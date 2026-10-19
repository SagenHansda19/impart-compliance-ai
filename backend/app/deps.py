from fastapi import Header

from .config import settings
from .errors import AppError


def require_key(x_api_key: str | None = Header(default=None)) -> None:
    """Shared-key auth. If API_KEY is not set the API is open (development only)."""
    if settings.api_key and x_api_key != settings.api_key:
        raise AppError(401, "unauthorized", "Missing or invalid X-API-Key header")


def caller(x_user: str | None = Header(default=None)) -> str | None:
    """Who is calling (set by your frontend/gateway); stored with each assessment."""
    return x_user[:100] if x_user else None
