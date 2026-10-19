"""IMPART v2 evaluation pipeline with enhanced Spectrum of Complexity, 
Granular Conflict Heatmap, and Discrepancy Tracking.

CR -> (1) decompose into atomic requirements
   -> per regulation:
      (2) map requirements onto the regulation's FULL field catalog (LLM picks IDs from a list)
      (3) pull the exact spec rows of the mapped fields + hybrid-retrieved validation/code/legal text
      (4) judge each requirement (N votes), compare numbers in Python, derive the verdict in Python
   -> heatmap & spectrum of complexity
"""
import re
from collections import Counter
from concurrent.futures import ThreadPoolExecutor

from common import EXTRACT_MODEL, JUDGE_MODEL, MAPPING_MODE, N_VOTES, REGIONS, REGS, llm_json
from retrieval import chunks_by_field_name, fetch_chunks, field_catalog, hybrid_search

DISCLAIMER = "AI-generated output. Requires human review."

# General regime facts injected into the judge prompt.
DOMAIN_NOTES = {
    "EMIR": [
        "EMIR REFIT reporting covers both OTC derivatives and exchange-traded derivatives (ETDs).",
        "Under EMIR REFIT, financial counterparties are legally responsible for reporting on behalf of "
        "NFC- counterparties (mandatory delegated reporting); other delegation arrangements are voluntary.",
    ],
    "UKEMIR": ["UK EMIR reporting covers both OTC derivatives and exchange-traded derivatives (ETDs)."],
    "ASIC": ["The ASIC Derivative Transaction Rules (Reporting) 2024 apply to OTC derivatives, not ETDs."],
    "MAS": ["The MAS derivatives reporting regime applies to OTC derivatives contracts; ETDs are not in scope."],
    "HKMA": ["The Hong Kong OTC derivatives reporting regime applies to OTC derivatives; ETDs are not in scope."],
}

ANALYZE_SYSTEM = """You are a regulatory-reporting business analyst. Turn a bank's Change Request (CR) into the MINIMUM set
of checkable requirements that a regulator's technical specification must be able to satisfy.

Return ONLY JSON:
{
  "is_ambiguous": false,
  "clarification_prompt": null,
  "summary": "<one sentence>",
  "requirements": [
    {
      "kind": "field" | "scope",
      "concept": "<regulatory data element or capability, in standard reporting terminology, 2-5 words>",
      "requirement": "<what must be true in the regulation for the CR to work, one sentence>",
      "required_max_length": <integer or null>,
      "search_queries": ["<5-10 word query>", "<another>"]
    }
  ]
}

Rules:
- Default to ONE requirement. Add a second or third ONLY when the CR states clearly independent conditions that a
  regulator could accept or reject separately. Max 3.
- kind="field": the CR needs a reporting field, value, format, length, allowed value or population rule.
  kind="scope": ONLY when the CR itself is about which products, entities, branches or reporting arrangements must be reportable.
- required_max_length: only when the CR states a length. Otherwise null.
- is_ambiguous=true only if missing information would change the answer; then write one clarifying question."""

MAP_SYSTEM = """You map change-request requirements onto a regulation's official field catalog.
Catalog lines: ID | Field name | short definition.
For EACH requirement list catalog IDs of fields that could represent the same business concept or an adjacent one
(0-4 IDs; be inclusive - a later step decides true equivalence). Return an empty list if nothing in the catalog is related.
Return ONLY JSON: {"mappings":[{"req_id":"R1","field_ids":["F12"],"note":"<why>"}]}"""


def judge_system(reg: str) -> str:
    notes = "\n".join(f"- {n}" for n in DOMAIN_NOTES.get(reg, [])) or "- (none)"
    return f"""You are a strict but fair regulatory-reporting specialist for {reg}. For each requirement decide whether
{reg} can accommodate it. Use ONLY the evidence supplied (field specification rows, validation rules, code lists,
legal text) plus these domain notes:
{notes}

For each requirement report two things:
- covered: kind="field" -> {reg} has a field/data element semantically equivalent to the concept.
            kind="scope" -> the regime's scope or reporting mechanism can represent the situation.
- conflict: a CONCRETE conflict between the CR and the specification, named or quoted, e.g. "spec max length 35 < 50",
  "field is date-only but CR needs a timestamp". Use an empty string if there is none.
A requirement fails only if covered=false or conflict is non-empty.

Return ONLY JSON:
{{"findings":[{{"req_id":"R1","covered":true,"field_name":"<name or null>","conflict":"","spec_max_length":null,
"spec_constraint":"<brief>","sources_disagree":false,"source_values":"","evidence_quote":"<verbatim>",
"reasoning":"<2-3 sentences>"}}],
"citation":"<document, sheet/row or page of the key evidence>"}}"""


def to_int(v):
    if v is None or isinstance(v, bool):
        return None
    if isinstance(v, (int, float)):
        return int(v)
    s = str(v)
    nums = [int(x) for x in re.findall(r"\d+", s)]
    if not nums:
        return None
    return sum(nums) if "+" in s else nums[0]


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", s or "").strip().lower()


def analyze_cr(cr_text: str) -> dict:
    try:
        a = llm_json(ANALYZE_SYSTEM, cr_text, EXTRACT_MODEL)
    except RuntimeError as e:
        a = {"analysis_error": str(e)}
    if not isinstance(a, dict):
        a = {"analysis_error": "model returned a non-object reply"}
    reqs = []
    raw_reqs = a.get("requirements")
    for r in (raw_reqs if isinstance(raw_reqs, list) else [])[:5]:
        if not isinstance(r, dict):
            continue
        reqs.append({
            "id": f"R{len(reqs) + 1}",
            "kind": "scope" if str(r.get("kind", "")).lower() == "scope" else "field",
            "concept": str(r.get("concept") or "")[:200],
            "requirement": str(r.get("requirement") or "")[:500],
            "required_max_length": to_int(r.get("required_max_length")),
            "search_queries": [str(q) for q in (r.get("search_queries") or []) if q][:3],
        })
    if not reqs:
        reqs = [{"id": "R1", "kind": "field", "concept": cr_text[:80], "requirement": cr_text[:400],
                 "required_max_length": None, "search_queries": [cr_text[:120]]}]
    a["requirements"] = reqs
    a.setdefault("summary", cr_text[:150])
    a["is_ambiguous"] = bool(a.get("is_ambiguous"))
    a.setdefault("clarification_prompt", None)
    return a


def _fid(x) -> str:
    s = str(x).strip().upper()
    return "F" + s if s.isdigit() else s


def _mapping_items(mp):
    if isinstance(mp, list):
        return [m for m in mp if isinstance(m, dict)], True
    if isinstance(mp, dict):
        for k in ("mappings", "mapping", "results", "requirements", "items"):
            if isinstance(mp.get(k), list):
                return [m for m in mp[k] if isinstance(m, dict)], True
        if "field_ids" in mp or "fields" in mp:
            return [mp], True
    return [], False


def _resolve_field(entries, name_index, x):
    if isinstance(x, dict):
        x = x.get("id") or x.get("name") or ""
    e = entries.get(_fid(x))
    return e or name_index.get(str(x).strip().lower())


_LEX_STOP = {"the", "and", "for", "of", "to", "in", "on", "per", "with", "where", "applicable", "field", "data", "element"}


def _lex_toks(text):
    return {t for t in re.findall(r"[a-z0-9]+", (text or "").lower()) if len(t) > 1 and t not in _LEX_STOP}


def lexical_map(entries, reqs, per_req=4, min_score=0.35):
    out = {}
    for r in reqs:
        phrases = [_lex_toks(p) for p in [r["concept"]] + r["search_queries"]]
        scored = []
        for e in entries.values():
            nt = _lex_toks(e["name"])
            if not nt:
                continue
            best = max((2 * len(nt & pt) / (len(nt) + len(pt)) for pt in phrases if pt and nt & pt), default=0.0)
            scored.append((best, e))
        scored.sort(key=lambda x: -x[0])
        picked = [e for sc, e in scored[:per_req] if sc >= min_score]
        if picked:
            out[r["id"]] = picked
    return out


def build_evidence(reg: str, cr_text: str, reqs: list):
    entries, catalog_text = field_catalog(reg)
    dbg = {"catalog_size": len(entries)}

    mapped_ids, mapped_names = [], {}
    if entries and MAPPING_MODE != "llm":
        for rid, es in lexical_map(entries, reqs).items():
            for e in es:
                mapped_ids.extend(e["ids"])
                mapped_names.setdefault(rid, []).append(e["name"])
    elif entries:
        name_index = {e["name"].strip().lower(): e for e in entries.values()}
        req_block = "\n".join(f"{r['id']} [{r['kind']}] {r['concept']} :: {r['requirement']}" for r in reqs)
        mp = {}
        try:
            mp = llm_json(MAP_SYSTEM, f"CATALOG for {reg}:\n{catalog_text}\n\nREQUIREMENTS:\n{req_block}", JUDGE_MODEL)
        except RuntimeError as e:
            dbg["mapping_error"] = f"mapping call failed: {e}"
        items, shape_ok = _mapping_items(mp)
        for m in items:
            ids = m.get("field_ids") or m.get("fields") or m.get("ids")
            ids = ids if isinstance(ids, list) else ([ids] if ids else [])
            for fid in ids:
                e = _resolve_field(entries, name_index, fid)
                if e:
                    mapped_ids.extend(e["ids"])
                    mapped_names.setdefault(m.get("req_id"), []).append(e["name"])
    dbg["mapped"] = mapped_names

    focus = "; ".join(r["requirement"] for r in reqs)[:400]
    queries = [q for r in reqs for q in r["search_queries"]] or [cr_text[:150]]
    seen_text = set()

    def uniq(chunks):
        out = []
        for c in chunks:
            key = _norm(c["chunk_text"])[:400]
            if key not in seen_text:
                seen_text.add(key)
                out.append(c)
        return out

    mapped_chunks = uniq(fetch_chunks(mapped_ids[:12]))
    seen = {c["id"] for c in mapped_chunks}
    extra_fields = uniq([c for c in hybrid_search(queries, reg, ["FIELD_SPEC"], focus=focus, top_k=5) if c["id"] not in seen])
    seen |= {c["id"] for c in extra_fields}
    names_q = list(dict.fromkeys(n for ns in mapped_names.values() for n in ns))[:4]
    official = uniq([c for c in chunks_by_field_name(reg, names_q) if c["id"] not in seen])
    seen |= {c["id"] for c in official}
    other = uniq([c for c in hybrid_search(queries + names_q, reg, ["VALIDATION_RULE", "CODE_LIST", "LEGAL"], focus=focus, top_k=6) if c["id"] not in seen])

    def fmt(prefix, chunks):
        return "\n\n".join(f"[{prefix}{i}] {c['chunk_text'][:1800]}" for i, c in enumerate(chunks, 1)) or "(none)"

    evidence_text = "\n".join([fmt("A", mapped_chunks), fmt("B", extra_fields), fmt("C", official + other)])
    req_lines = "\n".join(f"{r['id']} [{r['kind']}] concept: {r['concept']} | requirement: {r['requirement']}" for r in reqs)
    map_lines = "\n".join(f"{r['id']} -> {', '.join(mapped_names.get(r['id'], [])) or 'no related catalog field found'}" for r in reqs)
    all_names = "; ".join(e["name"] for e in entries.values()) or "(catalog empty)"
    
    user = f"""CHANGE REQUEST:\n{cr_text}\n\nREQUIREMENTS:\n{req_lines}\n\nALL FIELD NAMES IN {reg} ({len(entries)}): {all_names}\n\nCATALOG MAPPING:\n{map_lines}\n\nEVIDENCE A:\n{fmt("A", mapped_chunks)}\n\nEVIDENCE B:\n{fmt("B", extra_fields)}\n\nEVIDENCE C:\n{fmt("C", official + other)}"""
    dbg["evidence_ids"] = [c["id"] for c in mapped_chunks + extra_fields + official + other]
    return user, evidence_text, dbg


NO_CONFLICT = {"", "none", "n/a", "na", "no", "null", "nil", "-", "no conflict", "no conflicts"}


def _truthy(x) -> bool:
    return x is True or (isinstance(x, str) and x.strip().lower() == "true")


def derive(reqs: list, judged: dict) -> dict:
    if not isinstance(judged, dict):
        judged = {}
    raw = judged.get("findings")
    by_id = {str(f.get("req_id")): f for f in (raw if isinstance(raw, list) else []) if isinstance(f, dict)}
    findings, failing = [], []
    for r in reqs:
        f = dict(by_id.get(r["id"]) or {"req_id": r["id"], "reasoning": "No finding returned by judge."})
        conflict = str(f.get("conflict") or "").strip()
        has_conflict = conflict.lower().rstrip(". ") not in NO_CONFLICT
        if "covered" in f or "field_found" in f:
            sup = _truthy(f.get("covered", f.get("field_found"))) and not has_conflict
        else:
            sup = _truthy(f.get("supported"))
        need, have = r.get("required_max_length"), to_int(f.get("spec_max_length"))
        if r["kind"] == "field" and need is not None and have is not None:
            ok = have >= need
            f["numeric_check"] = f"CR needs {need}, spec allows {have} -> {'OK' if ok else 'EXCEEDS SPEC'}"
            if not ok:
                sup = False
        f["supported"] = sup
        f["req_id"] = r["id"]
        f["requirement"] = r["requirement"]
        findings.append(f)
        if not sup:
            failing.append(f)
    compliant = "No" if failing else "Yes"

    def why(f):
        if f.get("numeric_check") and "EXCEEDS" in f["numeric_check"]:
            sv = str(f.get("source_values") or "").strip()
            return f["numeric_check"] + (f" (sources: {sv})" if sv else "")
        if str(f.get("conflict") or "").strip().lower().rstrip(". ") not in NO_CONFLICT:
            return str(f["conflict"])
        return f.get("reasoning", "")

    reason = " | ".join(f"{f['req_id']}: {why(f)}" for f in failing)
    return {"compliant": compliant, "reason_if_not_compliant": reason, "findings": findings, "citation": str(judged.get("citation") or "")}


def pick_quote(findings, evidence_text, compliant):
    ordered = sorted(findings, key=lambda f: bool(f["supported"]) == (compliant == "No"))
    ev = _norm(evidence_text)
    for f in ordered:
        q = (f.get("evidence_quote") or "").strip()
        if q:
            return q, _norm(q) in ev
    return "", False


def evaluate_reg(reg: str, cr_text: str, analysis: dict, debug: bool = False) -> dict:
    reqs = analysis["requirements"]
    user, evidence_text, dbg = build_evidence(reg, cr_text, reqs)
    system = judge_system(reg)
    votes, errors = [], []
    for i in range(N_VOTES):
        try:
            j = llm_json(system, user, JUDGE_MODEL, temperature=0.0 if i == 0 else 0.5, salt=f"vote{i}")
        except RuntimeError as e:
            errors.append(str(e))
            continue
        votes.append(derive(reqs, j))
    if not votes:
        raise RuntimeError(f"all judge calls failed for {reg}: {errors[-1] if errors else '?'}")
    tally = Counter(v["compliant"] for v in votes)
    winner = tally.most_common(1)[0][0]
    chosen = next(v for v in votes if v["compliant"] == winner)
    quote, verified = pick_quote(chosen["findings"], evidence_text, winner)
    out = {
        "regulation": reg,
        "compliant": winner,
        "reason_if_not_compliant": chosen["reason_if_not_compliant"] if winner == "No" else "",
        "citation": chosen["citation"],
        "quote": quote,
        "quote_verified": verified,
        "votes": dict(tally),
        "findings": chosen["findings"],
        "sources_disagree": any(_truthy(f.get("sources_disagree")) for f in chosen["findings"]),
        "source_values": " | ".join(str(f["source_values"]) for f in chosen["findings"] if f.get("source_values")),
        "vote_errors": errors,
        "mapped_fields": dbg.get("mapped", {}),
        "catalog_size": dbg.get("catalog_size", 0),
    }
    if dbg.get("mapping_error"):
        out["mapping_error"] = dbg["mapping_error"]
    if debug:
        out["_debug"] = {**dbg, "evidence": evidence_text, "judge_user_prompt": user}
    return out


def heatmap(table: list) -> dict:
    def risk(n):
        return "High Risk" if n > 1 else "Moderate Risk" if n == 1 else "Safe to Implement"
    out = {}
    for region, regs in REGIONS.items():
        reg_results = [t for t in table if t["regulation"] in regs]
        bad = [t["regulation"] for t in reg_results if t["compliant"] != "Yes"]
        conflict_types = {}
        for t in reg_results:
            for f in t.get("findings", []):
                if not f.get("supported"):
                    c_type = "length_exceeded" if f.get("numeric_check") and "EXCEEDS" in f["numeric_check"] else "specification_conflict"
                    conflict_types[c_type] = conflict_types.get(c_type, 0) + 1
        out[region] = {
            "affected_regulations": regs,
            "non_compliant": bad,
            "risk_status": risk(len(bad)),
            "conflict_breakdown": conflict_types
        }
    return out


def spectrum_of_complexity(reqs: list, table: list) -> list:
    spectrum = []
    for r in reqs:
        severity = "Low"
        reason = "Standard field/scope mapping"
        if r["required_max_length"]:
            severity = "Medium"
            reason = f"Requires length validation limit: {r['required_max_length']}"
        
        failing_regs = [t["regulation"] for t in table if any(not f.get("supported") and f.get("req_id") == r["id"] for f in t.get("findings", []))]
        if failing_regs:
            severity = "Critical"
            reason = f"Conflict detected in regulation(s): {', '.join(failing_regs)}"

        spectrum.append({
            "requirement_id": r["id"],
            "concept": r["concept"],
            "kind": r["kind"],
            "severity": severity,
            "reason": reason,
            "required_max_length": r.get("required_max_length")
        })
    return spectrum


def evaluate_cr(cr_text: str, debug: bool = False) -> dict:
    analysis = analyze_cr(cr_text)

    def run(reg):
        try:
            return evaluate_reg(reg, cr_text, analysis, debug)
        except Exception as e:
            return {"regulation": reg, "compliant": "Error",
                    "reason_if_not_compliant": f"{type(e).__name__}: {e}",
                    "citation": "", "quote": "", "quote_verified": False, "votes": {}, "findings": []}

    with ThreadPoolExecutor(max_workers=len(REGS)) as ex:
        table = list(ex.map(run, REGS))

    cot = "\n".join(
        f"{t['regulation']}: " + " ".join(f"[{f['req_id']}={'OK' if f['supported'] else 'FAIL'}] {f.get('reasoning', '')}"
                                          for f in t["findings"])
        for t in table)
    
    return {
        "disclaimer": DISCLAIMER,
        "cr_metadata": {
            "is_ambiguous": analysis["is_ambiguous"],
            "clarification_prompt": analysis["clarification_prompt"],
            "summary": analysis["summary"],
            "requirements": analysis["requirements"]
        },
        "chain_of_thought_explanation": cot,
        "compliance_table": table,
        "conflict_heatmap": heatmap(table),
        "spectrum_of_complexity": spectrum_of_complexity(analysis["requirements"], table),
        "source_discrepancies": [
            {
                "regulation": t["regulation"],
                "source_values": t["source_values"]
            } for t in table if t.get("sources_disagree")
        ]
    }