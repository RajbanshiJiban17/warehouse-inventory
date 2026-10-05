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
    
    # 1. Create all missing tables first
    Base.metadata.create_all(bind=target_engine)
    
    # 2. Check and add/rename missing columns with case-sensitive quoting
    try:
        inspector = inspect(target_engine)
        table_names = inspector.get_table_names()
        is_postgres = "postgres" in str(target_engine.url).lower()

        # Schema prefixes to search in PostgreSQL
        schemas_to_check = [None]
        if is_postgres:
            try:
                available_schemas = inspector.get_schema_names()
                if "inventory" in available_schemas:
                    schemas_to_check.append("inventory")
                if "public" in available_schemas:
                    schemas_to_check.append("public")
            except Exception:
                pass

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

        stock_out_cols = [
            ("dateAD", "VARCHAR(20)"),
            ("dateBS", "VARCHAR(20)"),
            ("receiverName", "VARCHAR(200)"),
            ("unitPrice", "NUMERIC(12, 2) DEFAULT 0.0"),
            ("amount", "NUMERIC(14, 2) DEFAULT 0.0"),
            ("batchNo", "VARCHAR(100)"),
        ]

        for s in schemas_to_check:
            try:
                tables = inspector.get_table_names(schema=s)
            except Exception:
                continue

            tbl_prefix = f'"{s}".' if s else ""

            if "stock_ins" in tables:
                cols = {c["name"]: c for c in inspector.get_columns("stock_ins", schema=s)}
                cols_lower = {name.lower(): name for name in cols}
                
                with target_engine.begin() as conn:
                    for col_name, col_type in stock_in_cols:
                        try:
                            # If lowercase unquoted column exists in Postgres, rename to exact case
                            if is_postgres and col_name.lower() in cols_lower and col_name not in cols:
                                old_name = cols_lower[col_name.lower()]
                                conn.execute(text(f'ALTER TABLE {tbl_prefix}stock_ins RENAME COLUMN "{old_name}" TO "{col_name}"'))
                            elif col_name not in cols:
                                conn.execute(text(f'ALTER TABLE {tbl_prefix}stock_ins ADD COLUMN "{col_name}" {col_type}'))
                        except Exception:
                            pass

            if "stock_outs" in tables:
                cols = {c["name"]: c for c in inspector.get_columns("stock_outs", schema=s)}
                cols_lower = {name.lower(): name for name in cols}

                with target_engine.begin() as conn:
                    for col_name, col_type in stock_out_cols:
                        try:
                            if is_postgres and col_name.lower() in cols_lower and col_name not in cols:
                                old_name = cols_lower[col_name.lower()]
                                conn.execute(text(f'ALTER TABLE {tbl_prefix}stock_outs RENAME COLUMN "{old_name}" TO "{col_name}"'))
                            elif col_name not in cols:
                                conn.execute(text(f'ALTER TABLE {tbl_prefix}stock_outs ADD COLUMN "{col_name}" {col_type}'))
                        except Exception:
                            pass
    except Exception:
        pass


def get_db() -> Generator[Session, None, None]:
    """FastAPI database session dependency"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
