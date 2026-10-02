import os
import sys

# Ensure backend root is in Python import path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from decimal import Decimal
import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def auth_headers(client: TestClient) -> dict[str, str]:
    client.post(
        "/api/auth/register",
        json={"username": "report_admin", "email": "report_admin@example.com", "password": "SuperPass@2026"},
    )
    res = client.post(
        "/api/auth/login",
        json={"username": "report_admin", "password": "SuperPass@2026"},
    )
    token = res.json()["accessToken"]
    return {"Authorization": f"Bearer {token}", "X-Requested-With": "XMLHttpRequest"}


@pytest.fixture
def seeded_report_env(client: TestClient, auth_headers: dict[str, str]) -> list[int]:
    """Sets up items with diverse opening, in, and out operations across categories"""
    cat1 = client.post("/api/categories", headers=auth_headers, json={"name": "Electronics"}).json()["id"]
    cat2 = client.post("/api/categories", headers=auth_headers, json={"name": "Stationery"}).json()["id"]
    unit = client.post("/api/units", headers=auth_headers, json={"name": "pcs"}).json()["id"]

    # Item 1: Opening 100, In 50, Out 30 -> Closing 120
    item1 = client.post(
        "/api/items",
        headers=auth_headers,
        json={
            "itemCode": "REP-ITEM-01",
            "itemName": "Mechanical Keyboard",
            "barcode": "REP_BARCODE_01",
            "categoryId": cat1,
            "unitId": unit,
            "openingQuantity": "100.00",
            "minStockLevel": "15.00",
        },
    ).json()["id"]

    # Item 2: Opening 50, In 20, Out 65 -> Closing 5 (Low Stock alert: minStockLevel=10)
    item2 = client.post(
        "/api/items",
        headers=auth_headers,
        json={
            "itemCode": "REP-ITEM-02",
            "itemName": "Ballpoint Pen Pack",
            "barcode": "REP_BARCODE_02",
            "categoryId": cat2,
            "unitId": unit,
            "openingQuantity": "50.00",
            "minStockLevel": "10.00",
        },
    ).json()["id"]

    # Item 3: Dormant item (no movement after opening)
    item3 = client.post(
        "/api/items",
        headers=auth_headers,
        json={
            "itemCode": "REP-ITEM-03",
            "itemName": "Desk Organizer",
            "barcode": "REP_BARCODE_03",
            "categoryId": cat2,
            "unitId": unit,
            "openingQuantity": "30.00",
            "minStockLevel": "5.00",
        },
    ).json()["id"]

    # Stock In on item 1 (50)
    client.post("/api/stock/in", headers=auth_headers, json={"itemId": item1, "quantity": "50.00"})
    # Stock Out on item 1 (30)
    client.post("/api/stock/out", headers=auth_headers, json={"itemId": item1, "quantity": "30.00", "location": "Godown"})

    # Stock In on item 2 (20)
    client.post("/api/stock/in", headers=auth_headers, json={"itemId": item2, "quantity": "20.00"})
    # Stock Out on item 2 (65)
    client.post("/api/stock/out", headers=auth_headers, json={"itemId": item2, "quantity": "65.00", "location": "Floor"})

    return [item1, item2, item3]


def test_dashboard_stats_and_charts(client: TestClient, auth_headers: dict[str, str], seeded_report_env: list[int]) -> None:
    # 1. Stats
    stats_res = client.get("/api/dashboard/stats", headers=auth_headers)
    assert stats_res.status_code == 200
    stats = stats_res.json()
    assert stats["totalItems"] >= 3
    # Total stock: 120 + 5 + 30 = 155
    assert Decimal(str(stats["totalStockQuantity"])) >= Decimal("155.00")
    # Low stock item: item 2 has 5 <= 10
    assert stats["lowStockCount"] >= 1
    # Top moving item: item 2 had 65 issued, item 1 had 30 issued
    assert len(stats["top10MovingItems"]) >= 2
    assert stats["top10MovingItems"][0]["itemCode"] == "REP-ITEM-02"

    # 2. Charts
    charts_res = client.get("/api/dashboard/charts", headers=auth_headers)
    assert charts_res.status_code == 200
    charts = charts_res.json()
    assert len(charts["stockByCategory"]) >= 2
    assert len(charts["inVsOutTrend"]) == 7


def test_mathematical_reconciliation_opening_plus_in_minus_out_equals_closing(
    client: TestClient, auth_headers: dict[str, str], seeded_report_env: list[int]
) -> None:
    """
    CRITICAL PROMPT REQUIREMENT:
    'Report numbers must always reconcile: Opening + In - Out = Closing. Add an automated test that proves this.'
    """
    res = client.get("/api/reports/stock-ledger", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    items = data["items"]
    assert len(items) >= 3

    for it in items:
        opening = Decimal(str(it["openingQuantity"]))
        total_in = Decimal(str(it["totalIn"]))
        total_out = Decimal(str(it["totalOut"]))
        closing = Decimal(str(it["closingBalance"]))

        # PROOF: Opening + In - Out == Closing
        assert opening + total_in - total_out == closing, (
            f"Reconciliation failed for item {it['itemCode']}: "
            f"{opening} + {total_in} - {total_out} != {closing}"
        )
        assert it["isReconciled"] is True


def test_analytical_reports_filtering(client: TestClient, auth_headers: dict[str, str], seeded_report_env: list[int]) -> None:
    # 1. Current stock report
    curr_res = client.get("/api/reports/current-stock?search=Keyboard", headers=auth_headers)
    assert curr_res.status_code == 200
    assert curr_res.json()["total"] == 1
    assert curr_res.json()["items"][0]["itemCode"] == "REP-ITEM-01"

    # 2. Low stock report
    low_res = client.get("/api/reports/low-stock", headers=auth_headers)
    assert low_res.status_code == 200
    low_items = [i["itemCode"] for i in low_res.json()["items"]]
    assert "REP-ITEM-02" in low_items
    assert "REP-ITEM-01" not in low_items

    # 3. Location stock report
    loc_res = client.get("/api/reports/location-stock", headers=auth_headers)
    assert loc_res.status_code == 200
    loc_data = {l["location"]: Decimal(str(l["totalQuantityIssued"])) for l in loc_res.json()["items"]}
    assert loc_data["Floor"] == Decimal("65.00")
    assert loc_data["Godown"] == Decimal("30.00")

    # 4. Fast & Slow moving report
    fs_res = client.get("/api/reports/fast-slow-moving?days=30", headers=auth_headers)
    assert fs_res.status_code == 200
    fs_items = {i["itemCode"]: i["status"] for i in fs_res.json()["items"]}
    assert fs_items["REP-ITEM-02"] == "FAST_MOVING"  # >= 50
    assert fs_items["REP-ITEM-01"] == "SLOW_MOVING"  # 30

    # 5. User activity report
    act_res = client.get("/api/reports/user-activity", headers=auth_headers)
    assert act_res.status_code == 200
    assert act_res.json()["total"] >= 1


def test_report_exports_csv_excel_pdf(client: TestClient, auth_headers: dict[str, str], seeded_report_env: list[int]) -> None:
    # 1. CSV export
    csv_res = client.get("/api/reports/current-stock?format=csv", headers=auth_headers)
    assert csv_res.status_code == 200
    assert csv_res.headers["content-type"] == "text/csv; charset=utf-8"
    assert "Item Code,Item Name,Barcode" in csv_res.text
    assert "Mechanical Keyboard" in csv_res.text

    # 2. Excel export (.xlsx)
    xlsx_res = client.get("/api/reports/stock-ledger?format=xlsx", headers=auth_headers)
    assert xlsx_res.status_code == 200
    assert "spreadsheetml" in xlsx_res.headers["content-type"]
    assert len(xlsx_res.content) > 100

    # 3. PDF export (.pdf)
    pdf_res = client.get("/api/reports/low-stock?format=pdf", headers=auth_headers)
    assert pdf_res.status_code == 200
    assert pdf_res.headers["content-type"] == "application/pdf"
    assert pdf_res.content.startswith(b"%PDF")
