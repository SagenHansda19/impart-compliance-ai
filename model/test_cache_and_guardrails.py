import os
import sys
from pathlib import Path
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))

from guardrails import GuardrailEngine, check_cross_regime_bleed, verify_quote_against_evidence
from semantic_cache import SemanticCache, cosine_similarity


def test_cosine_similarity():
    v1 = [1.0, 0.0, 0.0]
    v2 = [1.0, 0.0, 0.0]
    v3 = [0.0, 1.0, 0.0]
    assert pytest.approx(cosine_similarity(v1, v2)) == 1.0
    assert pytest.approx(cosine_similarity(v1, v3)) == 0.0


def test_semantic_cache_exact_hit(tmp_path):
    cache = SemanticCache(cache_dir=tmp_path, enabled=True)
    cr = "Add a new reporting timestamp field in ISO 8601 format"
    fake_resp = {
        "disclaimer": "test",
        "compliance_table": [{"regulation": "EMIR", "compliant": "Yes"}],
        "timing": {"total_ms": 3500},
    }

    cache.store_cr(cr, fake_resp, embedding=[0.5] * 768)

    # Exact lookup
    hit = cache.get_cr(cr, query_embedding=[0.5] * 768)
    assert hit is not None
    assert hit["cached"] is True
    assert hit["cache_tier"] == "exact_cr"
    assert hit["similarity"] == 1.0
    assert hit["compliance_table"] == fake_resp["compliance_table"]


def test_semantic_cache_vector_hit(tmp_path):
    cache = SemanticCache(cache_dir=tmp_path, cr_threshold=0.95, enabled=True)
    cr1 = "Add a new reporting timestamp field in ISO 8601 format"
    fake_resp = {"disclaimer": "test", "compliance_table": []}

    emb1 = [1.0] + [0.0] * 767
    cache.store_cr(cr1, fake_resp, embedding=emb1)

    # Slight perturbation (cosine similarity ~ 0.98)
    emb2 = [0.99, 0.01] + [0.0] * 766
    cr2 = "Add a reporting timestamp field in ISO 8601 format"  # same tokens

    hit = cache.get_cr(cr2, query_embedding=emb2)
    assert hit is not None
    assert hit["cached"] is True
    assert hit["cache_tier"] == "semantic_cr"
    assert hit["similarity"] >= 0.95


def test_semantic_cache_token_guard_prevents_false_positive(tmp_path):
    cache = SemanticCache(cache_dir=tmp_path, cr_threshold=0.90, enabled=True)
    cr1 = "Limit package identifier to 35 characters"
    fake_resp = {"disclaimer": "test", "compliance_table": []}

    emb1 = [1.0] + [0.0] * 767
    cache.store_cr(cr1, fake_resp, embedding=emb1)

    # Similar text but different critical number ('50' instead of '35')
    cr2 = "Limit package identifier to 50 characters"
    emb2 = [0.98, 0.02] + [0.0] * 766

    hit = cache.get_cr(cr2, query_embedding=emb2)
    assert hit is None  # Token guard prevented false positive match!


def test_guardrail_quote_verification():
    ev_text = "Field: Reporting timestamp | Data Type: ISO 8601 UTC datetime. Description: Time report is submitted."
    good_quote = "Data Type: ISO 8601 UTC datetime."
    bad_quote = "This regulation prohibits all timestamps completely."

    is_good, ratio_good = verify_quote_against_evidence(good_quote, ev_text)
    assert is_good is True
    assert ratio_good >= 0.8

    is_bad, ratio_bad = verify_quote_against_evidence(bad_quote, ev_text)
    assert is_bad is False
    assert ratio_bad < 0.5


def test_guardrail_cross_regime_bleed():
    clean_text = "Under EMIR Refit, financial counterparties must report transactions."
    bleeding_text = "Under ASIC Derivative Transaction Rules, this trade must be submitted."

    assert len(check_cross_regime_bleed("EMIR", clean_text)) == 0
    violations = check_cross_regime_bleed("EMIR", bleeding_text)
    assert len(violations) > 0
    assert "ASIC" in violations[0]


def test_guardrail_engine_full():
    engine = GuardrailEngine()
    table = [
        {
            "regulation": "EMIR",
            "compliant": "Yes",
            "quote": "ISO 8601 UTC datetime",
            "reason_if_not_compliant": "",
            "findings": [{"supported": True, "reasoning": "EMIR allows ISO 8601 timestamps."}],
        },
        {
            "regulation": "HKMA",
            "compliant": "No",
            "quote": "Package identifier max 35 characters",
            "reason_if_not_compliant": "Exceeds 35 chars",
            "findings": [{"supported": False, "reasoning": "Under ASIC rules this fails"}],  # bleed!
        },
    ]
    evidences = {
        "EMIR": ("Specification defines format as ISO 8601 UTC datetime.", {}),
        "HKMA": ("Package identifier is limited to max 35 characters.", {}),
    }

    validated, report = engine.apply_guardrails(table, evidences, spectrum=[])
    assert len(validated) == 2
    assert validated[0]["quote_verified"] is True
    assert validated[1]["quote_verified"] is True
    assert report["cross_regime_bleed_detected"] is True
    assert report["grounding_score"] < 1.0
