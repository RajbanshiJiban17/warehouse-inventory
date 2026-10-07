from contextlib import asynccontextmanager
from typing import AsyncGenerator
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.core.config import settings
from app.core.logging import setup_logging, logger
from app.core.database import Base, engine, ensure_database_schema
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

    # Initialize and synchronize tables/columns across SQLite, Postgres, or Hosting
    ensure_database_schema(engine)

    # Ensure clean inventory without dummy sample items until Excel upload
    try:
        from app.core.database import SessionLocal
        from app.models.user import User, UserRole, UserStatus
        from app.models.stock import StockMovement, StockIn, StockOut, ItemBatch
        from app.models.item import Item
        with SessionLocal() as db:
            # 1. Activate pending users
            pending_users = db.query(User).filter(User.status == UserStatus.PENDING).all()
            for u in pending_users:
                u.status = UserStatus.ACTIVE
                u.role = UserRole.ADMIN
            if pending_users:
                db.commit()
                logger.info("activated_pending_users", count=len(pending_users))

            # 2. Clean all inventory items, movements, batches so database is 100% empty
            # Data will only appear after the user uploads their spreadsheet
            total_items = db.query(Item).count()
            if total_items > 0:
                db.query(StockMovement).delete(synchronize_session=False)
                db.query(ItemBatch).delete(synchronize_session=False)
                db.query(StockIn).delete(synchronize_session=False)
                db.query(StockOut).delete(synchronize_session=False)
                db.query(Item).delete(synchronize_session=False)
                db.commit()
                logger.info("cleaned_all_inventory_items", count=total_items)
    except Exception as e:
        logger.warning("startup_cleanup_error", error=str(e))

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
