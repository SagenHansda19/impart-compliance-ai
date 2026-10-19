"""Validate the change-request text. Every bad input gets a specific error code.

  cr_missing     no text / null            cr_invalid_type  not a string
  cr_blank       empty or whitespace only  cr_too_short     fewer than MIN_CR_CHARS
  cr_not_text    no real words (only digits/symbols)   cr_too_long   more than MAX_CR_CHARS
  pii_detected   client personal / trade data found
"""
import re
import unicodedata
from dataclasses import dataclass

from .config import settings
from .errors import AppError
from .guardrails import scan_pii


@dataclass
class CRInput:
    text: str
    source_type: str  # text | pdf | xlsx | csv | txt
    filename: str | None = None


def _clean(text: str) -> str:
    text = unicodedata.normalize("NFC", text).replace("\x00", "")
    text = re.sub(r"[ \t\r\f\v]+", " ", text)
    text = re.sub(r"\n\s*\n+", "\n\n", text)
    return text.strip()


def validate_text(raw: object, source_type: str = "text", filename: str | None = None) -> CRInput:
    """Validate CR text from any source. Raises AppError with a specific code."""
    if raw is None:
        raise AppError(422, "cr_missing", "No change request was provided. Send 'cr_text'.")
    if not isinstance(raw, str):
        raise AppError(422, "cr_invalid_type", "'cr_text' must be a string.")
    text = _clean(raw)
    if not text:
        code = "cr_blank" if source_type == "text" else "file_blank"
        raise AppError(422, code, "The change request is empty." if source_type == "text"
                       else "The file contains no text.")
    if len(text) < settings.min_cr_chars:
        raise AppError(422, "cr_too_short", f"The change request is too short (minimum {settings.min_cr_chars} characters).",
                       {"length": len(text), "min": settings.min_cr_chars})
    if not re.search(r"[^\W\d_]{3}", text):
        raise AppError(422, "cr_not_text", "The change request must contain readable words, not only numbers or symbols.")
    if len(text) > settings.max_cr_chars:
        raise AppError(413, "cr_too_long", f"The change request is too long (maximum {settings.max_cr_chars} characters).",
                       {"length": len(text), "max": settings.max_cr_chars})
    if settings.pii_check:
        found = scan_pii(text)
        if found:
            raise AppError(422, "pii_detected",
                           "The change request appears to contain client personal or trade data. "
                           "Only rules and structural changes may be submitted.", {"types": found})
    return CRInput(text=text, source_type=source_type, filename=filename)
