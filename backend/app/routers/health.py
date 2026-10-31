from fastapi import APIRouter, BackgroundTasks, Depends
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..config import settings
from ..db import get_db
from ..model_client import ping_model_service_sync

router = APIRouter(prefix="/api", tags=["health"])


@router.get("/health", summary="Liveness + database check")
def health(background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    background_tasks.add_task(ping_model_service_sync)
    try:
        db.execute(text("SELECT 1"))
    except Exception:  # noqa: BLE001
        return JSONResponse({"status": "degraded", "database": "down", "model_mode": settings.model_mode}, status_code=503)
    return {"status": "ok", "database": "up", "model_mode": settings.model_mode}
