"""Create the v2 schema. WARNING: drops the existing regulatory_chunks table."""
from common import db


def init_db():
    with db() as conn, conn.cursor() as cur:
        cur.execute("CREATE EXTENSION IF NOT EXISTS vector;")
        cur.execute("DROP TABLE IF EXISTS regulatory_chunks;")
        cur.execute("""
            CREATE TABLE regulatory_chunks (
                id              SERIAL PRIMARY KEY,
                jurisdiction    VARCHAR(20) NOT NULL,
                -- FIELD_SPEC | CODE_LIST | VALIDATION_RULE | LEGAL
                source_type     VARCHAR(20) NOT NULL,
                document_name   TEXT,
                clause_or_field TEXT,          -- field name (specs) or heading (legal)
                location        TEXT,          -- sheet/row or page
                chunk_text      TEXT,
                embedding       vector(768),
                meta            JSONB DEFAULT '{}'::jsonb,   -- raw row (specs)
                tsv             tsvector GENERATED ALWAYS AS (to_tsvector('english', chunk_text)) STORED
            );
        """)
        cur.execute("CREATE INDEX idx_chunks_jur_type ON regulatory_chunks (jurisdiction, source_type);")
        cur.execute("CREATE INDEX idx_chunks_tsv ON regulatory_chunks USING gin (tsv);")
        cur.execute("CREATE INDEX idx_chunks_emb ON regulatory_chunks USING hnsw (embedding vector_cosine_ops);")
        conn.commit()
    print("✅ v2 schema created (768-dim vectors, typed chunks, FTS, HNSW).")


if __name__ == "__main__":
    init_db()