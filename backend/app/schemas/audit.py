from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel, ConfigDict


class AuditLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    userId: Optional[int] = None
    action: str
    entity: str
    entityId: Optional[str] = None
    oldValue: Optional[Any] = None
    newValue: Optional[Any] = None
    ip: Optional[str] = None
    userAgent: Optional[str] = None
    createdAt: datetime
