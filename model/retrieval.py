"""Retrieval helpers: per-regulation field catalog, chunk fetch, hybrid search + rerank."""
import re
from functools import lru_cache

from common import batch_embed_queries, db, embed_query, rerank_scores, vec_literal

STOP = set("the a an of to in on for and or with by is are be as at from that this it its into per "
           "should must will can all any each when where which what shall".split())


def to_or_tsquery(text: str) -> str:
    """OR-combined tsquery. (plainto_tsquery ANDs every term, which almost never matches.)"""
    toks = [t.lower() for t in re.findall(r"[A-Za-z0-9]+", text)]
    toks = [t for t in dict.fromkeys(toks) if len(t) > 2 and t not in STOP]
    return " | ".join(toks[:20])


def _describe(meta: dict) -> str:
    for key, val in meta.items():
        if re.search(r"definition|description", key, re.I) and val:
            return val
    return ""


@lru_cache(maxsize=None)
def field_catalog(reg: str):
    """Returns (entries, catalog_text). entries: {'F1': {'name','ids','desc'}}; one entry per distinct field name."""
    with db() as conn, conn.cursor() as cur:
        cur.execute("""SELECT id, clause_or_field, meta FROM regulatory_chunks
                       WHERE jurisdiction=%s AND source_type='FIELD_SPEC' ORDER BY id""", (reg,))
        rows = cur.fetchall()
    by_name = {}
    for cid, name, meta in rows:
        key = (name or "").strip()
        if not key:
            continue
        e = by_name.setdefault(key, {"name": key, "ids": [], "desc": ""})
        e["ids"].append(cid)
        if not e["desc"]:
            e["desc"] = _describe(meta or {})
    entries = {f"F{i}": e for i, e in enumerate(by_name.values(), 1)}
    width = 90 if len(entries) <= 220 else 40
    text = "\n".join(f"{fid} | {e['name']} | {e['desc'][:width]}" for fid, e in entries.items())
    return entries, text


def fetch_chunks(ids):
    ids = list(dict.fromkeys(ids))
    if not ids:
        return []
    with db() as conn, conn.cursor() as cur:
        cur.execute("""SELECT id, jurisdiction, source_type, document_name, clause_or_field, location, chunk_text
                       FROM regulatory_chunks WHERE id = ANY(%s)""", (ids,))
        rows = {r[0]: r for r in cur.fetchall()}
    keys = ["id", "jurisdiction", "source_type", "document_name", "clause_or_field", "location", "chunk_text"]
    return [dict(zip(keys, rows[i])) for i in ids if i in rows]


def hybrid_search(queries, reg, source_types=None, focus=None, per_query=15, pool=12, top_k=6):
    """Vector + full-text per query -> reciprocal-rank fusion -> cross-encoder rerank."""
    queries = list(dict.fromkeys(q.strip() for q in queries if q and q.strip()))
    if not queries:
        return []

    # Batch embed all queries in one forward pass
    vectors = batch_embed_queries(queries)
    vec_map = {q: vec_literal(v) for q, v in zip(queries, vectors)}

    fused = {}
    type_sql = " AND source_type = ANY(%s)" if source_types else ""
    with db() as conn, conn.cursor() as cur:
        for q in queries:
            vec = vec_map[q]
            params = [reg] + ([list(source_types)] if source_types else []) + [vec, per_query]
            cur.execute(f"""SELECT id FROM regulatory_chunks WHERE jurisdiction=%s{type_sql}
                            ORDER BY embedding <=> %s::vector LIMIT %s""", params)
            for rank, (cid,) in enumerate(cur.fetchall(), 1):
                fused[cid] = fused.get(cid, 0.0) + 1.0 / (60 + rank)

            tsq = to_or_tsquery(q)
            if tsq:
                params = [reg] + ([list(source_types)] if source_types else []) + [tsq, tsq, per_query]
                cur.execute(f"""SELECT id FROM regulatory_chunks
                                WHERE jurisdiction=%s{type_sql} AND tsv @@ to_tsquery('english', %s)
                                ORDER BY ts_rank_cd(tsv, to_tsquery('english', %s)) DESC LIMIT %s""", params)
                for rank, (cid,) in enumerate(cur.fetchall(), 1):
                    fused[cid] = fused.get(cid, 0.0) + 1.0 / (60 + rank)

    top_ids = sorted(fused, key=fused.get, reverse=True)[:pool]
    chunks = fetch_chunks(top_ids)
    if not chunks or len(chunks) <= top_k:
        return chunks
    import os
    if os.environ.get("ENABLE_RERANKER", "0") != "1":
        return chunks[:top_k]
    scores = rerank_scores(focus or queries[0], [c["chunk_text"][:1200] for c in chunks])
    for c, s in zip(chunks, scores):
        c["score"] = s
    chunks.sort(key=lambda c: c["score"], reverse=True)
    return chunks[:top_k]


def chunks_by_field_name(reg, names, source_types=("LEGAL", "VALIDATION_RULE", "CODE_LIST"), per_name=3):
    """Official text / validation rows whose heading or field name contains the given field names
    (exact lookup, no embeddings). Used to compare the spec spreadsheet against legal documents."""
    ids = []
    with db() as conn, conn.cursor() as cur:
        for n in dict.fromkeys(names):
            base = re.sub(r"\s*\(.*?\)", "", n or "").strip()      # drop qualifiers like "(initial margin)"
            if len(base) < 4:
                continue
            like = "%" + base.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
            cur.execute("""SELECT id FROM regulatory_chunks
                           WHERE jurisdiction=%s AND source_type = ANY(%s) AND clause_or_field ILIKE %s
                           ORDER BY (source_type='VALIDATION_RULE') DESC, length(clause_or_field), id LIMIT %s""",
                        (reg, list(source_types), like, per_name))
            ids.extend(row[0] for row in cur.fetchall())
    return fetch_chunks(ids)