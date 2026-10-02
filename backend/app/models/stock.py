from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Numeric, DateTime, ForeignKey, Text, CheckConstraint
from sqlalchemy.orm import relationship
from app.core.database import Base


class MovementType:
    OPENING = "OPENING"
    IN = "IN"
    OUT = "OUT"
    ADJUSTMENT = "ADJUSTMENT"


class StockIn(Base):
    __tablename__ = "stock_ins"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="check_stock_in_quantity_positive"),
    )

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    itemId = Column(Integer, ForeignKey("items.id", ondelete="RESTRICT"), nullable=False, index=True)
    quantity = Column(Numeric(12, 2), nullable=False)
    remark = Column(String(500), nullable=True)
    dateAD = Column(String(20), nullable=True)
    dateBS = Column(String(20), nullable=True)
    supplierName = Column(String(200), nullable=True)
    receivedFrom = Column(String(200), nullable=True)
    location = Column(String(100), nullable=True)
    unitPrice = Column(Numeric(12, 2), default=0.0, nullable=True)
    amount = Column(Numeric(14, 2), default=0.0, nullable=True)
    batchNo = Column(String(100), nullable=True)
    mfgDate = Column(String(50), nullable=True)
    expiryDate = Column(String(50), nullable=True)
    createdBy = Column(Integer, ForeignKey("users.id"), nullable=False)
    createdAt = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True)

    # Relationships
    item = relationship("Item", back_populates="stock_ins")
    user = relationship("User")


class StockOut(Base):
    __tablename__ = "stock_outs"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="check_stock_out_quantity_positive"),
    )

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    itemId = Column(Integer, ForeignKey("items.id", ondelete="RESTRICT"), nullable=False, index=True)
    quantity = Column(Numeric(12, 2), nullable=False)
    location = Column(String(100), nullable=False)  # GODOWN, FLOOR, or admin-defined location
    remark = Column(String(500), nullable=True)
    dateAD = Column(String(20), nullable=True)
    dateBS = Column(String(20), nullable=True)
    receiverName = Column(String(200), nullable=True)
    unitPrice = Column(Numeric(12, 2), default=0.0, nullable=True)
    amount = Column(Numeric(14, 2), default=0.0, nullable=True)
    batchNo = Column(String(100), nullable=True)
    createdBy = Column(Integer, ForeignKey("users.id"), nullable=False)
    createdAt = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True)

    # Relationships
    item = relationship("Item", back_populates="stock_outs")
    user = relationship("User")


class ItemBatch(Base):
    __tablename__ = "item_batches"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    itemId = Column(Integer, ForeignKey("items.id", ondelete="CASCADE"), nullable=False, index=True)
    batchNo = Column(String(100), nullable=False, index=True)
    mfgDate = Column(String(50), nullable=True)
    expiryDate = Column(String(50), nullable=True)
    quantity = Column(Numeric(12, 2), default=0.0, nullable=False)
    initialQuantity = Column(Numeric(12, 2), default=0.0, nullable=False)
    unitPrice = Column(Numeric(12, 2), default=0.0, nullable=True)
    supplierName = Column(String(200), nullable=True)
    createdAt = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True)

    # Relationships
    item = relationship("Item", back_populates="batches")


class StockMovement(Base):
    """
    Immutable stock ledger.
    Every stock adjustment, stock in, or stock out creates a permanent entry.
    Tracks exact historical balanceAfter to ensure mathematical reconciliation:
    Opening + In - Out = Current Stock.
    """
    __tablename__ = "stock_movements"
    __table_args__ = (
        CheckConstraint('"balanceAfter" >= 0', name="check_movement_balance_non_negative"),
    )

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    itemId = Column(Integer, ForeignKey("items.id", ondelete="RESTRICT"), nullable=False, index=True)
    type = Column(String(20), nullable=False)  # OPENING, IN, OUT, ADJUSTMENT
    quantity = Column(Numeric(12, 2), nullable=False)
    balanceAfter = Column(Numeric(12, 2), nullable=False)
    referenceId = Column(String(100), nullable=True)
    createdBy = Column(Integer, ForeignKey("users.id"), nullable=True)
    createdAt = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True)

    # Relationships
    item = relationship("Item", back_populates="movements")
    user = relationship("User")
