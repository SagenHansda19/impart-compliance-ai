from .models import Assessment


EXTRA_ROW_FIELDS = ("source_values", "vote_errors", "mapped_fields", "catalog_size")


def row_out(r, raw_row: dict | None = None) -> dict:
    extra = {k: (raw_row or {}).get(k) for k in EXTRA_ROW_FIELDS}  # read from the stored raw model output
    return {**extra, "regulation": r.regulation, "region": r.region, "compliant": r.compliant,
            "effective_status": r.effective_status, "reason_if_not_compliant": r.reason_if_not_compliant,
            "citation": r.citation, "quote": r.quote, "quote_verified": r.quote_verified,
            "sources_disagree": r.sources_disagree, "votes": r.votes, "findings": r.findings, "flags": r.flags}


def _raw_row(raw: dict, position: int):
    rows = raw.get("compliance_table")
    return rows[position] if isinstance(rows, list) and 0 <= position < len(rows) and isinstance(rows[position], dict) else None


def detail(a: Assessment) -> dict:
    raw = a.raw_model_output or {}
    return {
        "id": a.id, "cr_id": a.cr_id, "parent_assessment_id": a.parent_assessment_id, "status": a.status,
        "overall_conclusion": a.overall_conclusion, "risk_score": a.risk_score, "warnings": a.warnings or [],
        "disclaimer": a.disclaimer,
        "change_request": {"text": a.cr.text, "source_type": a.cr.source_type, "original_filename": a.cr.original_filename},
        "model": {"mode": a.model_mode, "label": a.model_label, "latency_ms": a.latency_ms,
                  "disclaimer": raw.get("disclaimer")},
        "cr_metadata": raw.get("cr_metadata"),
        "clarification_prompt": (raw.get("cr_metadata") or {}).get("clarification_prompt"),
        "source_discrepancies": raw.get("source_discrepancies") or [],
        "chain_of_thought_explanation": raw.get("chain_of_thought_explanation"),
        "compliance_table": [row_out(r, _raw_row(raw, r.position)) for r in a.results],
        "conflict_heatmap": raw.get("conflict_heatmap"),
        "spectrum_of_complexity": raw.get("spectrum_of_complexity"),
        "error": {"code": a.error_code, "message": a.error_message} if a.error_code else None,
        "created_at": a.created_at.isoformat(), "completed_at": a.completed_at.isoformat() if a.completed_at else None,
    }


def summary(a: Assessment) -> dict:
    return {"id": a.id, "cr_id": a.cr_id, "cr_preview": a.cr.text[:200], "source_type": a.cr.source_type,
            "status": a.status, "overall_conclusion": a.overall_conclusion, "risk_score": a.risk_score,
            "results": {r.regulation: r.effective_status for r in a.results},
            "parent_assessment_id": a.parent_assessment_id, "created_at": a.created_at.isoformat()}
