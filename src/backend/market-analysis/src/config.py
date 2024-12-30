"""
Configuration module for the Bookman AI Market Analysis Service.
Handles environment variables, database connections, API settings, and ML parameters.

Version: 1.0.0
"""

import os
from typing import Dict, List, Optional
from pydantic import BaseSettings, Field, validator
from dotenv import load_dotenv
from pathlib import Path
import json

# Load market schema constants
with open(Path(__file__).parent.parent.parent / "shared/schemas/market.schema.json") as f:
    MARKET_SCHEMA = json.load(f)
    SUPPORTED_INTERVALS = MARKET_SCHEMA["properties"]["SUPPORTED_INTERVALS"]["items"]["enum"]
    MAX_HISTORICAL_DAYS = MARKET_SCHEMA["properties"]["MAX_HISTORICAL_DAYS"]["const"]

# Global constants
ENV_FILE = ".env"
CONFIG_VERSION = "1.0.0"

# Load environment variables
load_dotenv(ENV_FILE)

class DatabaseSettings(BaseSettings):
    """TimescaleDB connection settings for market data storage"""
    
    TIMESCALE_HOST: str = Field(..., env="TIMESCALE_HOST")
    TIMESCALE_PORT: int = Field(5432, env="TIMESCALE_PORT")
    TIMESCALE_DB: str = Field(..., env="TIMESCALE_DB")
    TIMESCALE_USER: str = Field(..., env="TIMESCALE_USER")
    TIMESCALE_PASSWORD: str = Field(..., env="TIMESCALE_PASSWORD")
    TIMESCALE_SCHEMA: str = Field("market_data", env="TIMESCALE_SCHEMA")
    CONNECTION_POOL_MIN: int = Field(5, env="DB_POOL_MIN")
    CONNECTION_POOL_MAX: int = Field(20, env="DB_POOL_MAX")
    SSL_ENABLED: bool = Field(True, env="DB_SSL_ENABLED")
    SSL_CA_CERT_PATH: Optional[str] = Field(None, env="DB_SSL_CA_CERT")

    @validator("SSL_CA_CERT_PATH")
    def validate_ssl_cert(cls, v: Optional[str], values: Dict) -> Optional[str]:
        if values.get("SSL_ENABLED") and v:
            if not Path(v).exists():
                raise ValueError(f"SSL CA certificate not found at: {v}")
        return v

    class Config:
        env_file = ENV_FILE
        case_sensitive = True

class APISettings(BaseSettings):
    """External API configuration for market data providers"""
    
    COINGECKO_API_KEY: str = Field(..., env="COINGECKO_API_KEY")
    BINANCE_API_KEY: str = Field(..., env="BINANCE_API_KEY")
    BINANCE_API_SECRET: str = Field(..., env="BINANCE_API_SECRET")
    API_RATE_LIMIT: int = Field(300, env="API_RATE_LIMIT")  # requests per minute
    API_TIMEOUT_SECONDS: int = Field(30, env="API_TIMEOUT")
    API_RETRY_ATTEMPTS: int = Field(3, env="API_RETRY_ATTEMPTS")
    API_RETRY_DELAY: int = Field(1, env="API_RETRY_DELAY")  # seconds
    
    API_ENDPOINTS: Dict[str, str] = {
        "coingecko": "https://api.coingecko.com/api/v3",
        "binance": "https://api.binance.com/api/v3"
    }
    
    SUPPORTED_EXCHANGES: List[str] = [
        "binance",
        "coingecko"
    ]

    class Config:
        env_file = ENV_FILE
        case_sensitive = True

class MLSettings(BaseSettings):
    """Machine learning model configuration"""
    
    MODEL_PATH: str = Field("models/", env="ML_MODEL_PATH")
    MODEL_VERSION: str = Field("1.0.0", env="ML_MODEL_VERSION")
    PREDICTION_INTERVAL: int = Field(3600, env="ML_PRED_INTERVAL")  # seconds
    CONFIDENCE_THRESHOLD: float = Field(0.8, env="ML_CONFIDENCE_THRESHOLD")
    BATCH_SIZE: int = Field(64, env="ML_BATCH_SIZE")
    
    MODEL_HYPERPARAMETERS: Dict = {
        "learning_rate": 0.001,
        "hidden_layers": [128, 64, 32],
        "dropout_rate": 0.2,
        "activation": "relu"
    }
    
    FEATURE_COLUMNS: List[str] = [
        "price", "volume", "market_cap", "volatility_24h",
        "liquidity_score", "market_dominance"
    ]
    
    MODEL_CHECKPOINT_DIR: str = Field("checkpoints/", env="ML_CHECKPOINT_DIR")
    TRAINING_EPOCHS: int = Field(100, env="ML_TRAINING_EPOCHS")

    @validator("MODEL_PATH", "MODEL_CHECKPOINT_DIR")
    def validate_paths(cls, v: str) -> str:
        path = Path(v)
        path.mkdir(parents=True, exist_ok=True)
        return str(path)

    class Config:
        env_file = ENV_FILE
        case_sensitive = True

class Settings(BaseSettings):
    """Main configuration class combining all settings"""
    
    db: DatabaseSettings = DatabaseSettings()
    api: APISettings = APISettings()
    ml: MLSettings = MLSettings()
    
    ENV_STATE: str = Field("development", env="ENV_STATE")
    LOG_LEVEL: str = Field("INFO", env="LOG_LEVEL")
    SERVICE_NAME: str = "market-analysis-service"
    VERSION: str = CONFIG_VERSION
    
    FEATURE_FLAGS: Dict[str, bool] = {
        "enable_ml_predictions": True,
        "enable_real_time_analytics": True,
        "enable_historical_analysis": True,
        "enable_market_alerts": True
    }

    def get_db_url(self) -> str:
        """Generates database connection URL with all parameters"""
        url = f"postgresql://{self.db.TIMESCALE_USER}:{self.db.TIMESCALE_PASSWORD}"
        url += f"@{self.db.TIMESCALE_HOST}:{self.db.TIMESCALE_PORT}/{self.db.TIMESCALE_DB}"
        
        params = []
        if self.db.SSL_ENABLED:
            params.append("sslmode=verify-full")
            if self.db.SSL_CA_CERT_PATH:
                params.append(f"sslcert={self.db.SSL_CA_CERT_PATH}")
        
        if params:
            url += "?" + "&".join(params)
        
        return url

    class Config:
        env_file = ENV_FILE
        case_sensitive = True

# Create and export settings instance
settings = Settings()