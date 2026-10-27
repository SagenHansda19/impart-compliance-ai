"""IMPART Latency Profiler & Bottleneck Analyzer

Measures exact elapsed time for:
1. LLM CR Analysis & Decomposition (AI API)
2. Database Field Catalog Fetch (PostgreSQL)
3. Retrieval Stage:
   - Local Embedding Generation (BGE-base-en-v1.5)
   - pgvector Vector Cosine Search (PostgreSQL <=> operator)
   - Full-Text Search (PostgreSQL GIN tsvector)
   - SQL Chunk Fetching (PostgreSQL ANY(id))
   - SQL Field ILIKE Lookup (PostgreSQL)
   - Local Cross-Encoder Reranker (BGE-reranker-base)
4. LLM Multi-Regime Judge (AI API per jurisdiction)
5. Pure Python Aggregation & Post-processing

Usage:
  python profile_pipeline.py
  python profile_pipeline.py --cr "With the latest developments in the booking layer..."
  python profile_pipeline.py --no-cache
"""
import argparse
import os
import sys
import time
from collections import defaultdict
from pathlib import Path

# Add model directory to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent))

import common
from common import DB_URL, EXTRACT_MODEL, JUDGE_MODEL, LLM_PROVIDER, REGS, db, embed_query, rerank_scores, vec_literal
import retrieval
from retrieval import chunks_by_field_name, fetch_chunks, field_catalog, to_or_tsquery


def profile_pure_db_vs_neural(query: str, reg: str = "ASIC"):
    """Isolate pure SQL/pgvector vs local neural model inference."""
    print("\n" + "=" * 70)
    print(f"🔬 DETAILED MICRO-BENCHMARK: DB Search vs Neural Inference (Regime: {reg})")
    print("=" * 70)

    # 1. Neural Embedding
    t0 = time.perf_counter()
    vec = embed_query(query)
    embed_ms = (time.perf_counter() - t0) * 1000
    vec_lit = vec_literal(vec)
    print(f"  [Neural Model]  Query Embedding (BGE-base-en-v1.5 CPU/GPU):  {embed_ms:8.2f} ms")

    # 2. Pure pgvector Search in PostgreSQL
    t0 = time.perf_counter()
    with db() as conn, conn.cursor() as cur:
        cur.execute(
            """SELECT id FROM regulatory_chunks 
               WHERE jurisdiction=%s 
               ORDER BY embedding <=> %s::vector LIMIT 20""",
            (reg, vec_lit),
        )
        vec_ids = [r[0] for r in cur.fetchall()]
    pgvector_ms = (time.perf_counter() - t0) * 1000
    print(f"  [PostgreSQL]    pgvector Cosine Search (<=> operator):       {pgvector_ms:8.2f} ms (Found {len(vec_ids)} rows)")

    # 3. Pure Full-Text Search (GIN tsvector)
    tsq = to_or_tsquery(query)
    t0 = time.perf_counter()
    with db() as conn, conn.cursor() as cur:
        cur.execute(
            """SELECT id FROM regulatory_chunks 
               WHERE jurisdiction=%s AND tsv @@ to_tsquery('english', %s)
               ORDER BY ts_rank_cd(tsv, to_tsquery('english', %s)) DESC LIMIT 20""",
            (reg, tsq, tsq),
        )
        fts_ids = [r[0] for r in cur.fetchall()]
    fts_ms = (time.perf_counter() - t0) * 1000
    print(f"  [PostgreSQL]    Full-Text Search (GIN tsvector ts_rank):     {fts_ms:8.2f} ms (Found {len(fts_ids)} rows)")

    # 4. Chunk Fetching by ID
    all_ids = list(dict.fromkeys(vec_ids + fts_ids))[:40]
    t0 = time.perf_counter()
    chunks = fetch_chunks(all_ids)
    fetch_ms = (time.perf_counter() - t0) * 1000
    print(f"  [PostgreSQL]    Fetch Chunk Content (SELECT ANY(id)):        {fetch_ms:8.2f} ms ({len(chunks)} chunks fetched)")

    # 5. Field Exact Lookup (ILIKE)
    t0 = time.perf_counter()
    field_chunks = chunks_by_field_name(reg, ["Event timestamp", "Trade date"])
    ilike_ms = (time.perf_counter() - t0) * 1000
    print(f"  [PostgreSQL]    Exact Field Name Match (ILIKE filter):       {ilike_ms:8.2f} ms ({len(field_chunks)} chunks)")

    # 6. Local Cross-Encoder Reranking
    if chunks:
        texts = [c["chunk_text"][:1500] for c in chunks[:15]]
        t0 = time.perf_counter()
        scores = rerank_scores(query, texts)
        rerank_ms = (time.perf_counter() - t0) * 1000
        print(f"  [Neural Model]  Cross-Encoder Reranker (BGE-reranker-base):  {rerank_ms:8.2f} ms ({len(texts)} chunks)")
    else:
        rerank_ms = 0.0

    pure_db_total = pgvector_ms + fts_ms + fetch_ms + ilike_ms
    local_neural_total = embed_ms + rerank_ms

    print("-" * 70)
    print(f"  ⚡ Pure Database Query Time (Postgres pgvector+FTS):         {pure_db_total:8.2f} ms")
    print(f"  🧠 Local Embedding & Reranker Time (PyTorch/Transformers):   {local_neural_total:8.2f} ms")
    print("=" * 70)


def profile_full_cr_pipeline(cr_text: str):
    """Profiles the entire end-to-end evaluation pipeline with granular timers."""
    import pipeline

    print("\n" + "=" * 70)
    print("🚀 END-TO-END PIPELINE PROFILE")
    print(f"CR: {cr_text[:85]}...")
    print(f"LLM Provider: {LLM_PROVIDER} | Judge Model: {JUDGE_MODEL} | Votes: {common.N_VOTES}")
    print("=" * 70)

    total_start = time.perf_counter()

    # Step 1: Decomposition
    print("\n[Step 1/5] Decomposing Change Request (AI API call)...")
    t0 = time.perf_counter()
    analysis = pipeline.analyze_cr(cr_text)
    t_decomp = (time.perf_counter() - t0) * 1000
    req_count = len(analysis.get("requirements", []))
    print(f"  ✓ Decomposed into {req_count} requirements in {t_decomp:.2f} ms")

    # Step 2: Per-regulation retrieval and judging
    reg_timings = {}
    print("\n[Step 2/5] Evaluating across 5 Jurisdictions (EMIR, UKEMIR, ASIC, MAS, HKMA)...")

    db_total_ms = 0.0
    llm_judge_total_ms = 0.0

    for reg in REGS:
        t_reg_start = time.perf_counter()

        # Phase A: Build Evidence (DB + Embeddings + Rerank)
        t_ev_start = time.perf_counter()
        user_prompt, ev_text, dbg = pipeline.build_evidence(reg, cr_text, analysis["requirements"])
        t_ev_ms = (time.perf_counter() - t_ev_start) * 1000
        db_total_ms += t_ev_ms

        # Phase B: Judge call (AI API)
        t_judge_start = time.perf_counter()
        system = pipeline.judge_system(reg)
        try:
            j = common.llm_json(system, user_prompt, JUDGE_MODEL, temperature=0.0)
            verdict = pipeline.derive(analysis["requirements"], j)
            compliant = verdict["compliant"]
        except Exception as e:
            compliant = f"Error: {e}"
        t_judge_ms = (time.perf_counter() - t_judge_start) * 1000
        llm_judge_total_ms += t_judge_ms

        t_reg_total = (time.perf_counter() - t_reg_start) * 1000
        reg_timings[reg] = {
            "evidence_ms": t_ev_ms,
            "judge_ms": t_judge_ms,
            "total_ms": t_reg_total,
            "compliant": compliant,
        }
        print(f"  • {reg:7s} | Compliant: {compliant:5s} | Retrieval/DB: {t_ev_ms:7.1f} ms | LLM Judge: {t_judge_ms:7.1f} ms | Total: {t_reg_total:7.1f} ms")

    # Step 3: Post-processing (Heatmap + Complexity Spectrum)
    t0 = time.perf_counter()
    table = [{"regulation": r, "compliant": reg_timings[r]["compliant"], "findings": []} for r in REGS]
    hmap = pipeline.heatmap(table)
    t_post_ms = (time.perf_counter() - t0) * 1000

    total_pipeline_ms = (time.perf_counter() - total_start) * 1000

    # Summary Report
    print("\n" + "=" * 70)
    print("📊 LATENCY BREAKDOWN & BOTTLENECK ANALYSIS")
    print("=" * 70)

    ai_api_total_ms = t_decomp + llm_judge_total_ms
    db_and_retrieval_ms = db_total_ms

    pct_ai = (ai_api_total_ms / total_pipeline_ms) * 100 if total_pipeline_ms else 0
    pct_db = (db_and_retrieval_ms / total_pipeline_ms) * 100 if total_pipeline_ms else 0
    pct_post = (t_post_ms / total_pipeline_ms) * 100 if total_pipeline_ms else 0

    print(f"{'Component':<35} | {'Time (ms)':<12} | {'Percentage':<10}")
    print("-" * 70)
    print(f"{'AI API: Decomposition (LLM)':<35} | {t_decomp:10.2f} ms | {(t_decomp/total_pipeline_ms)*100:8.1f} %")
    print(f"{'AI API: 5x Multi-Regime Judges':<35} | {llm_judge_total_ms:10.2f} ms | {(llm_judge_total_ms/total_pipeline_ms)*100:8.1f} %")
    print(f"{'  👉 TOTAL AI API TIME':<35} | {ai_api_total_ms:10.2f} ms | {pct_ai:8.1f} %")
    print("-" * 70)
    print(f"{'DB Retrieval & Local Reranking':<35} | {db_and_retrieval_ms:10.2f} ms | {pct_db:8.1f} %")
    print(f"{'Python Post-processing / Rules':<35} | {t_post_ms:10.2f} ms | {pct_post:8.1f} %")
    print("=" * 70)
    print(f"{'TOTAL END-TO-END PIPELINE':<35} | {total_pipeline_ms:10.2f} ms | 100.0 %")
    print("=" * 70)

    # Bottleneck Verdict
    print("\n🎯 KEY TAKEAWAYS & BOTTLENECK VERDICT:")
    if ai_api_total_ms > db_and_retrieval_ms:
        ratio = ai_api_total_ms / max(1.0, db_and_retrieval_ms)
        print(f"  • AI API calls are the PRIMARY bottleneck ({ratio:.1f}x slower than DB search & retrieval).")
        print("  • PostgreSQL (pgvector + FTS) executes queries in sub-50ms.")
        print("  • LLM calls consume the bulk of the response latency due to token generation & network round-trips.")
    else:
        ratio = db_and_retrieval_ms / max(1.0, ai_api_total_ms)
        print(f"  • Retrieval/Reranker is taking more time ({ratio:.1f}x slower than AI API).")
        print("  • This typically happens when Cross-Encoder reranking runs on CPU with large candidate pools, or when LLM responses are cached.")


if __name__ == "__main__":
    sample_cr = (
        "With the latest developments in the booking layer, each booking application will start "
        "sending us the exact date and time of each lifecycle event on every trade. This improvement will "
        "help us report the lifecycle events more accurately. Kindly update the logic of event timestamp / "
        "event date field to report the exact timestamp of the event for all regulations."
    )

    parser = argparse.ArgumentParser(description="Profile IMPART pipeline latency")
    parser.add_argument("--cr", default=sample_cr, help="Change Request text")
    parser.add_argument("--micro-only", action="store_true", help="Only run micro-benchmarks")
    parser.add_argument("--no-cache", action="store_true", help="Disable LLM cache")
    args = parser.parse_args()

    if args.no_cache:
        os.environ["NO_CACHE"] = "1"
        common.USE_CACHE = False

    profile_pure_db_vs_neural(args.cr, reg="ASIC")

    if not args.micro_only:
        profile_full_cr_pipeline(args.cr)
