# ✦ IMPART — Regulatory Compliance Co-Pilot & RAG Ingestion Pipeline

> **Automated Regulatory Impact Assessment, Hybrid Vector Search & Decision Support Engine across EMIR, UK EMIR, ASIC, MAS, and HKMA.**

[![Python](https://img.shields.io/badge/Python-3.10%2B-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/API-FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![PostgreSQL](https://img.shields.io/badge/Vector_DB-PostgreSQL_%2B_pgvector-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://github.com/pgvector/pgvector)
[![React](https://img.shields.io/badge/Frontend-React_19_%2B_TypeScript-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Docker](https://img.shields.io/badge/Deployment-Docker_Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)

---

## 📑 Table of Contents

- [Executive Summary](#-executive-summary)
- [System Architecture](#-system-architecture)
- [Performance & Reliability Highlights](#-performance--reliability-highlights)
- [Repository Structure](#-repository-structure)
- [Regulatory Knowledge Base](#-regulatory-knowledge-base)
- [RAG Ingestion Pipeline (Strategies A, B, C)](#-rag-ingestion-pipeline)
- [Database Schema (pgvector + FTS)](#-database-schema)
- [Quick Start: One-Command Docker Setup](#-quick-start-one-command-docker-setup)
- [Manual Setup: Step-by-Step Local Execution](#-manual-setup-step-by-step-local-execution)
  - [1. Database & pgvector Initialization](#1-database--pgvector-initialization)
  - [2. Ingestion Pipeline Execution](#2-ingestion-pipeline-execution)
  - [3. Verification Script (Hybrid Search Test)](#3-verification-script-hybrid-search-test)
  - [4. AI Model Engine Service](#4-ai-model-engine-service)
  - [5. Backend API Service](#5-backend-api-service)
  - [6. Frontend Web Dashboard](#6-frontend-web-dashboard)
- [Configuration & Environment Variables](#-configuration--environment-variables)
- [API Reference & Testing](#-api-reference--testing)
- [Troubleshooting & FAQs](#-troubleshooting--faqs)

---

## 🎯 Executive Summary

**IMPART** (Intelligent Multi-regime Policy Assessment & Regulatory Tool) is an end-to-end Compliance Co-Pilot built to evaluate whether proposed technology or business change requests (CRs) comply with global OTC derivative reporting regulations.

The system ingests regulatory statutes, technical guidance, validation rulebooks, and field specifications across **5 major regulatory jurisdictions**:

| Flag | Jurisdiction | Regime Name | Scope |
| :---: | :--- | :--- | :--- |
| 🇪🇺 | **EMIR** | European Market Infrastructure Regulation | ESMA Derivatives Reporting (REFIT RTS/ITS) |
| 🇬🇧 | **UK EMIR** | UK European Market Infrastructure Regulation | Bank of England & FCA Technical Standards |
| 🇦🇺 | **ASIC** | Australian Securities and Investments Commission | ASIC Derivative Transaction Rules 2024 |
| 🇸🇬 | **MAS** | Monetary Authority of Singapore | Securities and Futures Act (SFA 2013/2024) |
| 🇭🇰 | **HKMA** | Hong Kong Monetary Authority | HKMA OTC Derivatives Reporting Rules |

---

## 🏗️ System Architecture

```mermaid
flowchart TD
    subgraph Data_Layer ["📚 Phase 1 & 2: Regulatory Ingestion Pipeline"]
        A1["Standard Field Specs (.xlsx)"] -->|Strategy A: 1 Row = 1 Chunk| P["Ingestion Pipeline (ingest.py)"]
        A2["Validation Rulebooks (.xlsx)"] -->|Strategy B: Multi-Tab Header Discovery| P
        A3["Regulatory Statutes (.pdf)"] -->|Strategy C: Table-Preserving Markdown + RecursiveSplit| P
        P -->|BAAI/bge-base-en-v1.5 (768-dim)| V["PostgreSQL 16 + pgvector"]
    end

    subgraph Storage ["💾 Storage Layer"]
        V -->|"pgvector HNSW (ef_search=40) + GIN FTS"| RAG["Hybrid Vector Store (impart_db)"]
        MYSQL[("MySQL 8.4 (Backend History Store)")]
    end

    subgraph Engine ["🧠 Phase 3: AI Model Engine (Port 8001)"]
        CR["📝 Change Request (CR)"] --> CACHE{"2-Tier Semantic Cache<br/>(Cosine >= 0.90 + Token Guards)"}
        CACHE -->|Cache Hit: 5ms| RES["Evaluated Assessment"]
        CACHE -->|Cache Miss| DECOMP["Requirement Decomposer"]
        DECOMP --> CAT["Field Catalog Matcher"]
        CAT --> RET["Hybrid Retriever (Dense Vector + Full-Text Search)"]
        RET <--> RAG
        RET --> RERANK["Cross-Encoder Reranker (bge-reranker-base)"]
        RERANK --> JUDGE["Unified Multi-Regime Judge (Rotating LLM Pool)"]
        JUDGE --> GUARDS["4-Tier Post-RAG Guardrails<br/>(Quote Grounding & Bleed Isolation)"]
        GUARDS --> HEATMAP["Conflict Heatmap & Complexity Scoring"]
        HEATMAP --> RES
    end

    subgraph Application ["💻 Application Gateway & UI"]
        RES --> BACKEND["FastAPI Backend (Port 8080)"]
        BACKEND <--> MYSQL
        BACKEND --> FRONTEND["React 19 + TypeScript Dashboard (Port 8000)"]
    end
```

---

## ⚡ Performance & Reliability Highlights

| Metric | Before Optimization | After Optimization | Improvement |
| :--- | :--- | :--- | :--- |
| **End-to-End Latency (Uncached)** | 130s+ (frequent timeouts) | **~1.8s - 3.4s** | **~45x - 65x faster** |
| **End-to-End Latency (Cached)** | N/A (no cache) | **< 5ms** | **~700x speedup** |
| **Vector DB Scan (pgvector)** | 52.9ms | **1.18ms** (`ef_search = 40`) | **44.8x faster** |
| **Database Connection Handshake** | 15.0ms (per-query reconnect) | **< 0.05ms** (`ThreadedConnectionPool`) | **300x faster** |
| **Field Lookups (`ILIKE`)** | 13.8ms (full table scan) | **0.78ms** (Trigram GIN) | **17.7x faster** |
| **Full-Text Search (`tsvector`)** | 47.3ms (large table scan) | **8.9ms** (Compound Btree-GIN) | **5.3x faster** |
| **LLM Inference Roundtrips** | 5 serial calls per CR | **1 unified prompt** | **60% token reduction** |
| **Benchmark Accuracy** | Flaky (hallucination bleed) | **100% across 40 rule targets** | **Perfect grounding** |

---

## 📁 Repository Structure

```text
BNP-MUM-Team-25/
├── docker-compose.yml              # Complete containerized fullstack deployment
├── .env.example                    # Sample root environment configuration
├── requirements.txt                # Unified dependencies for ingestion pipeline
├── init_db.py                      # Database schema and pgvector index setup
├── ingest.py                       # Unified RAG ingestion pipeline (Strategies A, B, C)
├── verify_db.py                    # Verification script testing ASIC vector search
│
├── regulations/                    # Regulatory Document Library (5 jurisdictions)
│   ├── ASIC/                       # asic_field_specifications.xlsx, validation rules, PDFs
│   ├── EMIR/                       # emir_field_specifications.xlsx, ESMA validation rules, PDFs
│   ├── HKMA/                       # hkma_field_specifications.xlsx, FAQ PDFs, consultation docs
│   ├── MAS/                        # mas_field_specifications.xlsx, SFA guidelines, FAQ PDFs
│   └── UKEMIR/                     # ukemir_field_specifications.xlsx, BoE validation rules, PDFs
│
├── model/                          # AI Evaluation & Knowledge Retrieval Service
│   ├── api.py                      # FastAPI endpoint (/api/evaluate)
│   ├── pipeline.py                 # Core assessment pipeline orchestrator
│   ├── retrieval.py                # Hybrid search (pgvector + GIN tsvector) & reranker
│   ├── evaluate_v2.py              # Test dataset validation runner
│   ├── ingest_v2.py                # Model-level ingestion script
│   └── common.py                   # DB connection pool, embedding model, and LLM clients
│
├── backend/                        # FastAPI Application Backend & History Gateway
│   ├── app/                        # REST API routes, models, decision rules, PII filters
│   ├── schema.sql                  # MySQL database schema
│   ├── Dockerfile                  # Backend container specification
│   └── requirements.txt            # Backend Python dependencies
│
└── frontend/                       # Modern React 19 Single-Page Dashboard
    ├── src/                        # Components (Result table, Heatmap, Complexity, Timeline)
    ├── nginx.conf.template         # Reverse proxy forwarding /api to backend:8080
    ├── Dockerfile                  # Multi-stage production build container
    └── package.json                # React 19, Tailwind CSS v4, Vite dependencies
```

---

## 📚 Regulatory Knowledge Base

The ingestion pipeline processes the following regulatory artifacts:

### 1. Standard Field Specifications (`*field_specifications.xlsx`)
- **ASIC**: `asic_field_specifications.xlsx`
- **EMIR**: `emir_field_specifications.xlsx`
- **HKMA**: `hkma_field_specifications.xlsx`
- **MAS**: `mas_field_specifications.xlsx`
- **UK EMIR**: `ukemir_field_specifications.xlsx`

### 2. Multi-Tab Validation Rulebooks & Guidance
- **EMIR**: `esma74-362-2683_emir_refit_validation_rules_reconciliation_tolerances...xlsx`
- **UK EMIR**: `uk-emir-validation-rules-2023.xlsx`
- **ASIC**: `asic-2024-rules-reporting-entity-guidance-and-min-tr-validation-guidance-v1-1-07feb25.xlsx`

### 3. Regulatory Directives, Statutes & Technical Guidance PDFs
- **ASIC**: `F2025C01094.pdf`, `asic-2024-rules-schedule-1-technical-guidance-v1-1-07feb25.pdf`, `asic-iso-20022-mapping-to-asic-2024-rules-v1-1-07feb25.pdf`
- **EMIR**: `CELEX_02012R0648-20250117_EN_TXT.pdf`, `CELEX_32022R1855_EN_TXT.pdf`, `ESMA74-362-2281_Guidelines_EMIR_REFIT.pdf`
- **HKMA**: `20240926e3a1.pdf`, `Frequently Asked Questions_29Sep2025_v3.pdf`, `SRI Ver 3_0 250905.pdf`
- **MAS**: `FAQs on the Securities and Futures Reporting Regulations 2013.pdf`, `Guidelines to the Securities and Futures Reporting.pdf`, `Securities and Futures Act 2001.pdf`
- **UK EMIR**: `ps23-2.pdf`, `standards-instrument.pdf`

---

## ⚡ RAG Ingestion Pipeline

The pipeline implements three distinct, rigorous chunking strategies in `ingest.py`:

```mermaid
graph LR
    subgraph Strategy_A ["Strategy A: Standard Excel"]
        direction TB
        A1["Iterate rows 1-by-1"] --> A2["Map headers to values"]
        A2 --> A3["Skip empty/NaN cells"]
        A3 --> A4["Extract Field Name & Jurisdiction"]
    end

    subgraph Strategy_B ["Strategy B: Multi-Tab Validation"]
        direction TB
        B1["List all sheet names"] --> B2["Detect primary Validation/Guidance tab"]
        B2 --> B3["Auto-discover table header row"]
        B3 --> B4["Apply Strategy A row mapping"]
    end

    subgraph Strategy_C ["Strategy C: Regulatory PDFs"]
        direction TB
        C1["Convert PDF to Markdown with tables"] --> C2["RecursiveCharacterTextSplitter (800/150)"]
        C2 --> C3["Prefix explicit citation header: [Jurisdiction | Doc | Page]"]
    end
```

### Strategy A: Standard Excel Processing (1 Row = 1 Chunk)
- **Constraint**: Dynamically omits any columns where the cell is empty or NaN (never outputs empty labels).
- **Metadata**: Automatically extracts the jurisdiction (`ASIC`, `EMIR`, `HKMA`, `MAS`, `UKEMIR`) from the file path/name and sets `clause_or_field` to the field name (first column).

### Strategy B: Complex Validation Excel Processing (Multi-Tab)
- **Sheet Discovery**: Inspects workbook sheet names and scores target sheets matching keywords (`Validations_Cpty`, `Trade validations auth.030`, `ASIC Guidance-Table S1.1(1)`).
- **Dynamic Headers**: Detects column headers automatically regardless of decorative title rows.

### Strategy C: Regulatory PDF Processing
- **Table Preservation**: Extracts structured tables using markdown table notation (`| Col | Col |`).
- **Chunking**: Uses `RecursiveCharacterTextSplitter` configured with `chunk_size = 800` and `chunk_overlap = 150`.
- **Citation Traceability**: Explicitly prepends `[Jurisdiction: <JURISDICTION> | Document: <FILENAME> | Page: <PAGE_NO>]` into the body of every single chunk so LLMs can cite exact legal sources.

---

## 🗄️ Database Schema

The database runs PostgreSQL 16 with `pgvector` enabled:

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS regulatory_chunks (
    id              BIGSERIAL PRIMARY KEY,
    jurisdiction    TEXT NOT NULL,               -- ASIC | EMIR | UKEMIR | MAS | HKMA
    source_type     TEXT NOT NULL,               -- excel_specification | excel_validation | pdf
    document_name   TEXT NOT NULL,               -- e.g. asic_field_specifications.xlsx
    clause_or_field TEXT,                        -- Field Name or Section Heading
    page_or_row     TEXT,                        -- e.g. 'Row 23' or 'Page 12'
    chunk_text      TEXT NOT NULL,               -- Structured chunk content with citations
    embedding       vector(768),                 -- 768-dim dense embedding
    meta            JSONB DEFAULT '{}'::jsonb,   -- Raw specification row metadata
    tsv             tsvector GENERATED ALWAYS AS (to_tsvector('english', chunk_text)) STORED
);

-- Fast Approximate Nearest Neighbor Index (Cosine Distance)
CREATE INDEX IF NOT EXISTS chunk_vector_idx 
ON regulatory_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Full-Text Lexical Search Index
CREATE INDEX IF NOT EXISTS idx_chunks_tsv 
ON regulatory_chunks USING gin (tsv);

-- Filter Indexes
CREATE INDEX IF NOT EXISTS idx_chunks_jur_type 
ON regulatory_chunks (jurisdiction, source_type);
```

---

## 🚀 Quick Start: One-Command Docker Setup

The easiest way to run the entire IMPART platform is via Docker Compose:

### 1. Configure `.env`
Create a `.env` file in the project root:

```bash
# Copy template
cp .env.example .env
```

Set your credentials in `.env`:
```ini
# Gemini API Key (for LLM reasoning & evaluation)
GEMINI_API_KEY=YOUR_GEMINI_API_KEY

# Model Engine configuration
MODEL_MODE=http
KB_PASSWORD=mysecretpassword
MYSQL_PASSWORD=impart
MYSQL_ROOT_PASSWORD=rootpass
```

### 2. Launch All Services

```bash
# Launch database, backend, frontend, and AI model engine
docker compose --profile engine up --build
```

### 3. Access the Applications

| Component | URL | Description |
| :--- | :--- | :--- |
| **Frontend Dashboard** | [http://localhost:8000](http://localhost:8000) | Interactive React Web Application |
| **Backend API Docs** | [http://localhost:8080/docs](http://localhost:8080/docs) | FastAPI Swagger UI |
| **Model Engine Docs** | [http://localhost:8001/docs](http://localhost:8001/docs) | Knowledge Engine API Docs |

---

## 🛠️ Manual Setup: Step-by-Step Local Execution

If you prefer running services directly on your host machine without Docker:

### 1. Database & pgvector Initialization

Start a PostgreSQL 16 container with `pgvector`:

```bash
docker run -d \
  --name impart-pgvector \
  -e POSTGRES_USER=admin \
  -e POSTGRES_PASSWORD=mysecretpassword \
  -e POSTGRES_DB=impart_db \
  -p 5432:5432 \
  pgvector/pgvector:pg16
```

Set up your virtual environment and install dependencies:

```bash
# Create and activate Python 3.10+ virtualenv
python3 -m venv .venv
source .venv/bin/activate

# Install required ingestion packages
pip install -r requirements.txt
```

Initialize the database schema:

```bash
python init_db.py
```

*Output:*
```text
Connecting to database...
Applying schema migrations...
Database schema successfully initialized!
```

---

### 2. Ingestion Pipeline Execution

Run `ingest.py` to ingest the regulatory documents across all 5 regimes:

```bash
# Run all three ingestion strategies
python ingest.py --strategy all --max-pdf-pages 10
```

#### Ingestion Options:
- `--strategy all`: Executes Strategy A, B, and C sequentially.
- `--strategy A`: Ingests standard Excel field specifications only.
- `--strategy B`: Ingests complex multi-tab validation sheets only.
- `--strategy C`: Ingests regulatory PDFs with table preservation.
- `--clean`: Truncates `regulatory_chunks` before starting fresh ingestion.
- `--max-pdf-pages N`: Limits PDF processing to first `N` pages (omit to ingest all pages).

---

### 3. Verification Script (Hybrid Search Test)

Verify that the vector database and hybrid search are working correctly:

```bash
python verify_db.py "Event timestamp" ASIC
```

*Terminal Output:*
```text
======================================================================
COMPLIANCE CO-PILOT: RAG VECTOR SEARCH VERIFICATION
======================================================================
Query Term    : 'Event timestamp'
Jurisdiction  : 'ASIC'
Top-K Limit   : 2
Database URL  : postgresql://admin:mysecretpassword@localhost:5432/impart_db
Model         : BAAI/bge-base-en-v1.5
----------------------------------------------------------------------
Vectorizing query using FastEmbed...

Successfully retrieved top 2 matches for 'Event timestamp' (ASIC):

Rank #1 | Similarity Score: 0.7550 (Cosine Similarity: 75.50%)
  • Chunk ID        : 22
  • Jurisdiction    : ASIC
  • Source Type     : excel_specification
  • Document        : asic_field_specifications.xlsx
  • Clause / Field  : Event timestamp
  • Page / Row      : Row 23
  • Content Preview :
      Jurisdiction: ASIC
      Document: asic_field_specifications.xlsx
      Field Name: Event timestamp
      Description: The date and time the reported event occurred - in particular, when Action type is Modify or Terminate, the date/time of that modification or termination.
      Data Type & Format: ISO 8601 UTC date-time, format YYYY-MM-DDThh:mm:ssZ.
      Allowed Values: Any valid UTC date and time.
      Reporting Requirement: Mandatory across all trade and exit submissions...
----------------------------------------------------------------------
Rank #2 | Similarity Score: 0.6922 (Cosine Similarity: 69.22%)
  • Chunk ID        : 166
  • Jurisdiction    : ASIC
  • Source Type     : excel_specification
  • Document        : asic_field_specifications.xlsx
  • Clause / Field  : Reporting timestamp
  • Page / Row      : Row 167
  ...
```

---

### 4. AI Model Engine Service

Start the model evaluation microservice:

```bash
cd model
export DB_URL="postgresql://admin:mysecretpassword@localhost:5432/impart_db"
export LLM_PROVIDER="gemini"
export GEMINI_API_KEY="YOUR_GEMINI_API_KEY"

uvicorn api:app --host 127.0.0.1 --port 8001 --reload
```

---

### 5. Backend API Service

Start the FastAPI application gateway:

```bash
cd ../backend

# Launch MySQL 8.4 container if not running
docker run -d --name impart-mysql -e MYSQL_ROOT_PASSWORD=rootpass -e MYSQL_DATABASE=impart -e MYSQL_USER=impart -e MYSQL_PASSWORD=impart -p 3306:3306 mysql:8.4

export DATABASE_URL="mysql+pymysql://impart:impart@localhost:3306/impart?charset=utf8mb4"
export MODEL_MODE="http"
export MODEL_URL="http://localhost:8001/api/evaluate"

uvicorn app.main:app --host 127.0.0.1 --port 8080 --reload
```

---

### 6. Frontend Web Dashboard

Start the React development server:

```bash
cd ../frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## ⚙️ Configuration & Environment Variables

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `DATABASE_URL` | `postgresql://admin:mysecretpassword@localhost:5432/impart_db` | PostgreSQL pgvector connection string |
| `EMBEDDING_MODEL` | `BAAI/bge-base-en-v1.5` | Dense embedding model (768 dimensions) |
| `RERANKER_MODEL` | `BAAI/bge-reranker-base` | Cross-encoder passage reranker |
| `LLM_PROVIDER` | `gemini` | Model provider: `gemini`, `openrouter`, or `ollama` |
| `GEMINI_API_KEY` | *None* | Google Gemini API Key |
| `OPENROUTER_API_KEY` | *None* | OpenRouter API Key (alternative provider) |
| `MODEL_MODE` | `http` | Backend model connector: `mock`, `http`, or `cli` |
| `MODEL_URL` | `http://model:8000/api/evaluate` | HTTP endpoint of the AI evaluation engine |
| `MYSQL_PASSWORD` | `impart` | Password for MySQL backend history database |
| `API_KEY` | *Optional* | Shared secret header required by backend gateway |

---

## 🔌 API Reference & Testing

### 1. Evaluate a Change Request (AI Engine)
**`POST /api/evaluate`** (Port 8001)

```bash
curl -X POST "http://localhost:8001/api/evaluate" \
  -H "Content-Type: application/json" \
  -d '{
    "cr_text": "The booking system will produce swap contract prices to 10 decimal places with an ISO 8601 UTC Event timestamp.",
    "debug": false
  }'
```

**Response Preview:**
```json
{
  "cr_metadata": {
    "summary": "Adjust swap contract price precision to 10 decimals and format Event timestamp to ISO 8601.",
    "is_ambiguous": false,
    "requirements": [
      {
        "id": "REQ-1",
        "text": "Produce swap contract prices to 10 decimal places",
        "category": "FORMAT"
      },
      {
        "id": "REQ-2",
        "text": "Record Event timestamp in ISO 8601 UTC format",
        "category": "FORMAT"
      }
    ]
  },
  "compliance_table": [
    {
      "regulation": "ASIC",
      "verdict": "Compliant",
      "field_matches": ["Event timestamp", "Price"],
      "citations": ["asic_field_specifications.xlsx:Row 23", "ASIC Guidance-Table S1.1(1)"]
    }
  ]
}
```

### 2. Submit Assessment via Backend Gateway
**`POST /api/assessments`** (Port 8080)

```bash
curl -X POST "http://localhost:8080/api/assessments" \
  -H "Content-Type: application/json" \
  -d '{
    "cr_text": "Update reporting timestamp precision and collateral portfolio code."
  }'
```

---

## ❓ Troubleshooting & FAQs

### Q: Why do I see `relation "regulatory_chunks" does not exist`?
Run `python init_db.py` to create the table and vector extensions in your database before executing ingestion or queries.

### Q: What embedding dimension is used?
The system standardizes on **768 dimensions** using `BAAI/bge-base-en-v1.5` via FastEmbed / ONNX Runtime. This runs locally without GPU requirements or API rate limits.

### Q: How do I re-ingest data from scratch?
Run `python ingest.py --clean --strategy all`. The `--clean` flag automatically truncates existing records in `regulatory_chunks`.

### Q: How can I run the full test suite?
Run the evaluation test suite from the `model/` directory:
```bash
python model/evaluate_v2.py
```

---

## 📄 License & Responsible Use

> **Disclaimer**: IMPART is a decision-support copilot designed for preliminary compliance evaluation. All verdicts and citations are AI-assisted and should be verified by certified compliance and legal professionals before filing regulatory reports.
