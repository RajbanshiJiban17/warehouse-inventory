from typing import Generator
from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from app.core.config import settings

connect_args = {}
if settings.is_sqlite:
    connect_args["check_same_thread"] = False
else:
    # Ensure all PostgreSQL connections automatically have search_path set to inventory, public
    connect_args["options"] = "-c search_path=inventory,public"

db_url = settings.DATABASE_URL
if db_url.startswith("postgresql://"):
    db_url = db_url.replace("postgresql://", "postgresql+psycopg://", 1)
elif db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql+psycopg://", 1)

engine = create_engine(
    db_url,
    connect_args=connect_args,
    pool_pre_ping=True,
    echo=False,
)

# Enable foreign key support for SQLite, or ensure schema/search_path for PostgreSQL
if settings.is_sqlite:
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()
else:
    @event.listens_for(engine, "connect")
    def set_postgresql_schema(dbapi_connection, connection_record):
        try:
            with dbapi_connection.cursor() as cursor:
                cursor.execute("CREATE SCHEMA IF NOT EXISTS inventory;")
                cursor.execute("SET search_path TO inventory, public;")
            if hasattr(dbapi_connection, "commit"):
                dbapi_connection.commit()
        except Exception:
            pass

    @event.listens_for(engine, "checkout")
    def set_postgresql_checkout(dbapi_connection, connection_record, connection_proxy):
        try:
            with dbapi_connection.cursor() as cursor:
                cursor.execute("SET search_path TO inventory, public;")
            if hasattr(dbapi_connection, "commit"):
                dbapi_connection.commit()
        except Exception:
            pass

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    expire_on_commit=False,
)

Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    """FastAPI database session dependency"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
