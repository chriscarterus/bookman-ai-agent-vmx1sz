// Package handlers implements gRPC server handlers for the portfolio service
package handlers

import (
    "context"
    "fmt"
    "sync"
    "time"

    "github.com/google/uuid"                                  // v1.3.0
    "github.com/prometheus/client_golang/prometheus"          // v1.15.0
    "go.uber.org/zap"                                        // v1.24.0
    "google.golang.org/grpc/codes"                           // v1.50.0
    "google.golang.org/grpc/status"                          // v1.50.0

    "bookman/portfolio-service/internal/models"
    "bookman/portfolio-service/internal/services"
)

// Define common error responses
var (
    errInvalidRequest = status.Error(codes.InvalidArgument, "invalid request parameters")
    errNotFound      = status.Error(codes.NotFound, "portfolio not found")
    errInternal      = status.Error(codes.Internal, "internal server error")
)

// Define metrics collectors
var (
    requestMetrics = prometheus.NewCounterVec(
        prometheus.CounterOpts{
            Name: "portfolio_requests_total",
            Help: "Total number of portfolio requests",
        },
        []string{"method", "status"},
    )

    latencyMetrics = prometheus.NewHistogramVec(
        prometheus.HistogramOpts{
            Name: "portfolio_request_duration_seconds",
            Help: "Request latency in seconds",
            Buckets: []float64{.005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5, 10},
        },
        []string{"method"},
    )
)

func init() {
    // Register metrics with Prometheus
    prometheus.MustRegister(requestMetrics)
    prometheus.MustRegister(latencyMetrics)
}

// PortfolioHandler implements the gRPC server handlers with thread safety
type PortfolioHandler struct {
    portfolioService *services.PortfolioService
    logger          *zap.Logger
    mutex           sync.RWMutex
}

// NewPortfolioHandler creates a new portfolio handler instance
func NewPortfolioHandler(svc *services.PortfolioService, logger *zap.Logger) (*PortfolioHandler, error) {
    if svc == nil || logger == nil {
        return nil, fmt.Errorf("invalid dependencies provided")
    }

    return &PortfolioHandler{
        portfolioService: svc,
        logger:          logger.With(zap.String("component", "portfolio_handler")),
    }, nil
}

// CreatePortfolio handles portfolio creation requests
func (h *PortfolioHandler) CreatePortfolio(ctx context.Context, req *models.CreatePortfolioRequest) (*models.CreatePortfolioResponse, error) {
    startTime := time.Now()
    method := "CreatePortfolio"

    defer func() {
        latencyMetrics.WithLabelValues(method).Observe(time.Since(startTime).Seconds())
    }()

    // Validate request
    if err := h.validateCreateRequest(req); err != nil {
        requestMetrics.WithLabelValues(method, "error").Inc()
        h.logger.Error("Invalid create portfolio request",
            zap.Error(err),
            zap.Any("request", req),
        )
        return nil, errInvalidRequest
    }

    h.mutex.Lock()
    defer h.mutex.Unlock()

    // Create portfolio model
    portfolio := &models.Portfolio{
        UserID:      uuid.MustParse(req.UserId),
        Name:        req.Name,
        Description: req.Description,
    }

    // Call service layer
    createdPortfolio, err := h.portfolioService.CreatePortfolio(ctx, portfolio)
    if err != nil {
        requestMetrics.WithLabelValues(method, "error").Inc()
        h.logger.Error("Failed to create portfolio",
            zap.Error(err),
            zap.String("user_id", req.UserId),
        )
        return nil, errInternal
    }

    requestMetrics.WithLabelValues(method, "success").Inc()
    h.logger.Info("Portfolio created successfully",
        zap.String("portfolio_id", createdPortfolio.ID.String()),
        zap.String("user_id", req.UserId),
    )

    // Convert to response
    return &models.CreatePortfolioResponse{
        Portfolio: h.convertToProtoPortfolio(createdPortfolio),
    }, nil
}

// GetPortfolio handles portfolio retrieval requests
func (h *PortfolioHandler) GetPortfolio(ctx context.Context, req *models.GetPortfolioRequest) (*models.GetPortfolioResponse, error) {
    startTime := time.Now()
    method := "GetPortfolio"

    defer func() {
        latencyMetrics.WithLabelValues(method).Observe(time.Since(startTime).Seconds())
    }()

    // Validate request
    portfolioID, err := uuid.Parse(req.PortfolioId)
    if err != nil {
        requestMetrics.WithLabelValues(method, "error").Inc()
        h.logger.Error("Invalid portfolio ID",
            zap.Error(err),
            zap.String("portfolio_id", req.PortfolioId),
        )
        return nil, errInvalidRequest
    }

    h.mutex.RLock()
    defer h.mutex.RUnlock()

    // Call service layer
    portfolio, err := h.portfolioService.GetPortfolio(ctx, portfolioID)
    if err != nil {
        requestMetrics.WithLabelValues(method, "error").Inc()
        h.logger.Error("Failed to get portfolio",
            zap.Error(err),
            zap.String("portfolio_id", req.PortfolioId),
        )
        return nil, h.mapServiceError(err)
    }

    requestMetrics.WithLabelValues(method, "success").Inc()
    h.logger.Info("Portfolio retrieved successfully",
        zap.String("portfolio_id", req.PortfolioId),
    )

    return &models.GetPortfolioResponse{
        Portfolio: h.convertToProtoPortfolio(portfolio),
    }, nil
}

// UpdatePortfolio handles portfolio update requests
func (h *PortfolioHandler) UpdatePortfolio(ctx context.Context, req *models.UpdatePortfolioRequest) (*models.UpdatePortfolioResponse, error) {
    startTime := time.Now()
    method := "UpdatePortfolio"

    defer func() {
        latencyMetrics.WithLabelValues(method).Observe(time.Since(startTime).Seconds())
    }()

    // Validate request
    if err := h.validateUpdateRequest(req); err != nil {
        requestMetrics.WithLabelValues(method, "error").Inc()
        h.logger.Error("Invalid update portfolio request",
            zap.Error(err),
            zap.Any("request", req),
        )
        return nil, errInvalidRequest
    }

    h.mutex.Lock()
    defer h.mutex.Unlock()

    // Convert request to model
    portfolio := &models.Portfolio{
        ID:          uuid.MustParse(req.Portfolio.Id),
        UserID:      uuid.MustParse(req.Portfolio.UserId),
        Name:        req.Portfolio.Name,
        Description: req.Portfolio.Description,
    }

    // Call service layer
    updatedPortfolio, err := h.portfolioService.UpdatePortfolio(ctx, portfolio)
    if err != nil {
        requestMetrics.WithLabelValues(method, "error").Inc()
        h.logger.Error("Failed to update portfolio",
            zap.Error(err),
            zap.String("portfolio_id", req.Portfolio.Id),
        )
        return nil, h.mapServiceError(err)
    }

    requestMetrics.WithLabelValues(method, "success").Inc()
    h.logger.Info("Portfolio updated successfully",
        zap.String("portfolio_id", req.Portfolio.Id),
    )

    return &models.UpdatePortfolioResponse{
        Portfolio: h.convertToProtoPortfolio(updatedPortfolio),
    }, nil
}

// Helper functions

func (h *PortfolioHandler) validateCreateRequest(req *models.CreatePortfolioRequest) error {
    if req == nil {
        return fmt.Errorf("nil request")
    }

    if _, err := uuid.Parse(req.UserId); err != nil {
        return fmt.Errorf("invalid user ID: %v", err)
    }

    if req.Name == "" {
        return fmt.Errorf("portfolio name is required")
    }

    return nil
}

func (h *PortfolioHandler) validateUpdateRequest(req *models.UpdatePortfolioRequest) error {
    if req == nil || req.Portfolio == nil {
        return fmt.Errorf("nil request or portfolio")
    }

    if _, err := uuid.Parse(req.Portfolio.Id); err != nil {
        return fmt.Errorf("invalid portfolio ID: %v", err)
    }

    if _, err := uuid.Parse(req.Portfolio.UserId); err != nil {
        return fmt.Errorf("invalid user ID: %v", err)
    }

    if req.Portfolio.Name == "" {
        return fmt.Errorf("portfolio name is required")
    }

    return nil
}

func (h *PortfolioHandler) mapServiceError(err error) error {
    switch err {
    case services.ErrInvalidPortfolio:
        return errInvalidRequest
    case services.ErrRepositoryOperation:
        return errInternal
    default:
        return errInternal
    }
}

func (h *PortfolioHandler) convertToProtoPortfolio(p *models.Portfolio) *models.PortfolioProto {
    if p == nil {
        return nil
    }

    assets := make([]*models.AssetProto, len(p.Assets))
    for i, asset := range p.Assets {
        assets[i] = &models.AssetProto{
            Id:           asset.ID.String(),
            Type:        asset.Type,
            Symbol:      asset.Symbol,
            Amount:      asset.Amount.String(),
            CostBasis:   asset.CostBasis.String(),
            CurrentValue: asset.CurrentValue.String(),
            LastUpdated: asset.LastUpdated.Unix(),
        }
    }

    return &models.PortfolioProto{
        Id:          p.ID.String(),
        UserId:      p.UserID.String(),
        Name:        p.Name,
        Description: p.Description,
        Assets:      assets,
        TotalValue:  p.TotalValue.String(),
        ProfitLoss:  p.ProfitLoss.String(),
        CreatedAt:   p.CreatedAt.Unix(),
        LastUpdated: p.LastUpdated.Unix(),
    }
}