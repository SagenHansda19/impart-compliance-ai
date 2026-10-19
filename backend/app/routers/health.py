from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..config import settings
from ..db import get_db

router = APIRouter(prefix="/api", tags=["health"])


@router.get("/health", summary="Liveness + database check")
def health(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
    except Exception:  # noqa: BLE001
        return JSONResponse({"status": "degraded", "database": "down", "model_mode": settings.model_mode}, status_code=503)
    return {"status": "ok", "database": "up", "model_mode": settings.model_mode}
