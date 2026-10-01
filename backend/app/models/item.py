from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Numeric, Boolean, DateTime, ForeignKey, CheckConstraint
from sqlalchemy.orm import relationship
from app.core.database import Base


class Item(Base):
    __tablename__ = "items"
    __table_args__ = (
        CheckConstraint("quantity >= 0", name="check_item_quantity_non_negative"),
    )

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    itemCode = Column(String(50), unique=True, index=True, nullable=False)
    itemName = Column(String(200), index=True, nullable=False)
    barcode = Column(String(100), unique=True, index=True, nullable=False)
    unitId = Column(Integer, ForeignKey("units.id"), nullable=False)
    categoryId = Column(Integer, ForeignKey("categories.id"), nullable=False, index=True)
    
    # Real-time current stock quantity. Guaranteed never to drop below 0 by database constraint.
    # Automatically increased on StockIn and decreased on StockOut.
    quantity = Column(Numeric(12, 2), default=0.0, nullable=False)
    minStockLevel = Column(Numeric(12, 2), default=0.0, nullable=False)
    
    # Soft delete support
    isActive = Column(Boolean, default=True, nullable=False, index=True)
    
    createdBy = Column(Integer, ForeignKey("users.id"), nullable=True)
    createdAt = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
    updatedAt = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    category = relationship("Category", back_populates="items")
    unit = relationship("Unit", back_populates="items")
    stock_ins = relationship("StockIn", back_populates="item", cascade="all, delete-orphan")
    stock_outs = relationship("StockOut", back_populates="item", cascade="all, delete-orphan")
    movements = relationship("StockMovement", back_populates="item", cascade="all, delete-orphan")
