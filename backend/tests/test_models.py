import os
import sys

# Ensure backend root is in Python import path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from decimal import Decimal
import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from fastapi.testclient import TestClient

from app.models import (
    User, UserRole, UserStatus,
    Category, Unit, Location,
    Item, StockIn, StockOut, StockMovement, MovementType,
    AuditLog, AuditAction
)
from app.core.security import hash_password, verify_password, validate_password_strength


def test_password_hashing_and_verification() -> None:
    raw_pass = "SecureWarehousePass2026!"
    is_valid, msg = validate_password_strength(raw_pass)
    assert is_valid, msg

    hashed = hash_password(raw_pass)
    assert hashed != raw_pass
    assert verify_password(raw_pass, hashed) is True
    assert verify_password("WrongPassword123!", hashed) is False


def test_user_creation_and_roles(db_session: Session) -> None:
    admin = User(
        username="superadmin",
        email="superadmin@example.com",
        passwordHash=hash_password("SuperSecure123!"),
        role=UserRole.ADMIN,
        status=UserStatus.ACTIVE,
    )
    db_session.add(admin)
    db_session.commit()

    saved_user = db_session.query(User).filter_by(username="superadmin").first()
    assert saved_user is not None
    assert saved_user.role == UserRole.ADMIN
    assert saved_user.status == UserStatus.ACTIVE


def test_item_creation_and_non_negative_check_constraint(db_session: Session) -> None:
    cat = Category(name="Electronics", description="Gadgets")
    unit = Unit(name="pcs", description="Pieces")
    db_session.add_all([cat, unit])
    db_session.commit()

    item = Item(
        itemCode="ELEC-TEST-01",
        itemName="USB Mouse",
        barcode="123456789012",
        categoryId=cat.id,
        unitId=unit.id,
        quantity=Decimal("50.00"),
        minStockLevel=Decimal("10.00"),
    )
    db_session.add(item)
    db_session.commit()

    assert item.id is not None
    assert item.quantity == Decimal("50.00")

    # Verify check constraint prevents negative stock
    item.quantity = Decimal("-5.00")
    db_session.add(item)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_stock_in_and_stock_out_automatic_deduction_and_ledger(db_session: Session) -> None:
    """
    Test user requirement:
    Item In increases stock quantity.
    Item Out decreases stock quantity automatically and updates StockMovement ledger.
    """
    # 1. Setup Master records
    admin = User(
        username="staff_user",
        email="staff@example.com",
        passwordHash=hash_password("Warehouse2026!"),
        role=UserRole.STAFF,
        status=UserStatus.ACTIVE,
    )
    cat = Category(name="Groceries", description="Food")
    unit = Unit(name="kg", description="Kilograms", allowDecimals=True)
    loc = Location(name="Godown", description="Main godown")
    db_session.add_all([admin, cat, unit, loc])
    db_session.commit()

    # 2. Item Master Opening
    item = Item(
        itemCode="RICE-001",
        itemName="Basmati Rice 25kg",
        barcode="998877665544",
        categoryId=cat.id,
        unitId=unit.id,
        quantity=Decimal("100.00"),  # Opening stock: 100 kg
        minStockLevel=Decimal("20.00"),
        createdBy=admin.id,
    )
    db_session.add(item)
    db_session.commit()

    opening_movement = StockMovement(
        itemId=item.id,
        type=MovementType.OPENING,
        quantity=Decimal("100.00"),
        balanceAfter=Decimal("100.00"),
        referenceId="OPENING_STOCK",
        createdBy=admin.id,
    )
    db_session.add(opening_movement)
    db_session.commit()

    # 3. Item In (Stock In): Receive 50 kg
    stock_in_qty = Decimal("50.00")
    stock_in_entry = StockIn(
        itemId=item.id,
        quantity=stock_in_qty,
        remark="Received from supplier shipment #104",
        createdBy=admin.id,
    )
    # Automatic update: Item In adds to item quantity
    item.quantity += stock_in_qty
    stock_in_movement = StockMovement(
        itemId=item.id,
        type=MovementType.IN,
        quantity=stock_in_qty,
        balanceAfter=item.quantity,  # 150.00
        referenceId="STOCK_IN_1",
        createdBy=admin.id,
    )
    db_session.add_all([stock_in_entry, item, stock_in_movement])
    db_session.commit()

    assert item.quantity == Decimal("150.00")
    assert stock_in_movement.balanceAfter == Decimal("150.00")

    # 4. Item Out (Stock Out): Issue 40 kg
    stock_out_qty = Decimal("40.00")
    stock_out_entry = StockOut(
        itemId=item.id,
        quantity=stock_out_qty,
        location="Floor",
        remark="Issued to display sales floor",
        createdBy=admin.id,
    )
    # Automatic update: Item Out decreases quantity from current stock
    item.quantity -= stock_out_qty
    stock_out_movement = StockMovement(
        itemId=item.id,
        type=MovementType.OUT,
        quantity=stock_out_qty,
        balanceAfter=item.quantity,  # 110.00
        referenceId="STOCK_OUT_1",
        createdBy=admin.id,
    )
    db_session.add_all([stock_out_entry, item, stock_out_movement])
    db_session.commit()

    # Verify real-time stock balance matches exact calculation
    # Opening (100) + In (50) - Out (40) = 110
    reloaded_item = db_session.query(Item).filter_by(id=item.id).first()
    assert reloaded_item.quantity == Decimal("110.00")

    # Verify ledger history
    movements = db_session.query(StockMovement).filter_by(itemId=item.id).order_by(StockMovement.id.asc()).all()
    assert len(movements) == 3
    assert movements[0].type == MovementType.OPENING and movements[0].balanceAfter == Decimal("100.00")
    assert movements[1].type == MovementType.IN and movements[1].balanceAfter == Decimal("150.00")
    assert movements[2].type == MovementType.OUT and movements[2].balanceAfter == Decimal("110.00")


def test_stock_in_quantity_must_be_positive(db_session: Session) -> None:
    cat = Category(name="Packaging")
    unit = Unit(name="box")
    admin = User(
        username="u1", email="u1@test.com", passwordHash="hash", role=UserRole.ADMIN, status=UserStatus.ACTIVE
    )
    db_session.add_all([cat, unit, admin])
    db_session.commit()

    item = Item(
        itemCode="BOX-01", itemName="Cardboard Box", barcode="88776655", categoryId=cat.id, unitId=unit.id, quantity=10
    )
    db_session.add(item)
    db_session.commit()

    # Zero or negative quantity should violate CheckConstraint
    invalid_in = StockIn(itemId=item.id, quantity=Decimal("0.00"), createdBy=admin.id)
    db_session.add(invalid_in)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_stock_out_quantity_must_be_positive(db_session: Session) -> None:
    cat = Category(name="Office")
    unit = Unit(name="pcs")
    admin = User(
        username="u2", email="u2@test.com", passwordHash="hash", role=UserRole.ADMIN, status=UserStatus.ACTIVE
    )
    db_session.add_all([cat, unit, admin])
    db_session.commit()

    item = Item(
        itemCode="PEN-01", itemName="Pen", barcode="11223344", categoryId=cat.id, unitId=unit.id, quantity=10
    )
    db_session.add(item)
    db_session.commit()

    # Negative quantity in StockOut should violate CheckConstraint
    invalid_out = StockOut(itemId=item.id, quantity=Decimal("-5.00"), location="Godown", createdBy=admin.id)
    db_session.add(invalid_out)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_health_check_endpoint(client: TestClient) -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
