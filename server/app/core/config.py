
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "KnowStack AI"
    environment: str = "development"
    openai_api_key: str = ""
    cors_origins: str = (
        "http://localhost:3000,http://127.0.0.1:3000"
    )
    database_url: str = (
    "postgresql+psycopg://knowstack_user:local_dev_password"
    "@localhost:5432/knowstack"
    )
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def allowed_origins(self) -> list[str]:
        return [
            origin.strip()
            for origin in self.cors_origins.split(",")
            if origin.strip()
        ]


@lru_cache
def get_settings() -> Settings:
    return Settings()
