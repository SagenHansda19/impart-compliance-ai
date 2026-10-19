# IMPART backend (FastAPI + MySQL)

Takes a change request (CR) as text, **validates it**, sends it to your model,
checks the model's JSON, applies a conservative decision rule, and stores everything in MySQL as history.
No vector DB. Built around the model JSON you pasted (`compliance_table`, `cr_metadata`, ...).

## Run it
Use the master folder one level up: `docker compose up --build` there starts MySQL + this API + the web page
(see the master README). To run only this backend: create a MySQL database (`CREATE DATABASE impart CHARACTER SET utf8mb4;`), then
```bash
python -m venv .venv && . .venv/bin/activate && pip install -r requirements.txt
export DATABASE_URL="mysql+pymysql://USER:PASS@localhost:3306/impart?charset=utf8mb4"   # or sqlite:///impart.db for a quick try
uvicorn app.main:app --port 8080
```
API docs: http://localhost:8080/docs. Tables are created on startup. Tests: `pytest` (in-memory SQLite, never touches your DB).

## Connect your model (the only thing you must change): `MODEL_MODE`
| mode | what happens |
|---|---|
| `mock` (default) | canned answer in your output format, so you can build the frontend now |
| `http` | `POST MODEL_URL` with `{"<MODEL_REQUEST_FIELD>": "<cr text>"}` (default field `cr`), expects your JSON back. Retries only timeouts / 5xx / connection errors |
| `cli` | runs `MODEL_CLI_COMMAND` (default `python impart.py assess --json`), CR on **stdin**, JSON on **stdout**. Reloads the model on every call, so slow - prefer `http` (wrap `impart.py` in a tiny service) |

If your model's request field or CLI differs, change `MODEL_REQUEST_FIELD` / `MODEL_CLI_COMMAND`, or edit `app/model_client.py` (~10 lines).

## Endpoints (all under `X-API-Key` if `API_KEY` is set; optional `X-User` header is stored)
| | |
|---|---|
| `POST /api/assessments` | `{"cr_text": "..."}` -> 201 full assessment. Optional `Idempotency-Key` header (replay -> 200) |
| `GET /api/assessments` | history, newest first. Filters: `cr_id status overall regulation effective_status q from to limit offset` |
| `GET /api/assessments/{id}` | full record: table, evidence, explanation, heatmap, raw-derived fields |
| `POST /api/assessments/{id}/reassess` | run same CR again; old record untouched, new one links via `parent_assessment_id` |
| `GET /api/analytics/heatmap` | per-regulation counts + conflict rate across history |
| `GET /api/health` | DB check (503 if down) |

## Decision rule (what the backend adds on top of the model)
- Model says **No** -> `non_compliant`. **Yes** with no flags -> `compliant`. **Yes** with any flag -> `needs_review`.
- Flags: `unverified_quote` (quote_verified not true), `missing_quote`, `missing_citation`, `sources_disagree`, `unrecognised_verdict`, `missing_reason`.
- Overall: any non_compliant -> **Do Not Proceed**; else ambiguous CR / any needs_review / missing regulation -> **Needs Review**; else **Proceed**.
- `risk_score` = % of rows non_compliant. `is_ambiguous` -> status `needs_clarification`.
- Every response carries `"AI-generated: Requires Human Review"`.
- Model output with an empty table (not ambiguous), duplicate or unnamed regulation -> rejected `invalid_model_output` (502), stored with the raw output for debugging.

## Errors
Always `{"error":{"code","message","details"},"request_id"}`; `X-Request-ID` header on every response.
| code | HTTP | when |
|---|---|---|
| `cr_missing` | 422 | no `cr_text` / null / no file |
| `cr_invalid_type` | 422 | not a string |
| `cr_too_short` / `cr_too_long` | 422 / 413 | < `MIN_CR_CHARS` / > `MAX_CR_CHARS` |
| `cr_not_text` | 422 | no letters/digits |
| `pii_detected` | 422 | email, phone, IBAN, card, account no., ID, trade-ID found (`PII_CHECK=false` to disable) |
| `unauthorized` | 401 | bad `X-API-Key` |
| `model_timeout` | 504 | model too slow |
| `model_unreachable` `model_unavailable` `model_rejected` `model_bad_response` | 502 | model call problems |
| `invalid_model_output` | 502 | JSON failed validation |
| `assessment_not_found` | 404 | |
| `invalid_request` / `internal_error` | 422 / 500 | |
Failed model attempts are still saved (status `model_error` / `invalid_model_output`) so history is complete.

## Tables
`change_requests` (unique by normalised-text hash), `assessments` (immutable; JSON `raw_model_output`), `assessment_results` (one row per regulation). See `schema.sql`.

## Notes
- No migrations tool: tables are created on first start. Add Alembic before changing columns in production.
- Excel: all sheets are read and joined; scanned PDFs are rejected, not OCR'd.
- Scale: model calls run in the request thread (FastAPI threadpool); fine for internal use. For heavy load, move to a job queue.
