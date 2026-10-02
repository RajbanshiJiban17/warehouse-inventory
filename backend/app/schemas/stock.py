from datetime import datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator


class StockInRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    itemId: Optional[int] = None
    barcode: Optional[str] = None
    quantity: Decimal = Field(..., gt=0)
    remark: Optional[str] = Field(None, max_length=500)
    dateAD: Optional[str] = Field(None, max_length=20)
    dateBS: Optional[str] = Field(None, max_length=20)
    supplierName: Optional[str] = Field(None, max_length=200)
    receivedFrom: Optional[str] = Field(None, max_length=200)
    location: Optional[str] = Field(None, max_length=100)
    unitPrice: Optional[Decimal] = Field(default=Decimal("0.00"), ge=0)
    amount: Optional[Decimal] = Field(default=Decimal("0.00"), ge=0)
    batchNo: Optional[str] = Field(None, max_length=100)
    mfgDate: Optional[str] = Field(None, max_length=50)
    expiryDate: Optional[str] = Field(None, max_length=50)
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
    unitName: Optional[str] = None
    balanceAfter: Decimal
    remark: Optional[str] = None
    dateAD: Optional[str] = None
    dateBS: Optional[str] = None
    supplierName: Optional[str] = None
    receivedFrom: Optional[str] = None
    location: Optional[str] = None
    unitPrice: Optional[Decimal] = None
    amount: Optional[Decimal] = None
    batchNo: Optional[str] = None
    mfgDate: Optional[str] = None
    expiryDate: Optional[str] = None
    createdAt: datetime
    createdByUsername: Optional[str] = None


class StockOutRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    itemId: Optional[int] = None
    barcode: Optional[str] = None
    quantity: Decimal = Field(..., gt=0)
    location: str = Field(..., min_length=1, max_length=100)
    remark: Optional[str] = Field(None, max_length=500)
    dateAD: Optional[str] = Field(None, max_length=20)
    dateBS: Optional[str] = Field(None, max_length=20)
    receiverName: Optional[str] = Field(None, max_length=200)
    unitPrice: Optional[Decimal] = Field(default=Decimal("0.00"), ge=0)
    amount: Optional[Decimal] = Field(default=Decimal("0.00"), ge=0)
    batchNo: Optional[str] = Field(None, max_length=100)
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
    unitName: Optional[str] = None
    location: str
    balanceAfter: Decimal
    isLowStockWarning: bool = False
    remark: Optional[str] = None
    dateAD: Optional[str] = None
    dateBS: Optional[str] = None
    receiverName: Optional[str] = None
    unitPrice: Optional[Decimal] = None
    amount: Optional[Decimal] = None
    batchNo: Optional[str] = None
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


class BatchReportItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    itemId: int
    itemCode: str
    itemName: str
    barcode: str
    categoryName: Optional[str] = None
    unitName: Optional[str] = None
    batchNo: str
    mfgDate: Optional[str] = None
    expiryDate: Optional[str] = None
    quantity: Decimal
    unitPrice: Optional[Decimal] = None
    supplierName: Optional[str] = None
    status: str = "ACTIVE"
    createdAt: datetime
