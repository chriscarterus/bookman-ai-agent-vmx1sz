"""
Main entry point for the Bookman AI Education Service.
Implements AI-driven personalized learning paths and core educational features.

Version: 1.0.0
"""

import logging
import os
from typing import Dict

import structlog  # v23.1.0
import uvicorn  # v0.22.0
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware  # v0.100.0
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from prometheus_client import Counter, Gauge, Histogram  # v0.17.0
from prometheus_client import start_http_server

from .config import Config
from .routes.courses import course_router
from .services.learning_path import LearningPathService
from .utils.ai_content import ContentGenerator

# Initialize FastAPI application with OpenAPI documentation
app = FastAPI(
    title="Bookman AI Education Service",
    description="AI-driven cryptocurrency education platform",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc"
)

# Initialize configuration
config = Config()

# Configure structured logging
structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer()
    ],
    context_class=dict,
    logger_factory=structlog.PrintLoggerFactory(),
    wrapper_class=structlog.BoundLogger,
    cache_logger_on_first_use=True,
)
logger = structlog.get_logger()

# Initialize Prometheus metrics
class PrometheusMetrics:
    def __init__(self):
        self.course_completion = Counter(
            'education_course_completion_total',
            'Total number of course completions',
            ['difficulty']
        )
        self.active_learners = Gauge(
            'education_active_learners',
            'Number of currently active learners'
        )
        self.module_completion_time = Histogram(
            'education_module_completion_seconds',
            'Time taken to complete modules',
            ['module_type']
        )
        self.learning_path_success = Gauge(
            'education_learning_path_success_rate',
            'Success rate of learning path completion'
        )

metrics = PrometheusMetrics()

def configure_middleware() -> None:
    """Configure comprehensive middleware stack for security and performance."""
    
    # CORS middleware with strict configuration
    app.add_middleware(
        CORSMiddleware,
        allow_origins=config.service_config.get('allowed_origins', []),
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE"],
        allow_headers=["*"],
        max_age=600
    )

    # Gzip compression for responses
    app.add_middleware(GZipMiddleware, minimum_size=1000)

    # Trusted host middleware
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=config.service_config.get('allowed_hosts', ["*"])
    )

    # Request ID middleware
    @app.middleware("http")
    async def add_request_id(request: Request, call_next):
        request_id = request.headers.get('X-Request-ID', os.urandom(16).hex())
        response = await call_next(request)
        response.headers['X-Request-ID'] = request_id
        return response

    # Logging middleware
    @app.middleware("http")
    async def log_requests(request: Request, call_next):
        logger.info(
            "request_started",
            path=request.url.path,
            method=request.method,
            client_ip=request.client.host
        )
        response = await call_next(request)
        logger.info(
            "request_completed",
            path=request.url.path,
            status_code=response.status_code
        )
        return response

def configure_routes() -> None:
    """Configure API routes with versioning and documentation."""
    
    # Mount course routes with version prefix
    app.include_router(
        course_router,
        prefix="/api/v1",
        tags=["courses"]
    )

    # Health check endpoint
    @app.get("/health", tags=["monitoring"])
    async def health_check() -> Dict:
        return {
            "status": "healthy",
            "version": "1.0.0",
            "timestamp": structlog.get_timestamp()
        }

    # Metrics endpoint
    @app.get("/metrics", tags=["monitoring"])
    async def get_metrics() -> Response:
        return Response(
            content=metrics.generate_latest(),
            media_type="text/plain"
        )

@app.on_event("startup")
async def startup_event() -> None:
    """Initialize application components on startup."""
    try:
        # Start Prometheus metrics server
        start_http_server(
            port=config.service_config.get('metrics_port', 9090)
        )
        
        # Configure middleware
        configure_middleware()
        
        # Configure routes
        configure_routes()
        
        # Initialize services
        app.state.learning_path_service = LearningPathService(
            db_session=config.database_config['session'],
            content_generator=ContentGenerator(config),
            cache_client=config.cache_config['client']
        )
        
        logger.info(
            "application_started",
            version="1.0.0",
            environment=config.env
        )
    
    except Exception as e:
        logger.error(
            "startup_failed",
            error=str(e),
            environment=config.env
        )
        raise

@app.on_event("shutdown")
async def shutdown_event() -> None:
    """Clean up resources on application shutdown."""
    try:
        # Close database connections
        if hasattr(app.state, 'db_session'):
            app.state.db_session.close()
        
        logger.info("application_shutdown_completed")
    
    except Exception as e:
        logger.error(
            "shutdown_error",
            error=str(e)
        )
        raise

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=config.service_config.get('host', '0.0.0.0'),
        port=config.service_config.get('port', 8000),
        workers=config.service_config.get('workers', 4),
        log_level="info",
        reload=config.debug
    )