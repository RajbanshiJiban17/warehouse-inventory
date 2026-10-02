import os
from decimal import Decimal
from sqlalchemy.orm import Session
from app.core.database import SessionLocal, engine, Base
from app.core.config import settings
from app.core.security import hash_password
from app.models import (
    User, UserRole, UserStatus,
    Category, Unit, Location,
    Item, StockMovement, MovementType,
    AuditLog, AuditAction
)


def seed_database() -> None:
    # Ensure tables exist
    Base.metadata.create_all(bind=engine)
    db: Session = SessionLocal()

    try:
        print("[*] Starting database seed...")

        # 1. Admin account will be registered directly by the user on the registration page
        print("[*] Note: Admin user is not hardcoded. The administrator registers their own account.")

        # 2. Seed Units
        default_units = [
            ("pcs", "Pieces / Count", False),
            ("kg", "Kilograms", True),
            ("box", "Carton Box", False),
            ("litre", "Liters", True),
            ("packet", "Packets", False),
        ]
        unit_map = {}
        for name, desc, allow_dec in default_units:
            unit = db.query(Unit).filter(Unit.name == name).first()
            if not unit:
                unit = Unit(name=name, description=desc, allowDecimals=allow_dec)
                db.add(unit)
                db.commit()
                db.refresh(unit)
            unit_map[name] = unit
        print("[+] Units verified/seeded.")

        # 3. Seed Categories
        default_categories = [
            ("Electronics", "Electronic components and finished appliances"),
            ("Groceries", "Food items and perishables"),
            ("Hardware", "Tools, fasteners, and warehouse equipment"),
            ("Packaging", "Cartons, bubble wraps, tapes"),
            ("Office Supplies", "Stationery and administrative materials"),
        ]
        cat_map = {}
        for name, desc in default_categories:
            cat = db.query(Category).filter(Category.name == name).first()
            if not cat:
                cat = Category(name=name, description=desc)
                db.add(cat)
                db.commit()
                db.refresh(cat)
            cat_map[name] = cat
        print("[+] Categories verified/seeded.")

        # 4. Seed Locations
        default_locations = [
            ("Godown", "Main storage warehouse godown"),
            ("Floor", "Store front / Display sales floor"),
            ("Shop", "Retail shop branch counter"),
            ("Counter", "Checkout and quick dispatch counter"),
        ]
        for name, desc in default_locations:
            loc = db.query(Location).filter(Location.name == name).first()
            if not loc:
                loc = Location(name=name, description=desc)
                db.add(loc)
                db.commit()
        print("[+] Locations verified/seeded.")

        # 5. Seed 30 Sample Items
        sample_items_data = [
            # Electronics
            ("ELEC-001", "Wireless Optical Mouse", "890100010001", "Electronics", "pcs", 150.0, 20.0),
            ("ELEC-002", "Mechanical Keyboard USB-C", "890100010002", "Electronics", "pcs", 80.0, 15.0),
            ("ELEC-003", "HDMI Cable 2.0 (1.8m)", "890100010003", "Electronics", "pcs", 200.0, 25.0),
            ("ELEC-004", "Cat6 Ethernet Cable (3m)", "890100010004", "Electronics", "pcs", 300.0, 40.0),
            ("ELEC-005", "USB-C Fast Charger 65W", "890100010005", "Electronics", "pcs", 65.0, 10.0),
            ("ELEC-006", "Surge Protector 6-Socket", "890100010006", "Electronics", "pcs", 45.0, 10.0),

            # Groceries
            ("GROC-001", "Basmati Rice Special", "890200020001", "Groceries", "kg", 500.0, 100.0),
            ("GROC-002", "Refined Sunflower Oil", "890200020002", "Groceries", "litre", 250.0, 50.0),
            ("GROC-003", "Organic Green Tea Blend", "890200020003", "Groceries", "packet", 120.0, 25.0),
            ("GROC-004", "Premium CTC Black Tea", "890200020004", "Groceries", "packet", 180.0, 30.0),
            ("GROC-005", "Whole Wheat Flour (Atta)", "890200020005", "Groceries", "kg", 400.0, 80.0),
            ("GROC-006", "Iodized Salt Packets", "890200020006", "Groceries", "packet", 350.0, 50.0),

            # Hardware
            ("HARD-001", "Cordless Drill Set 18V", "890300030001", "Hardware", "box", 25.0, 5.0),
            ("HARD-002", "Stainless Steel Screws 2-inch", "890300030002", "Hardware", "box", 100.0, 20.0),
            ("HARD-003", "Heavy Duty Claw Hammer 16oz", "890300030003", "Hardware", "pcs", 50.0, 10.0),
            ("HARD-004", "Retractable Measuring Tape 5m", "890300030004", "Hardware", "pcs", 85.0, 15.0),
            ("HARD-005", "Combination Pliers 8-inch", "890300030005", "Hardware", "pcs", 60.0, 10.0),
            ("HARD-006", "Safety Goggles Polycarbonate", "890300030006", "Hardware", "pcs", 110.0, 20.0),

            # Packaging
            ("PACK-001", "Corrugated Carton Box 12x10x8", "890400040001", "Packaging", "box", 1000.0, 200.0),
            ("PACK-002", "Bubble Cushioning Wrap (50m)", "890400040002", "Packaging", "pcs", 40.0, 10.0),
            ("PACK-003", "Heavy Duty Brown Tape 2-inch", "890400040003", "Packaging", "pcs", 240.0, 50.0),
            ("PACK-004", "Clear Stretch Wrap Film 500mm", "890400040004", "Packaging", "pcs", 75.0, 15.0),
            ("PACK-005", "Thermal Shipping Labels 4x6", "890400040005", "Packaging", "box", 90.0, 20.0),
            ("PACK-006", "Fragile Warning Sticker Rolls", "890400040006", "Packaging", "pcs", 60.0, 15.0),

            # Office Supplies
            ("OFFC-001", "A4 Copier Paper 75GSM Ream", "890500050001", "Office Supplies", "box", 120.0, 25.0),
            ("OFFC-002", "Ballpoint Pen Blue 0.7mm Box", "890500050002", "Office Supplies", "box", 80.0, 15.0),
            ("OFFC-003", "Heavy Duty Metal Stapler", "890500050003", "Office Supplies", "pcs", 35.0, 8.0),
            ("OFFC-004", "Staple Pins Box No. 10", "890500050004", "Office Supplies", "box", 150.0, 30.0),
            ("OFFC-005", "Sticky Notes Neon (3x3 inch)", "890500050005", "Office Supplies", "packet", 140.0, 20.0),
            ("OFFC-006", "Permanent Marker Black Chisel", "890500050006", "Office Supplies", "box", 65.0, 12.0),
        ]

        items_created = 0
        for code, name, barcode, cat_name, unit_name, qty, min_stock in sample_items_data:
            existing_item = db.query(Item).filter(
                (Item.itemCode == code) | (Item.barcode == barcode)
            ).first()

            if not existing_item:
                item = Item(
                    itemCode=code,
                    itemName=name,
                    barcode=barcode,
                    categoryId=cat_map[cat_name].id,
                    unitId=unit_map[unit_name].id,
                    quantity=Decimal(str(qty)),
                    minStockLevel=Decimal(str(min_stock)),
                    createdBy=None,
                )
                db.add(item)
                db.commit()
                db.refresh(item)

                # Record opening quantity in immutable stock movement ledger
                movement = StockMovement(
                    itemId=item.id,
                    type=MovementType.OPENING,
                    quantity=Decimal(str(qty)),
                    balanceAfter=Decimal(str(qty)),
                    referenceId="INITIAL_SEED",
                    createdBy=None,
                )
                db.add(movement)
                db.commit()
                items_created += 1

        print(f"[+] 30 Sample items processed ({items_created} newly created, rest already existed).")
        print("[+] Database seed completed successfully!")

    except Exception as e:
        db.rollback()
        print(f"[!] Error during seed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
