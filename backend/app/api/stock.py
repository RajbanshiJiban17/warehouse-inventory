from datetime import datetime
from typing import Any, Optional
from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, get_client_ip
from app.models.user import User
from app.schemas.stock import (
    StockInRequest,
    StockInResponse,
    StockOutRequest,
    StockOutResponse,
    StockMovementResponse,
)
from app.services.stock_service import (
    process_stock_in,
    process_stock_out,
    list_stock_in_entries,
    list_stock_out_entries,
    list_stock_movements,
)

router = APIRouter(prefix="/api/stock", tags=["Stock Operations"])


@router.post("/in", response_model=StockInResponse, status_code=status.HTTP_201_CREATED)
def stock_in(
    request_data: StockInRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> StockInResponse:
    ip = get_client_ip(request)
    user_agent = request.headers.get("user-agent")
    return process_stock_in(
        db=db,
        user_id=current_user.id,
        request=request_data,
        ip=ip,
        user_agent=user_agent,
    )


@router.get("/in", response_model=dict[str, Any])
def get_stock_in_history(
    item_id: Optional[int] = Query(None),
    user_id: Optional[int] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    entries, total = list_stock_in_entries(
        db=db,
        item_id=item_id,
        user_id=user_id,
        start_date=start_date,
        end_date=end_date,
        limit=limit,
        offset=offset,
    )
    return {
        "total": total,
        "items": entries,
        "limit": limit,
        "offset": offset,
    }


@router.post("/out", response_model=StockOutResponse, status_code=status.HTTP_201_CREATED)
def stock_out(
    request_data: StockOutRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> StockOutResponse:
    ip = get_client_ip(request)
    user_agent = request.headers.get("user-agent")
    return process_stock_out(
        db=db,
        user_id=current_user.id,
        request=request_data,
        ip=ip,
        user_agent=user_agent,
    )


@router.get("/out", response_model=dict[str, Any])
def get_stock_out_history(
    item_id: Optional[int] = Query(None),
    user_id: Optional[int] = Query(None),
    location: Optional[str] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    entries, total = list_stock_out_entries(
        db=db,
        item_id=item_id,
        user_id=user_id,
        location=location,
        start_date=start_date,
        end_date=end_date,
        limit=limit,
        offset=offset,
    )
    return {
        "total": total,
        "items": entries,
        "limit": limit,
        "offset": offset,
    }


@router.get("/movements", response_model=dict[str, Any])
def get_stock_movements_ledger(
    item_id: Optional[int] = Query(None),
    type: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    movements, total = list_stock_movements(
        db=db,
        item_id=item_id,
        movement_type=type,
        limit=limit,
        offset=offset,
    )
    return {
        "total": total,
        "items": movements,
        "limit": limit,
        "offset": offset,
    }
