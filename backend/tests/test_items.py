import os
import sys

# Ensure backend root is in Python import path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from decimal import Decimal
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.user import UserRole, UserStatus
from app.models.category import Category
from app.models.unit import Unit


@pytest.fixture
def auth_admin_token(client: TestClient) -> str:
    client.post(
        "/api/auth/register",
        json={"username": "item_admin", "email": "item_admin@example.com", "password": "SuperPass@2026"},
    )
    res = client.post(
        "/api/auth/login",
        json={"username": "item_admin", "password": "SuperPass@2026"},
    )
    return res.json()["accessToken"]


@pytest.fixture
def setup_category_and_unit(client: TestClient, auth_admin_token: str) -> tuple[int, int]:
    headers = {"Authorization": f"Bearer {auth_admin_token}", "X-Requested-With": "XMLHttpRequest"}
    cat_res = client.post("/api/categories", headers=headers, json={"name": "Tools", "description": "Hardware Tools"})
    unit_res = client.post("/api/units", headers=headers, json={"name": "pcs", "description": "Pieces", "allowDecimals": False})
    return cat_res.json()["id"], unit_res.json()["id"]


def test_item_create_and_barcode_lookup(client: TestClient, auth_admin_token: str, setup_category_and_unit):
    cat_id, unit_id = setup_category_and_unit
    headers = {"Authorization": f"Bearer {auth_admin_token}", "X-Requested-With": "XMLHttpRequest"}

    # 1. Create Item
    create_res = client.post(
        "/api/items",
        headers=headers,
        json={
            "itemCode": "TOOL-001",
            "itemName": "Screwdriver Set 6pc",
            "barcode": "890999001",
            "categoryId": cat_id,
            "unitId": unit_id,
            "openingQuantity": "25.00",
            "minStockLevel": "5.00",
        },
    )
    assert create_res.status_code == 201
    data = create_res.json()
    assert data["itemCode"] == "TOOL-001"
    assert data["quantity"] == "25.00"
    item_id = data["id"]

    # 2. Scanner lookup by barcode
    lookup_res = client.get(f"/api/items/barcode/890999001", headers=headers)
    assert lookup_res.status_code == 200
    assert lookup_res.json()["id"] == item_id
    assert lookup_res.json()["itemName"] == "Screwdriver Set 6pc"

    # 3. Barcode not found returns 404
    not_found_res = client.get(f"/api/items/barcode/UNKNOWN_BARCODE", headers=headers)
    assert not_found_res.status_code == 404
    assert not_found_res.json()["detail"] == "Item not found"


def test_duplicate_barcode_and_code_validation(client: TestClient, auth_admin_token: str, setup_category_and_unit):
    cat_id, unit_id = setup_category_and_unit
    headers = {"Authorization": f"Bearer {auth_admin_token}", "X-Requested-With": "XMLHttpRequest"}

    client.post(
        "/api/items",
        headers=headers,
        json={
            "itemCode": "DUP-001",
            "itemName": "Original Item",
            "barcode": "DUP_BARCODE_1",
            "categoryId": cat_id,
            "unitId": unit_id,
        },
    )

    # Attempt duplicate itemCode
    dup_code_res = client.post(
        "/api/items",
        headers=headers,
        json={
            "itemCode": "DUP-001",
            "itemName": "Second Item",
            "barcode": "DIFFERENT_BARCODE",
            "categoryId": cat_id,
            "unitId": unit_id,
        },
    )
    assert dup_code_res.status_code == 409
    assert "already registered" in dup_code_res.json()["detail"]

    # Attempt duplicate barcode
    dup_barcode_res = client.post(
        "/api/items",
        headers=headers,
        json={
            "itemCode": "DIFFERENT_CODE",
            "itemName": "Third Item",
            "barcode": "DUP_BARCODE_1",
            "categoryId": cat_id,
            "unitId": unit_id,
        },
    )
    assert dup_barcode_res.status_code == 409
    assert "already registered" in dup_barcode_res.json()["detail"]


def test_item_update_and_soft_delete(client: TestClient, auth_admin_token: str, setup_category_and_unit):
    cat_id, unit_id = setup_category_and_unit
    headers = {"Authorization": f"Bearer {auth_admin_token}", "X-Requested-With": "XMLHttpRequest"}

    item_res = client.post(
        "/api/items",
        headers=headers,
        json={
            "itemCode": "DEL-001",
            "itemName": "Item to be deleted",
            "barcode": "DEL_BARCODE",
            "categoryId": cat_id,
            "unitId": unit_id,
            "openingQuantity": "10.00",
        },
    )
    item_id = item_res.json()["id"]

    # Update item
    update_res = client.put(
        f"/api/items/{item_id}",
        headers=headers,
        json={"itemName": "Renamed Item", "minStockLevel": "12.00"},
    )
    assert update_res.status_code == 200
    assert update_res.json()["itemName"] == "Renamed Item"

    # Soft delete item (admin only)
    del_res = client.delete(f"/api/items/{item_id}", headers=headers)
    assert del_res.status_code == 204

    # Deleted item should not be found via barcode scanner
    scanned = client.get(f"/api/items/barcode/DEL_BARCODE", headers=headers)
    assert scanned.status_code == 404


def test_item_bulk_csv_import_and_export(client: TestClient, auth_admin_token: str, setup_category_and_unit):
    headers = {"Authorization": f"Bearer {auth_admin_token}", "X-Requested-With": "XMLHttpRequest"}

    # CSV with 2 valid items and 1 error row
    csv_data = (
        "itemCode,itemName,barcode,categoryName,unitName,openingQuantity,minStockLevel\n"
        "BULK-01,Wrench 10mm,9001001,Tools,pcs,50,10\n"
        "BULK-02,Wrench 12mm,9001002,Tools,pcs,40,10\n"
        "INVALID-01,Faulty Item,9001003,NonExistentCat,pcs,10,2\n"
    )

    import_res = client.post(
        "/api/items/import",
        headers=headers,
        files={"file": ("items.csv", csv_data.encode("utf-8"), "text/csv")},
    )
    assert import_res.status_code == 200
    result = import_res.json()
    assert result["importedCount"] == 2
    assert result["failedCount"] == 1
    assert "NonExistentCat" in result["errors"][0]["error"]

    # Test CSV export
    export_csv = client.get("/api/items/export/data?format=csv", headers=headers)
    assert export_csv.status_code == 200
    assert "Wrench 10mm" in export_csv.text

    # Test Excel export
    export_xlsx = client.get("/api/items/export/data?format=xlsx", headers=headers)
    assert export_xlsx.status_code == 200
    assert len(export_xlsx.content) > 0
