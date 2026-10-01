from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional, Tuple
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc, update

from app.models.item import Item
from app.models.stock import StockIn, StockOut, StockMovement, MovementType
from app.models.user import User
from app.models.audit import AuditAction
from app.schemas.stock import (
    StockInRequest,
    StockInResponse,
    StockOutRequest,
    StockOutResponse,
    StockMovementResponse,
)
from app.services.audit_service import log_audit_event


def process_stock_in(
    db: Session,
    user_id: int,
    request: StockInRequest,
    ip: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> StockInResponse:
    """
    Executes Stock In transaction atomically with row-locking:
    1. Lock item row with with_for_update()
    2. Insert StockIn
    3. Increase Item.quantity
    4. Insert StockMovement ledger entry with exact balanceAfter
    5. Record AuditLog
    """
    qty = Decimal(str(request.quantity))
    if qty <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Stock In quantity must be greater than zero",
        )

    # 1. Lock Item row
    query = db.query(Item).filter(Item.isActive == True)
    if request.itemId:
        query = query.filter(Item.id == request.itemId)
    elif request.barcode:
        query = query.filter(Item.barcode == request.barcode.strip())
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Item ID or Barcode is required",
        )

    # with_for_update() ensures safe row-level locking for PostgreSQL (ignored cleanly on SQLite)
    item = query.with_for_update().first()
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found",
        )

    # Validate decimals against unit
    if item.unit and not item.unit.allowDecimals and (qty % 1 != 0):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unit '{item.unit.name}' does not allow fractional/decimal quantities",
        )

    try:
        # 2. Insert StockIn
        stock_in_entry = StockIn(
            itemId=item.id,
            quantity=qty,
            remark=request.remark,
            createdBy=user_id,
        )
        db.add(stock_in_entry)
        db.flush()

        # 3. Increase Item.quantity atomically
        stmt = (
            update(Item)
            .where(Item.id == item.id)
            .values(quantity=Item.quantity + qty)
        )
        db.execute(stmt)
        db.refresh(item)

        # 4. Insert StockMovement ledger record
        ref_id = request.idempotencyKey or f"IN_{stock_in_entry.id}"
        movement = StockMovement(
            itemId=item.id,
            type=MovementType.IN,
            quantity=qty,
            balanceAfter=item.quantity,
            referenceId=ref_id,
            createdBy=user_id,
        )
        db.add(movement)

        # 5. Insert AuditLog
        user = db.query(User).filter(User.id == user_id).first()
        log_audit_event(
            db=db,
            action=AuditAction.CREATE,
            entity="STOCK_IN",
            userId=user_id,
            entityId=str(stock_in_entry.id),
            newValue={
                "itemId": item.id,
                "itemCode": item.itemCode,
                "quantity": str(qty),
                "balanceAfter": str(item.quantity),
            },
            ip=ip,
            userAgent=user_agent,
        )

        db.commit()

        return StockInResponse(
            id=stock_in_entry.id,
            itemId=item.id,
            itemCode=item.itemCode,
            itemName=item.itemName,
            barcode=item.barcode,
            quantity=stock_in_entry.quantity,
            balanceAfter=item.quantity,
            remark=stock_in_entry.remark,
            createdAt=stock_in_entry.createdAt,
            createdByUsername=user.username if user else None,
        )

    except Exception:
        db.rollback()
        raise


def process_stock_out(
    db: Session,
    user_id: int,
    request: StockOutRequest,
    ip: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> StockOutResponse:
    """
    Executes Stock Out transaction atomically with row-locking:
    1. Lock item row with with_for_update()
    2. Check stock: If requested > available, reject with 'Insufficient stock. Available: N'
    3. Decrease Item.quantity automatically by requested quantity
    4. Insert StockOut
    5. Insert StockMovement ledger entry with exact balanceAfter
    6. Record AuditLog
    """
    qty = Decimal(str(request.quantity))
    if qty <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Stock Out quantity must be greater than zero",
        )

    # 1. Lock Item row
    query = db.query(Item).filter(Item.isActive == True)
    if request.itemId:
        query = query.filter(Item.id == request.itemId)
    elif request.barcode:
        query = query.filter(Item.barcode == request.barcode.strip())
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Item ID or Barcode is required",
        )

    item = query.with_for_update().first()
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found",
        )

    # Validate decimals against unit
    if item.unit and not item.unit.allowDecimals and (qty % 1 != 0):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unit '{item.unit.name}' does not allow fractional/decimal quantities",
        )

    # 2. Concurrency stock verification and atomic decrement
    stmt = (
        update(Item)
        .where(Item.id == item.id, Item.quantity >= qty)
        .values(quantity=Item.quantity - qty)
    )
    res = db.execute(stmt)
    if res.rowcount == 0:
        db.refresh(item)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Insufficient stock. Available: {item.quantity}",
        )
    db.refresh(item)

    try:
        # 3. Insert StockOut
        stock_out_entry = StockOut(
            itemId=item.id,
            quantity=qty,
            location=request.location.strip(),
            remark=request.remark,
            createdBy=user_id,
        )
        db.add(stock_out_entry)
        db.flush()

        # 4. Insert StockMovement ledger record
        ref_id = request.idempotencyKey or f"OUT_{stock_out_entry.id}"
        movement = StockMovement(
            itemId=item.id,
            type=MovementType.OUT,
            quantity=qty,
            balanceAfter=item.quantity,
            referenceId=ref_id,
            createdBy=user_id,
        )
        db.add(movement)

        # Low stock warning flag
        is_low_stock = bool(item.quantity <= item.minStockLevel)

        # 6. Insert AuditLog
        user = db.query(User).filter(User.id == user_id).first()
        log_audit_event(
            db=db,
            action=AuditAction.CREATE,
            entity="STOCK_OUT",
            userId=user_id,
            entityId=str(stock_out_entry.id),
            newValue={
                "itemId": item.id,
                "itemCode": item.itemCode,
                "quantity": str(qty),
                "location": stock_out_entry.location,
                "balanceAfter": str(item.quantity),
                "isLowStock": is_low_stock,
            },
            ip=ip,
            userAgent=user_agent,
        )

        db.commit()

        return StockOutResponse(
            id=stock_out_entry.id,
            itemId=item.id,
            itemCode=item.itemCode,
            itemName=item.itemName,
            barcode=item.barcode,
            quantity=stock_out_entry.quantity,
            location=stock_out_entry.location,
            balanceAfter=item.quantity,
            isLowStockWarning=is_low_stock,
            remark=stock_out_entry.remark,
            createdAt=stock_out_entry.createdAt,
            createdByUsername=user.username if user else None,
        )

    except Exception:
        db.rollback()
        raise


def list_stock_in_entries(
    db: Session,
    item_id: Optional[int] = None,
    user_id: Optional[int] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    limit: int = 50,
    offset: int = 0,
) -> Tuple[List[StockInResponse], int]:
    query = db.query(StockIn).join(Item).join(User)

    if item_id:
        query = query.filter(StockIn.itemId == item_id)
    if user_id:
        query = query.filter(StockIn.createdBy == user_id)
    if start_date:
        query = query.filter(StockIn.createdAt >= start_date)
    if end_date:
        query = query.filter(StockIn.createdAt <= end_date)

    total = query.count()
    entries = query.order_by(StockIn.id.desc()).offset(offset).limit(limit).all()

    results = []
    for e in entries:
        results.append(
            StockInResponse(
                id=e.id,
                itemId=e.itemId,
                itemCode=e.item.itemCode,
                itemName=e.item.itemName,
                barcode=e.item.barcode,
                quantity=e.quantity,
                balanceAfter=e.item.quantity,
                remark=e.remark,
                createdAt=e.createdAt,
                createdByUsername=e.user.username if e.user else None,
            )
        )
    return results, total


def list_stock_out_entries(
    db: Session,
    item_id: Optional[int] = None,
    user_id: Optional[int] = None,
    location: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    limit: int = 50,
    offset: int = 0,
) -> Tuple[List[StockOutResponse], int]:
    query = db.query(StockOut).join(Item).join(User)

    if item_id:
        query = query.filter(StockOut.itemId == item_id)
    if user_id:
        query = query.filter(StockOut.createdBy == user_id)
    if location:
        query = query.filter(StockOut.location == location)
    if start_date:
        query = query.filter(StockOut.createdAt >= start_date)
    if end_date:
        query = query.filter(StockOut.createdAt <= end_date)

    total = query.count()
    entries = query.order_by(StockOut.id.desc()).offset(offset).limit(limit).all()

    results = []
    for e in entries:
        results.append(
            StockOutResponse(
                id=e.id,
                itemId=e.itemId,
                itemCode=e.item.itemCode,
                itemName=e.item.itemName,
                barcode=e.item.barcode,
                quantity=e.quantity,
                location=e.location,
                balanceAfter=e.item.quantity,
                isLowStockWarning=bool(e.item.quantity <= e.item.minStockLevel),
                remark=e.remark,
                createdAt=e.createdAt,
                createdByUsername=e.user.username if e.user else None,
            )
        )
    return results, total


def list_stock_movements(
    db: Session,
    item_id: Optional[int] = None,
    movement_type: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
) -> Tuple[List[StockMovementResponse], int]:
    query = db.query(StockMovement).join(Item).outerjoin(User)

    if item_id:
        query = query.filter(StockMovement.itemId == item_id)
    if movement_type:
        query = query.filter(StockMovement.type == movement_type)

    total = query.count()
    movements = query.order_by(StockMovement.id.desc()).offset(offset).limit(limit).all()

    results = []
    for m in movements:
        results.append(
            StockMovementResponse(
                id=m.id,
                itemId=m.itemId,
                itemCode=m.item.itemCode,
                itemName=m.item.itemName,
                type=m.type,
                quantity=m.quantity,
                balanceAfter=m.balanceAfter,
                referenceId=m.referenceId,
                createdAt=m.createdAt,
                createdByUsername=m.user.username if m.user else None,
            )
        )
    return results, total
