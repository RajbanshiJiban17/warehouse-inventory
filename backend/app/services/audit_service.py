from typing import Any, Optional
from sqlalchemy.orm import Session
from app.models.audit import AuditLog
from app.core.logging import logger


def log_audit_event(
    db: Session,
    action: str,
    entity: str,
    userId: Optional[int] = None,
    entityId: Optional[str] = None,
    oldValue: Optional[Any] = None,
    newValue: Optional[Any] = None,
    ip: Optional[str] = None,
    userAgent: Optional[str] = None,
) -> AuditLog:
    """
    Append an immutable event to the audit_logs table.
    Also emits structured log.
    """
    log_entry = AuditLog(
        userId=userId,
        action=action,
        entity=entity,
        entityId=str(entityId) if entityId is not None else None,
        oldValue=oldValue,
        newValue=newValue,
        ip=ip,
        userAgent=userAgent,
    )
    db.add(log_entry)
    db.flush()

    logger.info(
        "audit_event",
        action=action,
        entity=entity,
        entity_id=entityId,
        user_id=userId,
        ip=ip,
    )
    return log_entry
