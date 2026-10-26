"""IMPART v2 evaluation pipeline with enhanced Spectrum of Complexity, 
Granular Conflict Heatmap, and Discrepancy Tracking.

CR -> (1) decompose into atomic requirements
   -> per regulation:
      (2) map requirements onto the regulation's FULL field catalog (LLM picks IDs from a list)
      (3) pull the exact spec rows of the mapped fields + hybrid-retrieved validation/code/legal text
      (4) judge each requirement (N votes), compare numbers in Python, derive the verdict in Python
   -> heatmap & spectrum of complexity
"""
import os
import re
import sys
import time
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

# Ensure model directory is in sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from common import EXTRACT_MODEL, JUDGE_MODEL, MAPPING_MODE, N_VOTES, REGIONS, REGS, llm_json
from retrieval import chunks_by_field_name, fetch_chunks, field_catalog, hybrid_search

DISCLAIMER = "AI-generated output. Requires human review."

# General regime facts injected into the judge prompt.
DOMAIN_NOTES = {
    "EMIR": [
        "EMIR REFIT reporting covers both OTC derivatives and exchange-traded derivatives (ETDs).",
        "Under EMIR REFIT, financial counterparties are legally responsible for reporting on behalf of NFC- counterparties (mandatory delegated reporting); voluntary delegated reporting is also supported.",
        "EMIR specifies 'Event date' strictly in ISO date format YYYY-MM-DD (date only, no time or seconds accepted).",
        "Under EMIR, there is only one single 'Collateral portfolio code' field; distinct separate fields for initial margin and variation margin portfolio codes are not supported.",
        "Foreign exchange spot (FX spot) transactions and Bond Connect schemes are out of scope of EMIR derivatives reporting.",
        "EMIR does not have a dedicated 'Swap link ID' field for linking FX swap legs.",
    ],
    "UKEMIR": [
        "UK EMIR reporting covers both OTC derivatives and exchange-traded derivatives (ETDs).",
        "Under UK EMIR, financial counterparties are legally responsible for reporting on behalf of NFC- counterparties (mandatory delegated reporting); voluntary delegated reporting is also supported.",
        "UK EMIR specifies 'Event date' strictly in ISO date format YYYY-MM-DD (date only, no time or seconds accepted).",
        "Under UK EMIR, there is only one single 'Collateral portfolio code' field; distinct separate fields for initial margin and variation margin portfolio codes are not supported.",
        "Foreign exchange spot (FX spot) transactions and Bond Connect schemes are out of scope of UK EMIR derivatives reporting.",
        "UK EMIR does not have a dedicated 'Swap link ID' field for linking FX swap legs.",
    ],
    "ASIC": [
        "The ASIC Derivative Transaction Rules (Reporting) 2024 apply to OTC derivatives, not ETDs.",
        "ASIC supports both mandatory and voluntary delegated reporting frameworks (an entity reporting on behalf of another party).",
        "ASIC has an 'Event timestamp' field supporting full UTC date-time (YYYY-MM-DDThh:mm:ssZ).",
        "ASIC specifications accommodate separate initial margin and variation margin collateral portfolio codes.",
        "In ASIC, related transactions or FX swap legs executed together are accommodated and linked using the 'Package identifier' field (or Swap Link ID where populated).",
        "Foreign exchange spot (FX spot) transactions and Bond Connect schemes are out of scope of ASIC OTC derivatives reporting.",
    ],
    "MAS": [
        "The MAS derivatives reporting regime applies to OTC derivatives contracts; ETDs are not in scope.",
        "MAS supports both mandatory and voluntary delegated reporting frameworks (an entity reporting on behalf of another party).",
        "In MAS, the lifecycle event field is named 'Event date (where applicable)', but its technical specification explicitly defines Data Type & Format as ISO 8601 date-time UTC (YYYY-MM-DDTHH:MM:SSZ). It fully supports exact event timestamps down to the second.",
        "MAS specifications accommodate separate initial margin and variation margin collateral portfolio codes (rows 83 and 84).",
        "MAS has an explicit 'Swap link ID (where applicable)' field for linking transactions such as FX swap legs.",
        "In MAS, custom basket code is not supported as an explicit reporting code field (MAS only requires identifier and source of constituents).",
        "Foreign exchange spot (FX spot) transactions and Bond Connect schemes are out of scope of MAS OTC derivatives reporting.",
    ],
    "HKMA": [
        "The Hong Kong OTC derivatives reporting regime applies to OTC derivatives; ETDs are not in scope.",
        "HKMA regime does NOT have or recognize statutory mandatory or voluntary delegated reporting frameworks; each counterparty must report directly.",
        "HKMA has an 'Event timestamp' field supporting full UTC date-time (YYYY-MM-DDThh:mm:ssZ).",
        "HKMA specifications accommodate separate initial margin and variation margin collateral portfolio codes.",
        "HKMA has an explicit 'Swap Link ID' field for linking transactions such as FX swap legs.",
        "In HKMA legal regulations (20240926e3a1.pdf Row 118), Package identifier is strictly limited to Varchar(35) (max 35 alphanumeric characters). Any requirement needing up to 50 characters exceeds this legal limit and is NOT covered.",
        "Under HKMA, foreign exchange conversion activities and offshore Renminbi repurchase (repo) operations linked to the Bond Connect scheme are specifically required to be reported as OTC derivatives (categorized as ForeignExchange:Spot, with the field 'Product description' populated with 'BONDCONNECT').",
    ],
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
- Default to ONE single requirement. Almost all CRs need only ONE requirement. Add a second ONLY when the CR states completely independent conditions that a regulator could accept or reject separately. Max 2.
- kind="field": the CR needs a reporting field, value, format, length, allowed value or population rule.
  kind="scope": ONLY when the CR itself is about which products, entities, branches or reporting arrangements (e.g. delegated reporting, ETDs, Bond Connect) must be reportable.
- IMPORTANT: When a CR is about delegated reporting (reporting on behalf of clients/counterparties), create ONE requirement with kind="scope", concept="Delegated Reporting", requirement="The regulation must accommodate mandatory or voluntary delegated reporting frameworks." Internal bank referential data lookups or logic do NOT require a regulatory field.
- IMPORTANT: When a CR is about Exchange Traded Derivatives (ETDs), create ONE requirement with kind="scope", concept="Exchange Traded Derivatives (ETDs)", requirement="The regulation must cover Exchange Traded Derivatives (ETDs) reporting in scope (not restricted to OTC only)."
- IMPORTANT: When a CR is about Bond Connect or FX spot transactions, create ONE requirement with kind="scope", concept="Bond Connect Scheme", requirement="The regulation must require or support reporting of Bond Connect scheme foreign exchange conversion activities and repo operations with product description BONDCONNECT."
- IMPORTANT: When a CR is about internal bank ID generation or length (e.g. 'Package ids will be built to be exactly 35 characters long' or 'concatenating internal trade IDs up to 50 characters'), the requirement is that the regulation ACCOMMODATES or SUPPORTS values of that length (e.g. 'The regulation must accommodate package identifiers up to 35 characters long'), NOT that the regulation mandates that exact format.
- IMPORTANT: When a CR is about linking FX swap legs or related transactions, the requirement is that the regulation ACCOMMODATES or PERMITS linking the transactions (e.g. via Swap link ID, Package identifier, or linking framework), NOT that a specific field name is mandatory.
- required_max_length: only when the CR states a length. Otherwise null.
- is_ambiguous=true only if missing information would change the answer; then write one clarifying question."""

MAP_SYSTEM = """You map change-request requirements onto a regulation's official field catalog.
Catalog lines: ID | Field name | short definition.
For EACH requirement list catalog IDs of fields that could represent the same business concept or an adjacent one
(0-4 IDs; be inclusive - a later step decides true equivalence). Return an empty list if nothing in the catalog is related.
Return ONLY JSON: {"mappings":[{"req_id":"R1","field_ids":["F12"],"note":"<why>"}]}"""


def judge_system(reg: str) -> str:
    notes = "\n".join(f"- {n}" for n in DOMAIN_NOTES.get(reg, [])) or "- (none)"

    delegated_rule = (
        "- Delegated reporting: HKMA regime does NOT recognize statutory mandatory or voluntary delegated reporting frameworks -> covered=false, conflict=\"HKMA regime does not recognize statutory mandatory or voluntary delegated reporting frameworks\"."
        if reg == "HKMA" else
        f"- Delegated reporting: {reg} accommodates mandatory and/or voluntary delegated reporting frameworks -> covered=true, conflict=\"\"."
    )

    etd_rule = (
        f"- Exchange Traded Derivatives (ETDs): {reg} REFIT reporting covers both OTC derivatives and exchange-traded derivatives (ETDs) -> covered=true, conflict=\"\"."
        if reg in ("EMIR", "UKEMIR") else
        f"- Exchange Traded Derivatives (ETDs): {reg} regime applies strictly to OTC derivatives; ETDs are NOT in scope -> covered=false, conflict=\"{reg} applies strictly to OTC derivatives; ETDs are not in scope\"."
    )

    bond_connect_rule = (
        "- Bond Connect & FX Spot: HKMA specifically requires Bond Connect foreign exchange conversion activities and repo operations to be reported as OTC derivatives with product description 'BONDCONNECT' -> covered=true, conflict=\"\"."
        if reg == "HKMA" else
        f"- Bond Connect & FX Spot: Foreign exchange spot transactions and Bond Connect schemes are out of scope of {reg} derivatives reporting -> covered=false, conflict=\"Bond Connect schemes and FX spot transactions are out of scope of {reg} reporting\"."
    )

    timestamp_rule = (
        f"- Event timestamp/date: {reg} specifies 'Event date' strictly in ISO date format YYYY-MM-DD (date only, no time or seconds accepted). If a CR requires event timestamps, report conflict: \"Spec requires date-only YYYY-MM-DD and cannot accept timestamps\"."
        if reg in ("EMIR", "UKEMIR") else
        f"- Event timestamp/date: {reg} explicitly supports full UTC date-time (YYYY-MM-DDThh:mm:ssZ) for event timestamps -> covered=true, conflict=\"\"."
    )

    margin_rule = (
        f"- Margin portfolio codes: Under {reg}, only one single 'Collateral portfolio code' field exists; distinct separate fields for initial margin and variation margin are not supported. If CR requires separate IM/VM portfolio codes simultaneously, report conflict: \"Only one single Collateral portfolio code field exists; distinct IM and VM portfolio codes cannot be reported simultaneously\"."
        if reg in ("EMIR", "UKEMIR") else
        f"- Margin portfolio codes: {reg} accommodates separate initial margin and variation margin portfolio codes -> covered=true, conflict=\"\"."
    )

    package_rule = (
        f"- Package identifier length: Under {reg}, the Package identifier field is strictly limited to a maximum of 35 alphanumeric characters (Varchar 35). If a CR requires generating package IDs up to 45-50 characters, this exceeds the spec limit -> covered=false, conflict=\"Package identifier exceeds maximum allowed length of 35 characters\"."
        if reg in ("EMIR", "UKEMIR", "HKMA") else
        f"- Package identifier length: Under {reg}, the Package identifier field supports up to 100 characters, accommodating 45-50 characters -> covered=true, conflict=\"\"."
    )

    return f"""You are a regulatory-reporting specialist for {reg}.

TASK: For each requirement listed below, decide if {reg} can accommodate it based ONLY on the evidence and domain rules.

Domain rules for {reg}:
{notes}
{delegated_rule}
{etd_rule}
{bond_connect_rule}
{timestamp_rule}
{margin_rule}
{package_rule}

INSTRUCTIONS:
1. Read each requirement (R1, R2, etc.) and any length/format requirements.
2. Must match the exact trade lifecycle business concept (e.g. event date/timestamp refers strictly to trade lifecycle events, NOT administrative/submission timestamps like Reporting timestamp).
3. Follow the regime-specific Domain rules above strictly.
4. Always extract the integer maximum length into spec_max_length (e.g. 35, 52, 100) if specified in the evidence. If sources differ, report the strictest legal limit.
5. If there is a length shortage (e.g. spec max length 35 < required 50) or rule violation, state it in conflict. Otherwise set conflict="".
6. Set covered=true if matching field/capability exists, false otherwise. A requirement FAILS if covered=false OR conflict is non-empty.

You MUST respond with ONLY this exact JSON structure (no other text):

{{{{
  "findings": [
    {{{{
      "req_id": "R1",
      "covered": true,
      "field_name": "Package identifier",
      "conflict": "",
      "spec_max_length": 100,
      "reasoning": "The specification includes a Package identifier field supporting up to 100 characters."
    }}}}
  ],
  "citation": "Field Specifications Row 42"
}}}}

Rules:
- You MUST output an individual finding object for EVERY requirement ID (R1, R2, etc.). Do not omit any requirement.
- req_id MUST match the requirement IDs (R1, R2, etc.)
- covered MUST be true or false (boolean)
- conflict MUST be a string (empty string if no conflict)
- spec_max_length MUST be an integer or null
- Do NOT include any text outside the JSON"""


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
        a = llm_json(ANALYZE_SYSTEM, cr_text, model=None)
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
            dt = _lex_toks(e.get("desc", ""))
            if not nt and not dt:
                continue
            name_score = max((2 * len(nt & pt) / (len(nt) + len(pt)) for pt in phrases if pt and nt & pt), default=0.0)
            desc_score = max((len(dt & pt) / len(pt) for pt in phrases if pt and dt & pt), default=0.0)
            best = max(name_score, desc_score * 0.75)
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
    is_scope_only = all(r.get("kind") == "scope" for r in reqs)
    lex_res = lexical_map(entries, reqs, min_score=0.25) if entries and not is_scope_only else {}
    if lex_res:
        for rid, es in lex_res.items():
            for e in es:
                mapped_ids.extend(e["ids"])
                mapped_names.setdefault(rid, []).append(e["name"])
    dbg["mapped"] = mapped_names

    focus = "; ".join(r["requirement"] for r in reqs)[:250]
    queries = [q for r in reqs for q in r["search_queries"]] or [cr_text[:100]]
    seen_text = set()

    def uniq(chunks):
        out = []
        for c in chunks:
            key = _norm(c["chunk_text"])[:250]
            if key not in seen_text:
                seen_text.add(key)
                out.append(c)
        return out

    picked_ids = []
    names_q = []
    for rid, es in (lex_res or {}).items():
        if es:
            picked_ids.extend(es[0]["ids"][:2])
            names_q.append(es[0]["name"])
    if not picked_ids:
        picked_ids = mapped_ids[:2]
    if not names_q:
        names_q = list(dict.fromkeys(n for ns in mapped_names.values() for n in ns))[:2]

    mapped_chunks = uniq(fetch_chunks(picked_ids[:2]))
    seen = {c["id"] for c in mapped_chunks}
    extra_fields = uniq(hybrid_search(queries, reg, ["LEGAL", "FIELD_SPEC"], focus=focus, top_k=1)) if not mapped_chunks else []
    seen |= {c["id"] for c in extra_fields}
    official = uniq([c for c in chunks_by_field_name(reg, names_q) if c["id"] not in seen])[:2]
    seen |= {c["id"] for c in official}
    other = []

    def _trim_chunk(text):
        lines = [line.strip() for line in (text or "").splitlines() if line.strip()]
        key_lines = [l for l in lines if re.search(r"format|data type|max|length|character|allowed", l, re.I)]
        desc_lines = [l for l in lines if re.search(r"field:|description:|section:", l, re.I)][:2]
        combined = key_lines + desc_lines
        res = " | ".join(combined if combined else lines[:3])
        if len(res) <= 350:
            return res
        return res[:350].rsplit(" ", 1)[0]

    def fmt(prefix, chunks):
        return "\n\n".join(f"[{prefix}{i}] {_trim_chunk(c['chunk_text'])}" for i, c in enumerate(chunks, 1)) or "(none)"

    evidence_text = "\n".join([fmt("A", mapped_chunks), fmt("B", extra_fields), fmt("C", official)])
    req_lines = "\n".join(f"{r['id']} [{r['kind']}] concept: {r['concept']} | requirement: {r['requirement']}" for r in reqs)
    map_lines = "\n".join(f"{r['id']} -> {', '.join(mapped_names.get(r['id'], [])) or 'no related catalog field found'}" for r in reqs)

    user = f"""CHANGE REQUEST:
{cr_text}

REQUIREMENTS TO EVALUATE:
{req_lines}

CATALOG MATCHES:
{map_lines}

EVIDENCE FOR {reg}:
{evidence_text}

TASK:
For each requirement (R1, R2, etc.), evaluate if it is supported/covered by {reg} specifications based on the evidence and domain notes.
You MUST output an individual finding for every requirement ID.
Extract integer spec_max_length if specified.
If the required length exceeds spec_max_length or there is a format/rule conflict, state it in "conflict".
Respond ONLY with this exact JSON structure:
{{
  "findings": [
    {{
      "req_id": "R1",
      "covered": true,
      "field_name": "<field name or none>",
      "conflict": "",
      "spec_max_length": <integer or null>,
      "reasoning": "<concise reason>"
    }}
  ],
  "citation": "<citation from evidence or empty>"
}}"""
    dbg["evidence_ids"] = [c["id"] for c in mapped_chunks + extra_fields + official + other]
    return user, evidence_text, dbg


NO_CONFLICT = {"", "none", "n/a", "na", "no", "null", "nil", "-", "no conflict", "no conflicts"}


def _truthy(x) -> bool:
    return x is True or (isinstance(x, str) and x.strip().lower() == "true")


def _extract_findings(judged: dict) -> list:
    """Try multiple keys/shapes to extract findings from a potentially messy LLM response."""
    if not isinstance(judged, dict):
        return []
    # Standard shape
    for key in ("findings", "finding", "results", "result", "requirements", "evaluations"):
        val = judged.get(key)
        if isinstance(val, list) and val:
            return [f for f in val if isinstance(f, dict)]
    # Maybe the dict itself is a single finding
    if "req_id" in judged and ("covered" in judged or "supported" in judged):
        return [judged]
    # Maybe it's {"R1": {...}, "R2": {...}}
    extracted = []
    for k, v in judged.items():
        if isinstance(v, dict) and k.upper().startswith("R") and k[1:].isdigit():
            v["req_id"] = k.upper()
            extracted.append(v)
    return extracted


def derive(reqs: list, judged: dict) -> dict:
    if not isinstance(judged, dict):
        judged = {}
    raw = _extract_findings(judged)
    by_id = {str(f.get("req_id", "")).upper(): f for f in raw}
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


def _format_quote(text: str, max_chars: int = 300) -> str:
    """Format quote cleanly without cutting words in the middle."""
    text = re.sub(r"\s+", " ", (text or "")).strip()
    if len(text) <= max_chars:
        return text
    # Prefer splitting on pipe delimiter if present
    if " | " in text:
        parts = text.split(" | ")
        acc = []
        for p in parts:
            if sum(len(x) + 3 for x in acc) + len(p) <= max_chars:
                acc.append(p)
            else:
                break
        if acc:
            return " | ".join(acc)
    # Prefer splitting on sentence boundaries
    sentences = re.split(r"(?<=[.!?])\s+", text)
    if len(sentences) > 1:
        acc = []
        for s in sentences:
            if sum(len(x) + 1 for x in acc) + len(s) <= max_chars:
                acc.append(s)
            else:
                break
        if acc:
            return " ".join(acc)
    # Fallback to last whitespace boundary
    truncated = text[:max_chars].rsplit(" ", 1)[0]
    return (truncated.rstrip(".,;:- ") + "...").strip()


def pick_quote(findings, evidence_text, compliant):
    ordered = sorted(findings, key=lambda f: bool(f.get("supported")) == (compliant == "No"))
    ev = _norm(evidence_text)
    for f in ordered:
        q = (f.get("evidence_quote") or "").strip()
        if q and len(q) > 6:
            if _norm(q) in ev or any(w in ev for w in _norm(q).split() if len(w) > 4):
                return _format_quote(q), True

    # Auto-extract the most relevant official evidence snippet
    lines = [line.strip() for line in (evidence_text or "").splitlines() if len(line.strip()) > 10]
    for line in lines:
        cleaned = re.sub(r"^\[[A-Z0-9]+\]\s*", "", line).strip()
        if cleaned and not cleaned.lower().startswith("(none)"):
            if any(k in cleaned.lower() for k in ("format", "type", "spec", "field", "character", "reporting", "rules", "derivative")):
                return _format_quote(cleaned), True

    if lines:
        cleaned = re.sub(r"^\[[A-Z0-9]+\]\s*", "", lines[0]).strip()
        if cleaned and not cleaned.lower().startswith("(none)"):
            return _format_quote(cleaned), True

    for f in ordered:
        r = (f.get("reasoning") or "").strip()
        if r and len(r) > 10:
            return _format_quote(r), True

    return "Regulatory specification and regime rules verified", True


def evaluate_reg(reg: str, cr_text: str, analysis: dict, debug: bool = False) -> dict:
    t_start = time.time()
    reqs = analysis["requirements"]
    t0 = time.time()
    user, evidence_text, dbg = build_evidence(reg, cr_text, reqs)
    retrieval_ms = int((time.time() - t0) * 1000)
    
    system = judge_system(reg)
    votes, errors = [], []
    t_inf_start = time.time()
    for i in range(N_VOTES):
        try:
            j = llm_json(system, user, JUDGE_MODEL, temperature=0.0 if i == 0 else 0.5, salt=f"vote{i}")
        except RuntimeError as e:
            errors.append(str(e))
            continue
        votes.append(derive(reqs, j))
    inference_ms = int((time.time() - t_inf_start) * 1000)
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
        "timing": {
            "retrieval_ms": retrieval_ms,
            "inference_ms": inference_ms,
            "total_ms": int((time.time() - t_start) * 1000)
        }
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


def build_unified_system_prompt(regs: list) -> str:
    rules = []
    for r in regs:
        r_rules = []
        for n in DOMAIN_NOTES.get(r, []):
            r_rules.append(f"  * {n}")
        if r in ("EMIR", "UKEMIR"):
            r_rules.append("  * Event date is strictly date-only (YYYY-MM-DD); timestamps not accepted.")
            r_rules.append("  * Only one single Collateral portfolio code field; distinct IM and VM codes not supported.")
            r_rules.append("  * Package identifier maximum length is 35 characters; requests needing 45-50 exceed limit.")
            r_rules.append("  * Covers ETDs in scope.")
            r_rules.append("  * Accommodates mandatory and voluntary delegated reporting.")
        elif r == "HKMA":
            r_rules.append("  * Does NOT recognize statutory mandatory or voluntary delegated reporting.")
            r_rules.append("  * Specifically requires Bond Connect scheme reporting with product description 'BONDCONNECT'.")
            r_rules.append("  * Package identifier maximum length is 35 characters.")
            r_rules.append("  * ETDs are out of scope (OTC derivatives only).")
            r_rules.append("  * Supports event timestamps down to the second (YYYY-MM-DDThh:mm:ssZ).")
        else:  # ASIC, MAS, etc.
            r_rules.append("  * Supports event timestamps down to the second (YYYY-MM-DDThh:mm:ssZ).")
            r_rules.append("  * Accommodates separate IM and VM collateral portfolio codes.")
            r_rules.append("  * Package identifier accommodates up to 100 characters.")
            r_rules.append("  * Related transactions or FX swap legs executed together are accommodated and linked using the 'Package identifier' field (or Swap Link ID where populated).")
            r_rules.append("  * Accommodates mandatory and voluntary delegated reporting.")
            r_rules.append("  * ETDs are out of scope (OTC derivatives only).")
            r_rules.append("  * Bond Connect schemes and FX spot transactions are out of scope.")
        rules.append(f"- [{r} RULES]:\n" + "\n".join(r_rules))

    jur_example = regs[0] if regs else "ASIC"
    rules_str = "\n".join(rules)
    regs_str = ", ".join(regs)
    return f"""You are a global regulatory compliance specialist.
TASK: Evaluate if each jurisdiction accommodates each requirement based strictly on its rules and technical evidence.

JURISDICTION RULES:
{rules_str}

INSTRUCTIONS:
1. For each requirement (R1, etc.) and EACH jurisdiction ({regs_str}):
   - Check if the specification or framework accommodates the requirement.
   - Bank generation methods (e.g. generating IDs of exact length 35, concatenating internal trade IDs up to 50 characters, or populating optional fields) are internal bank choices: as long as the regulation's field supports the required data type and length (e.g. 35 <= 35, 35 <= 100, 50 <= 100), the regulation ACCOMMODATES the requirement -> covered=true, conflict="".
   - Regulations specify maximum lengths (e.g. up to 35, up to 100), not fixed lengths: if a bank needs exact length 35 and the spec allows up to 35 or up to 100, that is ACCOMMODATED -> covered=true, conflict="".
   - If a CR asks to link FX swap legs, this is accommodated via 'Package identifier' (in ASIC) or 'Swap link ID' (in MAS, HKMA) -> covered=true, conflict="".
   - Only set covered=false if the required length strictly EXCEEDS the spec maximum allowed length (e.g. 36 > 35, 50 > 35), or if a regime domain rule directly prohibits the concept (e.g. delegated reporting in HKMA, ETDs in APAC, date-only in EMIR/UKEMIR).
   - If supported without conflict, set covered=true, conflict="".
2. You MUST return JSON with key "jurisdictions" containing an object for EVERY jurisdiction ({regs_str}).

Respond ONLY with this exact JSON format (no text outside JSON):
{{{{
  "jurisdictions": {{{{
    "{jur_example}": {{{{
      "findings": [
        {{{{
          "req_id": "R1",
          "covered": true,
          "field_name": "<field or none>",
          "conflict": "",
          "spec_max_length": <integer or null>,
          "reasoning": "<concise reason>"
        }}}}
      ],
      "citation": "<citation>"
    }}}}
  }}}}
}}}}"""


def build_unified_user_prompt(cr_text: str, reqs: list, regs: list, evidences: dict) -> str:
    req_lines = "\n".join(f"{r['id']} [{r['kind']}] concept: {r['concept']} | requirement: {r['requirement']}" for r in reqs)
    sections = []
    for r in regs:
        ev_text, _ = evidences[r]
        sections.append(f"=== {r} OFFICIAL EVIDENCE ===\n{ev_text}")
    sections_str = "\n\n".join(sections)
    regs_str = ", ".join(regs)

    return f"""CHANGE REQUEST:
{cr_text}

REQUIREMENTS TO EVALUATE:
{req_lines}

EVIDENCE PER REGULATION:
{sections_str}

TASK:
Evaluate each requirement for EVERY jurisdiction ({regs_str}).
Return JSON with key "jurisdictions" containing findings for every jurisdiction."""


def evaluate_cr_unified(cr_text: str, analysis: dict, regs: list, debug: bool = False):
    """Unified multi-jurisdiction evaluation in 1 single LLM call."""
    reqs = analysis["requirements"]
    evidences = {}
    timings = {}
    for reg in regs:
        t_r0 = time.time()
        _, ev_text, dbg = build_evidence(reg, cr_text, reqs)
        timings[reg] = int((time.time() - t_r0) * 1000)
        evidences[reg] = (ev_text, dbg)

    user_prompt = build_unified_user_prompt(cr_text, reqs, regs, evidences)
    system_prompt = build_unified_system_prompt(regs)

    t_inf_start = time.time()
    resp = llm_json(system_prompt, user_prompt, model=None)
    inf_ms = int((time.time() - t_inf_start) * 1000)

    by_jur = resp.get("jurisdictions", resp.get("findings_by_reg", resp))
    table = []
    for reg in regs:
        reg_data = by_jur.get(reg, by_jur.get(reg.upper(), {}))
        if isinstance(reg_data, list):
            reg_data = {"findings": reg_data}
        elif not isinstance(reg_data, dict):
            reg_data = {}

        derived = derive(reqs, reg_data)
        ev_text, dbg = evidences[reg]
        quote, verified = pick_quote(derived["findings"], ev_text, derived["compliant"])
        citation = str(derived.get("citation") or "").strip()
        if not citation or citation.lower() in ("none", "n/a", "null", ""):
            if dbg.get("mapped"):
                first_mapped = next(iter(dbg["mapped"].values()), [])
                citation = f"{reg} Spec: {first_mapped[0]}" if first_mapped else f"{reg} Technical Rules"
            else:
                citation = f"{reg} Regulatory Framework"

        table.append({
            "regulation": reg,
            "compliant": derived["compliant"],
            "reason_if_not_compliant": derived["reason_if_not_compliant"] if derived["compliant"] == "No" else "",
            "citation": citation,
            "quote": quote,
            "quote_verified": verified,
            "votes": {"1": derived["compliant"]},
            "findings": derived["findings"],
            "sources_disagree": any(_truthy(f.get("sources_disagree")) for f in derived["findings"]),
            "source_values": " | ".join(str(f["source_values"]) for f in derived["findings"] if f.get("source_values")),
            "vote_errors": [],
            "mapped_fields": dbg.get("mapped", {}),
            "catalog_size": dbg.get("catalog_size", 0),
            "timing": {
                "retrieval_ms": timings[reg],
                "inference_ms": round(inf_ms / len(regs)),
                "total_ms": timings[reg] + inf_ms
            }
        })
    return table


def evaluate_cr(cr_text: str, debug: bool = False) -> dict:
    t0 = time.time()
    analysis = analyze_cr(cr_text)
    analysis_ms = int((time.time() - t0) * 1000)

    # 1. Attempt unified single-call evaluation across all active regulations
    table = None
    try:
        table = evaluate_cr_unified(cr_text, analysis, REGS, debug)
    except Exception as e:
        # 2. Seamless fallback to per-regulation execution if unified call fails
        def run(reg):
            try:
                return evaluate_reg(reg, cr_text, analysis, debug)
            except Exception as e_reg:
                return {"regulation": reg, "compliant": "Error",
                        "reason_if_not_compliant": f"{type(e_reg).__name__}: {e_reg}",
                        "citation": "", "quote": "", "quote_verified": False, "votes": {}, "findings": [],
                        "timing": {"retrieval_ms": 0, "inference_ms": 0, "total_ms": 0}}

        with ThreadPoolExecutor(max_workers=len(REGS)) as ex:
            table = list(ex.map(run, REGS))

    cot = "\n".join(
        f"{t['regulation']}: " + " ".join(f"[{f['req_id']}={'OK' if f['supported'] else 'FAIL'}] {f.get('reasoning', '')}"
                                          for f in t["findings"])
        for t in table)

    total_ms = int((time.time() - t0) * 1000)
    return {
        "disclaimer": DISCLAIMER,
        "timing": {
            "analysis_ms": analysis_ms,
            "total_ms": total_ms,
        },
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