from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_admin
from app.models.category import Category
from app.models.user import User
from app.schemas.category import CategoryCreate, CategoryResponse

router = APIRouter(prefix="/api/categories", tags=["Categories"])


@router.get("", response_model=List[CategoryResponse])
def get_categories(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[Category]:
    return db.query(Category).filter(Category.isActive == True).order_by(Category.name.asc()).all()


@router.post("", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
def create_category(
    data: CategoryCreate,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> Category:
    existing = db.query(Category).filter(Category.name == data.name.strip()).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"Category '{data.name}' already exists")
    cat = Category(name=data.name.strip(), description=data.description)
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat
