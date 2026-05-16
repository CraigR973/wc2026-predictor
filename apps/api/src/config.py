from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Database
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/wc2026"

    # Auth
    jwt_access_secret: str = "change-me-access"
    jwt_refresh_secret: str = "change-me-refresh"

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

    # Background scheduler (APScheduler) — disable in tests / one-off scripts.
    scheduler_enabled: bool = True


settings = Settings()
