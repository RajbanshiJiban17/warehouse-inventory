from typing import Any, Generator
from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from app.core.config import settings

connect_args: dict[str, Any] = {}
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
    def set_sqlite_pragma(dbapi_connection: Any, connection_record: Any) -> None:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()
else:
    @event.listens_for(engine, "connect")
    def set_postgresql_schema(dbapi_connection: Any, connection_record: Any) -> None:
        try:
            with dbapi_connection.cursor() as cursor:
                cursor.execute("CREATE SCHEMA IF NOT EXISTS inventory;")
                cursor.execute("SET search_path TO inventory, public;")
            if hasattr(dbapi_connection, "commit"):
                dbapi_connection.commit()
        except Exception:
            pass

    @event.listens_for(engine, "checkout")
    def set_postgresql_checkout(dbapi_connection: Any, connection_record: Any, connection_proxy: Any) -> None:
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


def ensure_database_schema(target_engine: Any = engine) -> None:
    """Safely synchronizes table columns and creates tables across SQLite or PostgreSQL."""
    from sqlalchemy import inspect, text
    import app.models  # Ensures all models are registered with Base.metadata
    Base.metadata.create_all(bind=target_engine)
    try:
        inspector = inspect(target_engine)
        table_names = inspector.get_table_names()

        if "stock_ins" in table_names:
            existing_cols = {col["name"] for col in inspector.get_columns("stock_ins")}
            stock_in_cols = [
                ("dateAD", "VARCHAR(20)"),
                ("dateBS", "VARCHAR(20)"),
                ("supplierName", "VARCHAR(200)"),
                ("receivedFrom", "VARCHAR(200)"),
                ("location", "VARCHAR(100)"),
                ("unitPrice", "NUMERIC(12, 2) DEFAULT 0.0"),
                ("amount", "NUMERIC(14, 2) DEFAULT 0.0"),
                ("batchNo", "VARCHAR(100)"),
                ("mfgDate", "VARCHAR(50)"),
                ("expiryDate", "VARCHAR(50)"),
            ]
            with target_engine.begin() as conn:
                for col_name, col_type in stock_in_cols:
                    if col_name not in existing_cols:
                        conn.execute(text(f"ALTER TABLE stock_ins ADD COLUMN {col_name} {col_type}"))

        if "stock_outs" in table_names:
            existing_cols = {col["name"] for col in inspector.get_columns("stock_outs")}
            stock_out_cols = [
                ("dateAD", "VARCHAR(20)"),
                ("dateBS", "VARCHAR(20)"),
                ("receiverName", "VARCHAR(200)"),
                ("unitPrice", "NUMERIC(12, 2) DEFAULT 0.0"),
                ("amount", "NUMERIC(14, 2) DEFAULT 0.0"),
                ("batchNo", "VARCHAR(100)"),
            ]
            with target_engine.begin() as conn:
                for col_name, col_type in stock_out_cols:
                    if col_name not in existing_cols:
                        conn.execute(text(f"ALTER TABLE stock_outs ADD COLUMN {col_name} {col_type}"))
    except Exception:
        pass


def get_db() -> Generator[Session, None, None]:
    """FastAPI database session dependency"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
