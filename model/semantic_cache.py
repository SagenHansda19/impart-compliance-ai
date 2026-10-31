"""IMPART Semantic Caching Engine for Regulatory Change Requests (CRs).

Provides a 2-tier hierarchical semantic cache:
1. Tier 1 (Full-CR Semantic Cache): Caches end-to-end evaluation for semantically
   equivalent Change Requests (cosine similarity >= threshold, entity-constrained).
2. Tier 2 (Requirement-Level Sub-Cache): Caches per-requirement regulatory findings
   so multi-part CRs sharing sub-tasks with previous CRs can reuse evaluated requirements.
"""
import hashlib
import json
import logging
import os
import re
import threading
import time
from pathlib import Path
from typing import Any, Optional

import numpy as np

logger = logging.getLogger(__name__)

CACHE_DIR = Path(__file__).resolve().parent / ".semantic_cache"
CACHE_FILE = CACHE_DIR / "cr_semantic_cache.json"
REQ_CACHE_FILE = CACHE_DIR / "req_semantic_cache.json"

DEFAULT_SIMILARITY_THRESHOLD = float(os.getenv("SEMANTIC_CACHE_THRESHOLD", "0.90"))
REQ_SIMILARITY_THRESHOLD = float(os.getenv("REQ_CACHE_THRESHOLD", "0.88"))


def _normalize_text(text: str) -> str:
    """Normalize text for consistent hashing and embedding comparison."""
    if not text:
        return ""
    # Lowercase, collapse whitespace, strip common leading/trailing phrases
    t = text.lower().strip()
    t = re.sub(r"\s+", " ", t)
    return t


def _trigram_cosine(t1: str, t2: str) -> float:
    """Zero-memory character trigram cosine similarity fallback."""
    from collections import Counter
    import math

    def get_trigrams(t: str):
        t = " " + t.lower().strip() + " "
        return Counter([t[i : i + 3] for i in range(len(t) - 2)])

    c1, c2 = get_trigrams(t1), get_trigrams(t2)
    dot = sum(c1[k] * c2[k] for k in c1 if k in c2)
    norm1 = math.sqrt(sum(v * v for v in c1.values()))
    norm2 = math.sqrt(sum(v * v for v in c2.values()))
    return dot / (norm1 * norm2) if norm1 and norm2 else 0.0


def _extract_critical_tokens(text: str) -> set[str]:
    """Extract numbers, acronyms, and constraints that must match to prevent false positives."""
    norm = _normalize_text(text)
    # Extract numbers (e.g., '35', '50', '801')
    numbers = set(re.findall(r"\b\d+\b", norm))
    # Extract key regulatory terms
    reg_terms = set(re.findall(r"\b(emir|ukemir|asic|mas|hkma|lei|uti|upi|etd|otc|iso\s*8601|utc)\b", norm))
    return numbers | reg_terms


def cosine_similarity(v1: list[float] | np.ndarray, v2: list[float] | np.ndarray) -> float:
    """Compute cosine similarity between two dense embedding vectors."""
    a = np.array(v1, dtype=np.float32)
    b = np.array(v2, dtype=np.float32)
    norm = float(np.linalg.norm(a) * np.linalg.norm(b))
    if norm == 0.0:
        return 0.0
    return float(np.dot(a, b) / norm)


class SemanticCache:
    """Thread-safe hierarchical semantic cache for regulatory assessments."""

    def __init__(
        self,
        cache_dir: Path = CACHE_DIR,
        cr_threshold: float = DEFAULT_SIMILARITY_THRESHOLD,
        req_threshold: float = REQ_SIMILARITY_THRESHOLD,
        enabled: Optional[bool] = None,
    ):
        self.cache_dir = cache_dir
        self.cr_threshold = cr_threshold
        self.req_threshold = req_threshold
        self.enabled = (
            enabled
            if enabled is not None
            else (os.environ.get("NO_CACHE", "0").lower() not in ("1", "true", "yes"))
        )
        self.lock = threading.Lock()
        self._cr_entries: list[dict[str, Any]] = []
        self._req_entries: list[dict[str, Any]] = []
        self.stats = {"hits": 0, "misses": 0, "tokens_saved": 0, "latency_saved_ms": 0}
        self._load()

    def _load(self) -> None:
        """Load persisted cache entries from disk."""
        if not self.enabled:
            return
        try:
            self.cache_dir.mkdir(parents=True, exist_ok=True)
            if CACHE_FILE.exists():
                with open(CACHE_FILE, "r", encoding="utf-8") as f:
                    self._cr_entries = json.load(f)
            if REQ_CACHE_FILE.exists():
                with open(REQ_CACHE_FILE, "r", encoding="utf-8") as f:
                    self._req_entries = json.load(f)
        except Exception as e:
            logger.warning("Could not load semantic cache: %s", e)
            self._cr_entries = []
            self._req_entries = []

    def _save(self) -> None:
        """Persist cache entries to disk."""
        if not self.enabled:
            return
        try:
            self.cache_dir.mkdir(parents=True, exist_ok=True)
            with open(CACHE_FILE, "w", encoding="utf-8") as f:
                json.dump(self._cr_entries[-200:], f, indent=2)  # retain latest 200
            with open(REQ_CACHE_FILE, "w", encoding="utf-8") as f:
                json.dump(self._req_entries[-500:], f, indent=2)  # retain latest 500
        except Exception as e:
            logger.warning("Could not save semantic cache: %s", e)

    def clear(self) -> None:
        """Clear all in-memory and disk cache entries."""
        with self.lock:
            self._cr_entries.clear()
            self._req_entries.clear()
            for p in (CACHE_FILE, REQ_CACHE_FILE):
                if p.exists():
                    p.unlink()

    # -------------------------------------------------------------------------
    # Tier 1: Full Change Request Semantic Caching
    # -------------------------------------------------------------------------
    def get_cr(self, cr_text: str, query_embedding: Optional[list[float]] = None) -> Optional[dict[str, Any]]:
        """Look up a Change Request in the semantic cache.

        Checks exact hash first (< 0.1ms), then dense cosine similarity (>= 0.90)
        or trigram similarity fallback (>= 0.75) with critical token guard.
        """
        if not self.enabled or not cr_text.strip():
            return None

        norm = _normalize_text(cr_text)
        exact_hash = hashlib.sha256(norm.encode("utf-8")).hexdigest()
        tokens = _extract_critical_tokens(norm)

        with self.lock:
            # 1. Exact match pass
            for entry in self._cr_entries:
                if entry.get("exact_hash") == exact_hash:
                    self.stats["hits"] += 1
                    self.stats["tokens_saved"] += entry.get("approx_tokens", 2500)
                    saved_ms = entry.get("timing", {}).get("total_ms", 3000)
                    self.stats["latency_saved_ms"] += saved_ms
                    result = dict(entry["response"])
                    result["cached"] = True
                    result["cache_tier"] = "exact_cr"
                    result["similarity"] = 1.0
                    if "timing" in result and isinstance(result["timing"], dict):
                        result["timing"] = dict(result["timing"])
                        result["timing"]["cache_hit"] = True
                        result["timing"]["cache_tier"] = "exact_cr"
                        result["timing"]["similarity"] = 1.0
                        result["timing"]["total_ms"] = 2
                    return result

            # 2. Semantic similarity pass (Dense Embedding or Trigram Fallback)
            if not self._cr_entries:
                self.stats["misses"] += 1
                return None

            best_match = None
            best_sim = -1.0
            best_tier = "semantic_cr"

            for entry in self._cr_entries:
                cached_emb = entry.get("embedding")
                cached_norm_text = entry.get("norm_text", "")

                sim = -1.0
                tier = "semantic_cr"

                # If query_embedding and cached_emb exist, use dense vector similarity
                if query_embedding is not None and cached_emb:
                    sim = cosine_similarity(query_embedding, cached_emb)
                    threshold = self.cr_threshold
                elif cached_norm_text:
                    # Lightweight trigram similarity fallback (zero RAM)
                    sim = _trigram_cosine(norm, cached_norm_text)
                    threshold = 0.75
                    tier = "trigram_cr"
                else:
                    continue

                if sim >= threshold and sim > best_sim:
                    # Guardrail: critical tokens (numbers, acronyms) must match exactly
                    cached_tokens = set(entry.get("critical_tokens", []))
                    if tokens == cached_tokens:
                        # Length ratio check: lengths must be within +/- 30%
                        cached_len = entry.get("char_len", len(norm))
                        ratio = len(norm) / max(cached_len, 1)
                        if 0.70 <= ratio <= 1.40:
                            best_sim = sim
                            best_match = entry
                            best_tier = tier

            if best_match is not None:
                self.stats["hits"] += 1
                self.stats["tokens_saved"] += best_match.get("approx_tokens", 2500)
                saved_ms = best_match.get("timing", {}).get("total_ms", 3000)
                self.stats["latency_saved_ms"] += saved_ms
                result = dict(best_match["response"])
                result["cached"] = True
                result["cache_tier"] = best_tier
                result["similarity"] = round(best_sim, 4)
                if "timing" in result and isinstance(result["timing"], dict):
                    result["timing"] = dict(result["timing"])
                    result["timing"]["cache_hit"] = True
                    result["timing"]["cache_tier"] = best_tier
                    result["timing"]["similarity"] = round(best_sim, 4)
                    result["timing"]["total_ms"] = 5
                return result

            self.stats["misses"] += 1
            return None

    def store_cr(
        self,
        cr_text: str,
        response: dict[str, Any],
        embedding: Optional[list[float]] = None,
        approx_tokens: int = 2500,
    ) -> None:
        """Store a full Change Request evaluation in the cache."""
        if not self.enabled or not cr_text.strip():
            return

        norm = _normalize_text(cr_text)
        exact_hash = hashlib.sha256(norm.encode("utf-8")).hexdigest()
        tokens = list(_extract_critical_tokens(norm))

        clean_resp = {k: v for k, v in response.items() if k not in ("cached", "cache_tier", "similarity")}

        entry = {
            "exact_hash": exact_hash,
            "norm_text": norm,
            "char_len": len(norm),
            "critical_tokens": tokens,
            "embedding": embedding,
            "approx_tokens": approx_tokens,
            "timing": response.get("timing", {}),
            "response": clean_resp,
            "created_at": time.time(),
        }

        with self.lock:
            # Avoid duplicate identical entries
            self._cr_entries = [e for e in self._cr_entries if e.get("exact_hash") != exact_hash]
            self._cr_entries.append(entry)
            self._save()

    # -------------------------------------------------------------------------
    # Tier 2: Decomposed Requirement-Level Sub-Cache
    # -------------------------------------------------------------------------
    def get_requirement(
        self,
        concept: str,
        reg: str,
        query_embedding: Optional[list[float]] = None,
    ) -> Optional[dict[str, Any]]:
        """Look up findings for a single atomic requirement and jurisdiction."""
        if not self.enabled:
            return None

        norm_concept = _normalize_text(concept)
        reg_upper = reg.upper()

        with self.lock:
            for entry in self._req_entries:
                if entry.get("reg") != reg_upper:
                    continue

                # Exact concept match
                if entry.get("norm_concept") == norm_concept:
                    return entry.get("finding")

                # Semantic vector match
                if query_embedding and entry.get("embedding"):
                    sim = cosine_similarity(query_embedding, entry["embedding"])
                    if sim >= self.req_threshold:
                        return entry.get("finding")

        return None

    def store_requirement(
        self,
        concept: str,
        reg: str,
        finding: dict[str, Any],
        embedding: Optional[list[float]] = None,
    ) -> None:
        """Store findings for a single atomic requirement and jurisdiction."""
        if not self.enabled:
            return

        entry = {
            "norm_concept": _normalize_text(concept),
            "reg": reg.upper(),
            "embedding": embedding,
            "finding": finding,
            "created_at": time.time(),
        }

        with self.lock:
            self._req_entries.append(entry)
            if len(self._req_entries) > 500:
                self._req_entries = self._req_entries[-500:]


# Global default semantic cache instance
semantic_cache = SemanticCache()
