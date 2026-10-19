"""MySQL tables.

change_requests      one row per distinct CR text (same text => same row, so history groups by CR)
assessments          one row per model run. IMMUTABLE after completion; a re-run adds a new row
assessment_results   one row per regulation in the model's compliance_table
"""
import uuid
from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects import mysql
from sqlalchemy.types import TypeDecorator
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base

Json = JSON()


class UTCDateTime(TypeDecorator):
    """MySQL DATETIME has no timezone: store UTC with microseconds, hand back timezone-aware UTC values."""
    impl = DateTime
    cache_ok = True

    def load_dialect_impl(self, dialect):
        return dialect.type_descriptor(mysql.DATETIME(fsp=6) if dialect.name == "mysql" else DateTime())

    def process_bind_param(self, value, dialect):
        if value is not None and value.tzinfo is not None:
            value = value.astimezone(timezone.utc).replace(tzinfo=None)
        return value

    def process_result_value(self, value, dialect):
        return value.replace(tzinfo=timezone.utc) if value is not None else None


def _id() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.now(timezone.utc)


class ChangeRequest(Base):
    __tablename__ = "change_requests"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_id)
    text: Mapped[str] = mapped_column(Text)
    text_hash: Mapped[str] = mapped_column(String(64), unique=True)
    source_type: Mapped[str] = mapped_column(String(10))  # text | pdf | xlsx | csv | txt (first submission)
    original_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=_now)


class Assessment(Base):
    __tablename__ = "assessments"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_id)
    cr_id: Mapped[str] = mapped_column(ForeignKey("change_requests.id"), index=True)
    parent_assessment_id: Mapped[str | None] = mapped_column(ForeignKey("assessments.id"), nullable=True)
    idempotency_key: Mapped[str | None] = mapped_column(String(100), unique=True, nullable=True)
    # pending | assessed | needs_clarification | model_error | invalid_model_output
    status: Mapped[str] = mapped_column(String(25), default="pending", index=True)
    # Proceed | Do Not Proceed | Needs Review   (NULL until the model answered)
    overall_conclusion: Mapped[str | None] = mapped_column(String(20), nullable=True, index=True)
    risk_score: Mapped[float | None] = mapped_column(Float, nullable=True)  # % of regulations non-compliant
    warnings: Mapped[list | None] = mapped_column(Json, nullable=True)
    raw_model_output: Mapped[dict | None] = mapped_column(Json, nullable=True)  # exactly what the model returned
    error_code: Mapped[str | None] = mapped_column(String(40), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    model_mode: Mapped[str] = mapped_column(String(10))
    model_label: Mapped[str] = mapped_column(String(100))
    latency_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    requested_by: Mapped[str | None] = mapped_column(String(100), nullable=True)
    disclaimer: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=_now, index=True)
    completed_at: Mapped[datetime | None] = mapped_column(UTCDateTime(), nullable=True)

    cr: Mapped[ChangeRequest] = relationship()
    results: Mapped[list["AssessmentResult"]] = relationship(
        back_populates="assessment", cascade="all, delete-orphan", order_by="AssessmentResult.position")


class AssessmentResult(Base):
    __tablename__ = "assessment_results"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_id)
    assessment_id: Mapped[str] = mapped_column(ForeignKey("assessments.id", ondelete="CASCADE"), index=True)
    position: Mapped[int] = mapped_column(Integer, default=0)
    regulation: Mapped[str] = mapped_column(String(20))
    region: Mapped[str | None] = mapped_column(String(10), nullable=True)
    compliant: Mapped[str] = mapped_column(String(30))  # the model's verdict as returned ("Yes"/"No"/other)
    # compliant | non_compliant | needs_review   (computed by the backend, see services/decision.py)
    effective_status: Mapped[str] = mapped_column(String(15))
    reason_if_not_compliant: Mapped[str | None] = mapped_column(Text, nullable=True)
    citation: Mapped[str | None] = mapped_column(Text, nullable=True)
    quote: Mapped[str | None] = mapped_column(Text, nullable=True)
    quote_verified: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    sources_disagree: Mapped[bool] = mapped_column(Boolean, default=False)
    votes: Mapped[dict | None] = mapped_column(Json, nullable=True)
    findings: Mapped[list | None] = mapped_column(Json, nullable=True)
    flags: Mapped[list] = mapped_column(Json, default=list)

    assessment: Mapped[Assessment] = relationship(back_populates="results")

    __table_args__ = (Index("ix_results_reg_status", "regulation", "effective_status"),)
