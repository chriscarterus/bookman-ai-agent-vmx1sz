"""
Main entry point for the Bookman AI Market Analysis Service.
Provides real-time cryptocurrency market data processing and predictions through gRPC.

Version: 1.0.0
"""

# External imports
import grpc  # v1.54.0
import asyncio
import logging
import signal
from concurrent import futures
from typing import Optional
from prometheus_client import start_http_server, Counter, Histogram  # v0.17.0
from opentelemetry import trace  # v1.20.0
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter

# Internal imports
from .config import Settings
from .services.data_fetcher import DataFetcher
from .services.prediction import PredictionService

# Global constants
DEFAULT_PORT = 50051
MAX_WORKERS = 10
HEALTH_CHECK_PORT = 8080
GRACEFUL_SHUTDOWN_TIMEOUT = 30
CIRCUIT_BREAKER_THRESHOLD = 0.5
RETRY_ATTEMPTS = 3

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize metrics
REQUEST_COUNTER = Counter(
    'market_analysis_requests_total',
    'Total number of market analysis requests',
    ['method', 'status']
)
LATENCY_HISTOGRAM = Histogram(
    'market_analysis_request_duration_seconds',
    'Request duration in seconds',
    ['method']
)

class MarketServicer:
    """
    Enhanced gRPC service implementation for market data and analysis
    with production features including monitoring and circuit breakers.
    """

    def __init__(self, settings: Settings):
        """Initialize market analysis service with required components."""
        self._settings = settings
        self._data_fetcher = DataFetcher(settings)
        self._prediction_service = PredictionService(settings)
        
        # Initialize monitoring
        self._request_counter = REQUEST_COUNTER
        self._latency_histogram = LATENCY_HISTOGRAM
        
        # Initialize tracer
        self._tracer = trace.get_tracer(__name__)
        
        logger.info("Initialized MarketServicer with settings: %s", settings.SERVICE_NAME)

    async def GetMarketData(self, request, context):
        """
        Handle market data requests with enhanced error handling and monitoring.
        """
        with self._latency_histogram.labels(method='GetMarketData').time():
            with self._tracer.start_as_current_span("GetMarketData") as span:
                try:
                    # Validate request
                    if not request.symbol:
                        context.set_code(grpc.StatusCode.INVALID_ARGUMENT)
                        context.set_details("Symbol is required")
                        self._request_counter.labels(
                            method='GetMarketData',
                            status='error'
                        ).inc()
                        return None

                    # Add request metadata to span
                    span.set_attribute("symbol", request.symbol)
                    
                    # Fetch market data with circuit breaker
                    async with self._data_fetcher as fetcher:
                        market_data = await fetcher.fetch_real_time_data(
                            symbols=[request.symbol],
                            validate_cross_exchange=True
                        )
                    
                    if not market_data:
                        context.set_code(grpc.StatusCode.NOT_FOUND)
                        context.set_details(f"No data found for symbol {request.symbol}")
                        self._request_counter.labels(
                            method='GetMarketData',
                            status='not_found'
                        ).inc()
                        return None

                    # Record successful request
                    self._request_counter.labels(
                        method='GetMarketData',
                        status='success'
                    ).inc()

                    return market_data[0]

                except Exception as e:
                    logger.error("Error in GetMarketData: %s", str(e))
                    context.set_code(grpc.StatusCode.INTERNAL)
                    context.set_details(f"Internal error: {str(e)}")
                    self._request_counter.labels(
                        method='GetMarketData',
                        status='error'
                    ).inc()
                    return None

async def init_server(settings: Settings) -> grpc.Server:
    """
    Initialize the gRPC server with enhanced production features.
    """
    # Initialize OpenTelemetry
    trace.set_tracer_provider(TracerProvider())
    otlp_exporter = OTLPSpanExporter()
    span_processor = BatchSpanProcessor(otlp_exporter)
    trace.get_tracer_provider().add_span_processor(span_processor)

    # Create server with interceptors
    server = grpc.aio.server(
        futures.ThreadPoolExecutor(max_workers=MAX_WORKERS),
        options=[
            ('grpc.max_send_message_length', 1024 * 1024 * 10),
            ('grpc.max_receive_message_length', 1024 * 1024 * 10),
            ('grpc.keepalive_time_ms', 7200000),
            ('grpc.keepalive_timeout_ms', 20000),
            ('grpc.http2.max_pings_without_data', 0),
            ('grpc.http2.min_time_between_pings_ms', 10000),
            ('grpc.http2.min_ping_interval_without_data_ms', 5000),
        ]
    )

    # Add market servicer
    market_servicer = MarketServicer(settings)
    # Note: Add proto-generated service registration here
    # market_pb2_grpc.add_MarketServicer_to_server(market_servicer, server)

    # Start metrics server
    start_http_server(HEALTH_CHECK_PORT)
    
    # Add health check service
    # Note: Add health check service registration here
    
    return server

async def shutdown_server(
    server: grpc.Server,
    loop: Optional[asyncio.AbstractEventLoop] = None
) -> None:
    """
    Handle graceful server shutdown.
    """
    logger.info("Initiating graceful shutdown...")
    
    # Stop accepting new requests
    server.stop(grace=GRACEFUL_SHUTDOWN_TIMEOUT)
    
    try:
        # Wait for ongoing requests to complete
        await asyncio.wait_for(
            server.wait_for_termination(),
            timeout=GRACEFUL_SHUTDOWN_TIMEOUT
        )
    except asyncio.TimeoutError:
        logger.warning("Shutdown timeout exceeded, forcing exit")
    
    # Cleanup resources
    trace.get_tracer_provider().shutdown()
    
    if loop:
        loop.stop()
    
    logger.info("Server shutdown complete")

async def main():
    """
    Main entry point for the market analysis service.
    """
    settings = Settings()
    server = await init_server(settings)
    
    # Setup signal handlers
    loop = asyncio.get_event_loop()
    signals = (signal.SIGHUP, signal.SIGTERM, signal.SIGINT)
    for s in signals:
        loop.add_signal_handler(
            s,
            lambda s=s: asyncio.create_task(shutdown_server(server, loop))
        )
    
    try:
        # Start server
        await server.start()
        logger.info(
            "Market Analysis Service started on port %d",
            DEFAULT_PORT
        )
        
        # Keep server running
        await server.wait_for_termination()
        
    except Exception as e:
        logger.error("Server error: %s", str(e))
        await shutdown_server(server)
        raise

if __name__ == "__main__":
    asyncio.run(main())