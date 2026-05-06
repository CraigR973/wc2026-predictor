"""Development seed: 8 groups (A-H) and 32 teams.

Run from apps/api/ with:
    PYTHONPATH=. DATABASE_URL=<url> python -m src.seed
"""

import asyncio
import uuid
from typing import Any

from sqlalchemy import text

from src.database import AsyncSessionLocal

GROUPS = list("ABCDEFGH")

# 32 teams — 2022 WC format used as dev seed data.
# Groups and football_data_team_id are updated in Phase 1.4 with the actual
# 2026 draw (48 teams / 12 groups).
TEAMS: list[dict[str, Any]] = [
    # Group A
    {"name": "Qatar", "code": "QAT", "flag_emoji": "🇶🇦", "group": "A", "is_host": False},
    {"name": "Ecuador", "code": "ECU", "flag_emoji": "🇪🇨", "group": "A", "is_host": False},
    {"name": "Senegal", "code": "SEN", "flag_emoji": "🇸🇳", "group": "A", "is_host": False},
    {"name": "Netherlands", "code": "NED", "flag_emoji": "🇳🇱", "group": "A", "is_host": False},
    # Group B
    {"name": "England", "code": "ENG", "flag_emoji": "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "group": "B", "is_host": False},
    {"name": "Iran", "code": "IRN", "flag_emoji": "🇮🇷", "group": "B", "is_host": False},
    {"name": "USA", "code": "USA", "flag_emoji": "🇺🇸", "group": "B", "is_host": True},
    {"name": "Wales", "code": "WAL", "flag_emoji": "🏴󠁧󠁢󠁷󠁬󠁳󠁿", "group": "B", "is_host": False},
    # Group C
    {"name": "Argentina", "code": "ARG", "flag_emoji": "🇦🇷", "group": "C", "is_host": False},
    {"name": "Saudi Arabia", "code": "KSA", "flag_emoji": "🇸🇦", "group": "C", "is_host": False},
    {"name": "Mexico", "code": "MEX", "flag_emoji": "🇲🇽", "group": "C", "is_host": True},
    {"name": "Poland", "code": "POL", "flag_emoji": "🇵🇱", "group": "C", "is_host": False},
    # Group D
    {"name": "France", "code": "FRA", "flag_emoji": "🇫🇷", "group": "D", "is_host": False},
    {"name": "Australia", "code": "AUS", "flag_emoji": "🇦🇺", "group": "D", "is_host": False},
    {"name": "Denmark", "code": "DEN", "flag_emoji": "🇩🇰", "group": "D", "is_host": False},
    {"name": "Tunisia", "code": "TUN", "flag_emoji": "🇹🇳", "group": "D", "is_host": False},
    # Group E
    {"name": "Spain", "code": "ESP", "flag_emoji": "🇪🇸", "group": "E", "is_host": False},
    {"name": "Costa Rica", "code": "CRC", "flag_emoji": "🇨🇷", "group": "E", "is_host": False},
    {"name": "Germany", "code": "GER", "flag_emoji": "🇩🇪", "group": "E", "is_host": False},
    {"name": "Japan", "code": "JPN", "flag_emoji": "🇯🇵", "group": "E", "is_host": False},
    # Group F
    {"name": "Belgium", "code": "BEL", "flag_emoji": "🇧🇪", "group": "F", "is_host": False},
    {"name": "Canada", "code": "CAN", "flag_emoji": "🇨🇦", "group": "F", "is_host": True},
    {"name": "Morocco", "code": "MAR", "flag_emoji": "🇲🇦", "group": "F", "is_host": False},
    {"name": "Croatia", "code": "CRO", "flag_emoji": "🇭🇷", "group": "F", "is_host": False},
    # Group G
    {"name": "Brazil", "code": "BRA", "flag_emoji": "🇧🇷", "group": "G", "is_host": False},
    {"name": "Serbia", "code": "SRB", "flag_emoji": "🇷🇸", "group": "G", "is_host": False},
    {"name": "Switzerland", "code": "SUI", "flag_emoji": "🇨🇭", "group": "G", "is_host": False},
    {"name": "Cameroon", "code": "CMR", "flag_emoji": "🇨🇲", "group": "G", "is_host": False},
    # Group H
    {"name": "Portugal", "code": "POR", "flag_emoji": "🇵🇹", "group": "H", "is_host": False},
    {"name": "Ghana", "code": "GHA", "flag_emoji": "🇬🇭", "group": "H", "is_host": False},
    {"name": "Uruguay", "code": "URU", "flag_emoji": "🇺🇾", "group": "H", "is_host": False},
    {"name": "South Korea", "code": "KOR", "flag_emoji": "🇰🇷", "group": "H", "is_host": False},
]


async def seed() -> None:
    async with AsyncSessionLocal() as session:
        # Insert groups (idempotent)
        group_ids: dict[str, uuid.UUID] = {}
        for name in GROUPS:
            row = (
                await session.execute(text("SELECT id FROM groups WHERE name = :n"), {"n": name})
            ).first()
            if row:
                group_ids[name] = row[0]
            else:
                gid = uuid.uuid4()
                await session.execute(
                    text("INSERT INTO groups (id, name) VALUES (:id, :name)"),
                    {"id": gid, "name": name},
                )
                group_ids[name] = gid

        # Insert teams (idempotent — skip if code already present)
        for team in TEAMS:
            exists = (
                await session.execute(
                    text("SELECT 1 FROM teams WHERE code = :code"), {"code": team["code"]}
                )
            ).first()
            if not exists:
                await session.execute(
                    text(
                        "INSERT INTO teams (id, name, code, flag_emoji, group_id, is_host) "
                        "VALUES (:id, :name, :code, :flag_emoji, :group_id, :is_host)"
                    ),
                    {
                        "id": uuid.uuid4(),
                        "name": team["name"],
                        "code": team["code"],
                        "flag_emoji": team["flag_emoji"],
                        "group_id": group_ids[team["group"]],
                        "is_host": team["is_host"],
                    },
                )

        await session.commit()
        print(f"Seeded {len(GROUPS)} groups and {len(TEAMS)} teams.")


if __name__ == "__main__":
    asyncio.run(seed())
