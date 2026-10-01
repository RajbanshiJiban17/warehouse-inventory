from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class ItemBase(BaseModel):
    model_config = ConfigDict(extra="forbid")

    itemCode: str = Field(..., min_length=2, max_length=50)
    itemName: str = Field(..., min_length=2, max_length=200)
    barcode: str = Field(..., min_length=3, max_length=100)
    unitId: int
    categoryId: int
    minStockLevel: Decimal = Field(default=Decimal("0.00"), ge=0)


class ItemCreate(ItemBase):
    openingQuantity: Decimal = Field(default=Decimal("0.00"), ge=0)


class ItemUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    itemCode: Optional[str] = Field(None, min_length=2, max_length=50)
    itemName: Optional[str] = Field(None, min_length=2, max_length=200)
    barcode: Optional[str] = Field(None, min_length=3, max_length=100)
    unitId: Optional[int] = None
    categoryId: Optional[int] = None
    minStockLevel: Optional[Decimal] = Field(None, ge=0)


class ItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    itemCode: str
    itemName: str
    barcode: str
    unitId: int
    categoryId: int
    quantity: Decimal
    minStockLevel: Decimal
    isActive: bool
    createdAt: datetime
    updatedAt: datetime

    categoryName: Optional[str] = None
    unitName: Optional[str] = None
    allowDecimals: Optional[bool] = None
    isLowStock: bool = False


class ItemImportRowError(BaseModel):
    rowNumber: int
    itemCode: Optional[str] = None
    barcode: Optional[str] = None
    error: str


class ItemImportResult(BaseModel):
    totalRows: int
    importedCount: int
    failedCount: int
    errors: List[ItemImportRowError]
