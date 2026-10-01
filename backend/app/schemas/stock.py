from datetime import datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator


class StockInRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    itemId: Optional[int] = None
    barcode: Optional[str] = None
    quantity: Decimal = Field(..., gt=0)
    remark: Optional[str] = Field(None, max_length=500)
    idempotencyKey: Optional[str] = Field(None, max_length=100)

    @field_validator("quantity")
    @classmethod
    def validate_qty_positive(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("Stock In quantity must be greater than zero")
        return v


class StockInResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    itemId: int
    itemCode: str
    itemName: str
    barcode: str
    quantity: Decimal
    balanceAfter: Decimal
    remark: Optional[str] = None
    createdAt: datetime
    createdByUsername: Optional[str] = None


class StockOutRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    itemId: Optional[int] = None
    barcode: Optional[str] = None
    quantity: Decimal = Field(..., gt=0)
    location: str = Field(..., min_length=1, max_length=100)
    remark: Optional[str] = Field(None, max_length=500)
    idempotencyKey: Optional[str] = Field(None, max_length=100)

    @field_validator("quantity")
    @classmethod
    def validate_qty_positive(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("Stock Out quantity must be greater than zero")
        return v


class StockOutResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    itemId: int
    itemCode: str
    itemName: str
    barcode: str
    quantity: Decimal
    location: str
    balanceAfter: Decimal
    isLowStockWarning: bool = False
    remark: Optional[str] = None
    createdAt: datetime
    createdByUsername: Optional[str] = None


class StockMovementResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    itemId: int
    itemCode: str
    itemName: str
    type: str  # OPENING, IN, OUT, ADJUSTMENT
    quantity: Decimal
    balanceAfter: Decimal
    referenceId: Optional[str] = None
    createdAt: datetime
    createdByUsername: Optional[str] = None
