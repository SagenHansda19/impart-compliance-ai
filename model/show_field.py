"""Print spec rows for a field WITHOUT calling any LLM (use it to check what the data really says).
   python show_field.py HKMA package            # rows whose field name contains 'package'
   python show_field.py HKMA "50 characters" text   # search inside the chunk text instead"""
import sys

from common import db

reg, needle = sys.argv[1].upper(), sys.argv[2]
by_text = len(sys.argv) > 3 and sys.argv[3] == "text"
col = "chunk_text" if by_text else "clause_or_field"
with db() as conn, conn.cursor() as cur:
    cur.execute(f"""SELECT id, source_type, document_name, location, chunk_text FROM regulatory_chunks
                    WHERE jurisdiction=%s AND {col} ILIKE %s ORDER BY source_type, id LIMIT 25""", (reg, f"%{needle}%"))
    rows = cur.fetchall()
print(f"{len(rows)} rows for {reg} / {needle!r}\n")
for rid, st, doc, loc, text in rows:
    print(f"--- id={rid} {st} | {doc} | {loc}")
    print(text[:1500], "\n")