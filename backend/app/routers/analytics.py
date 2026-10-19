from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import require_key
from ..models import Assessment, AssessmentResult

router = APIRouter(prefix="/api/analytics", tags=["analytics"], dependencies=[Depends(require_key)])


@router.get("/heatmap", summary="Per-regulation counts of compliant / non_compliant / needs_review across history")
def heatmap(date_from: datetime | None = Query(None, alias="from"), date_to: datetime | None = Query(None, alias="to"),
            latest_per_cr: bool = True, db: Session = Depends(get_db)):
    """latest_per_cr=true counts only the newest finished assessment of each CR, so re-runs don't double count."""
    ok = [Assessment.completed_at.is_not(None), Assessment.overall_conclusion.is_not(None)]
    if date_from:
        ok.append(Assessment.created_at >= date_from)
    if date_to:
        ok.append(Assessment.created_at <= date_to)
    if latest_per_cr:
        latest = (select(Assessment.cr_id, func.max(Assessment.created_at).label("m")).where(*ok)
                  .group_by(Assessment.cr_id).subquery())
        ids = select(Assessment.id).join(latest, (Assessment.cr_id == latest.c.cr_id) & (Assessment.created_at == latest.c.m))
    else:
        ids = select(Assessment.id).where(*ok)
    q = (select(AssessmentResult.regulation, AssessmentResult.region, AssessmentResult.effective_status, func.count())
         .where(AssessmentResult.assessment_id.in_(ids))
         .group_by(AssessmentResult.regulation, AssessmentResult.region, AssessmentResult.effective_status))
    out: dict[str, dict] = {}
    for reg, region, st, n in db.execute(q):
        d = out.setdefault(reg, {"regulation": reg, "region": region, "compliant": 0, "non_compliant": 0, "needs_review": 0})
        d[st] = n
    items = []
    for d in out.values():
        d["total"] = d["compliant"] + d["non_compliant"] + d["needs_review"]
        d["conflict_rate"] = round(100 * d["non_compliant"] / d["total"], 1) if d["total"] else 0.0
        items.append(d)
    items.sort(key=lambda x: x["regulation"])

    # Region view built from the model's own `conflict_heatmap` stored with each assessment
    regions: dict[str, dict] = {}
    for raw in db.scalars(select(Assessment.raw_model_output).where(Assessment.id.in_(ids))):
        hm = (raw or {}).get("conflict_heatmap") if isinstance(raw, dict) else None
        if not isinstance(hm, dict):
            continue
        for region, v in hm.items():
            if not isinstance(v, dict):
                continue
            d = regions.setdefault(region, {"region": region, "assessments": 0, "risk_status": {}, "non_compliant_regulations": {}})
            d["assessments"] += 1
            status = str(v.get("risk_status") or "Unknown")
            d["risk_status"][status] = d["risk_status"].get(status, 0) + 1
            for reg in v.get("non_compliant") or []:
                d["non_compliant_regulations"][reg] = d["non_compliant_regulations"].get(reg, 0) + 1
    return {"items": items, "by_region": sorted(regions.values(), key=lambda x: x["region"]), "latest_per_cr": latest_per_cr}
