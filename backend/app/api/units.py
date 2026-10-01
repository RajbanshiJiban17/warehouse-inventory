from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_admin
from app.models.unit import Unit
from app.models.user import User
from app.schemas.unit import UnitCreate, UnitResponse

router = APIRouter(prefix="/api/units", tags=["Units"])


@router.get("", response_model=List[UnitResponse])
def get_units(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[Unit]:
    return db.query(Unit).filter(Unit.isActive == True).order_by(Unit.name.asc()).all()


@router.post("", response_model=UnitResponse, status_code=status.HTTP_201_CREATED)
def create_unit(
    data: UnitCreate,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> Unit:
    existing = db.query(Unit).filter(Unit.name == data.name.strip()).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"Unit '{data.name}' already exists")
    unit = Unit(name=data.name.strip(), description=data.description, allowDecimals=data.allowDecimals)
    db.add(unit)
    db.commit()
    db.refresh(unit)
    return unit
