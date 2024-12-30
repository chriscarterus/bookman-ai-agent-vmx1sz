// Package main provides the entry point for the portfolio service with comprehensive
// initialization, metrics, logging, and graceful shutdown handling.
package main

import (
    "context"
    "fmt"
    "log"
    "net"
    "os"
    "os/signal"
    "syscall"
    "time"

    "github.com/prometheus/client_golang/prometheus" // v1.14.0
    "go.uber.org/zap"                               // v1.24.0
    "google.golang.org/grpc"                        // v1.50.0
    grpc_prometheus "github.com/grpc-ecosystem/go-grpc-prometheus" // v1.2.0
    "google.golang.org/grpc/health/grpc_health_v1"
    "google.golang.org/grpc/keepalive"
    "google.golang.org/grpc/reflection"

    "bookman/portfolio-service/internal/config"
    "bookman/portfolio-service/internal/handlers"
    "bookman/portfolio-service/internal/services"
    "bookman/portfolio-service/internal/repository"
)

const (
    version         = "1.0.0"
    shutdownTimeout = 30 * time.Second
)

// Define service metrics
var (
    requestLatency = prometheus.NewHistogramVec(
        prometheus.HistogramOpts{
            Name:    "portfolio_request_duration_seconds",
            Help:    "Request latency in seconds",
            Buckets: []float64{.005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5, 10},
        },
        []string{"method"},
    )

    activeConnections = prometheus.NewGauge(
        prometheus.GaugeOpts{
            Name: "portfolio_active_connections",
            Help: "Number of active gRPC connections",
        },
    )

    errorCounter = prometheus.NewCounterVec(
        prometheus.CounterOpts{
            Name: "portfolio_errors_total",
            Help: "Total number of portfolio service errors",
        },
        []string{"type"},
    )
)

func init() {
    // Register metrics with Prometheus
    prometheus.MustRegister(requestLatency)
    prometheus.MustRegister(activeConnections)
    prometheus.MustRegister(errorCounter)
}

func main() {
    // Initialize structured logging
    logger, err := zap.NewProduction()
    if err != nil {
        log.Fatalf("Failed to initialize logger: %v", err)
    }
    defer logger.Sync()

    logger.Info("Starting portfolio service", zap.String("version", version))

    // Load and validate configuration
    cfg, err := config.LoadConfig()
    if err != nil {
        logger.Fatal("Failed to load configuration", zap.Error(err))
    }

    // Initialize database connection
    repo, err := repository.NewPostgresRepository(cfg, logger)
    if err != nil {
        logger.Fatal("Failed to initialize database", zap.Error(err))
    }
    defer repo.Close()

    // Initialize portfolio service
    portfolioService, err := services.NewPortfolioService(repo, logger)
    if err != nil {
        logger.Fatal("Failed to initialize portfolio service", zap.Error(err))
    }

    // Initialize gRPC server
    grpcServer, err := setupGRPCServer(cfg, portfolioService, logger)
    if err != nil {
        logger.Fatal("Failed to setup gRPC server", zap.Error(err))
    }

    // Start metrics server
    go func() {
        if err := setupMetricsServer(cfg); err != nil {
            logger.Error("Metrics server failed", zap.Error(err))
        }
    }()

    // Start gRPC server
    listener, err := net.Listen("tcp", fmt.Sprintf("%s:%d", cfg.Server.Host, cfg.Server.Port))
    if err != nil {
        logger.Fatal("Failed to start listener", zap.Error(err))
    }

    // Handle graceful shutdown
    sigChan := make(chan os.Signal, 1)
    signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

    go func() {
        if err := grpcServer.Serve(listener); err != nil {
            logger.Fatal("Failed to serve", zap.Error(err))
        }
    }()

    logger.Info("Portfolio service started",
        zap.String("address", listener.Addr().String()),
        zap.Int("port", cfg.Server.Port),
    )

    // Wait for shutdown signal
    sig := <-sigChan
    logger.Info("Received shutdown signal", zap.String("signal", sig.String()))

    // Create shutdown context with timeout
    ctx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
    defer cancel()

    // Initiate graceful shutdown
    stopped := make(chan struct{})
    go func() {
        grpcServer.GracefulStop()
        close(stopped)
    }()

    select {
    case <-ctx.Done():
        logger.Warn("Shutdown timeout exceeded, forcing shutdown")
        grpcServer.Stop()
    case <-stopped:
        logger.Info("Graceful shutdown completed")
    }
}

// setupGRPCServer configures and returns a new gRPC server instance
func setupGRPCServer(cfg *config.Config, svc *services.PortfolioService, logger *zap.Logger) (*grpc.Server, error) {
    // Configure server options
    opts := []grpc.ServerOption{
        grpc.KeepaliveParams(keepalive.ServerParameters{
            MaxConnectionIdle:     time.Minute * 5,
            MaxConnectionAge:      time.Hour * 4,
            MaxConnectionAgeGrace: time.Minute,
            Time:                 time.Minute,
            Timeout:             time.Second * 20,
        }),
        grpc.ChainUnaryInterceptor(
            grpc_prometheus.UnaryServerInterceptor,
        ),
        grpc.ChainStreamInterceptor(
            grpc_prometheus.StreamServerInterceptor,
        ),
    }

    // Add TLS configuration if enabled
    if cfg.Server.TLSEnabled {
        creds, err := loadTLSCredentials(cfg)
        if err != nil {
            return nil, fmt.Errorf("failed to load TLS credentials: %w", err)
        }
        opts = append(opts, grpc.Creds(creds))
    }

    // Create gRPC server
    server := grpc.NewServer(opts...)

    // Initialize portfolio handler
    portfolioHandler, err := handlers.NewPortfolioHandler(svc, logger)
    if err != nil {
        return nil, fmt.Errorf("failed to create portfolio handler: %w", err)
    }

    // Register services
    grpc_health_v1.RegisterHealthServer(server, &healthServer{})
    grpc_prometheus.Register(server)
    reflection.Register(server)

    // Enable metrics for all RPCs
    grpc_prometheus.EnableHandlingTimeHistogram()

    return server, nil
}

// setupMetricsServer initializes and starts the metrics HTTP server
func setupMetricsServer(cfg *config.Config) error {
    if !cfg.Metrics.Enabled {
        return nil
    }

    http.Handle(cfg.Metrics.Path, promhttp.Handler())
    addr := fmt.Sprintf("%s:%d", cfg.Metrics.Host, cfg.Metrics.Port)

    return http.ListenAndServe(addr, nil)
}

// healthServer implements the gRPC health check service
type healthServer struct{}

func (s *healthServer) Check(ctx context.Context, req *grpc_health_v1.HealthCheckRequest) (*grpc_health_v1.HealthCheckResponse, error) {
    return &grpc_health_v1.HealthCheckResponse{
        Status: grpc_health_v1.HealthCheckResponse_SERVING,
    }, nil
}

func (s *healthServer) Watch(*grpc_health_v1.HealthCheckRequest, grpc_health_v1.Health_WatchServer) error {
    return status.Error(codes.Unimplemented, "health check watching is not implemented")
}