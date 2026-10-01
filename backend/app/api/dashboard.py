from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.report import DashboardStatsResponse, DashboardChartsResponse
from app.services.report_service import get_dashboard_stats, get_dashboard_charts

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


@router.get("/stats", response_model=DashboardStatsResponse)
def get_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DashboardStatsResponse:
    return get_dashboard_stats(db)


@router.get("/charts", response_model=DashboardChartsResponse)
def get_charts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DashboardChartsResponse:
    return get_dashboard_charts(db)
