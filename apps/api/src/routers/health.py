import structlog
from fastapi import APIRouter
from sqlalchemy import text

from src.database import AsyncSessionLocal

router = APIRouter(prefix="/api/v1/health", tags=["health"])

log: structlog.stdlib.BoundLogger = structlog.get_logger(__name__)


@router.get("")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/ready")
async def ready() -> dict[str, str]:
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
        return {"status": "ready", "db": "ok"}
    except Exception:
        log.warning("readiness check failed — db unreachable")
        return {"status": "not_ready", "db": "unreachable"}
