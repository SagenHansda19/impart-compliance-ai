"""Run this BEFORE ingesting. Shows, for every Excel file/sheet, which header row and which
'field name' column the ingester will use, plus sample rows. If anything looks wrong, set
NAME_COL_OVERRIDE in ingest_v2.py (or paste this output back so it can be fixed)."""
import pandas as pd

from ingest_v2 import (CODE_SHEET_RE, SKIP_SHEET_RE, find_root, jurisdiction_for, pick_name_col, read_sheet)

root = find_root()
for path in sorted(root.glob("*.xlsx")):
    if path.name.startswith("~$") or "test data" in path.name.lower():
        continue
    print("=" * 100)
    print(f"{path.name}  ->  jurisdiction: {jurisdiction_for(path.name)}")
    xl = pd.ExcelFile(path)
    for sheet in xl.sheet_names:
        if SKIP_SHEET_RE.search(sheet):
            print(f"  [skip sheet] {sheet}")
            continue
        df, h = read_sheet(xl, sheet)
        if df is None or df.empty:
            print(f"  [empty] {sheet}")
            continue
        name_col = pick_name_col(df)
        kind = "VALIDATION" if "validation" in path.name.lower() else ("CODE_LIST" if CODE_SHEET_RE.search(sheet) else "FIELD_SPEC")
        print(f"\n  Sheet: {sheet!r}  rows={len(df)}  header_row_pos={h}  type={kind}")
        print(f"  columns: {list(df.columns)[:14]}")
        print(f"  NAME COLUMN -> {name_col!r}")
        print(f"  first names: {[str(v)[:40] for v in df[name_col].dropna().head(6)]}")