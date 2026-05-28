from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_PLACEHOLDER_SECRETS = {"change-me-access", "change-me-refresh"}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Database
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/wc2026"

    # Auth
    jwt_access_secret: str
    jwt_refresh_secret: str

    # External APIs
    football_data_api_key: str = ""
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_key: str = ""

    # Web Push
    vapid_public_key: str = ""
    vapid_private_key: str = ""
    vapid_contact_email: str = "admin@example.com"

    # App
    frontend_origin: str = "http://localhost:5173"
    sentry_dsn_backend: str = ""
    log_level: str = "INFO"
    environment: str = "development"

    # Backup
    backup_dir: str = "/tmp/wc2026_backups"

    # Email (Resend)
    resend_api_key: str = ""
    email_from: str = "WC2026 Predictor <noreply@example.com>"

    # Background scheduler (APScheduler) — disable in tests / one-off scripts.
    scheduler_enabled: bool = True

    @model_validator(mode="after")
    def _reject_weak_secrets_in_prod(self) -> "Settings":
        if self.environment == "development":
            return self
        errors: list[str] = []
        if self.jwt_access_secret in _PLACEHOLDER_SECRETS:
            errors.append("jwt_access_secret is a placeholder value")
        if self.jwt_refresh_secret in _PLACEHOLDER_SECRETS:
            errors.append("jwt_refresh_secret is a placeholder value")
        if not self.vapid_private_key:
            errors.append("vapid_private_key is empty")
        if not self.supabase_service_key:
            errors.append("supabase_service_key is empty")
        if not self.football_data_api_key:
            errors.append("football_data_api_key is empty")
        if errors:
            raise ValueError("Refusing to start with weak/missing secrets: " + "; ".join(errors))
        return self


settings = Settings()  # type: ignore[call-arg]  # env vars supply required fields at runtime
