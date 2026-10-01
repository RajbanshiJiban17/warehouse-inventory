from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    userId = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    tokenHash = Column(String(255), unique=True, index=True, nullable=False)
    familyId = Column(String(100), index=True, nullable=False)
    expiresAt = Column(DateTime(timezone=True), nullable=False)
    revokedAt = Column(DateTime(timezone=True), nullable=True)
    userAgent = Column(String(255), nullable=True)
    ip = Column(String(45), nullable=True)
    createdAt = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    user = relationship("User", back_populates="refresh_tokens")
