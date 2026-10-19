"""V2 ingestion.

Fixes vs the previous version:
  * explicit file -> jurisdiction mapping (nothing silently becomes 'GLOBAL'; unmapped files are reported)
  * Excel header-row detection (spec sheets usually have title rows above the real header)
  * the real FIELD NAME is stored in clause_or_field and the raw row in meta (needed for the field catalog)
  * sheets/files typed as FIELD_SPEC / CODE_LIST / VALIDATION_RULE so retrieval can target them
  * legal PDFs chunked on headings (Article/Section/numbered) with page numbers kept
  * re-runnable per file (deletes that document's old chunks first)
"""
import json
import re
import sys
from pathlib import Path

import pandas as pd
from psycopg2.extras import execute_values

from common import db, embed_docs, vec_literal

try:
    from pypdf import PdfReader
except ImportError:  # pragma: no cover
    from PyPDF2 import PdfReader

# ----------------------------------------------------------------------------- mapping
# ORDER MATTERS: first match wins ("ukemir_field" must come before "emir_field").
FILE_RULES = [
    ("ukemir_field", "UKEMIR"), ("uk-emir", "UKEMIR"), ("ps23", "UKEMIR"), ("standards-instrument", "UKEMIR"),
    ("emir_field", "EMIR"), ("esma", "EMIR"), ("celex", "EMIR"),
    ("asic", "ASIC"), ("f2025c01094", "ASIC"),
    ("mas_field", "MAS"), ("securities and futures", "MAS"),
    ("faqs on the securities", "MAS"), ("guidelines to the securities", "MAS"),
    ("hkma_field", "HKMA"), ("sri ver", "HKMA"), ("frequently asked questions", "HKMA"),
]
# Fill these in after checking what the file is (e.g. 20240926e3a1.pdf was not mappable by name).
MANUAL_MAP = {
    "20240926e3a1.pdf": "HKMA",   # HK joint consultation conclusions (UTI/UPI/CDE) - relevant
}
SKIP_FILE_SUBSTRINGS = ["test data"]          # add e.g. "securities and futures act 2001" if it adds noise
SKIP_SHEET_RE = re.compile(r"change ?log|version|history|readme|cover|contents|instruction|notification|"
                           r"document overview|^changes$|example|non-field|general information", re.I)
CODE_SHEET_RE = re.compile(r"code ?list|codes|enumer|lookup|allowed|valid values|taxonomy", re.I)
# (filename, sheet) -> exact column holding the field name; use after running inspect_specs.py
NAME_COL_OVERRIDE = {}

NAME_HINTS = ["field name", "label", "element name", "field", "data element", "name", "attribute", "item", "element"]


def jurisdiction_for(filename: str):
    if filename in MANUAL_MAP:
        return MANUAL_MAP[filename]
    n = filename.lower()
    for sub, jur in FILE_RULES:
        if sub in n:
            return jur
    return None


# ----------------------------------------------------------------------------- Excel
def cell_str(v) -> str:
    if v is None or (isinstance(v, float) and pd.isna(v)) or v is pd.NaT:
        return ""
    if isinstance(v, float) and v.is_integer():
        return str(int(v))
    if isinstance(v, pd.Timestamp):
        return v.date().isoformat()
    return re.sub(r"\s+", " ", str(v)).strip()


def detect_header_row(raw: pd.DataFrame, max_scan: int = 25) -> int:
    scan = raw.iloc[:max_scan]
    counts = scan.notna().sum(axis=1)
    max_count = counts.max() if len(counts) else 0
    best_i, best_score = 0, -1e9
    for i in range(len(scan)):
        vals = [cell_str(v) for v in scan.iloc[i]]
        vals = [v for v in vals if v]
        if len(vals) < max(2, 0.5 * max_count):
            continue
        long_cells = sum(len(v) > 80 for v in vals)
        numeric = sum(bool(re.fullmatch(r"[\d.,\-]+", v)) for v in vals)
        score = len(set(vals)) - 3 * long_cells - 2 * numeric - 0.05 * i
        if score > best_score:
            best_i, best_score = i, score
    return best_i


def read_sheet(xl: pd.ExcelFile, sheet: str):
    raw = pd.read_excel(xl, sheet_name=sheet, header=None, dtype=object)
    raw = raw.dropna(how="all").dropna(axis=1, how="all")
    if raw.empty:
        return None, None
    h_pos = detect_header_row(raw.reset_index(drop=True))
    header_vals = list(raw.iloc[h_pos])
    header, seen = [], {}
    for j, v in enumerate(header_vals):
        name = cell_str(v) or f"col{j}"
        seen[name] = seen.get(name, 0) + 1
        header.append(name if seen[name] == 1 else f"{name} ({seen[name]})")
    df = raw.iloc[h_pos + 1:].copy()
    df.columns = header
    return df, h_pos


def _looks_like_name(series: pd.Series) -> bool:
    vals = [cell_str(v) for v in series.dropna().head(60)]
    vals = [v for v in vals if v]
    if not vals:
        return False
    numeric = sum(bool(re.fullmatch(r"[\d.\-]+", v)) for v in vals) / len(vals)
    avg_len = sum(len(v) for v in vals) / len(vals)
    return numeric < 0.5 and 3 <= avg_len <= 60   # long prose columns are guidance text, not names


def pick_name_col(df: pd.DataFrame):
    cols = list(df.columns)
    for hint in NAME_HINTS:
        for c in cols:
            if hint in str(c).lower() and _looks_like_name(df[c]):
                return c
    for c in cols:
        if _looks_like_name(df[c]):
            return c
    return cols[0]


def excel_chunks(path: Path, jur: str):
    fname = path.name
    is_validation = "validation" in fname.lower()
    xl = pd.ExcelFile(path)
    out = []
    for sheet in xl.sheet_names:
        if SKIP_SHEET_RE.search(sheet):
            continue
        df, _ = read_sheet(xl, sheet)
        if df is None or df.empty:
            continue
        name_col = NAME_COL_OVERRIDE.get((fname, sheet)) or pick_name_col(df)
        if is_validation:
            stype = "VALIDATION_RULE"
        elif CODE_SHEET_RE.search(sheet):
            stype = "CODE_LIST"
        else:
            stype = "FIELD_SPEC"
        df[name_col] = df[name_col].ffill()
        for idx, row in df.iterrows():
            d = {c: cell_str(row[c]) for c in df.columns}
            d = {k: v for k, v in d.items() if v}
            if len(d) < 2:
                continue  # section-title rows
            name = d.get(name_col) or f"row {idx + 1}"
            lines = [f"[{jur}] {stype} | {fname} | Sheet: {sheet} | Row {idx + 1}", f"Field: {name}"]
            for k, v in d.items():
                if k != name_col:
                    lines.append(f"{k}: {v[:1500]}")
            out.append({
                "jurisdiction": jur, "source_type": stype, "document_name": fname,
                "clause_or_field": name[:500], "location": f"{sheet} / row {idx + 1}",
                "chunk_text": "\n".join(lines),
                "meta": {k: v[:600] for k, v in d.items()},
            })
    return out


# ----------------------------------------------------------------------------- PDF
HEADING_RE = re.compile(
    r"^(Article\s+\d+[a-z]?\b.*|Section\s+\d+[A-Z]?\b.*|Chapter\s+[IVXLC\d]+\b.*|Part\s+[IVXLC\d]+\b.*"
    r"|\d{1,3}(?:\.\d+)*\.?\s+[A-Z][^\n]{3,90})$"
)


def pdf_chunks(path: Path, jur: str, max_words: int = 300, overlap: int = 40):
    reader = PdfReader(str(path))
    chunks, buf, heading, start_page = [], [], "(start)", 1

    def flush(carry: bool, final: bool = False):
        nonlocal buf
        min_words = 10 if final else 25
        if len(buf) < min_words:
            return  # keep accumulating into the next section instead of dropping text
        text = " ".join(buf)
        chunks.append({
            "jurisdiction": jur, "source_type": "LEGAL", "document_name": path.name,
            "clause_or_field": heading[:500], "location": f"p.{start_page}",
            "chunk_text": f"[{jur}] LEGAL | {path.name} | p.{start_page} | {heading}\n{text}",
            "meta": {},
        })
        buf = buf[-overlap:] if carry else []

    for pno, page in enumerate(reader.pages, start=1):
        try:
            text = page.extract_text() or ""
        except Exception:
            continue
        for line in text.splitlines():
            line = line.strip()
            if not line:
                continue
            if len(line) < 120 and HEADING_RE.match(line):
                flush(carry=False)
                heading = line
                continue
            if not buf:
                start_page = pno
            buf.extend(line.split())
            if len(buf) >= max_words:
                flush(carry=True)
    flush(carry=False, final=True)
    return chunks


# ----------------------------------------------------------------------------- DB
def store(chunks, document_name: str):
    if not chunks:
        print(f"   (no chunks)")
        return
    embs = embed_docs([c["chunk_text"] for c in chunks])
    rows = [(c["jurisdiction"], c["source_type"], c["document_name"], c["clause_or_field"], c["location"],
             c["chunk_text"], vec_literal(e), json.dumps(c["meta"])) for c, e in zip(chunks, embs)]
    with db() as conn, conn.cursor() as cur:
        cur.execute("DELETE FROM regulatory_chunks WHERE document_name=%s", (document_name,))
        execute_values(
            cur,
            """INSERT INTO regulatory_chunks
               (jurisdiction, source_type, document_name, clause_or_field, location, chunk_text, embedding, meta)
               VALUES %s""",
            rows, template="(%s,%s,%s,%s,%s,%s,%s::vector,%s::jsonb)", page_size=500,
        )
        conn.commit()


def find_root() -> Path:
    here = Path(__file__).resolve().parent
    for cand in (here, here.parent):
        if any(cand.glob("*.pdf")) or any(cand.glob("*.xlsx")):
            return cand
    return here


def run():
    root = find_root()
    print(f"Scanning {root}")
    unmapped = []
    for path in sorted(root.iterdir()):
        n = path.name
        if n.startswith(("~$", ".")) or path.suffix.lower() not in (".xlsx", ".pdf"):
            continue
        if any(s in n.lower() for s in SKIP_FILE_SUBSTRINGS):
            continue
        jur = jurisdiction_for(n)
        if not jur:
            unmapped.append(path)
            continue
        print(f"\n→ {n}  [{jur}]")
        try:
            chunks = excel_chunks(path, jur) if path.suffix.lower() == ".xlsx" else pdf_chunks(path, jur)
        except Exception as e:
            print(f"   !! failed: {e}")
            continue
        types = {}
        for c in chunks:
            types[c["source_type"]] = types.get(c["source_type"], 0) + 1
        print(f"   {len(chunks)} chunks {types}")
        store(chunks, n)

    if unmapped:
        print("\n⚠️  UNMAPPED files (skipped) — add them to MANUAL_MAP in ingest_v2.py:")
        for p in unmapped:
            hint = ""
            if p.suffix.lower() == ".pdf":
                try:
                    hint = (PdfReader(str(p)).pages[0].extract_text() or "")[:200].replace("\n", " ")
                except Exception:
                    pass
            print(f"   - {p.name}   {('first text: ' + hint) if hint else ''}")

    with db() as conn, conn.cursor() as cur:
        cur.execute("SELECT jurisdiction, source_type, COUNT(*) FROM regulatory_chunks GROUP BY 1,2 ORDER BY 1,2")
        print("\nDB summary (jurisdiction, source_type, chunks):")
        for r in cur.fetchall():
            print("  ", r)


if __name__ == "__main__":
    run()