from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.logging import logger


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        logger.warning(
            "http_exception",
            path=request.url.path,
            method=request.method,
            status_code=exc.status_code,
            detail=exc.detail,
        )
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail},
            headers=getattr(exc, "headers", None),
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
        logger.warning(
            "validation_error",
            path=request.url.path,
            method=request.method,
            errors=exc.errors(),
        )
        # Format clean, readable error messages for client
        errors = []
        readable_messages = []
        for error in exc.errors():
            loc = " -> ".join(str(l) for l in error.get("loc", []))
            clean_field = " -> ".join(str(l) for l in error.get("loc", []) if l != "body")
            msg = error.get("msg", "Invalid input")
            errors.append(f"{loc}: {msg}")
            readable_messages.append(f"{clean_field}: {msg}" if clean_field else msg)

        readable_detail = "; ".join(readable_messages) if readable_messages else "Validation error in request payload"

        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "detail": readable_detail,
                "errors": errors,
            },
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        # Full stack trace logged securely on the server
        logger.error(
            "unhandled_internal_error",
            path=request.url.path,
            method=request.method,
            error=str(exc),
            exc_info=exc,
        )
        from app.core.config import settings
        detail_msg = f"Internal server error: {str(exc)}" if settings.DEBUG else "An internal server error occurred. Please contact the administrator."
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": detail_msg},
        )
