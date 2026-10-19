"""One error shape for every failure:  {"error": {"code", "message", "details"}, "request_id": "..."}"""
import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

log = logging.getLogger("impart")


class AppError(Exception):
    def __init__(self, status: int, code: str, message: str, details: dict | None = None):
        super().__init__(message)
        self.status, self.code, self.message, self.details = status, code, message, details or {}


def _body(request: Request, code: str, message: str, details: dict | None = None) -> dict:
    return {"error": {"code": code, "message": message, "details": details or {}},
            "request_id": getattr(request.state, "request_id", None)}


def install_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error(request: Request, exc: AppError):
        return JSONResponse(status_code=exc.status, content=_body(request, exc.code, exc.message, exc.details))

    @app.exception_handler(RequestValidationError)
    async def _validation(request: Request, exc: RequestValidationError):
        fields = [{"field": ".".join(str(p) for p in e["loc"][1:]) or "body", "problem": e["msg"]} for e in exc.errors()]
        return JSONResponse(status_code=422, content=_body(request, "invalid_request", "Request validation failed", {"fields": fields}))

    @app.exception_handler(StarletteHTTPException)
    async def _http(request: Request, exc: StarletteHTTPException):
        return JSONResponse(status_code=exc.status_code, content=_body(request, f"http_{exc.status_code}", str(exc.detail)))

    @app.exception_handler(Exception)
    async def _unexpected(request: Request, exc: Exception):
        # never leak stack traces or internals to the client; the full error goes to the server log
        log.exception("unhandled error request_id=%s", getattr(request.state, "request_id", None))
        return JSONResponse(status_code=500, content=_body(request, "internal_error", "Unexpected server error"))
