"""2026 FIFA World Cup seed: 12 groups (A–L), 48 teams, 72 group stage matches.

Idempotent — safe to re-run. Groups and teams are upserted by name/code;
matches are upserted by match_number.

football_data_team_id and football_data_match_id are left NULL here and
populated later by the API sync job once the FOOTBALL_DATA_API_KEY is
configured.

Run from apps/api/ with:
    PYTHONPATH=. DATABASE_URL=<url> python -m src.seed
"""

import asyncio
import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import text

from src.database import AsyncSessionLocal

GROUPS = list("ABCDEFGHIJKL")

# 48 teams — 2026 FIFA World Cup draw (December 2025)
# Groups A–L, 4 teams each, three host nations: Mexico (A), Canada (B), USA (D)
TEAMS: list[dict[str, Any]] = [
    # Group A — host: Mexico
    {"name": "Mexico", "code": "MEX", "flag_emoji": "🇲🇽", "group": "A", "is_host": True},
    {"name": "South Africa", "code": "RSA", "flag_emoji": "🇿🇦", "group": "A", "is_host": False},
    {"name": "South Korea", "code": "KOR", "flag_emoji": "🇰🇷", "group": "A", "is_host": False},
    {"name": "Czech Republic", "code": "CZE", "flag_emoji": "🇨🇿", "group": "A", "is_host": False},
    # Group B — host: Canada
    {"name": "Canada", "code": "CAN", "flag_emoji": "🇨🇦", "group": "B", "is_host": True},
    {
        "name": "Bosnia & Herzegovina",
        "code": "BIH",
        "flag_emoji": "🇧🇦",
        "group": "B",
        "is_host": False,
    },
    {"name": "Qatar", "code": "QAT", "flag_emoji": "🇶🇦", "group": "B", "is_host": False},
    {"name": "Switzerland", "code": "SUI", "flag_emoji": "🇨🇭", "group": "B", "is_host": False},
    # Group C
    {"name": "Brazil", "code": "BRA", "flag_emoji": "🇧🇷", "group": "C", "is_host": False},
    {"name": "Morocco", "code": "MAR", "flag_emoji": "🇲🇦", "group": "C", "is_host": False},
    {"name": "Haiti", "code": "HAI", "flag_emoji": "🇭🇹", "group": "C", "is_host": False},
    {"name": "Scotland", "code": "SCO", "flag_emoji": "🏴󠁧󠁢󠁳󠁣󠁴󠁿", "group": "C", "is_host": False},
    # Group D — host: USA
    {"name": "USA", "code": "USA", "flag_emoji": "🇺🇸", "group": "D", "is_host": True},
    {"name": "Paraguay", "code": "PAR", "flag_emoji": "🇵🇾", "group": "D", "is_host": False},
    {"name": "Australia", "code": "AUS", "flag_emoji": "🇦🇺", "group": "D", "is_host": False},
    {"name": "Turkey", "code": "TUR", "flag_emoji": "🇹🇷", "group": "D", "is_host": False},
    # Group E
    {"name": "Germany", "code": "GER", "flag_emoji": "🇩🇪", "group": "E", "is_host": False},
    {"name": "Curaçao", "code": "CUW", "flag_emoji": "🇨🇼", "group": "E", "is_host": False},
    {"name": "Ivory Coast", "code": "CIV", "flag_emoji": "🇨🇮", "group": "E", "is_host": False},
    {"name": "Ecuador", "code": "ECU", "flag_emoji": "🇪🇨", "group": "E", "is_host": False},
    # Group F
    {"name": "Netherlands", "code": "NED", "flag_emoji": "🇳🇱", "group": "F", "is_host": False},
    {"name": "Japan", "code": "JPN", "flag_emoji": "🇯🇵", "group": "F", "is_host": False},
    {"name": "Sweden", "code": "SWE", "flag_emoji": "🇸🇪", "group": "F", "is_host": False},
    {"name": "Tunisia", "code": "TUN", "flag_emoji": "🇹🇳", "group": "F", "is_host": False},
    # Group G
    {"name": "Belgium", "code": "BEL", "flag_emoji": "🇧🇪", "group": "G", "is_host": False},
    {"name": "Egypt", "code": "EGY", "flag_emoji": "🇪🇬", "group": "G", "is_host": False},
    {"name": "Iran", "code": "IRN", "flag_emoji": "🇮🇷", "group": "G", "is_host": False},
    {"name": "New Zealand", "code": "NZL", "flag_emoji": "🇳🇿", "group": "G", "is_host": False},
    # Group H
    {"name": "Spain", "code": "ESP", "flag_emoji": "🇪🇸", "group": "H", "is_host": False},
    {"name": "Cape Verde", "code": "CPV", "flag_emoji": "🇨🇻", "group": "H", "is_host": False},
    {"name": "Saudi Arabia", "code": "KSA", "flag_emoji": "🇸🇦", "group": "H", "is_host": False},
    {"name": "Uruguay", "code": "URU", "flag_emoji": "🇺🇾", "group": "H", "is_host": False},
    # Group I
    {"name": "France", "code": "FRA", "flag_emoji": "🇫🇷", "group": "I", "is_host": False},
    {"name": "Senegal", "code": "SEN", "flag_emoji": "🇸🇳", "group": "I", "is_host": False},
    {"name": "Iraq", "code": "IRQ", "flag_emoji": "🇮🇶", "group": "I", "is_host": False},
    {"name": "Norway", "code": "NOR", "flag_emoji": "🇳🇴", "group": "I", "is_host": False},
    # Group J
    {"name": "Argentina", "code": "ARG", "flag_emoji": "🇦🇷", "group": "J", "is_host": False},
    {"name": "Algeria", "code": "ALG", "flag_emoji": "🇩🇿", "group": "J", "is_host": False},
    {"name": "Austria", "code": "AUT", "flag_emoji": "🇦🇹", "group": "J", "is_host": False},
    {"name": "Jordan", "code": "JOR", "flag_emoji": "🇯🇴", "group": "J", "is_host": False},
    # Group K
    {"name": "Portugal", "code": "POR", "flag_emoji": "🇵🇹", "group": "K", "is_host": False},
    {"name": "DR Congo", "code": "COD", "flag_emoji": "🇨🇩", "group": "K", "is_host": False},
    {"name": "Uzbekistan", "code": "UZB", "flag_emoji": "🇺🇿", "group": "K", "is_host": False},
    {"name": "Colombia", "code": "COL", "flag_emoji": "🇨🇴", "group": "K", "is_host": False},
    # Group L
    {"name": "England", "code": "ENG", "flag_emoji": "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "group": "L", "is_host": False},
    {"name": "Croatia", "code": "CRO", "flag_emoji": "🇭🇷", "group": "L", "is_host": False},
    {"name": "Ghana", "code": "GHA", "flag_emoji": "🇬🇭", "group": "L", "is_host": False},
    {"name": "Panama", "code": "PAN", "flag_emoji": "🇵🇦", "group": "L", "is_host": False},
]

# 72 group stage matches — kickoff times in UTC
# Venues reflect FIFA's official allocation (June 2026).
# football_data_match_id: populated by API sync once key is configured.
MATCHES: list[dict[str, Any]] = [
    # ---- Matchday 1 ----
    # Group A
    {
        "match_number": 1,
        "group": "A",
        "home": "MEX",
        "away": "RSA",
        "kickoff_utc": datetime(2026, 6, 11, 19, 0),
        "venue": "Estadio Azteca, Mexico City",
    },
    {
        "match_number": 2,
        "group": "A",
        "home": "KOR",
        "away": "CZE",
        "kickoff_utc": datetime(2026, 6, 12, 2, 0),
        "venue": "Estadio Akron, Guadalajara",
    },
    # Group B
    {
        "match_number": 3,
        "group": "B",
        "home": "CAN",
        "away": "BIH",
        "kickoff_utc": datetime(2026, 6, 12, 19, 0),
        "venue": "BMO Field, Toronto",
    },
    # Group D
    {
        "match_number": 4,
        "group": "D",
        "home": "USA",
        "away": "PAR",
        "kickoff_utc": datetime(2026, 6, 13, 1, 0),
        "venue": "SoFi Stadium, Inglewood",
    },
    # Group B (cont.)
    {
        "match_number": 5,
        "group": "B",
        "home": "QAT",
        "away": "SUI",
        "kickoff_utc": datetime(2026, 6, 13, 19, 0),
        "venue": "Levi's Stadium, Santa Clara",
    },
    # Group C
    {
        "match_number": 6,
        "group": "C",
        "home": "BRA",
        "away": "MAR",
        "kickoff_utc": datetime(2026, 6, 13, 22, 0),
        "venue": "MetLife Stadium, East Rutherford",
    },
    {
        "match_number": 7,
        "group": "C",
        "home": "HAI",
        "away": "SCO",
        "kickoff_utc": datetime(2026, 6, 14, 1, 0),
        "venue": "Gillette Stadium, Foxborough",
    },
    # Group D (cont.)
    {
        "match_number": 8,
        "group": "D",
        "home": "AUS",
        "away": "TUR",
        "kickoff_utc": datetime(2026, 6, 14, 4, 0),
        "venue": "BC Place, Vancouver",
    },
    # Group E
    {
        "match_number": 9,
        "group": "E",
        "home": "GER",
        "away": "CUW",
        "kickoff_utc": datetime(2026, 6, 14, 17, 0),
        "venue": "NRG Stadium, Houston",
    },
    # Group F
    {
        "match_number": 10,
        "group": "F",
        "home": "NED",
        "away": "JPN",
        "kickoff_utc": datetime(2026, 6, 14, 20, 0),
        "venue": "AT&T Stadium, Arlington",
    },
    # Group E (cont.)
    {
        "match_number": 11,
        "group": "E",
        "home": "CIV",
        "away": "ECU",
        "kickoff_utc": datetime(2026, 6, 14, 23, 0),
        "venue": "Lincoln Financial Field, Philadelphia",
    },
    # Group F (cont.)
    {
        "match_number": 12,
        "group": "F",
        "home": "SWE",
        "away": "TUN",
        "kickoff_utc": datetime(2026, 6, 15, 2, 0),
        "venue": "Estadio BBVA, Guadalupe",
    },
    # Group H
    {
        "match_number": 13,
        "group": "H",
        "home": "ESP",
        "away": "CPV",
        "kickoff_utc": datetime(2026, 6, 15, 16, 0),
        "venue": "Mercedes-Benz Stadium, Atlanta",
    },
    # Group G
    {
        "match_number": 14,
        "group": "G",
        "home": "BEL",
        "away": "EGY",
        "kickoff_utc": datetime(2026, 6, 15, 19, 0),
        "venue": "Lumen Field, Seattle",
    },
    # Group H (cont.)
    {
        "match_number": 15,
        "group": "H",
        "home": "KSA",
        "away": "URU",
        "kickoff_utc": datetime(2026, 6, 15, 22, 0),
        "venue": "Hard Rock Stadium, Miami Gardens",
    },
    # Group G (cont.)
    {
        "match_number": 16,
        "group": "G",
        "home": "IRN",
        "away": "NZL",
        "kickoff_utc": datetime(2026, 6, 16, 1, 0),
        "venue": "SoFi Stadium, Inglewood",
    },
    # Group I
    {
        "match_number": 17,
        "group": "I",
        "home": "FRA",
        "away": "SEN",
        "kickoff_utc": datetime(2026, 6, 16, 19, 0),
        "venue": "MetLife Stadium, East Rutherford",
    },
    {
        "match_number": 18,
        "group": "I",
        "home": "IRQ",
        "away": "NOR",
        "kickoff_utc": datetime(2026, 6, 16, 22, 0),
        "venue": "Gillette Stadium, Foxborough",
    },
    # Group J
    {
        "match_number": 19,
        "group": "J",
        "home": "ARG",
        "away": "ALG",
        "kickoff_utc": datetime(2026, 6, 17, 1, 0),
        "venue": "Arrowhead Stadium, Kansas City",
    },
    {
        "match_number": 20,
        "group": "J",
        "home": "AUT",
        "away": "JOR",
        "kickoff_utc": datetime(2026, 6, 17, 4, 0),
        "venue": "Levi's Stadium, Santa Clara",
    },
    # Group K
    {
        "match_number": 21,
        "group": "K",
        "home": "POR",
        "away": "COD",
        "kickoff_utc": datetime(2026, 6, 17, 17, 0),
        "venue": "NRG Stadium, Houston",
    },
    # Group L
    {
        "match_number": 22,
        "group": "L",
        "home": "ENG",
        "away": "CRO",
        "kickoff_utc": datetime(2026, 6, 17, 20, 0),
        "venue": "AT&T Stadium, Arlington",
    },
    {
        "match_number": 23,
        "group": "L",
        "home": "GHA",
        "away": "PAN",
        "kickoff_utc": datetime(2026, 6, 17, 23, 0),
        "venue": "BMO Field, Toronto",
    },
    # Group K (cont.)
    {
        "match_number": 24,
        "group": "K",
        "home": "UZB",
        "away": "COL",
        "kickoff_utc": datetime(2026, 6, 18, 2, 0),
        "venue": "Estadio Azteca, Mexico City",
    },
    # ---- Matchday 2 ----
    # Group A
    {
        "match_number": 25,
        "group": "A",
        "home": "CZE",
        "away": "RSA",
        "kickoff_utc": datetime(2026, 6, 18, 16, 0),
        "venue": "Mercedes-Benz Stadium, Atlanta",
    },
    # Group B
    {
        "match_number": 26,
        "group": "B",
        "home": "SUI",
        "away": "BIH",
        "kickoff_utc": datetime(2026, 6, 18, 19, 0),
        "venue": "SoFi Stadium, Inglewood",
    },
    {
        "match_number": 27,
        "group": "B",
        "home": "CAN",
        "away": "QAT",
        "kickoff_utc": datetime(2026, 6, 18, 22, 0),
        "venue": "BC Place, Vancouver",
    },
    # Group A (cont.)
    {
        "match_number": 28,
        "group": "A",
        "home": "MEX",
        "away": "KOR",
        "kickoff_utc": datetime(2026, 6, 19, 1, 0),
        "venue": "Estadio Akron, Guadalajara",
    },
    # Group D
    {
        "match_number": 29,
        "group": "D",
        "home": "USA",
        "away": "AUS",
        "kickoff_utc": datetime(2026, 6, 19, 19, 0),
        "venue": "Lumen Field, Seattle",
    },
    # Group C
    {
        "match_number": 30,
        "group": "C",
        "home": "SCO",
        "away": "MAR",
        "kickoff_utc": datetime(2026, 6, 19, 22, 0),
        "venue": "Gillette Stadium, Foxborough",
    },
    {
        "match_number": 31,
        "group": "C",
        "home": "BRA",
        "away": "HAI",
        "kickoff_utc": datetime(2026, 6, 20, 0, 30),
        "venue": "Lincoln Financial Field, Philadelphia",
    },
    # Group D (cont.)
    {
        "match_number": 32,
        "group": "D",
        "home": "TUR",
        "away": "PAR",
        "kickoff_utc": datetime(2026, 6, 20, 3, 0),
        "venue": "Levi's Stadium, Santa Clara",
    },
    # Group F
    {
        "match_number": 33,
        "group": "F",
        "home": "NED",
        "away": "SWE",
        "kickoff_utc": datetime(2026, 6, 20, 17, 0),
        "venue": "NRG Stadium, Houston",
    },
    # Group E
    {
        "match_number": 34,
        "group": "E",
        "home": "GER",
        "away": "CIV",
        "kickoff_utc": datetime(2026, 6, 20, 20, 0),
        "venue": "BMO Field, Toronto",
    },
    {
        "match_number": 35,
        "group": "E",
        "home": "ECU",
        "away": "CUW",
        "kickoff_utc": datetime(2026, 6, 21, 0, 0),
        "venue": "Arrowhead Stadium, Kansas City",
    },
    # Group F (cont.)
    {
        "match_number": 36,
        "group": "F",
        "home": "TUN",
        "away": "JPN",
        "kickoff_utc": datetime(2026, 6, 21, 4, 0),
        "venue": "Estadio BBVA, Guadalupe",
    },
    # Group H
    {
        "match_number": 37,
        "group": "H",
        "home": "ESP",
        "away": "KSA",
        "kickoff_utc": datetime(2026, 6, 21, 16, 0),
        "venue": "Mercedes-Benz Stadium, Atlanta",
    },
    # Group G
    {
        "match_number": 38,
        "group": "G",
        "home": "BEL",
        "away": "IRN",
        "kickoff_utc": datetime(2026, 6, 21, 19, 0),
        "venue": "SoFi Stadium, Inglewood",
    },
    # Group H (cont.)
    {
        "match_number": 39,
        "group": "H",
        "home": "URU",
        "away": "CPV",
        "kickoff_utc": datetime(2026, 6, 21, 22, 0),
        "venue": "Hard Rock Stadium, Miami Gardens",
    },
    # Group G (cont.)
    {
        "match_number": 40,
        "group": "G",
        "home": "NZL",
        "away": "EGY",
        "kickoff_utc": datetime(2026, 6, 22, 1, 0),
        "venue": "BC Place, Vancouver",
    },
    # Group J
    {
        "match_number": 41,
        "group": "J",
        "home": "ARG",
        "away": "AUT",
        "kickoff_utc": datetime(2026, 6, 22, 17, 0),
        "venue": "AT&T Stadium, Arlington",
    },
    # Group I
    {
        "match_number": 42,
        "group": "I",
        "home": "FRA",
        "away": "IRQ",
        "kickoff_utc": datetime(2026, 6, 22, 21, 0),
        "venue": "Lincoln Financial Field, Philadelphia",
    },
    {
        "match_number": 43,
        "group": "I",
        "home": "NOR",
        "away": "SEN",
        "kickoff_utc": datetime(2026, 6, 23, 0, 0),
        "venue": "BMO Field, Toronto",
    },
    # Group J (cont.)
    {
        "match_number": 44,
        "group": "J",
        "home": "JOR",
        "away": "ALG",
        "kickoff_utc": datetime(2026, 6, 23, 3, 0),
        "venue": "Levi's Stadium, Santa Clara",
    },
    # Group K
    {
        "match_number": 45,
        "group": "K",
        "home": "POR",
        "away": "UZB",
        "kickoff_utc": datetime(2026, 6, 23, 17, 0),
        "venue": "NRG Stadium, Houston",
    },
    # Group L
    {
        "match_number": 46,
        "group": "L",
        "home": "ENG",
        "away": "GHA",
        "kickoff_utc": datetime(2026, 6, 23, 20, 0),
        "venue": "Gillette Stadium, Foxborough",
    },
    {
        "match_number": 47,
        "group": "L",
        "home": "PAN",
        "away": "CRO",
        "kickoff_utc": datetime(2026, 6, 23, 23, 0),
        "venue": "Gillette Stadium, Foxborough",
    },
    # Group K (cont.)
    {
        "match_number": 48,
        "group": "K",
        "home": "COL",
        "away": "COD",
        "kickoff_utc": datetime(2026, 6, 24, 2, 0),
        "venue": "Estadio Akron, Guadalajara",
    },
    # ---- Matchday 3 (simultaneous within each group) ----
    # Group B — simultaneous
    {
        "match_number": 49,
        "group": "B",
        "home": "SUI",
        "away": "CAN",
        "kickoff_utc": datetime(2026, 6, 24, 19, 0),
        "venue": "BC Place, Vancouver",
    },
    {
        "match_number": 50,
        "group": "B",
        "home": "BIH",
        "away": "QAT",
        "kickoff_utc": datetime(2026, 6, 24, 19, 0),
        "venue": "Lumen Field, Seattle",
    },
    # Group C — simultaneous
    {
        "match_number": 51,
        "group": "C",
        "home": "MAR",
        "away": "HAI",
        "kickoff_utc": datetime(2026, 6, 24, 22, 0),
        "venue": "Mercedes-Benz Stadium, Atlanta",
    },
    {
        "match_number": 52,
        "group": "C",
        "home": "SCO",
        "away": "BRA",
        "kickoff_utc": datetime(2026, 6, 24, 22, 0),
        "venue": "Hard Rock Stadium, Miami Gardens",
    },
    # Group A — simultaneous
    {
        "match_number": 53,
        "group": "A",
        "home": "RSA",
        "away": "KOR",
        "kickoff_utc": datetime(2026, 6, 25, 1, 0),
        "venue": "Estadio BBVA, Guadalupe",
    },
    {
        "match_number": 54,
        "group": "A",
        "home": "CZE",
        "away": "MEX",
        "kickoff_utc": datetime(2026, 6, 25, 1, 0),
        "venue": "Estadio Azteca, Mexico City",
    },
    # Group E — simultaneous
    {
        "match_number": 55,
        "group": "E",
        "home": "CUW",
        "away": "CIV",
        "kickoff_utc": datetime(2026, 6, 25, 20, 0),
        "venue": "Lincoln Financial Field, Philadelphia",
    },
    {
        "match_number": 56,
        "group": "E",
        "home": "ECU",
        "away": "GER",
        "kickoff_utc": datetime(2026, 6, 25, 20, 0),
        "venue": "MetLife Stadium, East Rutherford",
    },
    # Group F — simultaneous
    {
        "match_number": 57,
        "group": "F",
        "home": "TUN",
        "away": "NED",
        "kickoff_utc": datetime(2026, 6, 25, 23, 0),
        "venue": "Arrowhead Stadium, Kansas City",
    },
    {
        "match_number": 58,
        "group": "F",
        "home": "JPN",
        "away": "SWE",
        "kickoff_utc": datetime(2026, 6, 25, 23, 0),
        "venue": "AT&T Stadium, Arlington",
    },
    # Group D — simultaneous
    {
        "match_number": 59,
        "group": "D",
        "home": "TUR",
        "away": "USA",
        "kickoff_utc": datetime(2026, 6, 26, 2, 0),
        "venue": "SoFi Stadium, Inglewood",
    },
    {
        "match_number": 60,
        "group": "D",
        "home": "PAR",
        "away": "AUS",
        "kickoff_utc": datetime(2026, 6, 26, 2, 0),
        "venue": "Levi's Stadium, Santa Clara",
    },
    # Group I — simultaneous
    {
        "match_number": 61,
        "group": "I",
        "home": "NOR",
        "away": "FRA",
        "kickoff_utc": datetime(2026, 6, 26, 19, 0),
        "venue": "Gillette Stadium, Foxborough",
    },
    {
        "match_number": 62,
        "group": "I",
        "home": "SEN",
        "away": "IRQ",
        "kickoff_utc": datetime(2026, 6, 26, 19, 0),
        "venue": "BMO Field, Toronto",
    },
    # Group H — simultaneous
    {
        "match_number": 63,
        "group": "H",
        "home": "CPV",
        "away": "KSA",
        "kickoff_utc": datetime(2026, 6, 27, 0, 0),
        "venue": "NRG Stadium, Houston",
    },
    {
        "match_number": 64,
        "group": "H",
        "home": "URU",
        "away": "ESP",
        "kickoff_utc": datetime(2026, 6, 27, 0, 0),
        "venue": "Estadio Akron, Guadalajara",
    },
    # Group G — simultaneous
    {
        "match_number": 65,
        "group": "G",
        "home": "NZL",
        "away": "BEL",
        "kickoff_utc": datetime(2026, 6, 27, 3, 0),
        "venue": "BC Place, Vancouver",
    },
    {
        "match_number": 66,
        "group": "G",
        "home": "EGY",
        "away": "IRN",
        "kickoff_utc": datetime(2026, 6, 27, 3, 0),
        "venue": "Lumen Field, Seattle",
    },
    # Group L — simultaneous
    {
        "match_number": 67,
        "group": "L",
        "home": "PAN",
        "away": "ENG",
        "kickoff_utc": datetime(2026, 6, 27, 21, 0),
        "venue": "MetLife Stadium, East Rutherford",
    },
    {
        "match_number": 68,
        "group": "L",
        "home": "CRO",
        "away": "GHA",
        "kickoff_utc": datetime(2026, 6, 27, 21, 0),
        "venue": "Lincoln Financial Field, Philadelphia",
    },
    # Group K — simultaneous
    {
        "match_number": 69,
        "group": "K",
        "home": "COL",
        "away": "POR",
        "kickoff_utc": datetime(2026, 6, 27, 23, 30),
        "venue": "Hard Rock Stadium, Miami Gardens",
    },
    {
        "match_number": 70,
        "group": "K",
        "home": "COD",
        "away": "UZB",
        "kickoff_utc": datetime(2026, 6, 27, 23, 30),
        "venue": "Mercedes-Benz Stadium, Atlanta",
    },
    # Group J — simultaneous
    {
        "match_number": 71,
        "group": "J",
        "home": "ALG",
        "away": "AUT",
        "kickoff_utc": datetime(2026, 6, 28, 2, 0),
        "venue": "Arrowhead Stadium, Kansas City",
    },
    {
        "match_number": 72,
        "group": "J",
        "home": "JOR",
        "away": "ARG",
        "kickoff_utc": datetime(2026, 6, 28, 2, 0),
        "venue": "AT&T Stadium, Arlington",
    },
]


async def seed() -> None:
    async with AsyncSessionLocal() as session:
        # --- Groups (idempotent by name) ---
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

        # --- Teams (idempotent by code) ---
        team_ids: dict[str, uuid.UUID] = {}
        for team in TEAMS:
            row = (
                await session.execute(
                    text("SELECT id FROM teams WHERE code = :code"), {"code": team["code"]}
                )
            ).first()
            if row:
                team_ids[team["code"]] = row[0]
            else:
                tid = uuid.uuid4()
                await session.execute(
                    text(
                        "INSERT INTO teams (id, name, code, flag_emoji, group_id, is_host) "
                        "VALUES (:id, :name, :code, :flag_emoji, :group_id, :is_host)"
                    ),
                    {
                        "id": tid,
                        "name": team["name"],
                        "code": team["code"],
                        "flag_emoji": team["flag_emoji"],
                        "group_id": group_ids[team["group"]],
                        "is_host": team["is_host"],
                    },
                )
                team_ids[team["code"]] = tid

        # --- Matches (idempotent by match_number) ---
        for m in MATCHES:
            exists = (
                await session.execute(
                    text("SELECT 1 FROM matches WHERE match_number = :mn"),
                    {"mn": m["match_number"]},
                )
            ).first()
            if not exists:
                await session.execute(
                    text(
                        "INSERT INTO matches "
                        "(id, stage, group_id, match_number, home_team_id, away_team_id, "
                        " kickoff_utc, venue, status) "
                        "VALUES (:id, 'group', :group_id, :match_number, :home_team_id, "
                        "        :away_team_id, :kickoff_utc, :venue, 'scheduled')"
                    ),
                    {
                        "id": uuid.uuid4(),
                        "group_id": group_ids[m["group"]],
                        "match_number": m["match_number"],
                        "home_team_id": team_ids[m["home"]],
                        "away_team_id": team_ids[m["away"]],
                        "kickoff_utc": m["kickoff_utc"],
                        "venue": m["venue"],
                    },
                )

        await session.commit()
        print(
            f"Seeded {len(GROUPS)} groups, {len(TEAMS)} teams, {len(MATCHES)} group stage matches."
        )


if __name__ == "__main__":
    asyncio.run(seed())
