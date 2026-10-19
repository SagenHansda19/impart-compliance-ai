"""Run one assessment: store CR -> call model -> validate -> decide -> store rows."""
import logging
import time
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..config import DISCLAIMER, settings
from ..errors import AppError
from ..guardrails import text_hash
from ..input_validation import CRInput
from ..model_client import ModelCallError, get_model
from ..models import Assessment, AssessmentResult, ChangeRequest
from .decision import InvalidOutput, decide, parse_output

log = logging.getLogger("impart")


def _get_or_create_cr(db: Session, cr: CRInput) -> ChangeRequest:
    h = text_hash(cr.text)
    found = db.scalar(select(ChangeRequest).where(ChangeRequest.text_hash == h))
    if found:
        return found
    row = ChangeRequest(text=cr.text, text_hash=h, source_type=cr.source_type, original_filename=cr.filename)
    db.add(row)
    try:
        db.commit()
    except IntegrityError:  # another request inserted the same text first
        db.rollback()
        return db.scalar(select(ChangeRequest).where(ChangeRequest.text_hash == h))
    return row


def _fail(db: Session, a: Assessment, status: str, code: str, message: str, http: int,
          raw: dict | None = None, errors: list[str] | None = None) -> None:
    a.status, a.error_code, a.error_message = status, code, message[:1000]
    a.raw_model_output = raw if isinstance(raw, dict) else None
    a.warnings = errors
    a.completed_at = datetime.now(timezone.utc)
    db.commit()
    raise AppError(http, code, message, {"assessment_id": a.id, **({"problems": errors} if errors else {})})


def run_assessment(db: Session, cr_in: CRInput, who: str | None, idempotency_key: str | None = None,
                   existing_cr: ChangeRequest | None = None, parent_id: str | None = None) -> tuple[Assessment, bool]:
    """Returns (assessment, replayed). Raises AppError when the model fails or answers badly - the failed
    attempt is still stored so nothing is lost from the history."""
    if idempotency_key:
        prev = db.scalar(select(Assessment).where(Assessment.idempotency_key == idempotency_key))
        if prev:
            return prev, True

    cr = existing_cr or _get_or_create_cr(db, cr_in)
    a = Assessment(cr_id=cr.id, parent_assessment_id=parent_id, idempotency_key=idempotency_key, status="pending",
                   model_mode=settings.model_mode, model_label=settings.model_label, requested_by=who, disclaimer=DISCLAIMER)
    db.add(a)
    db.commit()  # the attempt is recorded before the (slow) model call

    t0 = time.perf_counter()
    try:
        raw = get_model().call(cr.text)
    except ModelCallError as e:
        a.latency_ms = int((time.perf_counter() - t0) * 1000)
        _fail(db, a, "model_error", e.code, e.message, 504 if e.code == "model_timeout" else 502)
    except Exception as e:  # noqa: BLE001 - never lose the attempt
        log.exception("unexpected model adapter failure")
        a.latency_ms = int((time.perf_counter() - t0) * 1000)
        _fail(db, a, "model_error", "model_error", f"Unexpected model failure ({type(e).__name__}).", 502)
    a.latency_ms = int((time.perf_counter() - t0) * 1000)

    try:
        decision = decide(parse_output(raw))
    except InvalidOutput as e:
        _fail(db, a, "invalid_model_output", "invalid_model_output",
              "The model's answer failed validation and was not accepted.", 502, raw=raw, errors=e.errors)

    a.raw_model_output = raw
    a.status, a.overall_conclusion, a.risk_score = decision.status, decision.overall, decision.risk_score
    a.warnings = decision.warnings or None
    for r in decision.rows:
        a.results.append(AssessmentResult(
            position=r.position, regulation=r.regulation, region=r.region, compliant=r.compliant,
            effective_status=r.effective_status, reason_if_not_compliant=r.reason, citation=r.citation, quote=r.quote,
            quote_verified=r.quote_verified, sources_disagree=r.sources_disagree, votes=r.votes, findings=r.findings,
            flags=r.flags))
    a.completed_at = datetime.now(timezone.utc)
    db.commit()
    return a, False
