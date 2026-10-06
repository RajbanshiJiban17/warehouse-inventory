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

        # 5. Clean up previous static sample items if any exist (keeping inventory clean for Excel upload)
        dummy_movements = db.query(StockMovement).filter(StockMovement.referenceId.in_(["INITIAL_SEED", "SAMPLE_SEED"])).all()
        dummy_items = db.query(Item).filter((Item.itemCode.like("ELEC-%")) | (Item.itemCode.like("SAMPLE-%"))).all()
        dummy_item_ids = list({m.itemId for m in dummy_movements} | {it.id for it in dummy_items})
        if dummy_item_ids:
            db.query(StockMovement).filter(StockMovement.itemId.in_(dummy_item_ids)).delete(synchronize_session=False)
            db.query(StockIn).filter(StockIn.itemId.in_(dummy_item_ids)).delete(synchronize_session=False)
            db.query(StockOut).filter(StockOut.itemId.in_(dummy_item_ids)).delete(synchronize_session=False)
            db.query(ItemBatch).filter(ItemBatch.itemId.in_(dummy_item_ids)).delete(synchronize_session=False)
            db.query(Item).filter(Item.id.in_(dummy_item_ids)).delete(synchronize_session=False)
            db.commit()
            print(f"[+] Cleaned up {len(dummy_item_ids)} previous static dummy sample items.")

        print("[+] Units, Categories, and Locations verified.")
        print("[+] Inventory is ready and clean. Items will be populated exclusively via Excel/CSV import or manual entry.")
        print("[+] Database seed completed successfully!")

    except Exception as e:
        db.rollback()
        print(f"[!] Error during seed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
