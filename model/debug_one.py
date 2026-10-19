"""Deep-dive one CR x one regulation: shows the decomposition, field mapping, exact evidence and the judge's findings.
   python debug_one.py 1 ASIC
   python debug_one.py 6 MAS"""
import json
import sys

import pandas as pd

from evaluate_v2 import find_test_file
from pipeline import analyze_cr, evaluate_reg

sr, reg = int(sys.argv[1]), sys.argv[2].upper()
df = pd.read_excel(find_test_file())
cols = {str(c).strip().lower(): c for c in df.columns}
row = df[df[cols["sr no"]] == sr].iloc[0]
cr = str(row[cols["change request"]])
print(f"Expected for {reg}: {row[cols[reg.lower()]]}\n")

analysis = analyze_cr(cr)
print("REQUIREMENTS:")
print(json.dumps(analysis["requirements"], indent=2))
if analysis.get("analysis_error"):
    sys.exit(f"ANALYSIS ERROR (stopping - fix the model/key first): {analysis['analysis_error']}")

out = evaluate_reg(reg, cr, analysis, debug=True)
dbg = out.pop("_debug")
print(f"\nCATALOG SIZE: {dbg['catalog_size']}   MAPPED: {json.dumps(dbg['mapped'])}")
if dbg.get("mapping_error"):
    print("MAPPING ERROR:", dbg["mapping_error"])
print("\n================ EVIDENCE GIVEN TO JUDGE ================")
print(dbg["evidence"][:9000])
print("\n================ VERDICT ================")
print(json.dumps({k: v for k, v in out.items() if k != "findings"}, indent=2))
for f in out["findings"]:
    print(json.dumps(f, indent=2))