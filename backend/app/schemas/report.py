from datetime import datetime, date
from decimal import Decimal
from typing import Dict, List, Optional
from pydantic import BaseModel, ConfigDict


class DashboardStatsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    totalItems: int
    totalStockQuantity: Decimal
    todayInQuantity: Decimal
    todayOutQuantity: Decimal
    lowStockCount: int
    top10MovingItems: List[Dict[str, object]]


class CategoryStockChartData(BaseModel):
    categoryName: str
    itemCount: int
    totalQuantity: Decimal


class TrendChartData(BaseModel):
    period: str  # YYYY-MM-DD or week or month
    inQuantity: Decimal
    outQuantity: Decimal


class DashboardChartsResponse(BaseModel):
    stockByCategory: List[CategoryStockChartData]
    inVsOutTrend: List[TrendChartData]


# Report Responses
class CurrentStockReportItem(BaseModel):
    itemCode: str
    itemName: str
    barcode: str
    categoryName: str
    unitName: str
    quantity: Decimal
    minStockLevel: Decimal
    isLowStock: bool


class StockLedgerReportItem(BaseModel):
    itemId: int
    itemCode: str
    itemName: str
    openingQuantity: Decimal
    totalIn: Decimal
    totalOut: Decimal
    closingBalance: Decimal
    isReconciled: bool  # Opening + In - Out == Closing


class LowStockReportItem(BaseModel):
    itemCode: str
    itemName: str
    categoryName: str
    currentStock: Decimal
    minStockLevel: Decimal
    deficit: Decimal


class LocationStockReportItem(BaseModel):
    location: str
    totalTransactions: int
    totalQuantityIssued: Decimal


class FastSlowMovingItem(BaseModel):
    itemCode: str
    itemName: str
    categoryName: str
    totalIssuedQuantity: Decimal
    issueTransactionsCount: int
    status: str  # "FAST_MOVING" | "SLOW_MOVING" | "DORMANT"


class DormantItem(BaseModel):
    itemCode: str
    itemName: str
    currentStock: Decimal
    lastMovementDate: Optional[datetime] = None
    daysInactive: int


class UserActivityReportItem(BaseModel):
    userId: int
    username: str
    role: str
    stockInCount: int
    stockInTotalQuantity: Decimal
    stockOutCount: int
    stockOutTotalQuantity: Decimal
    totalOperations: int


class BatchStockReportItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    itemId: int
    itemCode: str
    itemName: str
    barcode: str
    categoryName: str
    unitName: str
    batchNo: str
    mfgDate: Optional[str] = None
    expiryDate: Optional[str] = None
    quantity: Decimal
    unitPrice: Optional[Decimal] = Decimal("0.00")
    supplierName: Optional[str] = None
    status: str = "ACTIVE"
