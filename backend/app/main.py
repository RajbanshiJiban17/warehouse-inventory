from contextlib import asynccontextmanager
from typing import AsyncGenerator
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.core.config import settings
from app.core.logging import setup_logging, logger
from app.core.database import Base, engine
from app.middleware.security import SecurityHeadersMiddleware, CSRFProtectionMiddleware
from app.middleware.exceptions import register_exception_handlers
from app.api.auth import router as auth_router, limiter
from app.api.users import router as users_router
from app.api.audit import router as audit_router
from app.api.categories import router as categories_router
from app.api.units import router as units_router
from app.api.locations import router as locations_router
from app.api.items import router as items_router
from app.api.stock import router as stock_router
from app.api.dashboard import router as dashboard_router
from app.api.reports import router as reports_router


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    # Setup structured logging
    setup_logging()
    logger.info("application_startup", app=settings.APP_NAME, env=settings.ENVIRONMENT)

    # Initialize tables if SQLite development
    if settings.is_sqlite:
        Base.metadata.create_all(bind=engine)

    yield

    logger.info("application_shutdown", app=settings.APP_NAME)


app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    openapi_url="/openapi.json" if settings.DEBUG else None,
    lifespan=lifespan,
)

# Attach rate limiter state
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Custom Middlewares
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(CSRFProtectionMiddleware)

# CORS Setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Exception Handlers
register_exception_handlers(app)

# Include API Routers
app.include_router(auth_router)
app.include_router(users_router)
app.include_router(audit_router)
app.include_router(categories_router)
app.include_router(units_router)
app.include_router(locations_router)
app.include_router(items_router)
app.include_router(stock_router)
app.include_router(dashboard_router)
app.include_router(reports_router)


@app.get("/api/health", tags=["Health"])
def health_check() -> dict[str, str]:
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "environment": settings.ENVIRONMENT,
    }
