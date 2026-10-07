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
    StockIn, StockOut, ItemBatch,
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

        # 5. Clean up all inventory items, movements, batches so database starts completely empty
        # Data will only exist after the user uploads their Excel / CSV spreadsheet
        db.query(StockMovement).delete(synchronize_session=False)
        db.query(ItemBatch).delete(synchronize_session=False)
        db.query(StockIn).delete(synchronize_session=False)
        db.query(StockOut).delete(synchronize_session=False)
        db.query(Item).delete(synchronize_session=False)
        db.commit()
        print("[+] Purged all existing inventory items and movements. Database is 100% empty.")

        print("[+] Units, Categories, and Locations verified.")
        print("[+] Inventory is ready and completely clean. Items will appear only after spreadsheet upload.")
        print("[+] Database seed completed successfully!")

    except Exception as e:
        db.rollback()
        print(f"[!] Error during seed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
