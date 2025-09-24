import os
from functools import lru_cache


class Settings:
    def __init__(self) -> None:
        self.env: str = os.getenv("ENV", "local")
        self.auth_provider: str = os.getenv("AUTH_PROVIDER", "mock")
        self.jwt_secret: str = os.getenv("JWT_SECRET", "change_me")
        self.sqlite_db_path: str = os.getenv("SQLITE_DB_PATH", os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../database/app.db")))
        self.model_path: str = os.getenv("MODEL_PATH", os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../ai/model/model.pkl")))
        self.azure_openai_endpoint: str | None = os.getenv("AZURE_OPENAI_ENDPOINT")
        self.azure_openai_api_key: str | None = os.getenv("AZURE_OPENAI_API_KEY")
        self.azure_openai_deployment: str | None = os.getenv("AZURE_OPENAI_DEPLOYMENT")
        self.signalr_connection_string: str | None = os.getenv("SIGNALR_CONNECTION_STRING")
        self.acs_connection_string: str | None = os.getenv("ACS_CONNECTION_STRING")
        self.azure_sql_connection_string: str | None = os.getenv("AZURE_SQL_CONNECTION_STRING")
        self.allowed_origins: list[str] = os.getenv("ALLOWED_ORIGINS", "*").split(",")
        
        # Azure Functions specific settings
        self.is_azure_functions: bool = os.getenv("FUNCTIONS_WORKER_RUNTIME") is not None
        self.function_app_name: str = os.getenv("FUNCTIONS_APP_NAME", "ai-nps-assistant")
        
        # Database connection logic
        self.database_url: str = self._get_database_url()
    
    def _get_database_url(self) -> str:
        """Get database URL based on environment"""
        if self.azure_sql_connection_string and self.env == "production":
            return self.azure_sql_connection_string
        else:
            return f"sqlite:///{self.sqlite_db_path}"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


settings = get_settings()

