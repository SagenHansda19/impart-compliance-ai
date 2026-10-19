"""Data perimeter (Use Case s IX): reject CRs that contain client personal/trade data.

Deliberately conservative. LEIs (20 chars) and field widths such as "45-50" are NOT flagged.
Extend PII_PATTERNS with your own rules.
"""
import hashlib
import re

PII_PATTERNS = {
    "email": re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}"),
    "phone": re.compile(r"(?<!\d)(?:\+?\d[\s-]?){10,14}(?!\d)"),
    "iban": re.compile(r"\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b"),
    "account_number": re.compile(r"(?i)\b(?:account|acct|a/c)\s*(?:no\.?|number|#)?\s*[:=]?\s*\d{6,}\b"),
    "card_number": re.compile(r"\b(?:\d[ -]?){13,19}\b"),
    "government_id": re.compile(r"(?i)\b(?:passport|ssn|aadhaar|pan)\s*(?:no\.?|number|#)?\s*[:=]?\s*[A-Z0-9]{6,}\b"),
    "trade_id_literal": re.compile(r"(?i)\btrade\s*id\s*[:=]\s*[A-Za-z0-9-]{6,}\b"),
}


def scan_pii(text: str) -> list[str]:
    return sorted(name for name, pat in PII_PATTERNS.items() if pat.search(text))


def text_hash(text: str) -> str:
    """Hash of whitespace/case-normalised text, used to group repeated submissions of the same CR."""
    return hashlib.sha256(" ".join(text.split()).lower().encode()).hexdigest()
