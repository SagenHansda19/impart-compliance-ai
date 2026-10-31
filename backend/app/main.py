import asyncio
import logging
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .db import init_db
from .errors import install_handlers
from .model_client import wake_model_service
from .routers import analytics, assessments, health

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    asyncio.create_task(wake_model_service())
    yield


app = FastAPI(title="IMPART Regulatory Impact Assessment API", version="2.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, allow_methods=["*"],
                   allow_headers=["*"], expose_headers=["X-Request-ID", "Idempotent-Replay"])


@app.middleware("http")
async def request_id(request: Request, call_next):
    rid = request.headers.get("X-Request-ID") or uuid.uuid4().hex[:16]
    request.state.request_id = rid
    resp = await call_next(request)
    resp.headers["X-Request-ID"] = rid
    return resp


install_handlers(app)
app.include_router(health.router)
app.include_router(assessments.router)
app.include_router(analytics.router)


@app.api_route("/", methods=["GET", "HEAD"])
def root():
    return {"status": "ok", "service": "impart-backend-api"}
