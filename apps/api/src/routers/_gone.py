"""Helper for retiring v1 endpoint paths that moved under /leagues/{slug}/ in M5.

The old global paths (e.g. ``/api/v1/leaderboard``) stay registered but answer
410 Gone, carrying a ``Link: …; rel="successor-version"`` header that points at
the per-league replacement so callers can self-correct. The ``{slug}`` token in
the successor path is a literal template placeholder, mirroring the M3
deprecation convention.
"""

from fastapi import HTTPException, status


def gone(successor: str) -> HTTPException:
    """Return a 410 Gone HTTPException pointing at the successor path."""
    return HTTPException(
        status_code=status.HTTP_410_GONE,
        detail=f"This endpoint has moved to {successor}",
        headers={"Link": f'<{successor}>; rel="successor-version"'},
    )
