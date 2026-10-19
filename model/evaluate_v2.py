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


def find_test_file() -> Path:
    here = Path(__file__).resolve().parent
    for d in (here, here.parent):
        for p in d.glob("UC 7*Test Data*.xlsx"):
            return p
    raise FileNotFoundError("Test data xlsx not found")


def norm(v):
    s = str(v).strip().lower()
    return "Yes" if s in ("yes", "y", "true") else "No" if s in ("no", "n", "false") else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--cr", default="", help="comma-separated Sr No values")
    ap.add_argument("--debug", action="store_true")
    args = ap.parse_args()
    only = {int(x) for x in args.cr.split(",") if x.strip()}

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

    path = find_test_file()
    df = pd.read_excel(path)
    cols = {str(c).strip().lower(): c for c in df.columns}
    cr_col, sr_col = cols.get("change request"), cols.get("sr no")
    print(f"\nTest file: {path.name} | judge={JUDGE_MODEL} | votes={N_VOTES}\n")

    results, cells = [], []
    for i, row in df.iterrows():
        cr_text = row.get(cr_col)
        if pd.isna(cr_text):
            continue
        sr = int(row[sr_col]) if sr_col and pd.notna(row.get(sr_col)) else i + 1
        if only and sr not in only:
            continue
        print("=" * 70)
        print(f"CR {sr} ({row.get(cols.get('complexity'), '')})")
        out = evaluate_cr(str(cr_text), debug=args.debug)
        by_reg = {t["regulation"]: t for t in out["compliance_table"]}
        row_ok = True
        for reg in REGS:
            exp = norm(row.get(cols.get(reg.lower())))
            act = by_reg[reg]["compliant"]
            ok = exp is not None and act == exp
            row_ok &= ok
            cells.append({"cr": sr, "reg": reg, "expected": exp, "actual": act, "ok": ok,
                          "complexity": str(row.get(cols.get("complexity"), ""))})
            flag = "✅" if ok else "❌"
            print(f"  {reg:7s} expected={exp} actual={act} votes={by_reg[reg]['votes']} {flag}")
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


if __name__ == "__main__":
    main()