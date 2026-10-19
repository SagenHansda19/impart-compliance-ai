"""All settings come from environment variables (see .env.example)."""
import os
from pathlib import Path

try:  # lets you keep settings (DATABASE_URL, MODEL_*, API_KEY) in backend/.env instead of typing them every time
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).resolve().parent.parent / ".env", override=False)  # real environment variables win
except ImportError:  # python-dotenv comes with uvicorn[standard]; fine to skip if missing
    pass

DISCLAIMER = "AI-generated: Requires Human Review"
REGION_MAP = {"EMIR": "EMEA", "UKEMIR": "EMEA", "ASIC": "APAC", "MAS": "APAC", "HKMA": "APAC"}


def _bool(name: str, default: bool) -> bool:
    return os.getenv(name, str(default)).strip().lower() in ("1", "true", "yes", "on")


class Settings:
    # --- database (MySQL 8) ---
    database_url: str = os.getenv("DATABASE_URL", "mysql+pymysql://impart:impart@localhost:3306/impart?charset=utf8mb4")

    # --- security ---
    api_key: str | None = os.getenv("API_KEY") or None  # if empty, API is open (local dev only)
    cors_origins: list[str] = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:8000,http://localhost:3000").split(",") if o.strip()]

    # --- input limits ---
    min_cr_chars: int = int(os.getenv("MIN_CR_CHARS", "10"))
    max_cr_chars: int = int(os.getenv("MAX_CR_CHARS", "10000"))
    pii_check: bool = _bool("PII_CHECK", True)

    # --- model integration: "mock" | "http" | "cli" ---
    model_mode: str = os.getenv("MODEL_MODE", "http")
    model_timeout_s: float = float(os.getenv("MODEL_TIMEOUT_S", "180"))
    model_retries: int = int(os.getenv("MODEL_RETRIES", "2"))  # http mode only, transient errors only
    # http mode
    model_url: str = os.getenv("MODEL_URL", "http://localhost:8001/api/evaluate")
    model_request_field: str = os.getenv("MODEL_REQUEST_FIELD", "cr_text")  # JSON key that carries the CR text
    model_api_key: str | None = os.getenv("MODEL_API_KEY") or None
    # cli mode: CR text is sent on stdin, JSON is read from stdout
    model_cli_command: str = os.getenv("MODEL_CLI_COMMAND", "python impart.py assess --json")
    model_cli_cwd: str | None = os.getenv("MODEL_CLI_CWD") or None

    expected_regulations: list[str] = [r.strip().upper() for r in
                                       os.getenv("EXPECTED_REGULATIONS", "EMIR,UKEMIR,ASIC,MAS,HKMA").split(",") if r.strip()]
    model_label: str = os.getenv("MODEL_LABEL", "impart-model")  # stored with every assessment


settings = Settings()
