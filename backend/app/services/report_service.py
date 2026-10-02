from datetime import datetime, time, timedelta, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, or_, case

from app.models.item import Item
from app.models.category import Category
from app.models.unit import Unit
from app.models.stock import StockIn, StockOut, StockMovement, MovementType
from app.models.user import User
from app.schemas.report import (
    DashboardStatsResponse,
    CategoryStockChartData,
    TrendChartData,
    DashboardChartsResponse,
    CurrentStockReportItem,
    StockLedgerReportItem,
    LowStockReportItem,
    LocationStockReportItem,
    FastSlowMovingItem,
    DormantItem,
    UserActivityReportItem,
)


def get_dashboard_stats(db: Session) -> DashboardStatsResponse:
    now = datetime.now(timezone.utc)
    today_start = datetime.combine(now.date(), time.min).replace(tzinfo=timezone.utc)

    # 1. Active items count and total quantity
    items_agg = db.query(
        func.count(Item.id).label("total_items"),
        func.coalesce(func.sum(Item.quantity), Decimal("0.00")).label("total_qty"),
    ).filter(Item.isActive == True).first()

    total_items = items_agg.total_items if items_agg else 0
    total_qty = items_agg.total_qty if items_agg else Decimal("0.00")

    # 2. Today's In and Out
    today_in = db.query(
        func.coalesce(func.sum(StockIn.quantity), Decimal("0.00"))
    ).filter(StockIn.createdAt >= today_start).scalar()

    today_out = db.query(
        func.coalesce(func.sum(StockOut.quantity), Decimal("0.00"))
    ).filter(StockOut.createdAt >= today_start).scalar()

    # 3. Low stock count
    low_stock_count = db.query(func.count(Item.id)).filter(
        Item.isActive == True,
        Item.quantity <= Item.minStockLevel,
    ).scalar() or 0

    # 4. Top 10 moving items (by total stock out quantity)
    top_moving = db.query(
        Item.id,
        Item.itemCode,
        Item.itemName,
        func.coalesce(func.sum(StockOut.quantity), Decimal("0.00")).label("total_issued"),
    ).join(StockOut, StockOut.itemId == Item.id)\
     .group_by(Item.id, Item.itemCode, Item.itemName)\
     .order_by(desc("total_issued"))\
     .limit(10).all()

    top_10 = [
        {
            "itemId": row.id,
            "itemCode": row.itemCode,
            "itemName": row.itemName,
            "totalIssued": row.total_issued,
        }
        for row in top_moving
    ]

    return DashboardStatsResponse(
        totalItems=total_items,
        totalStockQuantity=total_qty,
        todayInQuantity=today_in,
        todayOutQuantity=today_out,
        lowStockCount=low_stock_count,
        top10MovingItems=top_10,
    )


def get_dashboard_charts(db: Session) -> DashboardChartsResponse:
    # 1. Stock by Category
    cat_stock = db.query(
        Category.name.label("cat_name"),
        func.count(Item.id).label("item_count"),
        func.coalesce(func.sum(Item.quantity), Decimal("0.00")).label("total_qty"),
    ).join(Item, Item.categoryId == Category.id)\
     .filter(Item.isActive == True)\
     .group_by(Category.name)\
     .order_by(desc("total_qty")).all()

    stock_by_cat = [
        CategoryStockChartData(
            categoryName=row.cat_name,
            itemCount=row.item_count,
            totalQuantity=row.total_qty,
        )
        for row in cat_stock
    ]

    # 2. In vs Out 7-day trend
    now = datetime.now(timezone.utc)
    trend_data: List[TrendChartData] = []
    for day_offset in range(6, -1, -1):
        target_date = (now - timedelta(days=day_offset)).date()
        day_start = datetime.combine(target_date, time.min).replace(tzinfo=timezone.utc)
        day_end = datetime.combine(target_date, time.max).replace(tzinfo=timezone.utc)

        in_qty = db.query(func.coalesce(func.sum(StockIn.quantity), Decimal("0.00"))).filter(
            StockIn.createdAt >= day_start,
            StockIn.createdAt <= day_end,
        ).scalar()

        out_qty = db.query(func.coalesce(func.sum(StockOut.quantity), Decimal("0.00"))).filter(
            StockOut.createdAt >= day_start,
            StockOut.createdAt <= day_end,
        ).scalar()

        trend_data.append(
            TrendChartData(
                period=target_date.strftime("%Y-%m-%d"),
                inQuantity=in_qty,
                outQuantity=out_qty,
            )
        )

    return DashboardChartsResponse(
        stockByCategory=stock_by_cat,
        inVsOutTrend=trend_data,
    )


def get_current_stock_report_data(
    db: Session,
    category_id: Optional[int] = None,
    is_low_stock: Optional[bool] = None,
    search: Optional[str] = None,
) -> List[CurrentStockReportItem]:
    query = db.query(Item).join(Category).join(Unit).filter(Item.isActive == True)

    if category_id:
        query = query.filter(Item.categoryId == category_id)
    if is_low_stock is True:
        query = query.filter(Item.quantity <= Item.minStockLevel)
    if search:
        search_fmt = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Item.itemName.ilike(search_fmt),
                Item.itemCode.ilike(search_fmt),
                Item.barcode.ilike(search_fmt),
            )
        )

    items = query.order_by(Item.itemName.asc()).all()
    results = []
    for it in items:
        results.append(
            CurrentStockReportItem(
                itemCode=it.itemCode,
                itemName=it.itemName,
                barcode=it.barcode,
                categoryName=it.category.name if it.category else "",
                unitName=it.unit.name if it.unit else "",
                quantity=it.quantity,
                minStockLevel=it.minStockLevel,
                isLowStock=bool(it.quantity <= it.minStockLevel),
            )
        )
    return results


def get_stock_ledger_report_data(
    db: Session,
    item_id: Optional[int] = None,
) -> List[StockLedgerReportItem]:
    """
    Mathematical Reconciliation Calculation:
    For every item:
    Opening + In - Out == Closing Balance
    """
    items_query = db.query(Item).filter(Item.isActive == True)
    if item_id:
        items_query = items_query.filter(Item.id == item_id)

    items = items_query.order_by(Item.itemCode.asc()).all()
    report: List[StockLedgerReportItem] = []

    for it in items:
        # Sum of OPENING movements
        opening_qty = db.query(
            func.coalesce(func.sum(StockMovement.quantity), Decimal("0.00"))
        ).filter(
            StockMovement.itemId == it.id,
            StockMovement.type == MovementType.OPENING,
        ).scalar()

        # Sum of IN movements
        in_qty = db.query(
            func.coalesce(func.sum(StockMovement.quantity), Decimal("0.00"))
        ).filter(
            StockMovement.itemId == it.id,
            StockMovement.type == MovementType.IN,
        ).scalar()

        # Sum of OUT movements
        out_qty = db.query(
            func.coalesce(func.sum(StockMovement.quantity), Decimal("0.00"))
        ).filter(
            StockMovement.itemId == it.id,
            StockMovement.type == MovementType.OUT,
        ).scalar()

        # Closing stock from ledger
        calculated_closing = opening_qty + in_qty - out_qty
        is_reconciled = bool(calculated_closing == it.quantity)

        report.append(
            StockLedgerReportItem(
                itemId=it.id,
                itemCode=it.itemCode,
                itemName=it.itemName,
                openingQuantity=opening_qty,
                totalIn=in_qty,
                totalOut=out_qty,
                closingBalance=it.quantity,
                isReconciled=is_reconciled,
            )
        )

    return report


def get_low_stock_report_data(
    db: Session,
    category_id: Optional[int] = None,
) -> List[LowStockReportItem]:
    query = db.query(Item).join(Category).filter(
        Item.isActive == True,
        Item.quantity <= Item.minStockLevel,
    )
    if category_id:
        query = query.filter(Item.categoryId == category_id)

    items = query.order_by(Item.quantity.asc()).all()
    return [
        LowStockReportItem(
            itemCode=it.itemCode,
            itemName=it.itemName,
            categoryName=it.category.name if it.category else "",
            currentStock=it.quantity,
            minStockLevel=it.minStockLevel,
            deficit=max(Decimal("0.00"), it.minStockLevel - it.quantity),
        )
        for it in items
    ]


def get_location_stock_report_data(db: Session) -> List[LocationStockReportItem]:
    data = db.query(
        StockOut.location,
        func.count(StockOut.id).label("tx_count"),
        func.coalesce(func.sum(StockOut.quantity), Decimal("0.00")).label("total_qty"),
    ).group_by(StockOut.location).order_by(desc("total_qty")).all()

    return [
        LocationStockReportItem(
            location=row.location,
            totalTransactions=row.tx_count,
            totalQuantityIssued=row.total_qty,
        )
        for row in data
    ]


def get_fast_slow_moving_report_data(db: Session, days: int = 30) -> List[FastSlowMovingItem]:
    since = datetime.now(timezone.utc) - timedelta(days=days)

    query = db.query(
        Item.itemCode,
        Item.itemName,
        Category.name.label("cat_name"),
        func.coalesce(func.sum(StockOut.quantity), Decimal("0.00")).label("issued_qty"),
        func.count(StockOut.id).label("tx_count"),
    ).join(Category, Category.id == Item.categoryId)\
     .outerjoin(StockOut, (StockOut.itemId == Item.id) & (StockOut.createdAt >= since))\
     .filter(Item.isActive == True)\
     .group_by(Item.id, Item.itemCode, Item.itemName, Category.name)\
     .order_by(desc("issued_qty")).all()

    results = []
    for row in query:
        if row.issued_qty >= Decimal("50.00"):
            status_desc = "FAST_MOVING"
        elif row.issued_qty > Decimal("0.00"):
            status_desc = "SLOW_MOVING"
        else:
            status_desc = "DORMANT"

        results.append(
            FastSlowMovingItem(
                itemCode=row.itemCode,
                itemName=row.itemName,
                categoryName=row.cat_name,
                totalIssuedQuantity=row.issued_qty,
                issueTransactionsCount=row.tx_count,
                status=status_desc,
            )
        )
    return results


def get_dormant_items_report_data(db: Session, days: int = 30) -> List[DormantItem]:
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    items = db.query(Item).filter(Item.isActive == True).all()
    dormant_list = []

    for it in items:
        last_mov = db.query(func.max(StockMovement.createdAt)).filter(
            StockMovement.itemId == it.id,
            StockMovement.type.in_([MovementType.IN, MovementType.OUT]),
        ).scalar()

        if not last_mov or (last_mov.replace(tzinfo=timezone.utc) if last_mov.tzinfo is None else last_mov) < cutoff:
            if last_mov:
                lm = last_mov.replace(tzinfo=timezone.utc) if last_mov.tzinfo is None else last_mov
                inactive_days = (datetime.now(timezone.utc) - lm).days
            else:
                inactive_days = days

            dormant_list.append(
                DormantItem(
                    itemCode=it.itemCode,
                    itemName=it.itemName,
                    currentStock=it.quantity,
                    lastMovementDate=last_mov,
                    daysInactive=inactive_days,
                )
            )

    return sorted(dormant_list, key=lambda x: x.daysInactive, reverse=True)


def get_user_activity_report_data(
    db: Session,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
) -> List[UserActivityReportItem]:
    users = db.query(User).all()
    report = []

    if start_date and start_date.tzinfo is None:
        start_date = start_date.replace(tzinfo=timezone.utc)
    if end_date and end_date.tzinfo is None:
        end_date = end_date.replace(tzinfo=timezone.utc)

    for u in users:
        # Stock In stats
        in_query = db.query(
            func.count(StockIn.id).label("in_count"),
            func.coalesce(func.sum(StockIn.quantity), Decimal("0.00")).label("in_qty"),
        ).filter(StockIn.createdBy == u.id)
        if start_date:
            in_query = in_query.filter(StockIn.createdAt >= start_date)
        if end_date:
            in_query = in_query.filter(StockIn.createdAt <= end_date)
        in_stats = in_query.first()

        # Stock Out stats
        out_query = db.query(
            func.count(StockOut.id).label("out_count"),
            func.coalesce(func.sum(StockOut.quantity), Decimal("0.00")).label("out_qty"),
        ).filter(StockOut.createdBy == u.id)
        if start_date:
            out_query = out_query.filter(StockOut.createdAt >= start_date)
        if end_date:
            out_query = out_query.filter(StockOut.createdAt <= end_date)
        out_stats = out_query.first()

        in_count = in_stats.in_count if in_stats else 0
        in_qty = in_stats.in_qty if in_stats else Decimal("0.00")
        out_count = out_stats.out_count if out_stats else 0
        out_qty = out_stats.out_qty if out_stats else Decimal("0.00")

        report.append(
            UserActivityReportItem(
                userId=u.id,
                username=u.username,
                role=u.role,
                stockInCount=in_count,
                stockInTotalQuantity=in_qty,
                stockOutCount=out_count,
                stockOutTotalQuantity=out_qty,
                totalOperations=in_count + out_count,
            )
        )

    return sorted(report, key=lambda x: x.totalOperations, reverse=True)
