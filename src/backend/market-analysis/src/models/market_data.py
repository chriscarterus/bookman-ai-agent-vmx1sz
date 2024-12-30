"""
Market data models for cryptocurrency price and volume information with TimescaleDB integration.
Implements comprehensive validation and time-series optimization.

Version: 1.0.0
"""

from datetime import datetime, timezone
from typing import Dict, List, Optional, Union
import json

import numpy as np
import pandas as pd
from pydantic import BaseModel, Field, validator  # pydantic v2.0.0
from sqlalchemy import Column, Float, String, DateTime, Integer, JSON  # sqlalchemy v2.0.0
from sqlalchemy.dialects.postgresql import JSONB

# Import schema constants
from shared.schemas.market import MarketDataSchema

# Global constants
PRICE_PRECISION = 8
VOLUME_PRECISION = 2
DEFAULT_TIMEFRAME = "1h"
MAX_PRICE_CHANGE_THRESHOLD = 0.25  # 25% max price change threshold
ANOMALY_DETECTION_WINDOW = 24  # Hours for anomaly detection window

class MarketData(BaseModel):
    """
    Core market data model for cryptocurrency price and volume information.
    Implements comprehensive validation and TimescaleDB optimization.
    """
    symbol: str = Field(..., min_length=2, max_length=10, regex="^[A-Z0-9]{2,10}$")
    price: float = Field(..., gt=0)
    volume: float = Field(..., ge=0)
    change_24h: float = Field(..., ge=-100, le=1000)
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    market_cap: Optional[float] = Field(None, ge=0)
    circulating_supply: Optional[float] = Field(None, ge=0)
    rank: Optional[int] = Field(None, gt=0)
    volatility_index: Optional[float] = Field(None, ge=0)
    metadata: Optional[Dict] = Field(default_factory=dict)

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            np.float64: lambda v: float(v)
        }
        arbitrary_types_allowed = True

    def __init__(self, data: Dict, validation_config: Optional[Dict] = None) -> None:
        """
        Initialize market data with enhanced validation.
        
        Args:
            data: Raw market data dictionary
            validation_config: Optional configuration for validation rules
        """
        # Ensure UTC timezone
        if 'timestamp' in data and isinstance(data['timestamp'], str):
            data['timestamp'] = datetime.fromisoformat(data['timestamp']).replace(tzinfo=timezone.utc)
        
        # Initialize base model
        super().__init__(**data)
        
        # Apply custom validation rules
        if validation_config:
            self._apply_validation_rules(validation_config)
        
        # Initialize metadata
        self.metadata = self.metadata or {}
        self.metadata.update({
            'validation_timestamp': datetime.now(timezone.utc).isoformat(),
            'data_quality_score': self._calculate_quality_score()
        })

    @validator('price')
    def validate_price_precision(cls, v: float) -> float:
        """Validate price precision and range."""
        return round(float(v), PRICE_PRECISION)

    @validator('volume')
    def validate_volume_precision(cls, v: float) -> float:
        """Validate volume precision and range."""
        return round(float(v), VOLUME_PRECISION)

    def to_dict(self, include_metadata: bool = True) -> Dict:
        """
        Convert market data to dictionary format with enhanced serialization.
        
        Args:
            include_metadata: Whether to include metadata in output
            
        Returns:
            Dictionary representation of market data
        """
        base_dict = {
            'symbol': self.symbol,
            'price': round(self.price, PRICE_PRECISION),
            'volume': round(self.volume, VOLUME_PRECISION),
            'change_24h': round(self.change_24h, 2),
            'timestamp': self.timestamp.isoformat(),
        }
        
        # Add optional fields if present
        for field in ['market_cap', 'circulating_supply', 'rank', 'volatility_index']:
            value = getattr(self, field)
            if value is not None:
                base_dict[field] = value

        if include_metadata:
            base_dict['metadata'] = self.metadata

        return base_dict

    def to_timescale(self) -> Dict:
        """
        Prepare data for TimescaleDB insertion with optimization hints.
        
        Returns:
            Dictionary formatted for TimescaleDB with hypertable metadata
        """
        timescale_data = self.to_dict(include_metadata=False)
        
        # Add TimescaleDB-specific metadata
        timescale_data.update({
            'chunk_time_interval': '1 day',
            'compression_enabled': True,
            'compression_segmentby': ['symbol'],
            'compression_orderby': 'timestamp',
            'compression_interval': '7 days',
            'retention_policy': '365 days',
            '_timescaledb_internal': {
                'hypertable_id': True,
                'is_compressed': False
            }
        })
        
        return timescale_data

    def validate_price(self, previous_price: Optional[float] = None,
                      historical_prices: Optional[List[float]] = None) -> bool:
        """
        Perform enhanced price validation with anomaly detection.
        
        Args:
            previous_price: Last known price for comparison
            historical_prices: List of historical prices for analysis
            
        Returns:
            Boolean indicating validation success
        """
        # Basic validation
        if not 0 < self.price < 1e15:
            return False
            
        # Previous price comparison
        if previous_price:
            price_change = abs(self.price - previous_price) / previous_price
            if price_change > MAX_PRICE_CHANGE_THRESHOLD:
                return False
                
        # Statistical validation
        if historical_prices and len(historical_prices) >= ANOMALY_DETECTION_WINDOW:
            prices_array = np.array(historical_prices)
            mean = np.mean(prices_array)
            std = np.std(prices_array)
            z_score = abs(self.price - mean) / std
            
            # Reject if price is more than 3 standard deviations from mean
            if z_score > 3:
                return False
                
        return True

class HistoricalMarketData(BaseModel):
    """
    Historical OHLCV market data model with advanced aggregation capabilities.
    """
    symbol: str = Field(..., min_length=2, max_length=10)
    interval: str = Field(..., regex="^[1-9][0-9]*(m|h|d|w)$")
    open: float = Field(..., gt=0)
    high: float = Field(..., gt=0)
    low: float = Field(..., gt=0)
    close: float = Field(..., gt=0)
    volume: float = Field(..., ge=0)
    timestamp: datetime = Field(...)
    technical_indicators: Optional[Dict] = Field(default_factory=dict)

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            np.float64: lambda v: float(v)
        }

    def __init__(self, data: Dict, indicators: Optional[List[str]] = None) -> None:
        """
        Initialize historical market data with validation and indicators.
        
        Args:
            data: Raw OHLCV data dictionary
            indicators: List of technical indicators to calculate
        """
        super().__init__(**data)
        
        # Validate OHLCV consistency
        self._validate_ohlcv()
        
        # Calculate technical indicators if requested
        if indicators:
            self._calculate_indicators(indicators)

    def aggregate(self, target_interval: str,
                 agg_functions: Optional[Dict] = None,
                 volume_weighted: bool = True) -> pd.DataFrame:
        """
        Perform advanced time-series aggregation with custom functions.
        
        Args:
            target_interval: Target timeframe for aggregation
            agg_functions: Custom aggregation functions
            volume_weighted: Whether to use volume-weighted calculations
            
        Returns:
            Pandas DataFrame with aggregated data
        """
        # Create DataFrame from OHLCV data
        df = pd.DataFrame({
            'timestamp': [self.timestamp],
            'open': [self.open],
            'high': [self.high],
            'low': [self.low],
            'close': [self.close],
            'volume': [self.volume]
        })
        
        # Set timestamp as index
        df.set_index('timestamp', inplace=True)
        
        # Define default aggregation functions
        default_agg = {
            'open': 'first',
            'high': 'max',
            'low': 'min',
            'close': 'last',
            'volume': 'sum'
        }
        
        # Merge with custom aggregation functions
        agg_functions = {**default_agg, **(agg_functions or {})}
        
        # Resample and aggregate
        resampled = df.resample(target_interval).agg(agg_functions)
        
        if volume_weighted:
            resampled['vwap'] = (resampled['close'] * resampled['volume']).cumsum() / resampled['volume'].cumsum()
            
        return resampled

    def _validate_ohlcv(self) -> None:
        """Validate OHLCV data consistency."""
        assert self.low <= self.high, "Low price cannot be greater than high price"
        assert self.low <= self.open <= self.high, "Open price must be between low and high"
        assert self.low <= self.close <= self.high, "Close price must be between low and high"

    def _calculate_indicators(self, indicators: List[str]) -> None:
        """Calculate requested technical indicators."""
        # Implementation for technical indicators would go here
        pass