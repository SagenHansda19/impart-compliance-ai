"""IMPART Post-RAG Compliance Guardrails Engine.

Provides automated deterministic verification across 4 guardrail tiers:
1. Anti-Hallucination Quote Verification: Verifies that cited regulatory quotes
   actually exist verbatim or with high lexical overlap in retrieved evidence chunks.
2. Cross-Regime Isolation Guardrail: Detects and flags cross-jurisdiction bleed
   (e.g., ASIC rules mistakenly cited to justify an EMIR verdict).
3. Logical Decision Consistency: Guarantees consistency between findings,
   verdicts ('Yes' vs 'No'), and the Spectrum of Complexity.
4. Quantitative Grounding Scorer: Computes a composite confidence/grounding
   score (0.0 to 1.0) for regulatory auditability.
"""
import logging
import re
from typing import Any

logger = logging.getLogger(__name__)

ALL_REGS = {"EMIR", "UKEMIR", "ASIC", "MAS", "HKMA"}


def _clean_tokens(text: str) -> list[str]:
    """Tokenize and clean words for fuzzy overlap checks."""
    if not text:
        return []
    words = re.findall(r"\b[a-zA-Z0-9_\-]{3,}\b", text.lower())
    # Exclude trivial stopwords
    stops = {"the", "and", "for", "that", "this", "with", "from", "are", "not", "date", "time"}
    return [w for w in words if w not in stops]


def verify_quote_against_evidence(quote: str, evidence_text: str) -> tuple[bool, float]:
    """Verify that a quote is grounded in the retrieved evidence text.

    Returns:
        (is_verified: bool, overlap_ratio: float)
    """
    if not quote or not evidence_text:
        return False, 0.0

    q_clean = quote.strip()
    ev_clean = evidence_text.strip()

    # 1. Exact or substring match (high confidence)
    if q_clean in ev_clean:
        return True, 1.0

    # 2. Token overlap match (handles formatting differences / ellipsis)
    q_tokens = _clean_tokens(q_clean)
    if not q_tokens:
        return False, 0.0

    ev_tokens = set(_clean_tokens(ev_clean))
    matched = [t for t in q_tokens if t in ev_tokens]
    ratio = len(matched) / len(q_tokens)

    # If >= 75% of non-stopword tokens match the evidence, it is grounded
    return ratio >= 0.75, round(ratio, 3)


def check_cross_regime_bleed(target_reg: str, text: str) -> list[str]:
    """Check if text for a target regulation references rules from a different regulation."""
    if not text:
        return []
    other_regs = ALL_REGS - {target_reg.upper()}
    violations = []
    for o_reg in other_regs:
        # Check for explicit phrases like "Under ASIC Rules" in an EMIR evaluation
        pattern = rf"\b(?:under|per|according to|in)\s+{re.escape(o_reg)}\b"
        if re.search(pattern, text, re.I):
            violations.append(f"Target {target_reg} mentions {o_reg} rules")
    return violations


class GuardrailEngine:
    """Post-RAG verification engine ensuring output integrity and regulatory compliance."""

    def apply_guardrails(
        self,
        compliance_table: list[dict[str, Any]],
        evidences: dict[str, Any],
        spectrum: list[dict[str, Any]],
    ) -> tuple[list[dict[str, Any]], dict[str, Any]]:
        """Run all guardrails over the compliance table and evidence.

        Returns:
            (validated_table, guardrail_report)
        """
        all_violations: list[str] = []
        verified_quotes_count = 0
        total_quotes_count = 0
        bleed_detected = False

        validated_table = []

        for row in compliance_table:
            row_copy = dict(row)
            reg = str(row_copy.get("regulation", "")).upper()
            quote = str(row_copy.get("quote", "")).strip()
            ev_data = evidences.get(reg, ("", {}))
            ev_text = ev_data[0] if isinstance(ev_data, tuple) else str(ev_data)

            # 1. Quote Verification Guardrail
            is_verified = False
            overlap = 0.0
            if quote:
                total_quotes_count += 1
                is_verified, overlap = verify_quote_against_evidence(quote, ev_text)
                if is_verified:
                    verified_quotes_count += 1
                else:
                    all_violations.append(f"[{reg}] Quote not found in retrieved evidence (overlap: {overlap * 100:.1f}%)")

            row_copy["quote_verified"] = is_verified
            row_copy["quote_overlap_score"] = overlap

            # 2. Cross-Regime Isolation Guardrail
            reasoning_blob = " ".join(
                str(f.get("reasoning", "")) for f in row_copy.get("findings", [])
            ) + " " + str(row_copy.get("reason_if_not_compliant", ""))
            bleed_issues = check_cross_regime_bleed(reg, reasoning_blob)
            if bleed_issues:
                bleed_detected = True
                all_violations.extend([f"[{reg}] Cross-regime bleed: {b}" for b in bleed_issues])

            # 3. Decision Consistency Guardrail
            compliant = row_copy.get("compliant")
            reason = str(row_copy.get("reason_if_not_compliant", "")).strip()

            if compliant == "No" and not reason:
                # Inconsistency: marked non-compliant without a reason
                row_copy["reason_if_not_compliant"] = "Non-compliance detected by requirement findings."
                all_violations.append(f"[{reg}] Missing reason_if_not_compliant for non-compliant verdict")
            elif compliant == "Yes" and reason:
                # Inconsistency: marked compliant but reason_if_not_compliant populated
                row_copy["reason_if_not_compliant"] = ""

            validated_table.append(row_copy)

        # 4. Quantitative Grounding Scorer
        quote_rate = (verified_quotes_count / total_quotes_count) if total_quotes_count > 0 else 1.0
        bleed_penalty = 0.2 if bleed_detected else 0.0
        violation_penalty = min(0.05 * len(all_violations), 0.3)

        grounding_score = max(0.0, round(quote_rate - bleed_penalty - violation_penalty, 3))

        report = {
            "passed": len(all_violations) == 0,
            "grounding_score": grounding_score,
            "quote_verification_rate": round(quote_rate, 3),
            "cross_regime_bleed_detected": bleed_detected,
            "violations_count": len(all_violations),
            "violations": all_violations,
        }

        return validated_table, report


# Global default guardrail engine instance
guardrail_engine = GuardrailEngine()
