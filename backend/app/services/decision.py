"""Parse the model's JSON and apply the decision policy.

Policy (conservative - missing or doubtful evidence is never turned into a 'compliant' verdict):

  row verdict "No"                        -> non_compliant   (a confirmed conflict is never hidden)
  row verdict "Yes", no flags             -> compliant
  row verdict "Yes" WITH any flag         -> needs_review
  verdict missing / not Yes / not No      -> needs_review
  flags: unverified_quote (quote_verified is not true), missing_quote, missing_citation,
         sources_disagree, vote_errors, unrecognised_verdict, missing_reason (a "No" without a reason)

  overall: any non_compliant row                                    -> "Do Not Proceed"
           else CR ambiguous / any needs_review / regulation missing -> "Needs Review"
           else                                                       -> "Proceed"
  risk_score: percentage of rows that are non_compliant
"""
from dataclasses import dataclass, field
from typing import Any

from pydantic import BaseModel, ConfigDict, ValidationError

from ..config import REGION_MAP, settings


class Row(BaseModel):
    model_config = ConfigDict(extra="allow")
    regulation: str | None = None
    compliant: str | bool | None = None
    reason_if_not_compliant: str | None = None
    citation: str | None = None
    quote: str | None = None
    quote_verified: bool | None = None
    votes: dict | None = None
    findings: list[Any] | None = None
    sources_disagree: bool | None = None
    vote_errors: list[Any] | None = None


class CRMeta(BaseModel):
    model_config = ConfigDict(extra="allow")
    summary: str | None = None
    is_ambiguous: bool = False
    requirements: list[Any] | None = None


class ModelOutput(BaseModel):
    model_config = ConfigDict(extra="allow")
    disclaimer: str | None = None
    cr_metadata: CRMeta | None = None
    chain_of_thought_explanation: str | None = None
    compliance_table: list[Row] = []
    conflict_heatmap: Any = None
    spectrum_of_complexity: Any = None
    source_discrepancies: Any = None


class InvalidOutput(Exception):
    def __init__(self, errors: list[str]):
        super().__init__("; ".join(errors))
        self.errors = errors


@dataclass
class RowDecision:
    position: int
    regulation: str
    region: str | None
    compliant: str
    effective_status: str
    reason: str | None
    citation: str | None
    quote: str | None
    quote_verified: bool | None
    sources_disagree: bool
    votes: dict | None
    findings: list | None
    flags: list[str] = field(default_factory=list)


@dataclass
class Decision:
    status: str  # assessed | needs_clarification
    overall: str
    risk_score: float | None
    rows: list[RowDecision]
    warnings: list[str]


def parse_output(raw: Any) -> ModelOutput:
    if not isinstance(raw, dict):
        raise InvalidOutput(["model output is not a JSON object"])
    try:
        return ModelOutput.model_validate(raw)
    except ValidationError as e:
        raise InvalidOutput([f"{'.'.join(str(p) for p in err['loc'])}: {err['msg']}" for err in e.errors()]) from None


def _verdict(v: Any) -> str | None:
    if isinstance(v, bool):
        return "yes" if v else "no"
    s = str(v).strip().lower() if v is not None else ""
    return s if s in ("yes", "no") else None


def decide(out: ModelOutput) -> Decision:
    ambiguous = bool(out.cr_metadata and out.cr_metadata.is_ambiguous)
    if not out.compliance_table and not ambiguous:
        raise InvalidOutput(["compliance_table is empty and the CR was not marked ambiguous"])

    errors: list[str] = []
    seen: set[str] = set()
    rows: list[RowDecision] = []
    for i, r in enumerate(out.compliance_table):
        reg = (r.regulation or "").strip().upper()
        if not reg:
            errors.append(f"compliance_table[{i}]: regulation is missing")
            continue
        if reg in seen:
            errors.append(f"compliance_table[{i}]: duplicate row for {reg}")
            continue
        seen.add(reg)
        verdict = _verdict(r.compliant)
        flags: list[str] = []
        if verdict is None:
            flags.append("unrecognised_verdict")
        if r.quote_verified is not True:
            flags.append("unverified_quote")
        if not (r.quote or "").strip():
            flags.append("missing_quote")
        if not (r.citation or "").strip():
            flags.append("missing_citation")
        if r.sources_disagree:
            flags.append("sources_disagree")
        if r.vote_errors:
            flags.append("vote_errors")
        if verdict == "no" and not (r.reason_if_not_compliant or "").strip():
            flags.append("missing_reason")
        if verdict == "no":
            status = "non_compliant"
        elif verdict == "yes" and not flags:
            status = "compliant"
        else:
            status = "needs_review"
        rows.append(RowDecision(
            position=i, regulation=reg, region=REGION_MAP.get(reg), compliant=("Yes" if verdict == "yes" else "No" if verdict == "no" else str(r.compliant)),
            effective_status=status, reason=r.reason_if_not_compliant, citation=r.citation, quote=r.quote,
            quote_verified=r.quote_verified, sources_disagree=bool(r.sources_disagree), votes=r.votes,
            findings=r.findings, flags=flags))
    if errors:
        raise InvalidOutput(errors)

    warnings: list[str] = []
    missing = [x for x in settings.expected_regulations if x not in seen]
    extra = sorted(seen - set(settings.expected_regulations))
    if missing:
        warnings.append(f"missing_regulations: {', '.join(missing)}")
    if extra:
        warnings.append(f"unexpected_regulations: {', '.join(extra)}")
    discrepancies = bool(out.source_discrepancies)
    if discrepancies:
        warnings.append("source_discrepancies_present: the model found conflicting source documents")
    if ambiguous:
        warnings.append("model_marked_cr_ambiguous: clarification needed before relying on this assessment")

    bad = sum(r.effective_status == "non_compliant" for r in rows)
    review = any(r.effective_status == "needs_review" for r in rows)
    if bad:
        overall = "Do Not Proceed"
    elif ambiguous or review or missing or discrepancies:
        overall = "Needs Review"
    else:
        overall = "Proceed"
    return Decision(status="needs_clarification" if ambiguous else "assessed", overall=overall,
                    risk_score=round(100 * bad / len(rows), 1) if rows else None, rows=rows, warnings=warnings)
