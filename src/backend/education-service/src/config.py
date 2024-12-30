"""
Configuration module for the Bookman AI Education Service.
Provides centralized configuration management with enhanced security and performance settings.

Version: 1.0.0
"""

import os
import json
from typing import Dict, Any, Optional, Set
from dataclasses import dataclass, field
from urllib.parse import quote_plus

# Import course schema constants
DIFFICULTY_LEVELS = ["beginner", "intermediate", "advanced", "expert"]
CONTENT_TYPES = ["video", "text", "quiz", "interactive", "assessment", "simulation", "ai_generated"]

# Global service configuration
ENV: str = os.getenv('EDUCATION_SERVICE_ENV', 'development')
DEBUG: bool = os.getenv('EDUCATION_SERVICE_DEBUG', 'False').lower() == 'true'
SERVICE_NAME: str = 'education-service'

def get_database_url() -> str:
    """
    Constructs a secure database URL with connection pooling and SSL configuration.
    
    Returns:
        str: Formatted database URL with security parameters
    """
    db_params = {
        'user': os.getenv('DB_USER', ''),
        'password': quote_plus(os.getenv('DB_PASSWORD', '')),
        'host': os.getenv('DB_HOST', 'localhost'),
        'port': os.getenv('DB_PORT', '5432'),
        'dbname': os.getenv('DB_NAME', 'bookman_education')
    }
    
    # Validate required credentials
    if not all([db_params['user'], db_params['password'], db_params['host']]):
        raise ValueError("Missing required database credentials")
    
    # Add SSL configuration if enabled
    ssl_params = []
    if os.getenv('DB_SSL_REQUIRED', 'True').lower() == 'true':
        ssl_params.extend([
            'sslmode=verify-full',
            'sslcert=/etc/ssl/certs/edu-service-cert.pem',
            'sslkey=/etc/ssl/private/edu-service-key.pem',
            'sslrootcert=/etc/ssl/certs/ca.pem'
        ])
    
    # Add connection optimization parameters
    conn_params = [
        'application_name=education_service',
        'connect_timeout=10',
        'keepalives=1',
        'keepalives_idle=30',
        'keepalives_interval=10',
        'keepalives_count=5'
    ]
    
    # Construct URL with all parameters
    url = f"postgresql://{db_params['user']}:{db_params['password']}@{db_params['host']}:{db_params['port']}/{db_params['dbname']}"
    if ssl_params or conn_params:
        url += '?' + '&'.join(ssl_params + conn_params)
    
    return url

@dataclass
class Config:
    """Enhanced configuration class for the education service."""
    
    env: str = ENV
    debug: bool = DEBUG
    service_name: str = SERVICE_NAME
    
    # Database configuration with connection pooling
    database_config: Dict[str, Any] = field(default_factory=lambda: {
        'url': get_database_url(),
        'pool_size': int(os.getenv('DB_POOL_SIZE', '10')),
        'max_overflow': int(os.getenv('DB_MAX_OVERFLOW', '20')),
        'pool_timeout': int(os.getenv('DB_POOL_TIMEOUT', '30')),
        'pool_recycle': int(os.getenv('DB_POOL_RECYCLE', '3600')),
        'echo': DEBUG,
        'echo_pool': DEBUG
    })
    
    # Redis cache configuration
    cache_config: Dict[str, Any] = field(default_factory=lambda: {
        'url': f"redis://{os.getenv('REDIS_HOST', 'localhost')}:{os.getenv('REDIS_PORT', '6379')}",
        'db': int(os.getenv('REDIS_DB', '0')),
        'password': os.getenv('REDIS_PASSWORD', ''),
        'ssl': os.getenv('REDIS_SSL', 'True').lower() == 'true',
        'socket_timeout': 5,
        'socket_connect_timeout': 5,
        'retry_on_timeout': True,
        'max_connections': 100,
        'ttl': int(os.getenv('CACHE_TTL', '3600')),
        'key_prefix': 'edu:'
    })
    
    # Content storage configuration with CDN support
    storage_config: Dict[str, Any] = field(default_factory=lambda: {
        'bucket': os.getenv('EDUCATION_S3_BUCKET'),
        'prefix': os.getenv('EDUCATION_S3_PREFIX', 'content'),
        'region': os.getenv('AWS_REGION', 'us-east-1'),
        'cdn_enabled': os.getenv('CDN_ENABLED', 'True').lower() == 'true',
        'cdn_base_url': os.getenv('CDN_BASE_URL'),
        'max_upload_size': int(os.getenv('MAX_UPLOAD_SIZE', '104857600')),  # 100MB
        'allowed_content_types': set(os.getenv('ALLOWED_CONTENT_TYPES', 'video,audio,pdf,html').split(',')),
        'content_encryption': os.getenv('CONTENT_ENCRYPTION', 'True').lower() == 'true'
    })
    
    # AI model configuration
    ai_config: Dict[str, Any] = field(default_factory=lambda: {
        'model_path': os.getenv('AI_MODEL_PATH', '/models/education'),
        'model_version': os.getenv('AI_MODEL_VERSION', 'latest'),
        'batch_size': int(os.getenv('AI_BATCH_SIZE', '32')),
        'learning_rate': float(os.getenv('AI_LEARNING_RATE', '0.001')),
        'min_confidence': float(os.getenv('AI_MIN_CONFIDENCE', '0.85')),
        'max_sequence_length': int(os.getenv('AI_MAX_SEQ_LENGTH', '512')),
        'device': os.getenv('AI_DEVICE', 'cuda' if os.path.exists('/dev/nvidia0') else 'cpu')
    })
    
    # Service configuration
    service_config: Dict[str, Any] = field(default_factory=lambda: {
        'host': os.getenv('SERVICE_HOST', '0.0.0.0'),
        'port': int(os.getenv('SERVICE_PORT', '50051')),
        'workers': int(os.getenv('SERVICE_WORKERS', '4')),
        'max_concurrent_requests': int(os.getenv('MAX_CONCURRENT_REQUESTS', '100')),
        'health_check_interval': int(os.getenv('HEALTH_CHECK_INTERVAL', '30')),
        'completion_rate_threshold': float(os.getenv('COMPLETION_RATE_THRESHOLD', '0.8')),
        'grpc_max_message_length': int(os.getenv('GRPC_MAX_MESSAGE_LENGTH', '4194304')),  # 4MB
        'enable_reflection': ENV != 'production'
    })
    
    def __post_init__(self):
        """Validate configuration after initialization."""
        self._validate_config()
    
    def _validate_config(self):
        """Validates critical configuration parameters."""
        # Validate storage configuration
        if not self.storage_config['bucket']:
            raise ValueError("S3 bucket name is required")
        
        if self.storage_config['cdn_enabled'] and not self.storage_config['cdn_base_url']:
            raise ValueError("CDN base URL is required when CDN is enabled")
        
        # Validate cache configuration
        if self.cache_config['ssl'] and not self.cache_config['password']:
            raise ValueError("Redis password is required when SSL is enabled")
        
        # Validate AI configuration
        if not os.path.exists(self.ai_config['model_path']):
            raise ValueError(f"AI model path does not exist: {self.ai_config['model_path']}")
        
        # Validate service configuration
        if self.service_config['workers'] < 1:
            raise ValueError("Number of workers must be at least 1")

# Create singleton configuration instance
config = Config()

# Export commonly used configuration values
DATABASE_URL = config.database_config['url']
REDIS_URL = config.cache_config['url']
S3_BUCKET = config.storage_config['bucket']
AI_MODEL_PATH = config.ai_config['model_path']