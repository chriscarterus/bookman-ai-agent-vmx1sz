"""
Core machine learning model implementation for cryptocurrency price prediction and market analysis.
Uses LSTM-based architecture with uncertainty estimation for robust market predictions.

Version: 1.0.0
"""

import tensorflow as tf
import numpy as np
import pandas as pd
from sklearn.preprocessing import MinMaxScaler
from typing import Tuple, Dict, List, Optional
import logging
from ..config import Settings

# Configure GPU memory growth to prevent OOM errors
physical_devices = tf.config.list_physical_devices('GPU')
if physical_devices:
    for device in physical_devices:
        tf.config.experimental.set_memory_growth(device, True)

# Global constants
MODEL_VERSION = "1.0.0"
DEFAULT_SEQUENCE_LENGTH = 30
FEATURE_COLUMNS = ["price", "volume", "market_cap", "volatility"]
DROPOUT_RATE = 0.2
CONFIDENCE_LEVEL = 0.95

class MarketPredictor:
    """
    LSTM-based deep learning model for cryptocurrency price prediction with uncertainty estimation
    and production-ready features including model versioning and validation.
    """
    
    def __init__(self, config: Dict = None, dropout_rate: float = DROPOUT_RATE):
        """
        Initialize the market prediction model with configuration and resource management.
        
        Args:
            config (Dict): Model configuration parameters
            dropout_rate (float): Dropout rate for uncertainty estimation
        """
        self._config = config or Settings().ml.MODEL_HYPERPARAMETERS
        self._dropout_rate = dropout_rate
        self._version = MODEL_VERSION
        self._metrics = {}
        
        # Initialize preprocessing components
        self._scaler = MinMaxScaler()
        
        # Build and compile model
        self._model = self.build_model()
        
        logging.info(f"Initialized MarketPredictor v{self._version}")

    def build_model(self) -> tf.keras.Model:
        """
        Constructs the LSTM neural network architecture with uncertainty estimation.
        
        Returns:
            tf.keras.Model: Compiled TensorFlow model
        """
        input_shape = (DEFAULT_SEQUENCE_LENGTH, len(FEATURE_COLUMNS))
        
        inputs = tf.keras.layers.Input(shape=input_shape)
        
        # LSTM layers with dropout for uncertainty estimation
        x = tf.keras.layers.LSTM(
            units=self._config['hidden_layers'][0],
            return_sequences=True,
            name='lstm_1'
        )(inputs)
        x = tf.keras.layers.Dropout(self._dropout_rate)(x)
        
        x = tf.keras.layers.LSTM(
            units=self._config['hidden_layers'][1],
            return_sequences=False,
            name='lstm_2'
        )(x)
        x = tf.keras.layers.Dropout(self._dropout_rate)(x)
        
        # Dense layers for prediction
        x = tf.keras.layers.Dense(
            units=self._config['hidden_layers'][2],
            activation=self._config['activation'],
            name='dense_1'
        )(x)
        
        # Output layer with mean and variance predictions
        mean = tf.keras.layers.Dense(1, name='price_prediction')(x)
        variance = tf.keras.layers.Dense(1, activation='softplus', name='uncertainty')(x)
        
        model = tf.keras.Model(inputs=inputs, outputs=[mean, variance])
        
        # Compile with custom loss function for uncertainty
        model.compile(
            optimizer=tf.keras.optimizers.Adam(
                learning_rate=self._config['learning_rate'],
                clipnorm=1.0
            ),
            loss={
                'price_prediction': 'mse',
                'uncertainty': 'mae'
            },
            metrics={
                'price_prediction': ['mae', 'mape']
            }
        )
        
        return model

    @tf.function(experimental_relax_shapes=True)
    def predict(self, input_data: np.ndarray, horizon: int = 1,
               confidence_level: float = CONFIDENCE_LEVEL) -> Tuple[np.ndarray, np.ndarray, Dict]:
        """
        Generates price predictions with uncertainty estimates and confidence intervals.
        
        Args:
            input_data (np.ndarray): Input features for prediction
            horizon (int): Prediction horizon in time steps
            confidence_level (float): Confidence level for prediction intervals
            
        Returns:
            Tuple[np.ndarray, np.ndarray, Dict]: Predictions, confidence intervals, and metrics
        """
        # Validate input data
        if input_data.ndim != 3:
            raise ValueError(f"Expected 3D input data, got shape {input_data.shape}")
            
        # Preprocess input data
        processed_data = self._preprocess_data(input_data, training=False)
        
        # Monte Carlo predictions with dropout
        mc_predictions = []
        mc_iterations = 100
        
        for _ in range(mc_iterations):
            mean, variance = self._model(processed_data, training=True)
            mc_predictions.append(mean.numpy())
            
        mc_predictions = np.array(mc_predictions)
        
        # Calculate prediction statistics
        mean_prediction = np.mean(mc_predictions, axis=0)
        std_prediction = np.std(mc_predictions, axis=0)
        
        # Calculate confidence intervals
        z_score = abs(np.percentile(np.random.standard_normal(10000),
                                  confidence_level * 100))
        confidence_intervals = z_score * std_prediction
        
        # Update metrics
        self._metrics.update({
            'mean_uncertainty': float(np.mean(std_prediction)),
            'max_uncertainty': float(np.max(std_prediction)),
            'confidence_level': confidence_level
        })
        
        return mean_prediction, confidence_intervals, self._metrics

    def load_model(self, model_path: str, strict_version: bool = True) -> bool:
        """
        Loads and validates pre-trained model weights with version checking.
        
        Args:
            model_path (str): Path to saved model
            strict_version (bool): Whether to enforce version matching
            
        Returns:
            bool: Load success status
        """
        try:
            # Load model architecture and weights
            self._model = tf.keras.models.load_model(
                model_path,
                custom_objects={
                    'uncertainty_loss': self._model.loss
                }
            )
            
            # Load scaler parameters
            scaler_path = f"{model_path}/scaler.pkl"
            self._scaler = pd.read_pickle(scaler_path)
            
            # Version validation
            model_version = self._model.get_config().get('version', '0.0.0')
            if strict_version and model_version != self._version:
                raise ValueError(f"Model version mismatch: {model_version} != {self._version}")
            
            logging.info(f"Successfully loaded model from {model_path}")
            return True
            
        except Exception as e:
            logging.error(f"Failed to load model: {str(e)}")
            return False

    def save_model(self, model_path: str, include_optimizer: bool = True) -> bool:
        """
        Saves model weights, parameters, and metadata with versioning.
        
        Args:
            model_path (str): Path to save model
            include_optimizer (bool): Whether to save optimizer state
            
        Returns:
            bool: Save success status
        """
        try:
            # Save model architecture and weights
            self._model.save(
                model_path,
                include_optimizer=include_optimizer,
                save_format='tf'
            )
            
            # Save scaler parameters
            scaler_path = f"{model_path}/scaler.pkl"
            pd.to_pickle(self._scaler, scaler_path)
            
            # Save metadata
            metadata = {
                'version': self._version,
                'config': self._config,
                'metrics': self._metrics,
                'feature_columns': FEATURE_COLUMNS
            }
            
            with open(f"{model_path}/metadata.json", 'w') as f:
                import json
                json.dump(metadata, f)
            
            logging.info(f"Successfully saved model to {model_path}")
            return True
            
        except Exception as e:
            logging.error(f"Failed to save model: {str(e)}")
            return False

    def _preprocess_data(self, data: np.ndarray, training: bool = False) -> np.ndarray:
        """
        Implements robust data preprocessing pipeline.
        
        Args:
            data (np.ndarray): Input data array
            training (bool): Whether in training mode
            
        Returns:
            np.ndarray: Preprocessed data
        """
        # Validate input
        if data.shape[-1] != len(FEATURE_COLUMNS):
            raise ValueError(f"Expected {len(FEATURE_COLUMNS)} features, got {data.shape[-1]}")
            
        # Handle missing values
        data = np.nan_to_num(data, nan=0.0)
        
        # Apply scaling
        if training:
            data = self._scaler.fit_transform(
                data.reshape(-1, data.shape[-1])
            ).reshape(data.shape)
        else:
            data = self._scaler.transform(
                data.reshape(-1, data.shape[-1])
            ).reshape(data.shape)
            
        return data