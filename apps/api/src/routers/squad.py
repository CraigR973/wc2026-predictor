"""Squad player search endpoint (U14.3).

GET /api/v1/squad/search?q=<query>&limit=<n>

Public (no auth required) — same precedent as GET /leagues/by-code/{code}.
Rate-limited to 120/minute per IP.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import case, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_db
from src.models.squad import SquadPlayer
from src.models.team import Team
from src.rate_limit import limiter

router = APIRouter(prefix="/api/v1/squad", tags=["squad"])

_MAX_LIMIT = 30


class SquadPlayerResult:
    """Lightweight result DTO — returned as plain dicts for speed."""


@router.get("/search")
@limiter.limit("120/minute")
async def search_squad(
    request: Request,  # required by slowapi
    db: Annotated[AsyncSession, Depends(get_db)],
    q: str = Query(default="", max_length=100),
    limit: int = Query(default=20, ge=1, le=_MAX_LIMIT),
) -> list[dict]:
    """Case-insensitive substring search across full_name and known_as.

    Returns players ranked: exact known_as prefix first, then full_name prefix,
    then any substring match — all alphabetical within each tier.
    """
    q = q.strip()
    if not q:
        return []

    q_lower = q.lower()
    like_pat = f"%{q_lower}%"

    stmt = (
        select(
            SquadPlayer.id,
            SquadPlayer.full_name,
            SquadPlayer.known_as,
            SquadPlayer.position,
            SquadPlayer.shirt_number,
            Team.code.label("team_code"),
            Team.name.label("team_name"),
            Team.flag_emoji,
        )
        .join(Team, SquadPlayer.team_id == Team.id)
        .where(
            SquadPlayer.is_active.is_(True),
            or_(
                func.lower(SquadPlayer.full_name).like(like_pat),
                func.lower(SquadPlayer.known_as).like(like_pat),
            ),
        )
        # Rank: known_as prefix match → full_name prefix match → other
        .order_by(
            # 0 = known_as starts with query (best), 1 = full_name prefix, 2 = substring
            case(
                (func.lower(SquadPlayer.known_as).like(f"{q_lower}%"), 0),
                (func.lower(SquadPlayer.full_name).like(f"{q_lower}%"), 1),
                else_=2,
            ),
            SquadPlayer.known_as,
        )
        .limit(limit)
    )

    rows = (await db.execute(stmt)).all()

    return [
        {
            "id": str(row.id),
            "full_name": row.full_name,
            "known_as": row.known_as,
            "position": row.position,
            "shirt_number": row.shirt_number,
            "team_code": row.team_code,
            "team_name": row.team_name,
            "flag_emoji": row.flag_emoji,
        }
        for row in rows
    ]
