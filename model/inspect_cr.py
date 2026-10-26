"""Interactive CR Inspection Tool for IMPART v2.
Inspect the exact metadata, retrieved database chunks, full LLM prompts, and citations.

Usage:
  .venv/bin/python model/inspect_cr.py 1
  .venv/bin/python model/inspect_cr.py 21 --file UC_7_-_Test_Cases.xlsx
  .venv/bin/python model/inspect_cr.py "Our booking system generates 50-char package IDs..."
"""
import argparse
import json
import sys
from pathlib import Path

# Add model directory to path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from common import JUDGE_MODEL, JUDGE_MODELS, REGS, db
from evaluate_v2 import find_test_file, norm
from pipeline import (
    ANALYZE_SYSTEM,
    analyze_cr,
    build_evidence,
    build_unified_system_prompt,
    build_unified_user_prompt,
    derive,
    evaluate_cr,
    pick_quote,
)


def inspect_single_cr(cr_text: str, sr: int = None, complexity: str = None, expected: dict = None):
    print("=" * 80)
    print(f"🔬 IMPART COMPLIANCE AI: CR DEEP INSPECTION {'[CR ' + str(sr) + ']' if sr else ''}")
    print("=" * 80)
    print(f"\n📌 RAW CHANGE REQUEST:\n{cr_text.strip()}\n")
    if complexity:
        print(f"📊 Complexity Level: {complexity}")
    if expected:
        print(f"🎯 Expected Verdicts: {expected}")

    # -------------------------------------------------------------------------
    # STEP 1: DECOMPOSITION & METADATA EXTRACTION
    # -------------------------------------------------------------------------
    print("\n" + "-" * 80)
    print("STEP 1: CHANGE REQUEST DECOMPOSITION (LLM Analysis)")
    print("-" * 80)
    analysis = analyze_cr(cr_text)
    print(f"Is Ambiguous: {analysis.get('is_ambiguous')}")
    if analysis.get('clarification_prompt'):
        print(f"Clarification Prompt: {analysis.get('clarification_prompt')}")
    print(f"Summary: {analysis.get('summary')}")
    print("\nExtracted Requirements:")
    for r in analysis.get("requirements", []):
        print(f"  [{r['id']}] Kind: {r['kind']} | Concept: {r['concept']}")
        print(f"       Requirement: {r['requirement']}")
        print(f"       Required Max Length: {r.get('required_max_length')}")
        print(f"       Search Queries: {r.get('search_queries')}")

    # -------------------------------------------------------------------------
    # STEP 2: DATABASE RETRIEVAL & EVIDENCE MAPPING
    # -------------------------------------------------------------------------
    print("\n" + "-" * 80)
    print("STEP 2: DATABASE RETRIEVAL PER REGULATION (Field Specs & Legal Chunks)")
    print("-" * 80)
    reqs = analysis["requirements"]
    evidences = {}
    for reg in REGS:
        print(f"\n📂 [{reg}] Official Regulatory Evidence Retrieved:")
        _, ev_text, dbg = build_evidence(reg, cr_text, reqs)
        evidences[reg] = (ev_text, dbg)
        mapped = dbg.get("mapped", {})
        print(f"   • Catalog Matches: {mapped if mapped else 'None'}")
        print(f"   • Catalog Size: {dbg.get('catalog_size', 0)} fields indexed")
        print(f"   • Snippets Sent to Judge:")
        for line in ev_text.splitlines():
            if line.strip():
                print(f"     {line[:120]}")

    # -------------------------------------------------------------------------
    # STEP 3: PROMPT CONSTRUCTION
    # -------------------------------------------------------------------------
    print("\n" + "-" * 80)
    print("STEP 3: PROMPT SENT TO UNIFIED LLM JUDGE")
    print("-" * 80)
    user_prompt = build_unified_user_prompt(cr_text, reqs, REGS, evidences)
    system_prompt = build_unified_system_prompt(REGS)

    print("--- [SYSTEM PROMPT (Rules & Schema)] ---")
    print(system_prompt[:600] + "\n... [truncated for display] ...\n")
    print("--- [USER PROMPT (Requirements & Consolidated Evidence)] ---")
    print(user_prompt[:800] + "\n... [truncated for display] ...\n")

    # -------------------------------------------------------------------------
    # STEP 4: EVALUATION EXECUTION & CITATIONS
    # -------------------------------------------------------------------------
    print("-" * 80)
    print("STEP 4: MODEL EVALUATION, CITATIONS & DECISIONS")
    print("-" * 80)
    out = evaluate_cr(cr_text, debug=True)
    table = out["compliance_table"]

    print(f"{'Jurisdiction':<14} | {'Compliant':<10} | {'Expected':<10} | {'Citation / Quote':<40}")
    print("-" * 80)
    for t in table:
        reg = t["regulation"]
        act = t["compliant"]
        exp = expected.get(reg, "-") if expected else "-"
        cit = t.get("citation") or "None"
        quote = t.get("quote") or ""
        cit_display = f"{cit} ('{quote[:25]}...')" if quote else cit
        match_icon = "✅" if exp == "-" or act == exp else "❌"
        print(f"{reg:<14} | {act:<10} | {str(exp):<10} | {cit_display:<40} {match_icon}")
        for f in t.get("findings", []):
            print(f"   ↳ {f.get('req_id')}: supported={f.get('supported')} field='{f.get('field_name')}' spec_len={f.get('spec_max_length')}")
            print(f"     Reasoning: {f.get('reasoning')}")
            if f.get("conflict"):
                print(f"     ⚠️ Conflict: {f.get('conflict')}")

    print("\n" + "=" * 80)


def main():
    ap = argparse.ArgumentParser(description="Inspect raw inputs, metadata, prompts, and citations for any Change Request.")
    ap.add_argument("cr_input", nargs="?", default="1", help="Sr No (e.g. 1, 15, 21) or raw text of the Change Request")
    ap.add_argument("--file", "-f", default=None, help="Path to test Excel/CSV file")
    args = ap.parse_args()

    # If cr_input is an integer, look it up in the test file
    if args.cr_input.isdigit():
        sr_target = int(args.cr_input)
        path = find_test_file(args.file)
        import pandas as pd
        df = pd.read_csv(path) if path.suffix.lower() == ".csv" else pd.read_excel(path)
        cols = {str(c).strip().lower(): c for c in df.columns}
        cr_col = next((cols[k] for k in ["change request", "cr", "cr_text", "prompt", "description"] if k in cols), None)
        sr_col = next((cols[k] for k in ["sr no", "sr_no", "id", "cr_id", "test_id", "sr.no"] if k in cols), None)
        complexity_col = next((cols[k] for k in ["complexity", "level"] if k in cols), None)

        matched_row = None
        for i, row in df.iterrows():
            sr = int(row[sr_col]) if sr_col and pd.notna(row.get(sr_col)) else i + 1
            if sr == sr_target:
                matched_row = row
                break

        if matched_row is None:
            print(f"CR with Sr No {sr_target} not found in {path.name}.")
            return

        cr_text = str(matched_row[cr_col])
        complexity = str(matched_row.get(complexity_col, "")) if complexity_col else ""
        expected = {reg: norm(matched_row.get(cols.get(reg.lower()))) for reg in REGS}
        inspect_single_cr(cr_text, sr=sr_target, complexity=complexity, expected=expected)
    else:
        inspect_single_cr(args.cr_input)


if __name__ == "__main__":
    main()
