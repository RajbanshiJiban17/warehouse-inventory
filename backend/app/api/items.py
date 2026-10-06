import csv
import io
from typing import Any, Optional
from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, Response, UploadFile, status
from fastapi.responses import StreamingResponse
import openpyxl  # type: ignore
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_admin, get_client_ip
from app.models.user import User
from app.schemas.item import (
    ItemCreate,
    ItemUpdate,
    ItemResponse,
    ItemImportResult,
)
from app.services.item_service import (
    list_items,
    get_item_by_id,
    get_item_by_barcode,
    get_item_by_code,
    create_item,
    update_item,
    soft_delete_item,
    import_items_from_csv,
    import_items_from_file,
    reset_all_inventory,
    serialize_item_response,
)

router = APIRouter(prefix="/api/items", tags=["Item Master"])


@router.get("", response_model=dict[str, Any])
def get_items_list(
    search: Optional[str] = Query(None),
    category_id: Optional[int] = Query(None),
    is_low_stock: Optional[bool] = Query(None),
    is_active: Optional[bool] = Query(True),
    sort_by: str = Query("id"),
    sort_dir: str = Query("desc"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    items, total = list_items(
        db=db,
        search=search,
        category_id=category_id,
        is_low_stock=is_low_stock,
        is_active=is_active,
        sort_by=sort_by,
        sort_dir=sort_dir,
        limit=limit,
        offset=offset,
    )
    return {
        "total": total,
        "items": items,
        "limit": limit,
        "offset": offset,
    }


@router.post("", response_model=ItemResponse, status_code=status.HTTP_201_CREATED)
def register_item(
    request_data: ItemCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ItemResponse:
    ip = get_client_ip(request)
    user_agent = request.headers.get("user-agent")
    return create_item(
        db=db,
        user_id=current_user.id,
        request=request_data,
        ip=ip,
        user_agent=user_agent,
    )


@router.get("/next-code")
def fetch_next_code(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    from app.services.item_service import get_next_item_code
    return {"nextCode": get_next_item_code(db)}


@router.get("/barcode/{barcode}", response_model=ItemResponse)
def lookup_by_barcode(
    barcode: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ItemResponse:
    """
    Scanner endpoint: fast barcode lookup.
    Returns 404 with 'Item not found' if not in system.
    """
    return get_item_by_barcode(db, barcode)


@router.get("/code/{item_code}", response_model=ItemResponse)
def lookup_by_code(
    item_code: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ItemResponse:
    return get_item_by_code(db, item_code)


@router.get("/{item_id}", response_model=ItemResponse)
def get_item(
    item_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ItemResponse:
    item = get_item_by_id(db, item_id)
    return serialize_item_response(item)


@router.put("/{item_id}", response_model=ItemResponse)
def modify_item(
    item_id: int,
    request_data: ItemUpdate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ItemResponse:
    ip = get_client_ip(request)
    user_agent = request.headers.get("user-agent")
    return update_item(
        db=db,
        user_id=current_user.id,
        item_id=item_id,
        request=request_data,
        ip=ip,
        user_agent=user_agent,
    )


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_item(
    item_id: int,
    request: Request,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> None:
    ip = get_client_ip(request)
    user_agent = request.headers.get("user-agent")
    soft_delete_item(db=db, user_id=current_admin.id, item_id=item_id, ip=ip, user_agent=user_agent)


from app.services.item_service import (
    list_items,
    get_item_by_id,
    get_item_by_barcode,
    get_item_by_code,
    create_item,
    update_item,
    soft_delete_item,
    import_items_from_file,
    import_items_from_csv,
    serialize_item_response,
)


@router.get("/import/template")
def download_import_template(
    format: str = Query("xlsx", pattern="^(xlsx|csv)$"),
    current_user: User = Depends(get_current_user),
) -> StreamingResponse:
    """Provides a sample spreadsheet template for bulk item importing"""
    headers = [
        "Item Code",
        "Item Name",
        "Barcode",
        "Category",
        "Unit",
        "Opening Stock",
        "Min Stock Level",
    ]
    sample_rows = [
        ["ITEM-001", "Sample Item One", "890000000001", "Electronics", "pcs", 100, 10],
        ["ITEM-002", "Sample Item Two", "890000000002", "Groceries", "kg", 50, 5],
    ]
    if format == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(headers)
        for r in sample_rows:
            writer.writerow(r)
        output.seek(0)
        return StreamingResponse(
            io.BytesIO(output.getvalue().encode("utf-8")),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=inventory_import_template.csv"},
        )
    else:
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Import Template"
        ws.append(headers)
        for r in sample_rows:
            ws.append(r)
        excel_io = io.BytesIO()
        wb.save(excel_io)
        excel_io.seek(0)
        return StreamingResponse(
            excel_io,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=inventory_import_template.xlsx"},
        )


@router.post("/import", response_model=ItemImportResult)
async def bulk_import_items(
    request: Request,
    file: UploadFile = File(...),
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> ItemImportResult:
    fn_lower = (file.filename or "").lower()
    if not (fn_lower.endswith(".csv") or fn_lower.endswith(".xlsx") or fn_lower.endswith(".xls")):
        raise HTTPException(
            status_code=400,
            detail="Supported file formats: Excel (.xlsx, .xls) and CSV (.csv)",
        )

    file_bytes = await file.read()
    ip = get_client_ip(request)
    user_agent = request.headers.get("user-agent")
    return import_items_from_file(
        db=db,
        user_id=current_admin.id,
        file_bytes=file_bytes,
        filename=file.filename or "import.xlsx",
        ip=ip,
        user_agent=user_agent,
    )


@router.post("/reset-inventory")
def reset_inventory(
    request: Request,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Wipes all items, stock movements, and batches so users can start with a fresh file upload."""
    ip = get_client_ip(request)
    user_agent = request.headers.get("user-agent")
    wiped_count = reset_all_inventory(db=db, user_id=current_admin.id, ip=ip, user_agent=user_agent)
    return {
        "message": "Inventory successfully reset. Ready for new spreadsheet upload.",
        "wipedCount": wiped_count,
    }


@router.get("/export/data")
def export_items(
    format: str = Query("csv", pattern="^(csv|xlsx)$"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> StreamingResponse:
    items, _ = list_items(db=db, limit=10000, offset=0)

    if format == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["Item Code", "Item Name", "Barcode", "Category", "Unit", "Current Stock", "Min Stock Level"])
        for it in items:
            writer.writerow([it.itemCode, it.itemName, it.barcode, it.categoryName or "", it.unitName or "", it.quantity, it.minStockLevel])
        output.seek(0)
        return StreamingResponse(
            io.BytesIO(output.getvalue().encode("utf-8")),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=inventory_items.csv"},
        )
    else:
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Inventory Items"
        ws.append(["Item Code", "Item Name", "Barcode", "Category", "Unit", "Current Stock", "Min Stock Level"])
        for it in items:
            ws.append([it.itemCode, it.itemName, it.barcode, it.categoryName or "", it.unitName or "", float(it.quantity), float(it.minStockLevel)])
        
        excel_io = io.BytesIO()
        wb.save(excel_io)
        excel_io.seek(0)
        return StreamingResponse(
            excel_io,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=inventory_items.xlsx"},
        )
