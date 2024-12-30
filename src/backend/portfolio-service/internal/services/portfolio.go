// Package services implements the core business logic for portfolio management
package services

import (
    "context"
    "errors"
    "fmt"
    "sync"
    "time"

    "github.com/google/uuid"           // v1.3.0
    "github.com/shopspring/decimal"    // v1.3.1
    "go.uber.org/zap"                 // v1.24.0
    "google.golang.org/grpc/codes"    // v1.50.0
    "google.golang.org/grpc/status"   // v1.50.0

    "bookman/portfolio-service/internal/models"
    "bookman/portfolio-service/internal/repository"
)

// Common errors returned by the service
var (
    ErrInvalidPortfolio = errors.New("invalid portfolio data")
    ErrInvalidAsset = errors.New("invalid asset data")
    ErrInvalidTransaction = errors.New("invalid transaction data")
    ErrConcurrentModification = errors.New("concurrent modification detected")
    ErrRepositoryOperation = errors.New("repository operation failed")
)

// PortfolioService implements thread-safe portfolio management operations
type PortfolioService struct {
    repo    repository.PostgresRepository
    logger  *zap.Logger
    mutex   sync.RWMutex
}

// NewPortfolioService creates a new instance of the portfolio service
func NewPortfolioService(repo *repository.PostgresRepository, logger *zap.Logger) (*PortfolioService, error) {
    if repo == nil || logger == nil {
        return nil, errors.New("invalid dependencies provided")
    }

    return &PortfolioService{
        repo:   *repo,
        logger: logger.With(zap.String("service", "portfolio")),
    }, nil
}

// CreatePortfolio creates a new portfolio with validation
func (s *PortfolioService) CreatePortfolio(ctx context.Context, portfolio *models.Portfolio) (*models.Portfolio, error) {
    if err := s.validatePortfolio(portfolio); err != nil {
        return nil, fmt.Errorf("%w: %v", ErrInvalidPortfolio, err)
    }

    s.mutex.Lock()
    defer s.mutex.Unlock()

    // Generate new UUID if not provided
    if portfolio.ID == uuid.Nil {
        portfolio.ID = uuid.New()
    }

    // Set creation timestamps
    now := time.Now().UTC()
    portfolio.CreatedAt = now
    portfolio.LastUpdated = now

    // Begin transaction
    err := s.repo.WithTransaction(ctx, func(tx repository.PostgresRepository) error {
        if err := tx.CreatePortfolio(ctx, portfolio); err != nil {
            return fmt.Errorf("failed to create portfolio: %w", err)
        }
        return nil
    })

    if err != nil {
        s.logger.Error("Failed to create portfolio",
            zap.Error(err),
            zap.String("user_id", portfolio.UserID.String()),
        )
        return nil, fmt.Errorf("%w: %v", ErrRepositoryOperation, err)
    }

    s.logger.Info("Portfolio created successfully",
        zap.String("portfolio_id", portfolio.ID.String()),
        zap.String("user_id", portfolio.UserID.String()),
    )

    return portfolio, nil
}

// GetPortfolio retrieves a portfolio by ID
func (s *PortfolioService) GetPortfolio(ctx context.Context, id uuid.UUID) (*models.Portfolio, error) {
    if id == uuid.Nil {
        return nil, ErrInvalidPortfolio
    }

    s.mutex.RLock()
    defer s.mutex.RUnlock()

    portfolio, err := s.repo.GetPortfolio(ctx, id)
    if err != nil {
        s.logger.Error("Failed to retrieve portfolio",
            zap.Error(err),
            zap.String("portfolio_id", id.String()),
        )
        return nil, fmt.Errorf("%w: %v", ErrRepositoryOperation, err)
    }

    return portfolio, nil
}

// UpdatePortfolio updates an existing portfolio
func (s *PortfolioService) UpdatePortfolio(ctx context.Context, portfolio *models.Portfolio) (*models.Portfolio, error) {
    if err := s.validatePortfolio(portfolio); err != nil {
        return nil, fmt.Errorf("%w: %v", ErrInvalidPortfolio, err)
    }

    s.mutex.Lock()
    defer s.mutex.Unlock()

    portfolio.LastUpdated = time.Now().UTC()

    err := s.repo.WithTransaction(ctx, func(tx repository.PostgresRepository) error {
        if err := tx.UpdatePortfolio(ctx, portfolio); err != nil {
            return fmt.Errorf("failed to update portfolio: %w", err)
        }
        return nil
    })

    if err != nil {
        s.logger.Error("Failed to update portfolio",
            zap.Error(err),
            zap.String("portfolio_id", portfolio.ID.String()),
        )
        return nil, fmt.Errorf("%w: %v", ErrRepositoryOperation, err)
    }

    s.logger.Info("Portfolio updated successfully",
        zap.String("portfolio_id", portfolio.ID.String()),
    )

    return portfolio, nil
}

// AddAsset adds a new asset to a portfolio
func (s *PortfolioService) AddAsset(ctx context.Context, portfolioID uuid.UUID, asset *models.Asset) error {
    if err := s.validateAsset(asset); err != nil {
        return fmt.Errorf("%w: %v", ErrInvalidAsset, err)
    }

    s.mutex.Lock()
    defer s.mutex.Unlock()

    portfolio, err := s.repo.GetPortfolio(ctx, portfolioID)
    if err != nil {
        return fmt.Errorf("%w: %v", ErrRepositoryOperation, err)
    }

    if err := portfolio.AddAsset(*asset); err != nil {
        return fmt.Errorf("failed to add asset: %w", err)
    }

    err = s.repo.WithTransaction(ctx, func(tx repository.PostgresRepository) error {
        if err := tx.UpdatePortfolio(ctx, portfolio); err != nil {
            return fmt.Errorf("failed to update portfolio with new asset: %w", err)
        }
        return nil
    })

    if err != nil {
        s.logger.Error("Failed to add asset",
            zap.Error(err),
            zap.String("portfolio_id", portfolioID.String()),
            zap.String("asset_symbol", asset.Symbol),
        )
        return fmt.Errorf("%w: %v", ErrRepositoryOperation, err)
    }

    s.logger.Info("Asset added successfully",
        zap.String("portfolio_id", portfolioID.String()),
        zap.String("asset_symbol", asset.Symbol),
    )

    return nil
}

// GetPerformanceMetrics calculates portfolio performance metrics
func (s *PortfolioService) GetPerformanceMetrics(ctx context.Context, portfolioID uuid.UUID) (*models.Portfolio, error) {
    s.mutex.RLock()
    defer s.mutex.RUnlock()

    portfolio, err := s.repo.GetPortfolio(ctx, portfolioID)
    if err != nil {
        return nil, fmt.Errorf("%w: %v", ErrRepositoryOperation, err)
    }

    // Calculate total value and profit/loss
    totalValue := portfolio.CalculateTotalValue(s.getCurrentPrices())
    profitLoss := portfolio.CalculateProfitLoss()

    s.logger.Info("Performance metrics calculated",
        zap.String("portfolio_id", portfolioID.String()),
        zap.String("total_value", totalValue.String()),
        zap.String("profit_loss", profitLoss.String()),
    )

    return portfolio, nil
}

// validatePortfolio performs comprehensive portfolio validation
func (s *PortfolioService) validatePortfolio(p *models.Portfolio) error {
    if p == nil {
        return errors.New("portfolio cannot be nil")
    }

    if p.UserID == uuid.Nil {
        return errors.New("user ID is required")
    }

    if p.Name == "" {
        return errors.New("portfolio name is required")
    }

    if len(p.Assets) > models.MAX_ASSETS_PER_PORTFOLIO {
        return fmt.Errorf("portfolio exceeds maximum asset limit of %d", models.MAX_ASSETS_PER_PORTFOLIO)
    }

    return nil
}

// validateAsset performs comprehensive asset validation
func (s *PortfolioService) validateAsset(a *models.Asset) error {
    if a == nil {
        return errors.New("asset cannot be nil")
    }

    if err := models.ValidateAssetType(a.Type); err != nil {
        return err
    }

    if a.Symbol == "" {
        return errors.New("asset symbol is required")
    }

    if a.Amount.LessThan(models.MIN_TRANSACTION_AMOUNT) {
        return fmt.Errorf("asset amount must be greater than %v", models.MIN_TRANSACTION_AMOUNT)
    }

    return nil
}

// getCurrentPrices fetches current market prices for assets
// This is a placeholder - implement actual market data integration
func (s *PortfolioService) getCurrentPrices() map[string]decimal.Decimal {
    // TODO: Implement market data integration
    return make(map[string]decimal.Decimal)
}