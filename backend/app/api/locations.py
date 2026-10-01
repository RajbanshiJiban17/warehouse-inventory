from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_admin
from app.models.location import Location
from app.models.user import User
from app.schemas.location import LocationCreate, LocationResponse

router = APIRouter(prefix="/api/locations", tags=["Locations"])


@router.get("", response_model=List[LocationResponse])
def get_locations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[Location]:
    return db.query(Location).filter(Location.isActive == True).order_by(Location.name.asc()).all()


@router.post("", response_model=LocationResponse, status_code=status.HTTP_201_CREATED)
def create_location(
    data: LocationCreate,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> Location:
    existing = db.query(Location).filter(Location.name == data.name.strip()).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"Location '{data.name}' already exists")
    loc = Location(name=data.name.strip(), description=data.description)
    db.add(loc)
    db.commit()
    db.refresh(loc)
    return loc
