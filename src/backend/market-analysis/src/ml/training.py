"""
Machine learning model training module for cryptocurrency market predictions.
Implements a comprehensive training pipeline with advanced data preprocessing,
model training, validation, and production features.

Version: 1.0.0
"""

import tensorflow as tf  # v2.13.0
import numpy as np  # v1.24.0
import pandas as pd  # v2.0.0
from sklearn.model_selection import train_test_split  # v1.3.0
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Tuple, Optional
import json

from .model import MarketPredictor
from ..config import Settings
from ..services.data_fetcher import DataFetcher

# Global constants from specification
TRAINING_SYMBOLS = ["BTC", "ETH", "BNB", "XRP", "ADA"]
VALIDATION_SPLIT = 0.2
TEST_SPLIT = 0.1
EPOCHS = 100
EARLY_STOPPING_PATIENCE = 10
MODEL_VERSION_PREFIX = "v"
CHECKPOINT_DIR = "./checkpoints"
METRICS_LOG_DIR = "./metrics"

@tf.keras.utils.register_keras_serializable()
class ModelTrainer:
    """
    Enhanced trainer class for market prediction model with advanced features
    including model versioning, validation, and performance monitoring.
    """

    def __init__(self, settings: Settings, logger: logging.Logger):
        """
        Initialize the enhanced model trainer with comprehensive configuration.

        Args:
            settings: Application settings
            logger: Logger instance for tracking training progress
        """
        self._settings = settings
        self._logger = logger
        
        # Initialize model and data components
        self._model = MarketPredictor()
        self._data_fetcher = DataFetcher(settings)
        
        # Setup training infrastructure
        self._setup_training_environment()
        
        # Initialize tracking
        self._training_history = {}
        self._model_version = self._generate_model_version()
        self._performance_metrics = {}
        
        self._logger.info(f"Initialized ModelTrainer with version {self._model_version}")

    async def prepare_training_data(
        self,
        symbols: List[str] = TRAINING_SYMBOLS,
        interval: str = "1h",
        validate_quality: bool = True
    ) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        """
        Enhanced data preparation with quality validation and advanced preprocessing.

        Args:
            symbols: List of cryptocurrency symbols
            interval: Time interval for data
            validate_quality: Whether to perform data quality validation

        Returns:
            Tuple of training, validation, and test datasets
        """
        self._logger.info(f"Preparing training data for symbols: {symbols}")
        
        try:
            # Fetch historical data with quality validation
            async with self._data_fetcher as fetcher:
                all_data = []
                for symbol in symbols:
                    data = await fetcher.fetch_historical_data(
                        symbol=symbol,
                        interval=interval,
                        limit=self._settings.ml.TRAINING_EPOCHS
                    )
                    
                    if validate_quality:
                        data_quality = await fetcher.validate_data_quality(data)
                        if not data_quality['is_valid']:
                            self._logger.warning(f"Data quality check failed for {symbol}: {data_quality['issues']}")
                            continue
                    
                    all_data.append(data)
                
            # Combine and preprocess data
            combined_data = pd.concat(all_data)
            processed_data = self._preprocess_data(combined_data)
            
            # Create sequences for time series prediction
            sequences = self._create_sequences(processed_data)
            
            # Split data into training, validation, and test sets
            train_data, temp_data = train_test_split(
                sequences,
                test_size=VALIDATION_SPLIT + TEST_SPLIT,
                shuffle=False
            )
            
            val_data, test_data = train_test_split(
                temp_data,
                test_size=TEST_SPLIT/(VALIDATION_SPLIT + TEST_SPLIT),
                shuffle=False
            )
            
            self._logger.info(f"Prepared datasets - Train: {train_data.shape}, "
                            f"Validation: {val_data.shape}, Test: {test_data.shape}")
            
            return train_data, val_data, test_data
            
        except Exception as e:
            self._logger.error(f"Error preparing training data: {str(e)}")
            raise

    async def train_model(
        self,
        train_data: np.ndarray,
        val_data: np.ndarray,
        training_params: Optional[Dict] = None
    ) -> Dict:
        """
        Enhanced model training with comprehensive monitoring and validation.

        Args:
            train_data: Training dataset
            val_data: Validation dataset
            training_params: Optional training parameters

        Returns:
            Dictionary containing training history and performance metrics
        """
        self._logger.info("Starting model training")
        
        try:
            # Setup training parameters
            params = {
                'batch_size': self._settings.ml.BATCH_SIZE,
                'epochs': EPOCHS,
                'shuffle': True,
                **training_params or {}
            }
            
            # Configure callbacks
            callbacks = self._setup_training_callbacks()
            
            # Train the model
            history = self._model.build_model().fit(
                train_data,
                validation_data=val_data,
                callbacks=callbacks,
                **params
            )
            
            # Store training history
            self._training_history = history.history
            
            # Calculate and store performance metrics
            self._performance_metrics = {
                'train_loss': float(history.history['loss'][-1]),
                'val_loss': float(history.history['val_loss'][-1]),
                'train_accuracy': float(history.history['accuracy'][-1]),
                'val_accuracy': float(history.history['val_accuracy'][-1]),
                'training_time': datetime.now().isoformat(),
                'epochs_trained': len(history.history['loss']),
                'early_stopping_epoch': callbacks[0].stopped_epoch if callbacks[0].stopped_epoch > 0 else None
            }
            
            self._logger.info(f"Training completed. Metrics: {self._performance_metrics}")
            
            return {
                'history': self._training_history,
                'metrics': self._performance_metrics
            }
            
        except Exception as e:
            self._logger.error(f"Error during model training: {str(e)}")
            raise

    async def evaluate_model(
        self,
        test_data: np.ndarray,
        include_uncertainty: bool = True
    ) -> Dict:
        """
        Comprehensive model evaluation with uncertainty estimation.

        Args:
            test_data: Test dataset
            include_uncertainty: Whether to include uncertainty estimates

        Returns:
            Dictionary containing evaluation metrics and uncertainty estimates
        """
        self._logger.info("Starting model evaluation")
        
        try:
            # Basic model evaluation
            evaluation_metrics = self._model.validate_model(test_data)
            
            # Enhanced evaluation with uncertainty estimation
            if include_uncertainty:
                uncertainty_metrics = self._calculate_uncertainty_metrics(test_data)
                evaluation_metrics.update(uncertainty_metrics)
            
            # Store evaluation results
            self._performance_metrics.update({
                'test_metrics': evaluation_metrics,
                'evaluation_timestamp': datetime.now().isoformat()
            })
            
            self._logger.info(f"Evaluation completed. Metrics: {evaluation_metrics}")
            
            return evaluation_metrics
            
        except Exception as e:
            self._logger.error(f"Error during model evaluation: {str(e)}")
            raise

    async def save_trained_model(self) -> bool:
        """
        Secure model saving with versioning and validation.

        Returns:
            Boolean indicating save success
        """
        self._logger.info(f"Saving trained model version {self._model_version}")
        
        try:
            # Create save directory
            save_path = Path(self._settings.ml.MODEL_PATH) / self._model_version
            save_path.mkdir(parents=True, exist_ok=True)
            
            # Save model with validation
            save_success = self._model.save_model(str(save_path))
            
            if save_success:
                # Save additional artifacts
                self._save_training_artifacts(save_path)
                self._logger.info(f"Model successfully saved to {save_path}")
                return True
            else:
                self._logger.error("Model save operation failed")
                return False
                
        except Exception as e:
            self._logger.error(f"Error saving model: {str(e)}")
            return False

    def _setup_training_environment(self) -> None:
        """Configure training environment and directories."""
        # Create necessary directories
        Path(CHECKPOINT_DIR).mkdir(parents=True, exist_ok=True)
        Path(METRICS_LOG_DIR).mkdir(parents=True, exist_ok=True)
        
        # Configure GPU memory growth
        gpus = tf.config.list_physical_devices('GPU')
        if gpus:
            for gpu in gpus:
                tf.config.experimental.set_memory_growth(gpu, True)

    def _setup_training_callbacks(self) -> List[tf.keras.callbacks.Callback]:
        """Configure training callbacks for monitoring and checkpointing."""
        return [
            tf.keras.callbacks.EarlyStopping(
                monitor='val_loss',
                patience=EARLY_STOPPING_PATIENCE,
                restore_best_weights=True
            ),
            tf.keras.callbacks.ModelCheckpoint(
                filepath=f"{CHECKPOINT_DIR}/checkpoint-{self._model_version}-{{epoch:02d}}-{{val_loss:.2f}}.h5",
                monitor='val_loss',
                save_best_only=True
            ),
            tf.keras.callbacks.TensorBoard(
                log_dir=f"{METRICS_LOG_DIR}/{self._model_version}",
                histogram_freq=1
            )
        ]

    def _generate_model_version(self) -> str:
        """Generate unique model version identifier."""
        timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        return f"{MODEL_VERSION_PREFIX}{timestamp}"

    def _save_training_artifacts(self, save_path: Path) -> None:
        """Save training history and metadata."""
        # Save training history
        with open(save_path / "training_history.json", 'w') as f:
            json.dump(self._training_history, f)
        
        # Save performance metrics
        with open(save_path / "performance_metrics.json", 'w') as f:
            json.dump(self._performance_metrics, f)
        
        # Save model metadata
        metadata = {
            'version': self._model_version,
            'training_params': self._settings.ml.MODEL_HYPERPARAMETERS,
            'training_symbols': TRAINING_SYMBOLS,
            'creation_date': datetime.now().isoformat()
        }
        with open(save_path / "metadata.json", 'w') as f:
            json.dump(metadata, f)

    def _calculate_uncertainty_metrics(self, test_data: np.ndarray) -> Dict:
        """Calculate model uncertainty metrics using Monte Carlo dropout."""
        mc_predictions = []
        n_iterations = 100
        
        # Perform Monte Carlo predictions
        for _ in range(n_iterations):
            predictions = self._model.build_model()(test_data, training=True)
            mc_predictions.append(predictions)
            
        mc_predictions = np.array(mc_predictions)
        
        # Calculate uncertainty metrics
        mean_prediction = np.mean(mc_predictions, axis=0)
        std_prediction = np.std(mc_predictions, axis=0)
        
        return {
            'prediction_uncertainty_mean': float(np.mean(std_prediction)),
            'prediction_uncertainty_std': float(np.std(std_prediction)),
            'confidence_intervals': {
                '95': float(np.percentile(std_prediction, 95)),
                '99': float(np.percentile(std_prediction, 99))
            }
        }

    def _preprocess_data(self, data: pd.DataFrame) -> np.ndarray:
        """Implement advanced data preprocessing pipeline."""
        # Handle missing values
        data = data.fillna(method='ffill').fillna(method='bfill')
        
        # Calculate additional features
        data['returns'] = data['close'].pct_change()
        data['volatility'] = data['returns'].rolling(window=24).std()
        data['ma_20'] = data['close'].rolling(window=20).mean()
        data['ma_50'] = data['close'].rolling(window=50).mean()
        
        # Drop rows with NaN values after feature creation
        data = data.dropna()
        
        # Normalize features
        feature_columns = self._settings.ml.FEATURE_COLUMNS
        normalized_data = (data[feature_columns] - data[feature_columns].mean()) / data[feature_columns].std()
        
        return normalized_data.values

    def _create_sequences(self, data: np.ndarray, sequence_length: int = 30) -> np.ndarray:
        """Create sequences for time series prediction."""
        sequences = []
        for i in range(len(data) - sequence_length):
            sequences.append(data[i:(i + sequence_length)])
        return np.array(sequences)