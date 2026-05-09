from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from typing import Any

import sentry_sdk
import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
from sentry_sdk.types import Event, Hint
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from src.config import settings
from src.logging_config import configure_logging
from src.middleware import CorrelationIdMiddleware
from src.routers import admin, auth, health

configure_logging(settings.log_level)

log: structlog.stdlib.BoundLogger = structlog.get_logger(__name__)


def _scrub_pii(event: Event, hint: Hint) -> Event | None:
    """Remove display names from Sentry events so player names never appear in error reports."""
    user: Any = event.get("user")
    if isinstance(user, dict):
        user.pop("display_name", None)
        user.pop("username", None)
    return event


if settings.sentry_dsn_backend:
    sentry_sdk.init(
        dsn=settings.sentry_dsn_backend,
        environment=settings.environment,
        integrations=[FastApiIntegration(), SqlalchemyIntegration()],
        send_default_pii=False,
        before_send=_scrub_pii,
        traces_sample_rate=0.1,
    )


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    log.info("api starting", environment=settings.environment)
    yield


_limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="WC2026 Prediction League API",
    version="0.1.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

app.state.limiter = _limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)  # type: ignore[arg-type]

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(CorrelationIdMiddleware)

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(admin.router)
