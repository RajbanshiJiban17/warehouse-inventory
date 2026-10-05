from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.core.database import Base


class AuditAction:
    CREATE = "CREATE"
    UPDATE = "UPDATE"
    DELETE = "DELETE"
    LOGIN = "LOGIN"
    FAILED_LOGIN = "FAILED_LOGIN"
    LOGOUT = "LOGOUT"
    APPROVE = "APPROVE"
    ROLE_CHANGE = "ROLE_CHANGE"
    PASSWORD_RESET = "PASSWORD_RESET"
    BULK_IMPORT = "BULK_IMPORT"


class AuditLog(Base):
    """
    Append-only audit trail. Records every security, user, and inventory modification event.
    """
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    userId = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    action = Column(String(50), nullable=False, index=True)
    entity = Column(String(50), nullable=False, index=True)  # ITEM, USER, STOCK_IN, STOCK_OUT, etc.
    entityId = Column(String(50), nullable=True, index=True)
    oldValue = Column(JSON, nullable=True)
    newValue = Column(JSON, nullable=True)
    ip = Column(String(45), nullable=True)
    userAgent = Column(String(255), nullable=True)
    createdAt = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True)

    # Relationships
    user = relationship("User")
