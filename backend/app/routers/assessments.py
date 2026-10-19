from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, Header, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from .. import serializers
from ..db import get_db
from ..deps import caller, require_key
from ..errors import AppError
from ..input_validation import CRInput, validate_text
from ..models import Assessment, AssessmentResult, ChangeRequest
from ..services.assessments import run_assessment

router = APIRouter(prefix="/api/assessments", tags=["assessments"], dependencies=[Depends(require_key)])


class SubmitText(BaseModel):
    cr_text: Any = None  # validated by hand so null / blank / wrong type each get their own error code


def _respond(a: Assessment, replayed: bool) -> JSONResponse:
    resp = JSONResponse(serializers.detail(a), status_code=200 if replayed else 201)
    if replayed:
        resp.headers["Idempotent-Replay"] = "true"
    return resp


@router.post("", status_code=201, summary="Submit a change request as text")
def submit_text(body: SubmitText, db: Session = Depends(get_db), who: str | None = Depends(caller),
                idempotency_key: str | None = Header(default=None, alias="Idempotency-Key", max_length=100)):
    cr = validate_text(body.cr_text)
    return _respond(*run_assessment(db, cr, who, idempotency_key))


def _load(db: Session, assessment_id: str) -> Assessment:
    a = db.scalar(select(Assessment).where(Assessment.id == assessment_id).options(
        selectinload(Assessment.results), selectinload(Assessment.cr)))
    if not a:
        raise AppError(404, "assessment_not_found", "No assessment with that id.")
    return a


@router.get("", summary="History (newest first), paginated and filterable")
def history(cr_id: str | None = None, status: str | None = None,
            overall: str | None = Query(None, pattern="^(Proceed|Do Not Proceed|Needs Review)$"),
            regulation: str | None = None,
            effective_status: str | None = Query(None, pattern="^(compliant|non_compliant|needs_review)$"),
            q: str | None = Query(None, max_length=200),
            date_from: datetime | None = Query(None, alias="from"), date_to: datetime | None = Query(None, alias="to"),
            limit: int = Query(20, ge=1, le=100), offset: int = Query(0, ge=0), db: Session = Depends(get_db)):
    cond = []
    if cr_id:
        cond.append(Assessment.cr_id == cr_id)
    if status:
        cond.append(Assessment.status == status)
    if overall:
        cond.append(Assessment.overall_conclusion == overall)
    if date_from:
        cond.append(Assessment.created_at >= date_from)
    if date_to:
        cond.append(Assessment.created_at <= date_to)
    if q:
        cond.append(Assessment.cr_id.in_(select(ChangeRequest.id).where(ChangeRequest.text.ilike(f"%{q}%"))))
    if regulation or effective_status:
        sub = select(AssessmentResult.assessment_id)
        if regulation:
            sub = sub.where(AssessmentResult.regulation == regulation.upper())
        if effective_status:
            sub = sub.where(AssessmentResult.effective_status == effective_status)
        cond.append(Assessment.id.in_(sub))
    total = db.scalar(select(func.count()).select_from(Assessment).where(*cond))
    rows = db.scalars(select(Assessment).where(*cond).options(selectinload(Assessment.results), selectinload(Assessment.cr))
                      .order_by(Assessment.created_at.desc()).limit(limit).offset(offset)).all()
    return {"items": [serializers.summary(a) for a in rows], "total": total, "limit": limit, "offset": offset}


@router.get("/{assessment_id}", summary="One assessment with the full table, evidence and model explanation")
def get_one(assessment_id: str, db: Session = Depends(get_db)):
    return serializers.detail(_load(db, assessment_id))


@router.post("/{assessment_id}/reassess", status_code=201,
             summary="Run the same CR through the model again; the old assessment is kept unchanged")
def reassess(assessment_id: str, db: Session = Depends(get_db), who: str | None = Depends(caller)):
    old = _load(db, assessment_id)
    cr_in = CRInput(text=old.cr.text, source_type=old.cr.source_type, filename=old.cr.original_filename)
    return _respond(*run_assessment(db, cr_in, who, existing_cr=old.cr, parent_id=old.id))
