"""Evaluate the v2 pipeline against the ground-truth test sheet.

  python evaluate_v2.py                 # all CRs
  python evaluate_v2.py --cr 1,6,18     # subset (by 'Sr No')
  python evaluate_v2.py --debug         # also store evidence + prompts in eval_results.json
  NO_CACHE=1 python evaluate_v2.py      # ignore the LLM cache
"""
import argparse
import json
from pathlib import Path

import pandas as pd

from common import JUDGE_MODEL, N_VOTES, REGS, db
from pipeline import evaluate_cr


def find_test_file(requested: str = None) -> Path:
    here = Path(__file__).resolve().parent
    if requested:
        p = Path(requested)
        if p.is_file():
            return p
        for base in (Path.cwd(), here, here.parent):
            candidate = base / requested
            if candidate.is_file():
                return candidate
        raise FileNotFoundError(f"Requested test file not found: {requested}")

    for d in (Path.cwd(), here, here.parent):
        for pat in ["UC 7*Test Data*.xlsx", "UC_7*Test_Cases*.xlsx", "*Test*.xlsx"]:
            for p in sorted(d.glob(pat)):
                if p.is_file():
                    return p
    raise FileNotFoundError("Test data xlsx not found")


def norm(v):
    if pd.isna(v):
        return None
    s = str(v).strip().lower()
    if s in ("yes", "y", "true"):
        return "Yes"
    if s in ("no", "n", "false") or "no relevant" in s:
        return "No"
    if "clarif" in s:
        return "Clarification needed"
    return str(v).strip()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--file", "-f", default=None, help="Path to test Excel or CSV file")
    ap.add_argument("--cr", default="", help="comma-separated Sr No values")
    ap.add_argument("--debug", action="store_true")
    args = ap.parse_args()
    only = {int(x) for x in args.cr.split(",") if x.strip()}
    import time
    t_suite_start = time.time()

    with db() as conn, conn.cursor() as cur:
        cur.execute("SELECT jurisdiction, source_type, COUNT(*) FROM regulatory_chunks GROUP BY 1,2 ORDER BY 1,2")
        print("DB contents:")
        have_specs = set()
        for j, t, n in cur.fetchall():
            print(f"  {j:7s} {t:16s} {n}")
            if t == "FIELD_SPEC":
                have_specs.add(j)
        for r in REGS:
            if r not in have_specs:
                print(f"  ⚠️  no FIELD_SPEC rows for {r} - run inspect_specs.py and re-ingest")

    path = find_test_file(args.file)
    df = pd.read_csv(path) if path.suffix.lower() == ".csv" else pd.read_excel(path)
    cols = {str(c).strip().lower(): c for c in df.columns}
    cr_col = next((cols[k] for k in ["change request", "cr", "cr_text", "prompt", "description"] if k in cols), None)
    sr_col = next((cols[k] for k in ["sr no", "sr_no", "id", "cr_id", "test_id", "sr.no"] if k in cols), None)
    complexity_col = next((cols[k] for k in ["complexity", "level"] if k in cols), None)

    if not cr_col:
        raise ValueError(f"Could not find a Change Request column in {path.name}. Available columns: {list(df.columns)}")

    print(f"\nTest file: {path.name} ({len(df)} rows) | judge={JUDGE_MODEL} | votes={N_VOTES}\n")

    results, cells = [], []
    for i, row in df.iterrows():
        cr_text = row.get(cr_col)
        if pd.isna(cr_text):
            continue
        sr = int(row[sr_col]) if sr_col and pd.notna(row.get(sr_col)) else i + 1
        if only and sr not in only:
            continue
        print("=" * 70)
        complexity_val = row.get(complexity_col, "") if complexity_col else ""
        print(f"CR {sr} ({complexity_val})")
        out = evaluate_cr(str(cr_text), debug=args.debug)
        by_reg = {t["regulation"]: t for t in out["compliance_table"]}
        cr_timing = out.get("timing", {})
        print(f"  ⏱  Decomposition: {cr_timing.get('analysis_ms', 0)} ms | End-to-End: {cr_timing.get('total_ms', 0) / 1000:.2f} s")
        row_ok = True
        for reg in REGS:
            raw_val = row.get(cols.get(reg.lower()))
            exp = norm(raw_val)
            act = by_reg[reg]["compliant"]
            if exp == "Clarification needed":
                ok = bool(out.get("cr_metadata", {}).get("is_ambiguous"))
            else:
                ok = exp is not None and act == exp
            row_ok &= ok
            cells.append({"cr": sr, "reg": reg, "expected": exp, "actual": act, "ok": ok,
                          "complexity": str(complexity_val)})
            flag = "✅" if ok else "❌"
            t_info = by_reg[reg].get("timing", {})
            t_str = f"({t_info.get('retrieval_ms', 0)}ms ret + {t_info.get('inference_ms', 0)}ms llm)"
            print(f"  {reg:7s} expected={str(exp):<5s} actual={str(act):<5s} {t_str:25s} {flag}")
            if by_reg[reg].get("sources_disagree"):
                print(f"      ⚠ sources disagree - needs human review: {by_reg[reg].get('source_values', '')[:200]}")
            if not ok:
                t = by_reg[reg]
                if act == "Error":
                    print(f"      ERROR: {t['reason_if_not_compliant'][:300]}")
                else:
                    if t.get("vote_errors"):
                        print(f"      (some judge calls failed: {t['vote_errors'][-1][:150]})")
                    print(f"      mapped fields: {t.get('mapped_fields')}  (catalog={t.get('catalog_size')})")
                    for f in t["findings"]:
                        if not f["supported"] == (exp == "Yes"):
                            print(f"      {f['req_id']} supported={f['supported']} field={f.get('field_name')} "
                                  f"spec_len={f.get('spec_max_length')} {f.get('numeric_check', '')}")
                            print(f"         {str(f.get('reasoning', ''))[:260]}")
        results.append({"cr": sr, "row_ok": row_ok, "output": out})

    if not cells:
        print("Nothing evaluated.")
        return
    n_ok = sum(c["ok"] for c in cells)
    print("\n" + "=" * 70)
    print(f"CELL ACCURACY: {n_ok}/{len(cells)} = {100 * n_ok / len(cells):.1f}%")
    print(f"ROW ACCURACY : {sum(r['row_ok'] for r in results)}/{len(results)} CRs fully correct")
    print("\nPer regulation:")
    for reg in REGS:
        cs = [c for c in cells if c["reg"] == reg]
        if cs:
            print(f"  {reg:7s} {sum(c['ok'] for c in cs)}/{len(cs)}")
    tp = sum(c["expected"] == "Yes" and c["actual"] == "Yes" for c in cells)
    tn = sum(c["expected"] == "No" and c["actual"] == "No" for c in cells)
    fp = sum(c["expected"] == "No" and c["actual"] == "Yes" for c in cells)
    fn = sum(c["expected"] == "Yes" and c["actual"] == "No" for c in cells)
    print(f"\nConfusion (Yes=positive): TP={tp} TN={tn} FP(said Yes, should be No)={fp} FN(said No, should be Yes)={fn}")

    print("\nFAILURE ANALYSIS")
    for c in cells:
        if c["ok"]:
            continue
        out = next(r["output"] for r in results if r["cr"] == c["cr"])
        t = next(x for x in out["compliance_table"] if x["regulation"] == c["reg"])
        print(f"\n--- CR {c['cr']} / {c['reg']}: expected {c['expected']}, got {c['actual']}")
        for f in t["findings"]:
            print(f"   {f['req_id']} supported={f['supported']} field={f.get('field_name')} "
                  f"spec_len={f.get('spec_max_length')} {f.get('numeric_check', '')}")
            print(f"      {str(f.get('reasoning', ''))[:350]}")
        if t.get("reason_if_not_compliant") and c["actual"] == "Error":
            print(f"   ERROR: {t['reason_if_not_compliant']}")

    Path("eval_results.json").write_text(json.dumps({"cells": cells, "results": results}, indent=2, default=str))
    print("\nSaved eval_results.json")

    # ------------------------------------------------------------------------- Historical run logging
    import time
    from datetime import datetime
    
    total_sec = round(time.time() - t_suite_start, 2)
    history_file = Path("eval_history.json")
    history = []
    if history_file.is_file():
        try:
            history = json.loads(history_file.read_text(encoding="utf-8"))
        except Exception:
            history = []

    test_num = len(history) + 1
    run_entry = {
        "test_number": test_num,
        "file": path.name,
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "model": JUDGE_MODEL,
        "cell_accuracy": f"{n_ok}/{len(cells)} ({100 * n_ok / len(cells):.1f}%)",
        "row_accuracy": f"{sum(r['row_ok'] for r in results)}/{len(results)}",
        "total_time_s": total_sec,
        "per_cr": [
            {
                "cr": r["cr"],
                "row_ok": r["row_ok"],
                "total_s": round(r["output"].get("timing", {}).get("total_ms", 0) / 1000, 2),
                "avg_ret_ms": round(sum(t.get("timing", {}).get("retrieval_ms", 0) for t in r["output"]["compliance_table"]) / max(1, len(REGS)), 1),
                "total_llm_s": round(sum(t.get("timing", {}).get("inference_ms", 0) for t in r["output"]["compliance_table"]) / 1000, 2)
            } for r in results
        ]
    }
    history.append(run_entry)
    history_file.write_text(json.dumps(history, indent=2), encoding="utf-8")

    # Also update eval_results.json with test metadata
    Path("eval_results.json").write_text(
        json.dumps({"test_number": test_num, "summary": run_entry, "cells": cells, "results": results}, indent=2, default=str),
        encoding="utf-8"
    )

    print("\n" + "=" * 92)
    print("HISTORICAL RUN PROGRESSION TRACKER (eval_history.json)")
    print(f"{'Test #':<8} | {'File':<26} | {'Model':<20} | {'Cells':<14} | {'Total Time':<10}")
    print("-" * 92)
    for h in history:
        f_name = str(h.get("file", "UC 7 - Test Data.xlsx"))[:26]
        print(f"Run {h.get('test_number', '?'):<4} | {f_name:<26} | {str(h.get('model', ''))[:20]:<20} | {h.get('cell_accuracy', ''):<14} | {h.get('total_time_s', 0):>6.1f}s")
    print("=" * 92)


if __name__ == "__main__":
    main()