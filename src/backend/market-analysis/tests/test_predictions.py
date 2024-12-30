"""
Comprehensive test suite for cryptocurrency price prediction and market analysis functionality.
Tests prediction accuracy, trend analysis, risk metrics validation, and performance benchmarks.

Version: 1.0.0
"""

# External imports - v7.0.0
import pytest
# External imports - v0.21.0
import pytest_asyncio
# External imports - v1.24.0
import numpy as np
# External imports - v2.0.0
import pandas as pd
# External imports - v4.0.0
from pytest_benchmark.fixture import BenchmarkFixture
from datetime import datetime, timedelta
from typing import Dict, List, Optional

# Internal imports
from ..src.services.prediction import PredictionService
from ..src.ml.model import MarketPredictor
from ..src.services.data_fetcher import DataFetcher
from ..config import Settings

# Test constants
TEST_SYMBOLS = ["BTC", "ETH", "SOL", "ADA", "DOT"]
TEST_HORIZONS = [1, 7, 14, 30, 90]
TEST_CONFIDENCE_LEVELS = [0.68, 0.95, 0.99]
PERFORMANCE_THRESHOLDS = {
    "prediction_time": 0.5,  # seconds
    "analysis_time": 0.3,
    "risk_calculation_time": 0.2
}

@pytest.mark.asyncio
class TestPredictionService:
    """
    Comprehensive test suite for PredictionService functionality with performance benchmarking.
    """

    async def setup_method(self):
        """Initialize test environment with mock data and performance monitoring."""
        self.settings = Settings()
        self._service = PredictionService(self.settings)
        self._data_fetcher = DataFetcher(self.settings)
        self._test_data_cache = {}
        self._performance_metrics = {}

        # Load test data
        async with self._data_fetcher as fetcher:
            for symbol in TEST_SYMBOLS:
                self._test_data_cache[symbol] = await fetcher.fetch_historical_data(
                    symbol=symbol,
                    interval="1d",
                    limit=90
                )

    @pytest.mark.asyncio
    @pytest.mark.benchmark
    async def test_price_prediction(self, benchmark: BenchmarkFixture):
        """Tests price prediction functionality with accuracy validation."""
        for symbol in TEST_SYMBOLS:
            for horizon in TEST_HORIZONS:
                for confidence_level in TEST_CONFIDENCE_LEVELS:
                    # Benchmark prediction performance
                    result = await benchmark.pedantic(
                        self._service.predict_price,
                        args=(symbol, horizon, confidence_level),
                        iterations=5,
                        rounds=3
                    )

                    # Validate prediction structure
                    assert isinstance(result, dict)
                    assert "predictions" in result
                    assert "metrics" in result
                    assert "confidence_intervals" in result["predictions"]

                    # Validate prediction values
                    predictions = result["predictions"]
                    assert predictions["mean"] > 0
                    assert predictions["confidence_intervals"]["lower"] < predictions["mean"]
                    assert predictions["confidence_intervals"]["upper"] > predictions["mean"]

                    # Validate confidence intervals
                    ci_width = (predictions["confidence_intervals"]["upper"] - 
                              predictions["confidence_intervals"]["lower"])
                    assert ci_width > 0
                    assert ci_width / predictions["mean"] < 0.5  # Max 50% uncertainty

                    # Check prediction metrics
                    metrics = result["metrics"]
                    assert 0 <= metrics["data_quality_score"] <= 1
                    assert metrics["historical_volatility"] >= 0
                    assert metrics["prediction_std"] > 0

                    # Verify performance
                    assert benchmark.stats["mean"] < PERFORMANCE_THRESHOLDS["prediction_time"]

    @pytest.mark.asyncio
    async def test_trend_analysis(self):
        """Tests market trend analysis with technical indicators."""
        for symbol in TEST_SYMBOLS:
            # Test trend analysis with different window sizes
            for window_size in [7, 14, 30]:
                result = await self._service.analyze_trend(
                    symbol=symbol,
                    window_size=window_size,
                    indicators=["rsi", "macd", "bollinger"]
                )

                # Validate trend analysis structure
                assert isinstance(result, dict)
                assert "trend" in result
                assert "momentum" in result
                assert "technical_indicators" in result

                # Validate trend direction
                trend = result["trend"]
                assert trend["direction"] in ["bullish", "bearish", "neutral"]
                assert 0 <= trend["strength"] <= 100
                assert 0 <= trend["confidence"] <= 1

                # Validate technical indicators
                indicators = result["technical_indicators"]
                if "rsi" in indicators:
                    assert 0 <= indicators["rsi"] <= 100
                if "macd" in indicators:
                    assert all(key in indicators["macd"] for key in ["macd", "signal", "histogram"])
                if "bollinger" in indicators:
                    assert all(key in indicators["bollinger"] for key in ["middle", "upper", "lower"])
                    assert indicators["bollinger"]["lower"] < indicators["bollinger"]["upper"]

                # Validate momentum metrics
                momentum = result["momentum"]
                assert all(key in momentum for key in ["momentum_1d", "momentum_7d", "momentum_30d"])
                assert isinstance(momentum["volatility"], float)

    @pytest.mark.asyncio
    async def test_risk_metrics(self):
        """Tests risk assessment calculations with stress testing."""
        for symbol in TEST_SYMBOLS:
            # Test risk metrics with different time windows
            result = await self._service.get_risk_metrics(
                symbol=symbol,
                windows=[30, 60, 90]
            )

            # Validate risk metrics structure
            assert isinstance(result, dict)
            assert "risk_metrics" in result
            assert "risk_score" in result

            # Validate risk metrics for each window
            risk_metrics = result["risk_metrics"]
            for window in ["30d", "60d", "90d"]:
                window_metrics = risk_metrics[window]
                
                # Validate Value at Risk (VaR)
                assert "value_at_risk" in window_metrics
                assert window_metrics["value_at_risk"]["95"] < 0  # VaR should be negative
                assert window_metrics["value_at_risk"]["99"] < window_metrics["value_at_risk"]["95"]

                # Validate Conditional VaR (CVaR)
                assert "conditional_var" in window_metrics
                assert window_metrics["conditional_var"]["95"] < window_metrics["value_at_risk"]["95"]
                assert window_metrics["conditional_var"]["99"] < window_metrics["conditional_var"]["95"]

                # Validate volatility and other metrics
                assert window_metrics["volatility"] > 0
                assert isinstance(window_metrics["sharpe_ratio"], float)
                assert -1 <= window_metrics["max_drawdown"] <= 0

            # Validate risk score
            assert 0 <= result["risk_score"] <= 100

@pytest.mark.asyncio
class TestMarketPredictor:
    """Test suite for ML model functionality with performance validation."""

    async def setup_method(self):
        """Sets up ML model test environment with performance monitoring."""
        self.settings = Settings()
        self._model = MarketPredictor(config=self.settings.ml.MODEL_HYPERPARAMETERS)
        self._model_metrics = {}
        self._performance_data = {}

        # Load test model
        model_loaded = self._model.load_model(self.settings.ml.MODEL_PATH)
        assert model_loaded, "Failed to load test model"

    @pytest.mark.asyncio
    @pytest.mark.benchmark
    async def test_model_prediction(self, benchmark: BenchmarkFixture):
        """Tests raw model predictions with performance benchmarking."""
        # Prepare test input data
        test_sequence = np.random.rand(1, 30, len(self.settings.ml.FEATURE_COLUMNS))
        
        # Benchmark raw model prediction
        predictions, confidence_intervals, metrics = await benchmark.pedantic(
            self._model.predict,
            args=(test_sequence,),
            iterations=10,
            rounds=3
        )

        # Validate prediction shape and values
        assert predictions.shape[1] == 1  # Single step prediction
        assert confidence_intervals.shape == predictions.shape
        assert all(ci > 0 for ci in confidence_intervals.flatten())

        # Validate prediction bounds
        assert np.all(predictions > 0)  # Prices should be positive
        assert np.all(confidence_intervals > 0)  # Confidence intervals should be positive

        # Validate uncertainty estimates
        assert "mean_uncertainty" in metrics
        assert "max_uncertainty" in metrics
        assert 0 < metrics["mean_uncertainty"] < metrics["max_uncertainty"]

        # Verify model performance
        assert benchmark.stats["mean"] < PERFORMANCE_THRESHOLDS["prediction_time"]