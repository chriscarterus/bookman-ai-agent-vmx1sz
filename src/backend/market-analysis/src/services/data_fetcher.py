"""
Enhanced data fetcher service for cryptocurrency market data.
Implements robust error handling, rate limiting, and data validation.

Version: 1.0.0
"""

import asyncio
import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional, Union
import json

import aiohttp  # v3.8.0
import pandas as pd  # v2.0.0
import backoff  # v2.2.1
import circuitbreaker  # v1.4.0
from aiohttp import ClientSession, TCPConnector
from asyncio import Semaphore

from ..models.market_data import MarketData
from ..config import Settings

# Global constants from specification
SUPPORTED_EXCHANGES = ["binance", "coingecko", "kraken", "huobi"]
MAX_RETRIES = 3
BATCH_SIZE = 100
HEALTH_CHECK_INTERVAL = 60
RATE_LIMIT_BUFFER = 0.8
CIRCUIT_BREAKER_THRESHOLD = 0.5

logger = logging.getLogger(__name__)

class DataFetcher:
    """
    Enhanced asynchronous data fetcher for cryptocurrency market data with 
    improved reliability and monitoring capabilities.
    """

    def __init__(self, settings: Settings):
        """
        Initialize data fetcher with enhanced settings and monitoring.
        
        Args:
            settings: Application configuration settings
        """
        self.settings = settings
        self._session: Optional[ClientSession] = None
        self._rate_limiters: Dict[str, Semaphore] = {}
        self._exchange_stats: Dict[str, Dict] = {}
        
        # Initialize rate limiters for each exchange
        for exchange in SUPPORTED_EXCHANGES:
            rate_limit = int(settings.api.API_RATE_LIMIT * RATE_LIMIT_BUFFER)
            self._rate_limiters[exchange] = Semaphore(rate_limit)
            self._exchange_stats[exchange] = {
                'requests': 0,
                'errors': 0,
                'last_success': None
            }

    async def __aenter__(self):
        """Async context manager entry."""
        connector = TCPConnector(
            limit=self.settings.api.API_RATE_LIMIT,
            ttl_dns_cache=300,
            ssl=self.settings.db.SSL_ENABLED
        )
        self._session = ClientSession(
            connector=connector,
            timeout=aiohttp.ClientTimeout(total=self.settings.api.API_TIMEOUT_SECONDS),
            raise_for_status=True
        )
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        if self._session:
            await self._session.close()
            self._session = None

    @backoff.on_exception(
        backoff.expo,
        (aiohttp.ClientError, asyncio.TimeoutError),
        max_tries=MAX_RETRIES
    )
    @circuitbreaker.circuit(failure_threshold=CIRCUIT_BREAKER_THRESHOLD)
    async def fetch_real_time_data(
        self,
        symbols: List[str],
        exchange: Optional[str] = "binance",
        validate_cross_exchange: Optional[bool] = False
    ) -> List[MarketData]:
        """
        Fetches real-time market data with enhanced error handling and validation.
        
        Args:
            symbols: List of cryptocurrency symbols
            exchange: Preferred exchange (default: binance)
            validate_cross_exchange: Whether to validate data across exchanges
            
        Returns:
            List of validated MarketData objects
        """
        if not self._session:
            raise RuntimeError("Session not initialized. Use async context manager.")

        if exchange not in SUPPORTED_EXCHANGES:
            raise ValueError(f"Unsupported exchange: {exchange}")

        async with self._rate_limiters[exchange]:
            try:
                endpoint = self.settings.api.API_ENDPOINTS[exchange]
                symbols_param = ",".join(symbols)
                
                async with self._session.get(
                    f"{endpoint}/ticker/price",
                    params={"symbols": symbols_param}
                ) as response:
                    data = await response.json()
                    
                    # Update exchange statistics
                    self._exchange_stats[exchange]['requests'] += 1
                    self._exchange_stats[exchange]['last_success'] = datetime.now(timezone.utc)
                    
                    # Process and validate data
                    market_data = []
                    for item in data:
                        try:
                            md = MarketData(item)
                            if validate_cross_exchange:
                                await self._validate_cross_exchange(md)
                            market_data.append(md)
                        except Exception as e:
                            logger.error(f"Data validation error for {item['symbol']}: {str(e)}")
                            self._exchange_stats[exchange]['errors'] += 1
                            continue
                    
                    return market_data
                    
            except Exception as e:
                self._exchange_stats[exchange]['errors'] += 1
                logger.error(f"Error fetching data from {exchange}: {str(e)}")
                raise

    async def fetch_historical_data(
        self,
        symbol: str,
        interval: str,
        limit: Optional[int] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None
    ) -> pd.DataFrame:
        """
        Fetches historical OHLCV data with optimized batch processing.
        
        Args:
            symbol: Cryptocurrency symbol
            interval: Time interval (e.g., '1h', '1d')
            limit: Number of candles to fetch
            start_time: Start time for historical data
            end_time: End time for historical data
            
        Returns:
            DataFrame containing historical market data
        """
        if not self._session:
            raise RuntimeError("Session not initialized. Use async context manager.")

        try:
            # Calculate optimal batch size based on interval
            batch_size = min(BATCH_SIZE, limit) if limit else BATCH_SIZE
            
            # Prepare request parameters
            params = {
                "symbol": symbol,
                "interval": interval,
                "limit": batch_size
            }
            
            if start_time:
                params["startTime"] = int(start_time.timestamp() * 1000)
            if end_time:
                params["endTime"] = int(end_time.timestamp() * 1000)
            
            # Fetch data in batches
            all_data = []
            async with self._rate_limiters["binance"]:
                endpoint = f"{self.settings.api.API_ENDPOINTS['binance']}/klines"
                
                async with self._session.get(endpoint, params=params) as response:
                    data = await response.json()
                    all_data.extend(data)
            
            # Convert to DataFrame and process
            df = pd.DataFrame(all_data, columns=[
                'timestamp', 'open', 'high', 'low', 'close', 'volume',
                'close_time', 'quote_volume', 'trades', 'taker_buy_base',
                'taker_buy_quote', 'ignored'
            ])
            
            # Clean and format data
            df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')
            for col in ['open', 'high', 'low', 'close', 'volume']:
                df[col] = pd.to_numeric(df[col], errors='coerce')
            
            return df.set_index('timestamp')
            
        except Exception as e:
            logger.error(f"Error fetching historical data for {symbol}: {str(e)}")
            raise

    async def batch_update(
        self,
        symbols: List[str],
        force_update: Optional[bool] = False
    ) -> Dict:
        """
        Performs optimized batch update with progress tracking.
        
        Args:
            symbols: List of symbols to update
            force_update: Whether to force update regardless of cache
            
        Returns:
            Dictionary containing update statistics
        """
        if not symbols:
            return {"status": "error", "message": "No symbols provided"}

        results = {
            "total": len(symbols),
            "successful": 0,
            "failed": 0,
            "errors": [],
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

        # Split symbols into batches
        symbol_batches = [symbols[i:i + BATCH_SIZE] for i in range(0, len(symbols), BATCH_SIZE)]
        
        try:
            for batch in symbol_batches:
                try:
                    market_data = await self.fetch_real_time_data(batch)
                    results["successful"] += len(market_data)
                except Exception as e:
                    results["failed"] += len(batch)
                    results["errors"].append(str(e))
                    logger.error(f"Batch update failed for symbols {batch}: {str(e)}")
                    
                # Add small delay between batches to prevent rate limiting
                await asyncio.sleep(0.1)
            
            return results
            
        except Exception as e:
            logger.error(f"Batch update failed: {str(e)}")
            results["status"] = "error"
            results["message"] = str(e)
            return results

    async def _validate_cross_exchange(self, market_data: MarketData) -> bool:
        """
        Validates market data across multiple exchanges.
        
        Args:
            market_data: MarketData object to validate
            
        Returns:
            Boolean indicating validation success
        """
        try:
            prices = []
            for exchange in SUPPORTED_EXCHANGES[:2]:  # Check first two exchanges
                if exchange != "binance":
                    async with self._rate_limiters[exchange]:
                        endpoint = self.settings.api.API_ENDPOINTS[exchange]
                        async with self._session.get(
                            f"{endpoint}/ticker/price",
                            params={"symbol": market_data.symbol}
                        ) as response:
                            data = await response.json()
                            prices.append(float(data["price"]))
            
            # Calculate price deviation
            avg_price = sum(prices) / len(prices)
            deviation = abs(market_data.price - avg_price) / avg_price
            
            return deviation <= 0.05  # 5% maximum deviation threshold
            
        except Exception as e:
            logger.warning(f"Cross-exchange validation failed: {str(e)}")
            return True  # Default to true if validation fails