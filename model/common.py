"""Shared config, DB helpers, model singletons and LLM client for IMPART v2."""
import hashlib
import json
import os
import re
import threading
import time
from contextlib import contextmanager
from pathlib import Path

import psycopg2
import requests

# Load model/.env if present
_env_file = Path(__file__).resolve().parent / ".env"
if _env_file.is_file():
    for _line in _env_file.read_text(encoding="utf-8").splitlines():
        _line = _line.strip()
        if _line and not _line.startswith("#") and "=" in _line:
            _k, _v = _line.split("=", 1)
            _k, _v = _k.strip(), _v.strip().strip("'\"")
            if _k not in os.environ:
                os.environ[_k] = _v

DB_URL = os.environ.get("DB_URL", "postgresql://admin:mysecretpassword@localhost:5433/impart_db")

# ----------------------------------------------------------------------------- LLM provider
# Configured for Gemini Flash using the OpenAI-compatible endpoint
LLM_PROVIDER = os.environ.get("LLM_PROVIDER", "gemini").lower()

if LLM_PROVIDER == "gemini":
    LLM_API_KEY = os.environ.get("GEMINI_API_KEY", "")
    LLM_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
    _DEFAULT_MODEL = "gemini-3.8-flash"
elif LLM_PROVIDER == "openrouter":
    LLM_API_KEY = os.environ.get("OPENROUTER_API_KEY")
    LLM_URL = "https://openrouter.ai/api/v1/chat/completions"
    _DEFAULT_MODEL = "meta-llama/llama-3.3-70b-instruct"
else:  # Ollama local fallback
    LLM_API_KEY = os.environ.get("LLM_API_KEY", "ollama")
    LLM_URL = "http://localhost:11434/v1/chat/completions"
    _DEFAULT_MODEL = "qwen2.5:7b-instruct"

JUDGE_MODEL = os.environ.get("JUDGE_MODEL", _DEFAULT_MODEL)
EXTRACT_MODEL = os.environ.get("EXTRACT_MODEL", JUDGE_MODEL)
N_VOTES = max(1, int(os.environ.get("N_VOTES", "1")))      # judge votes per regulation
USE_CACHE = os.environ.get("NO_CACHE", "0") != "1"          # NO_CACHE=1 to force fresh LLM calls
MAPPING_MODE = os.environ.get("MAPPING_MODE", "lexical").lower()

EMBED_MODEL_NAME = "BAAI/bge-base-en-v1.5"
RERANK_MODEL_NAME = "BAAI/bge-reranker-base"
QUERY_PREFIX = "Represent this sentence for searching relevant passages: "

REGS = ["EMIR", "UKEMIR", "ASIC", "MAS", "HKMA"]
REGIONS = {"EMEA": ["EMIR", "UKEMIR"], "APAC": ["ASIC", "MAS", "HKMA"]}

CACHE_DIR = Path(__file__).resolve().parent / ".llm_cache"
CACHE_DIR.mkdir(exist_ok=True)

_model_lock = threading.Lock()
_embedder = None
_reranker = None


# ----------------------------------------------------------------------------- DB
@contextmanager
def db():
    conn = psycopg2.connect(DB_URL)
    try:
        yield conn
    finally:
        conn.close()


def vec_literal(v) -> str:
    return "[" + ",".join(f"{float(x):.6f}" for x in v) + "]"


# ----------------------------------------------------------------------------- models
def get_embedder():
    global _embedder
    with _model_lock:
        if _embedder is None:
            from sentence_transformers import SentenceTransformer
            print(f"Loading embedder {EMBED_MODEL_NAME} ...")
            _embedder = SentenceTransformer(EMBED_MODEL_NAME)
    return _embedder


def get_reranker():
    global _reranker
    with _model_lock:
        if _reranker is None:
            from sentence_transformers import CrossEncoder
            print(f"Loading reranker {RERANK_MODEL_NAME} ...")
            _reranker = CrossEncoder(RERANK_MODEL_NAME, max_length=512)
    return _reranker


def embed_query(text: str):
    m = get_embedder()
    with _model_lock:
        v = m.encode([QUERY_PREFIX + text], normalize_embeddings=True)[0]
    return v.tolist()


def embed_docs(texts):
    m = get_embedder()
    with _model_lock:
        return m.encode(texts, batch_size=32, normalize_embeddings=True, show_progress_bar=True)


def rerank_scores(query: str, texts):
    rr = get_reranker()
    with _model_lock:
        return [float(s) for s in rr.predict([(query, t) for t in texts], batch_size=16)]


# ----------------------------------------------------------------------------- LLM
def _parse_json(text: str):
    text = (text or "").strip()
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text, flags=re.I)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        s, e = text.find("{"), text.rfind("}")
        if s != -1 and e > s:
            return json.loads(text[s:e + 1])
        raise


_llm_sem = threading.Semaphore(max(1, int(os.environ.get("LLM_CONCURRENCY", "4"))))
LLM_TIMEOUT = int(os.environ.get("LLM_TIMEOUT", "120"))


def llm_json(system: str, user: str, model: str, temperature: float = 0.0,
             salt: str = "", retries: int = 4):
    """JSON chat call (Gemini or OpenRouter): global concurrency cap, Retry-After on 429, on-disk cache, loud errors."""
    if not LLM_API_KEY:
        raise RuntimeError("GEMINI_API_KEY is not set")
    key = hashlib.sha256(
        json.dumps([LLM_PROVIDER, model, temperature, salt, system, user], ensure_ascii=False).encode()
    ).hexdigest()
    path = CACHE_DIR / f"{key}.json"
    if USE_CACHE and path.exists():
        return json.loads(path.read_text())

    payload = {
        "model": model,
        "temperature": temperature,
        "response_format": {"type": "json_object"},
        "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
    }
    headers = {"Authorization": f"Bearer {LLM_API_KEY}", "Content-Type": "application/json"}
    last = None
    for attempt in range(retries):
        wait = min(2 ** attempt, 20)
        try:
            with _llm_sem:
                r = requests.post(LLM_URL, headers=headers, json=payload, timeout=LLM_TIMEOUT)
            if r.status_code == 400 and "response_format" in payload:
                payload.pop("response_format")
                last = "HTTP 400 (retrying without response_format)"
                continue
            if r.status_code in (401, 402, 403, 404):
                hint = {404: "model id not available - check JUDGE_MODEL / EXTRACT_MODEL"}.get(r.status_code, "auth/credits")
                raise RuntimeError(f"HTTP {r.status_code} ({hint}, not retrying): {r.text[:300]}")
            if r.status_code == 200:
                data = r.json()
                if "choices" not in data:
                    last = f"provider error: {str(data.get('error'))[:200]}"
                else:
                    parsed = _parse_json(data["choices"][0]["message"]["content"])
                    if USE_CACHE:
                        path.write_text(json.dumps(parsed))
                    return parsed
            else:
                last = f"HTTP {r.status_code}: {r.text[:300]}"
                if r.status_code == 429 and re.search(r"per[- ]?day|daily", r.text, re.I):
                    raise RuntimeError(f"DAILY quota reached - stop and retry tomorrow or enable billing/credits. {r.text[:300]}")
                if r.status_code == 429:
                    ra = r.headers.get("Retry-After", "")
                    wait = min(float(ra) if ra.replace(".", "", 1).isdigit() else 5 * 2 ** attempt, 60)
        except (requests.RequestException, KeyError, TypeError, ValueError) as e:
            last = f"{type(e).__name__}: {e}"
        time.sleep(wait)
    raise RuntimeError(f"LLM call failed after {retries} attempts: {last}")