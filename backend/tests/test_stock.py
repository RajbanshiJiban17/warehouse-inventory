from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
import pytest
from fastapi.testclient import TestClient

from app.models.item import Item
from app.models.stock import StockMovement, MovementType


@pytest.fixture
def auth_headers(client: TestClient) -> dict:
    client.post(
        "/api/auth/register",
        json={"username": "stock_operator", "email": "operator@example.com", "password": "SuperPass@2026"},
    )
    res = client.post(
        "/api/auth/login",
        json={"username": "stock_operator", "password": "SuperPass@2026"},
    )
    token = res.json()["accessToken"]
    return {"Authorization": f"Bearer {token}", "X-Requested-With": "XMLHttpRequest"}


@pytest.fixture
def test_stock_item(client: TestClient, auth_headers: dict) -> int:
    # Setup Category, Unit, Item
    cat = client.post("/api/categories", headers=auth_headers, json={"name": "Beverages"}).json()
    unit = client.post("/api/units", headers=auth_headers, json={"name": "box", "allowDecimals": False}).json()

    item = client.post(
        "/api/items",
        headers=auth_headers,
        json={
            "itemCode": "TEA-BOX-01",
            "itemName": "Organic Green Tea Box",
            "barcode": "89000111222",
            "categoryId": cat["id"],
            "unitId": unit["id"],
            "openingQuantity": "20.00",
            "minStockLevel": "5.00",
        },
    ).json()
    return item["id"]


def test_stock_in_increases_quantity_and_records_ledger(client: TestClient, auth_headers: dict, test_stock_item: int):
    item_id = test_stock_item

    # Stock In 15 boxes
    stock_in_res = client.post(
        "/api/stock/in",
        headers=auth_headers,
        json={
            "itemId": item_id,
            "quantity": "15.00",
            "remark": "Factory batch delivery #501",
        },
    )
    assert stock_in_res.status_code == 201
    data = stock_in_res.json()
    assert data["quantity"] == "15.00"
    # Opening (20) + Stock In (15) = 35
    assert data["balanceAfter"] == "35.00"

    # Verify item current stock via scanner endpoint
    item_check = client.get("/api/items/barcode/89000111222", headers=auth_headers).json()
    assert item_check["quantity"] == "35.00"

    # Verify StockMovement ledger
    movements_res = client.get(f"/api/stock/movements?item_id={item_id}", headers=auth_headers).json()
    assert movements_res["total"] == 2  # 1 OPENING + 1 IN
    latest_mov = movements_res["items"][0]
    assert latest_mov["type"] == "IN"
    assert latest_mov["balanceAfter"] == "35.00"


def test_stock_out_automatic_deduction_and_insufficient_stock(client: TestClient, auth_headers: dict, test_stock_item: int):
    item_id = test_stock_item

    # Current stock is 20.00
    # 1. Attempt to withdraw 25 (more than available) -> must reject!
    excess_res = client.post(
        "/api/stock/out",
        headers=auth_headers,
        json={
            "itemId": item_id,
            "quantity": "25.00",
            "location": "Floor",
            "remark": "Attempted excess issue",
        },
    )
    assert excess_res.status_code == 400
    assert "Insufficient stock. Available: 20.00" in excess_res.json()["detail"]

    # 2. Legitimate Stock Out: issue 16 boxes (remaining will be 4.00, triggering low stock warning)
    stock_out_res = client.post(
        "/api/stock/out",
        headers=auth_headers,
        json={
            "itemId": item_id,
            "quantity": "16.00",
            "location": "Floor",
            "remark": "Dispatch to retail shelf",
        },
    )
    assert stock_out_res.status_code == 201
    out_data = stock_out_res.json()
    assert out_data["quantity"] == "16.00"
    # Opening (20) - Stock Out (16) = 4
    assert out_data["balanceAfter"] == "4.00"
    assert out_data["isLowStockWarning"] is True  # 4.00 <= minStockLevel (5.00)

    # 3. Verify item current stock automatically decreased
    item_check = client.get(f"/api/items/{item_id}", headers=auth_headers).json()
    assert item_check["quantity"] == "4.00"
    assert item_check["isLowStock"] is True


def test_concurrency_simultaneous_stock_outs_prevent_overselling(client: TestClient, auth_headers: dict):
    """
    Race condition / concurrency test:
    Item has 10 units in stock.
    Two simultaneous requests each try to withdraw 8 units.
    Total requested = 16 > 10.
    With row locking, exactly ONE request must succeed and the other must fail with 'Insufficient stock'.
    Final stock MUST be 2.00, never negative or corrupted!
    """
    # Create item with opening quantity = 10
    cat = client.post("/api/categories", headers=auth_headers, json={"name": "Limited Stock"}).json()
    unit = client.post("/api/units", headers=auth_headers, json={"name": "pcs"}).json()

    item = client.post(
        "/api/items",
        headers=auth_headers,
        json={
            "itemCode": "CONCUR-001",
            "itemName": "Limited Edition Item",
            "barcode": "CONCUR_999",
            "categoryId": cat["id"],
            "unitId": unit["id"],
            "openingQuantity": "10.00",
            "minStockLevel": "1.00",
        },
    ).json()
    item_id = item["id"]

    def perform_stock_out():
        return client.post(
            "/api/stock/out",
            headers=auth_headers,
            json={
                "itemId": item_id,
                "quantity": "8.00",
                "location": "Godown",
                "remark": "Concurrent request",
            },
        )

    with ThreadPoolExecutor(max_workers=2) as executor:
        f1 = executor.submit(perform_stock_out)
        f2 = executor.submit(perform_stock_out)
        res1 = f1.result()
        res2 = f2.result()

    statuses = [res1.status_code, res2.status_code]
    # Exactly one 201 (success) and one 400 (insufficient stock)
    assert 201 in statuses, f"Expected one success, got: {statuses}"
    assert 400 in statuses, f"Expected one insufficient stock error, got: {statuses}"

    failed_res = res1 if res1.status_code == 400 else res2
    assert "Insufficient stock" in failed_res.json()["detail"]

    # Verify final stock is exactly 10 - 8 = 2
    final_item = client.get(f"/api/items/{item_id}", headers=auth_headers).json()
    assert final_item["quantity"] == "2.00"
