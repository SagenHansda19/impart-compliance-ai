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
elif LLM_PROVIDER == "groq":
    LLM_API_KEY = os.environ.get("LLM_API_KEY", "")
    LLM_URL = os.environ.get("LLM_URL", "https://api.groq.com/openai/v1/chat/completions")
    _DEFAULT_MODEL = "qwen/qwen3.8-27b"
else:  # Ollama local fallback
    LLM_API_KEY = os.environ.get("LLM_API_KEY", "ollama")
    LLM_URL = os.environ.get("LLM_URL", "http://localhost:11434/v1/chat/completions")
    _DEFAULT_MODEL = "qwen2.5:3b-instruct"

# ----------------------------------------------------------------------------- Multi-Model Pool & Dynamic Regs
raw_models = os.environ.get("JUDGE_MODELS", os.environ.get("JUDGE_MODEL", _DEFAULT_MODEL))
JUDGE_MODELS = [m.strip() for m in raw_models.split(",") if m.strip()]
JUDGE_MODEL = JUDGE_MODELS[0]
EXTRACT_MODEL = os.environ.get("EXTRACT_MODEL", JUDGE_MODEL)
N_VOTES = max(1, int(os.environ.get("N_VOTES", "1")))      # judge votes per regulation
USE_CACHE = os.environ.get("NO_CACHE", "0") != "1"          # NO_CACHE=1 to force fresh LLM calls
MAPPING_MODE = os.environ.get("MAPPING_MODE", "lexical").lower()

_model_pool_idx = 0
_pool_lock = threading.Lock()
_model_cooldowns = {}  # model_name -> cooldown_expiration_timestamp


def parse_reset_seconds(val_str: str) -> float:
    if not val_str:
        return 2.0
    m_sec = re.search(r"([\d\.]+)\s*(ms|s|m)?", str(val_str))
    if m_sec:
        v, unit = float(m_sec.group(1)), m_sec.group(2) or "s"
        return (v / 1000.0 if unit == "ms" else v * 60.0 if unit == "m" else v)
    return 2.0


def mark_model_cooldown(model_name: str, duration_sec: float):
    with _pool_lock:
        _model_cooldowns[model_name] = max(_model_cooldowns.get(model_name, 0), time.time() + duration_sec)


def get_next_model(preferred: str = None, exclude: set = None) -> str:
    """Thread-safe smart model selector from JUDGE_MODELS pool with cooldown avoidance."""
    global _model_pool_idx
    if exclude is None:
        exclude = set()
    now = time.time()

    with _pool_lock:
        if preferred and preferred in JUDGE_MODELS and preferred not in exclude:
            if _model_cooldowns.get(preferred, 0) <= now:
                return preferred

        # Find healthy candidates not on cooldown and not excluded
        healthy = [
            m for m in JUDGE_MODELS
            if m not in exclude and _model_cooldowns.get(m, 0) <= now
        ]

        if healthy:
            m = healthy[_model_pool_idx % len(healthy)]
            _model_pool_idx += 1
            return m

        # If all healthy candidates were in exclude, fall back to any healthy in pool
        not_cooling = [m for m in JUDGE_MODELS if _model_cooldowns.get(m, 0) <= now]
        if not_cooling:
            m = not_cooling[_model_pool_idx % len(not_cooling)]
            _model_pool_idx += 1
            return m

        # All models are cooling down: pick the one that recovers earliest
        earliest_m = min(JUDGE_MODELS, key=lambda m: _model_cooldowns.get(m, 0))
        wait_needed = _model_cooldowns.get(earliest_m, 0) - now
        if wait_needed > 0:
            print(f"  ⏳ [TPM Budget Cooldown] All active models ({', '.join(JUDGE_MODELS)}) cooling down. Pausing {wait_needed:.1f}s for {earliest_m} window...")
            time.sleep(min(wait_needed, 60.0))
        return earliest_m


def get_next_in_pool(current: str) -> str:
    """Deterministically cycle to the next model in JUDGE_MODELS pool, looping back to the first."""
    if current in JUDGE_MODELS:
        idx = JUDGE_MODELS.index(current)
        return JUDGE_MODELS[(idx + 1) % len(JUDGE_MODELS)]
    return JUDGE_MODELS[0]


EMBED_MODEL_NAME = "BAAI/bge-base-en-v1.5"
RERANK_MODEL_NAME = "BAAI/bge-reranker-base"
QUERY_PREFIX = "Represent this sentence for searching relevant passages: "

DEFAULT_REGS = ["EMIR", "UKEMIR", "ASIC", "MAS", "HKMA"]


def get_active_regs():
    """Dynamically discover all ingested regulations from the database."""
    try:
        with db() as conn, conn.cursor() as cur:
            cur.execute("SELECT DISTINCT jurisdiction FROM regulatory_chunks ORDER BY jurisdiction")
            rows = [r[0] for r in cur.fetchall() if r[0]]
            if rows:
                return rows
    except Exception:
        pass
    return DEFAULT_REGS


REGS = get_active_regs()
REGIONS = {"EMEA": [r for r in REGS if "EMIR" in r], "APAC": [r for r in REGS if "EMIR" not in r]}

CACHE_DIR = Path(__file__).resolve().parent / ".llm_cache"
CACHE_DIR.mkdir(exist_ok=True)

_model_lock = threading.Lock()
_embedder = None
_reranker = None


# ----------------------------------------------------------------------------- DB
from psycopg2.pool import ThreadedConnectionPool

_db_pool = None
_pool_lock = threading.Lock()


def get_db_pool():
    global _db_pool
    if _db_pool is None:
        with _pool_lock:
            if _db_pool is None:
                _db_pool = ThreadedConnectionPool(minconn=2, maxconn=30, dsn=DB_URL)
    return _db_pool


@contextmanager
def db():
    pool = get_db_pool()
    conn = pool.getconn()
    try:
        yield conn
    finally:
        pool.putconn(conn)


def vec_literal(v) -> str:
    return "[" + ",".join(f"{float(x):.6f}" for x in v) + "]"


def get_device():
    import torch
    return "cuda" if torch.cuda.is_available() else "cpu"


def get_embedder():
    global _embedder
    with _model_lock:
        if _embedder is None:
            from sentence_transformers import SentenceTransformer
            dev = get_device()
            print(f"Loading embedder {EMBED_MODEL_NAME} on {dev} ...")
            _embedder = SentenceTransformer(EMBED_MODEL_NAME, device=dev)
    return _embedder


def get_reranker():
    global _reranker
    with _model_lock:
        if _reranker is None:
            from sentence_transformers import CrossEncoder
            dev = get_device()
            print(f"Loading reranker {RERANK_MODEL_NAME} on {dev} ...")
            _reranker = CrossEncoder(RERANK_MODEL_NAME, max_length=512, device=dev)
    return _reranker


from functools import lru_cache

_embed_cache = {}
_embed_cache_lock = threading.Lock()


def embed_query(text: str):
    return batch_embed_queries([text])[0]


def batch_embed_queries(texts: list) -> list:
    """Batch embed queries using cache with a single batched neural pass for misses."""
    cleaned = [t.strip() for t in texts if t and t.strip()]
    if not cleaned:
        return []

    # Check cache
    results = {}
    missing = []
    with _embed_cache_lock:
        for t in cleaned:
            if t in _embed_cache:
                results[t] = _embed_cache[t]
            elif t not in missing:
                missing.append(t)

    # Encode misses in a single forward pass
    if missing:
        m = get_embedder()
        prompts = [QUERY_PREFIX + t for t in missing]
        with _model_lock:
            vecs = m.encode(prompts, batch_size=len(prompts), normalize_embeddings=True)
        with _embed_cache_lock:
            for t, v in zip(missing, vecs):
                _embed_cache[t] = [float(x) for x in v]
                results[t] = _embed_cache[t]

    return [results[t.strip()] for t in texts if t and t.strip()]


def embed_docs(texts):
    m = get_embedder()
    with _model_lock:
        return m.encode(texts, batch_size=32, normalize_embeddings=True, show_progress_bar=True)


def rerank_scores(query: str, texts):
    if not texts:
        return []
    rr = get_reranker()
    pairs = [(query, t) for t in texts]
    with _model_lock:
        return [float(s) for s in rr.predict(pairs, batch_size=len(pairs))]


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


def llm_json(system: str, user: str, model: str = None, temperature: float = 0.0,
             salt: str = "", retries: int = None):
    """JSON chat call: multi-model pool rotation, rate-limit resilience, on-disk cache, loud errors."""
    if not LLM_API_KEY:
        raise RuntimeError(f"API key not set for {LLM_PROVIDER}")
    
    if retries is None:
        retries = max(12, len(JUDGE_MODELS) * 4)

    current_model = model or get_next_model()
    key = hashlib.sha256(
        json.dumps([LLM_PROVIDER, current_model, temperature, salt, system, user], ensure_ascii=False).encode()
    ).hexdigest()
    path = CACHE_DIR / f"{key}.json"
    if USE_CACHE and path.exists():
        return json.loads(path.read_text())

    payload = {
        "model": current_model,
        "temperature": temperature,
        "response_format": {"type": "json_object"},
        "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
    }
    headers = {"Authorization": f"Bearer {LLM_API_KEY}", "Content-Type": "application/json"}
    last = None
    for attempt in range(retries):
        wait = min(2 * (attempt + 1), 20)
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
                    # Token budget awareness: if remaining tokens < 1500, proactively mark cooldown
                    rem_tokens = r.headers.get("x-ratelimit-remaining-tokens")
                    reset_tokens = r.headers.get("x-ratelimit-reset-tokens")
                    if rem_tokens and rem_tokens.isdigit() and int(rem_tokens) < 1500:
                        mark_model_cooldown(current_model, parse_reset_seconds(reset_tokens) + 0.5)

                    parsed = _parse_json(data["choices"][0]["message"]["content"])
                    if USE_CACHE:
                        path.write_text(json.dumps(parsed))
                    return parsed
            else:
                last = f"HTTP {r.status_code}: {r.text[:300]}"
                if r.status_code == 429:
                    if re.search(r"per[- ]?day|daily", r.text, re.I):
                        raise RuntimeError(f"DAILY quota reached: {r.text[:300]}")

                    reset_tokens = r.headers.get("x-ratelimit-reset-tokens", "")
                    retry_after = r.headers.get("Retry-After", "")
                    m_text = re.search(r"try again in ([\d\.]+)s", r.text, re.I)

                    if reset_tokens:
                        cooldown_sec = parse_reset_seconds(reset_tokens)
                    elif retry_after and retry_after.replace(".", "", 1).isdigit():
                        cooldown_sec = float(retry_after)
                    elif m_text:
                        cooldown_sec = float(m_text.group(1))
                    else:
                        cooldown_sec = min(3 * (attempt + 1), 30)

                    mark_model_cooldown(current_model, cooldown_sec + 0.5)

                    # Seamless rotation: cycle to next model in pool, looping back to the first
                    if len(JUDGE_MODELS) > 1 and attempt < retries - 1:
                        next_m = get_next_in_pool(current_model)
                        payload["model"] = next_m

                        wait_for_next = _model_cooldowns.get(next_m, 0) - time.time()
                        if wait_for_next > 0:
                            print(f"  ⏳ [Rate-Limit Cooldown] All models cooling down. Pausing {wait_for_next:.1f}s for {next_m}...")
                            time.sleep(min(wait_for_next, 60.0))
                        else:
                            print(f"  🔄 [Rate-Limit Failover] {current_model} reached limit -> rotating to {next_m} (attempt {attempt + 1})")
                            time.sleep(0.1)

                        current_model = next_m
                        continue

                    wait = cooldown_sec + 0.5
        except (requests.RequestException, KeyError, TypeError, ValueError) as e:
            last = f"{type(e).__name__}: {e}"
        time.sleep(wait)
    raise RuntimeError(f"LLM call failed after {retries} attempts: {last}")