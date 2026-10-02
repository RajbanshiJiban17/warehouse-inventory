from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.services.report_service import (
    get_current_stock_report_data,
    get_stock_ledger_report_data,
    get_low_stock_report_data,
    get_location_stock_report_data,
    get_fast_slow_moving_report_data,
    get_dormant_items_report_data,
    get_user_activity_report_data,
    get_batch_stock_report_data,
)
from app.services.export_service import export_as_csv, export_as_excel, export_as_pdf

router = APIRouter(prefix="/api/reports", tags=["Analytical Reports"])


@router.get("/batch-stock")
def get_batch_stock_report(
    category_id: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
    format: str = Query("json", pattern="^(json|csv|xlsx|pdf)$"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Batch & Expiry Breakdown Report with MFG, Expire, Batch No, and Qty"""
    data = get_batch_stock_report_data(db=db, category_id=category_id, search=search)

    if format == "json":
        return {"total": len(data), "items": [item.model_dump() for item in data]}

    headers = ["S.N", "Item Name", "Item Code", "Barcode", "Batch No", "MFG Date", "Expiry Date", "Quantity", "Unit", "Status"]
    rows = [
        [idx + 1, i.itemName, i.itemCode, i.barcode, i.batchNo, i.mfgDate or "-", i.expiryDate or "-", i.quantity, i.unitName, i.status]
        for idx, i in enumerate(data)
    ]

    if format == "csv":
        return export_as_csv("batch_stock_report", headers, rows)
    elif format == "xlsx":
        return export_as_excel("batch_stock_report", "Batch & Expiry Stock Report", headers, rows)
    else:
        return export_as_pdf("batch_stock_report", "Batch & Expiry Stock Report", headers, rows)


@router.get("/current-stock")
def get_current_stock_report(
    category_id: Optional[int] = Query(None),
    is_low_stock: Optional[bool] = Query(None),
    search: Optional[str] = Query(None),
    format: str = Query("json", pattern="^(json|csv|xlsx|pdf)$"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    data = get_current_stock_report_data(
        db=db,
        category_id=category_id,
        is_low_stock=is_low_stock,
        search=search,
    )

    if format == "json":
        return {"total": len(data), "items": [item.model_dump() for item in data]}

    headers = ["Item Code", "Item Name", "Barcode", "Category", "Unit", "Current Stock", "Min Stock", "Low Stock"]
    rows = [
        [i.itemCode, i.itemName, i.barcode, i.categoryName, i.unitName, i.quantity, i.minStockLevel, "YES" if i.isLowStock else "NO"]
        for i in data
    ]

    if format == "csv":
        return export_as_csv("current_stock_report", headers, rows)
    elif format == "xlsx":
        return export_as_excel("current_stock_report", "Current Stock Report", headers, rows)
    else:
        return export_as_pdf("current_stock_report", "Current Stock Report", headers, rows)


@router.get("/stock-ledger")
def get_stock_ledger_report(
    item_id: Optional[int] = Query(None),
    format: str = Query("json", pattern="^(json|csv|xlsx|pdf)$"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Mathematical Stock Ledger Reconciled Report:
    Opening + In - Out = Closing
    """
    data = get_stock_ledger_report_data(db=db, item_id=item_id)

    if format == "json":
        return {"total": len(data), "items": [item.model_dump() for item in data]}

    headers = ["Item Code", "Item Name", "Opening Qty", "Total In", "Total Out", "Closing Balance", "Reconciled"]
    rows = [
        [i.itemCode, i.itemName, i.openingQuantity, i.totalIn, i.totalOut, i.closingBalance, "YES" if i.isReconciled else "MISMATCH"]
        for i in data
    ]

    if format == "csv":
        return export_as_csv("stock_ledger_report", headers, rows)
    elif format == "xlsx":
        return export_as_excel("stock_ledger_report", "Stock Movement Ledger Report", headers, rows)
    else:
        return export_as_pdf("stock_ledger_report", "Stock Movement Ledger Report", headers, rows)


@router.get("/low-stock")
def get_low_stock_report(
    category_id: Optional[int] = Query(None),
    format: str = Query("json", pattern="^(json|csv|xlsx|pdf)$"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    data = get_low_stock_report_data(db=db, category_id=category_id)

    if format == "json":
        return {"total": len(data), "items": [item.model_dump() for item in data]}

    headers = ["Item Code", "Item Name", "Category", "Current Stock", "Min Stock Level", "Deficit Qty"]
    rows = [
        [i.itemCode, i.itemName, i.categoryName, i.currentStock, i.minStockLevel, i.deficit]
        for i in data
    ]

    if format == "csv":
        return export_as_csv("low_stock_report", headers, rows)
    elif format == "xlsx":
        return export_as_excel("low_stock_report", "Low Stock Alert Report", headers, rows)
    else:
        return export_as_pdf("low_stock_report", "Low Stock Alert Report", headers, rows)


@router.get("/location-stock")
def get_location_stock_report(
    format: str = Query("json", pattern="^(json|csv|xlsx|pdf)$"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    data = get_location_stock_report_data(db=db)

    if format == "json":
        return {"total": len(data), "items": [item.model_dump() for item in data]}

    headers = ["Location", "Transactions Count", "Total Quantity Issued"]
    rows = [
        [i.location, i.totalTransactions, i.totalQuantityIssued]
        for i in data
    ]

    if format == "csv":
        return export_as_csv("location_stock_report", headers, rows)
    elif format == "xlsx":
        return export_as_excel("location_stock_report", "Stock by Location Report", headers, rows)
    else:
        return export_as_pdf("location_stock_report", "Stock by Location Report", headers, rows)


@router.get("/fast-slow-moving")
def get_fast_slow_moving_report(
    days: int = Query(30, ge=1, le=365),
    format: str = Query("json", pattern="^(json|csv|xlsx|pdf)$"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    data = get_fast_slow_moving_report_data(db=db, days=days)

    if format == "json":
        return {"total": len(data), "items": [item.model_dump() for item in data]}

    headers = ["Item Code", "Item Name", "Category", "Total Issued Qty", "Operations Count", "Movement Category"]
    rows = [
        [i.itemCode, i.itemName, i.categoryName, i.totalIssuedQuantity, i.issueTransactionsCount, i.status]
        for i in data
    ]

    if format == "csv":
        return export_as_csv("fast_slow_moving_report", headers, rows)
    elif format == "xlsx":
        return export_as_excel("fast_slow_moving_report", f"Fast/Slow Moving ({days} Days)", headers, rows)
    else:
        return export_as_pdf("fast_slow_moving_report", f"Fast and Slow Moving Items ({days} Days)", headers, rows)


@router.get("/dormant-items")
def get_dormant_items_report(
    days: int = Query(30, ge=1, le=365),
    format: str = Query("json", pattern="^(json|csv|xlsx|pdf)$"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    data = get_dormant_items_report_data(db=db, days=days)

    if format == "json":
        return {"total": len(data), "items": [item.model_dump() for item in data]}

    headers = ["Item Code", "Item Name", "Current Stock", "Last Movement Date", "Days Inactive"]
    rows = [
        [i.itemCode, i.itemName, i.currentStock, i.lastMovementDate.strftime("%Y-%m-%d") if i.lastMovementDate else "None", i.daysInactive]
        for i in data
    ]

    if format == "csv":
        return export_as_csv("dormant_items_report", headers, rows)
    elif format == "xlsx":
        return export_as_excel("dormant_items_report", f"Dormant Items (> {days} Days)", headers, rows)
    else:
        return export_as_pdf("dormant_items_report", f"Dormant Items (Unmoved > {days} Days)", headers, rows)


@router.get("/user-activity")
def get_user_activity_report(
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    format: str = Query("json", pattern="^(json|csv|xlsx|pdf)$"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    data = get_user_activity_report_data(db=db, start_date=start_date, end_date=end_date)

    if format == "json":
        return {"total": len(data), "items": [item.model_dump() for item in data]}

    headers = ["User ID", "Username", "Role", "Stock In Count", "Stock In Qty", "Stock Out Count", "Stock Out Qty", "Total Operations"]
    rows = [
        [i.userId, i.username, i.role, i.stockInCount, i.stockInTotalQuantity, i.stockOutCount, i.stockOutTotalQuantity, i.totalOperations]
        for i in data
    ]

    if format == "csv":
        return export_as_csv("user_activity_report", headers, rows)
    elif format == "xlsx":
        return export_as_excel("user_activity_report", "User Activity Report", headers, rows)
    else:
        return export_as_pdf("user_activity_report", "User Operations Activity Report", headers, rows)
