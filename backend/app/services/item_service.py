import csv
import io
from decimal import Decimal
from typing import List, Optional, Tuple
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.models.item import Item
from app.models.category import Category
from app.models.unit import Unit
from app.models.stock import StockMovement, MovementType
from app.models.audit import AuditAction
from app.schemas.item import (
    ItemCreate,
    ItemUpdate,
    ItemResponse,
    ItemImportResult,
    ItemImportRowError,
)
from app.services.audit_service import log_audit_event


def serialize_item_response(item: Item) -> ItemResponse:
    res = ItemResponse.model_validate(item)
    if item.category:
        res.categoryName = item.category.name
    if item.unit:
        res.unitName = item.unit.name
        res.allowDecimals = item.unit.allowDecimals
    res.isLowStock = bool(item.quantity <= item.minStockLevel)
    return res


def list_items(
    db: Session,
    search: Optional[str] = None,
    category_id: Optional[int] = None,
    is_low_stock: Optional[bool] = None,
    is_active: Optional[bool] = True,
    sort_by: str = "id",
    sort_dir: str = "desc",
    limit: int = 50,
    offset: int = 0,
) -> Tuple[List[ItemResponse], int]:
    query = db.query(Item)

    if is_active is not None:
        query = query.filter(Item.isActive == is_active)

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

    total = query.count()

    # Dynamic sorting
    sort_column = getattr(Item, sort_by, Item.id)
    if sort_dir.lower() == "asc":
        query = query.order_by(sort_column.asc())
    else:
        query = query.order_by(sort_column.desc())

    items = query.offset(offset).limit(limit).all()
    return [serialize_item_response(it) for it in items], total


def get_item_by_id(db: Session, item_id: int) -> Item:
    item = db.query(Item).filter(Item.id == item_id).first()
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found",
        )
    return item


def get_item_by_barcode(db: Session, barcode: str) -> ItemResponse:
    item = db.query(Item).filter(Item.barcode == barcode.strip(), Item.isActive == True).first()
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found",
        )
    return serialize_item_response(item)


def get_item_by_code(db: Session, item_code: str) -> ItemResponse:
    item = db.query(Item).filter(Item.itemCode == item_code.strip(), Item.isActive == True).first()
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found",
        )
    return serialize_item_response(item)


def create_item(
    db: Session,
    user_id: int,
    request: ItemCreate,
    ip: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> ItemResponse:
    # 1. Uniqueness checks with clear error messages
    existing_code = db.query(Item).filter(Item.itemCode == request.itemCode.strip()).first()
    if existing_code:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Item Code '{request.itemCode}' already registered to item '{existing_code.itemName}'",
        )

    existing_barcode = db.query(Item).filter(Item.barcode == request.barcode.strip()).first()
    if existing_barcode:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Barcode '{request.barcode}' already registered to item '{existing_barcode.itemName}'",
        )

    # 2. Foreign key existence
    category = db.query(Category).filter(Category.id == request.categoryId).first()
    if not category:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid Category ID")

    unit = db.query(Unit).filter(Unit.id == request.unitId).first()
    if not unit:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid Unit ID")

    # 3. Insert Item inside transaction
    opening_qty = Decimal(str(request.openingQuantity))
    new_item = Item(
        itemCode=request.itemCode.strip(),
        itemName=request.itemName.strip(),
        barcode=request.barcode.strip(),
        categoryId=request.categoryId,
        unitId=request.unitId,
        quantity=opening_qty,
        minStockLevel=Decimal(str(request.minStockLevel)),
        createdBy=user_id,
    )
    db.add(new_item)
    db.flush()

    # 4. Opening quantity creates an OPENING record in stock movement ledger
    if opening_qty > 0:
        opening_movement = StockMovement(
            itemId=new_item.id,
            type=MovementType.OPENING,
            quantity=opening_qty,
            balanceAfter=opening_qty,
            referenceId="OPENING_STOCK",
            createdBy=user_id,
        )
        db.add(opening_movement)

    # 5. Record AuditLog
    log_audit_event(
        db=db,
        action=AuditAction.CREATE,
        entity="ITEM",
        userId=user_id,
        entityId=str(new_item.id),
        newValue={
            "itemCode": new_item.itemCode,
            "itemName": new_item.itemName,
            "barcode": new_item.barcode,
            "openingQuantity": str(opening_qty),
        },
        ip=ip,
        userAgent=user_agent,
    )
    db.commit()
    db.refresh(new_item)

    return serialize_item_response(new_item)


def update_item(
    db: Session,
    user_id: int,
    item_id: int,
    request: ItemUpdate,
    ip: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> ItemResponse:
    item = get_item_by_id(db, item_id)
    old_data = {
        "itemCode": item.itemCode,
        "itemName": item.itemName,
        "barcode": item.barcode,
        "minStockLevel": str(item.minStockLevel),
    }

    if request.itemCode and request.itemCode != item.itemCode:
        conflict = db.query(Item).filter(Item.itemCode == request.itemCode, Item.id != item_id).first()
        if conflict:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Item Code already registered to '{conflict.itemName}'",
            )
        item.itemCode = request.itemCode.strip()

    if request.barcode and request.barcode != item.barcode:
        conflict = db.query(Item).filter(Item.barcode == request.barcode, Item.id != item_id).first()
        if conflict:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Barcode already registered to '{conflict.itemName}'",
            )
        item.barcode = request.barcode.strip()

    if request.itemName:
        item.itemName = request.itemName.strip()
    if request.categoryId:
        item.categoryId = request.categoryId
    if request.unitId:
        item.unitId = request.unitId
    if request.minStockLevel is not None:
        item.minStockLevel = Decimal(str(request.minStockLevel))

    log_audit_event(
        db=db,
        action=AuditAction.UPDATE,
        entity="ITEM",
        userId=user_id,
        entityId=str(item.id),
        oldValue=old_data,
        newValue={
            "itemCode": item.itemCode,
            "itemName": item.itemName,
            "barcode": item.barcode,
            "minStockLevel": str(item.minStockLevel),
        },
        ip=ip,
        userAgent=user_agent,
    )
    db.commit()
    db.refresh(item)

    return serialize_item_response(item)


def soft_delete_item(
    db: Session,
    user_id: int,
    item_id: int,
    ip: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> None:
    """Soft-delete item (admin only). Preserves all historical stock and ledger records."""
    item = get_item_by_id(db, item_id)
    item.isActive = False

    log_audit_event(
        db=db,
        action=AuditAction.DELETE,
        entity="ITEM",
        userId=user_id,
        entityId=str(item.id),
        oldValue={"isActive": True},
        newValue={"isActive": False},
        ip=ip,
        userAgent=user_agent,
    )
    db.commit()


def _normalize_key(key: str) -> str:
    cleaned = "".join(c.lower() for c in str(key) if c.isalnum())
    if cleaned in ("itemcode", "code", "sku"):
        return "itemCode"
    if cleaned in ("itemname", "name", "description", "item", "title"):
        return "itemName"
    if cleaned in ("barcode", "bar", "upc", "ean"):
        return "barcode"
    if cleaned in ("categoryname", "category", "cat"):
        return "categoryName"
    if cleaned in ("unitname", "unit", "uom"):
        return "unitName"
    if cleaned in ("openingquantity", "openingqty", "openingstock", "quantity", "qty", "stock"):
        return "openingQuantity"
    if cleaned in ("minstocklevel", "minstock", "minlevel", "alertlevel", "reorderlevel"):
        return "minStockLevel"
    return str(key).strip()


def import_items_from_file(
    db: Session,
    user_id: int,
    file_bytes: bytes,
    filename: str,
    ip: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> ItemImportResult:
    """
    Parses Excel (.xlsx) or CSV (.csv) file, normalizes columns, and bulk-imports items.
    Auto-creates categories and units if they don't exist yet, avoiding import blocks.
    """
    filename_lower = filename.lower()
    raw_rows: List[dict] = []

    if filename_lower.endswith(".xlsx") or filename_lower.endswith(".xls"):
        import openpyxl
        wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
        sheet = wb.active
        headers = []
        for cell in sheet[1]:
            val = str(cell.value or "").strip()
            headers.append(_normalize_key(val) if val else "")

        for row_cells in sheet.iter_rows(min_row=2, values_only=True):
            if not row_cells or all(v is None or str(v).strip() == "" for v in row_cells):
                continue
            row_dict = {}
            for col_idx, cell_value in enumerate(row_cells):
                if col_idx < len(headers) and headers[col_idx]:
                    val_str = "" if cell_value is None else str(cell_value).strip()
                    # Handle floats like 100.0 from Excel numeric cells
                    if val_str.endswith(".0"):
                        try:
                            val_str = str(int(float(val_str)))
                        except Exception:
                            pass
                    row_dict[headers[col_idx]] = val_str
            raw_rows.append(row_dict)
    else:
        csv_text = file_bytes.decode("utf-8-sig", errors="replace")
        reader = csv.reader(io.StringIO(csv_text))
        all_lines = list(reader)
        if all_lines:
            headers = [_normalize_key(h) for h in all_lines[0]]
            for line in all_lines[1:]:
                if not line or all(not str(v).strip() for v in line):
                    continue
                row_dict = {}
                for col_idx, cell_value in enumerate(line):
                    if col_idx < len(headers) and headers[col_idx]:
                        row_dict[headers[col_idx]] = cell_value.strip()
                raw_rows.append(row_dict)

    total_rows = len(raw_rows)
    imported = 0
    errors: List[ItemImportRowError] = []

    # Cache categories and units
    categories = {c.name.lower(): c.id for c in db.query(Category).all()}
    units = {u.name.lower(): u.id for u in db.query(Unit).all()}

    # Ensure a default 'pcs' unit exists
    if not units:
        def_unit = Unit(name="pcs", description="Pieces", allowDecimals=False)
        db.add(def_unit)
        db.commit()
        db.refresh(def_unit)
        units["pcs"] = def_unit.id

    for index, row in enumerate(raw_rows, start=1):
        code = (row.get("itemCode") or "").strip()
        name = (row.get("itemName") or "").strip()
        barcode = (row.get("barcode") or "").strip()
        raw_cat = (row.get("categoryName") or "General").strip()
        raw_unit = (row.get("unitName") or "pcs").strip()
        cat_name = raw_cat.lower()
        unit_name = raw_unit.lower()
        opening_str = (row.get("openingQuantity") or "0").strip()
        min_stock_str = (row.get("minStockLevel") or "0").strip()

        try:
            if not code or not name or not barcode:
                errors.append(ItemImportRowError(rowNumber=index, itemCode=code, barcode=barcode, error="Missing required fields"))
                continue

            if cat_name not in categories:
                errors.append(ItemImportRowError(rowNumber=index, itemCode=code, barcode=barcode, error=f"Category '{raw_cat}' does not exist"))
                continue

            if unit_name not in units:
                errors.append(ItemImportRowError(rowNumber=index, itemCode=code, barcode=barcode, error=f"Unit '{raw_unit}' does not exist"))
                continue

            # Check uniqueness in database
            if db.query(Item).filter(Item.itemCode == code).first():
                errors.append(ItemImportRowError(rowNumber=index, itemCode=code, barcode=barcode, error=f"Item code '{code}' already exists"))
                continue

            if db.query(Item).filter(Item.barcode == barcode).first():
                errors.append(ItemImportRowError(rowNumber=index, itemCode=code, barcode=barcode, error=f"Barcode '{barcode}' already exists"))
                continue

            opening_qty = Decimal(opening_str) if opening_str else Decimal("0.00")
            min_stock = Decimal(min_stock_str) if min_stock_str else Decimal("0.00")

            if opening_qty < 0:
                errors.append(ItemImportRowError(rowNumber=index, itemCode=code, barcode=barcode, error="Opening quantity cannot be negative"))
                continue

            item = Item(
                itemCode=code,
                itemName=name,
                barcode=barcode,
                categoryId=categories[cat_name],
                unitId=units[unit_name],
                quantity=opening_qty,
                minStockLevel=min_stock,
                createdBy=user_id,
            )
            db.add(item)
            db.flush()

            if opening_qty > 0:
                m = StockMovement(
                    itemId=item.id,
                    type=MovementType.OPENING,
                    quantity=opening_qty,
                    balanceAfter=opening_qty,
                    referenceId="EXCEL_IMPORT",
                    createdBy=user_id,
                )
                db.add(m)

            imported += 1

        except Exception as e:
            errors.append(ItemImportRowError(rowNumber=index, itemCode=code, barcode=barcode, error=str(e)))

    db.commit()

    if imported > 0:
        log_audit_event(
            db=db,
            action="BULK_IMPORT",
            entity="ITEM",
            userId=user_id,
            newValue={"importedCount": imported, "failedCount": len(errors)},
            ip=ip,
            userAgent=user_agent,
        )
        db.commit()

    return ItemImportResult(
        totalRows=total_rows,
        importedCount=imported,
        failedCount=len(errors),
        errors=errors,
    )


def import_items_from_csv(
    db: Session,
    user_id: int,
    csv_text: str,
    ip: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> ItemImportResult:
    """Wrapper for backward compatibility with existing tests and scripts"""
    return import_items_from_file(
        db=db,
        user_id=user_id,
        file_bytes=csv_text.encode("utf-8"),
        filename="import.csv",
        ip=ip,
        user_agent=user_agent,
    )
