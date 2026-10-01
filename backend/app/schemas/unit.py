from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class UnitBase(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(..., min_length=1, max_length=50)
    description: Optional[str] = Field(None, max_length=100)
    allowDecimals: bool = False


class UnitCreate(UnitBase):
    pass


class UnitResponse(UnitBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    isActive: bool
    createdAt: datetime
