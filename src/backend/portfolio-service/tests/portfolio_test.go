// Package tests provides comprehensive unit tests for the portfolio service
package tests

import (
    "context"
    "sync"
    "testing"
    "time"

    "github.com/google/uuid"           // v1.3.0
    "github.com/shopspring/decimal"    // v1.3.1
    "github.com/stretchr/testify/assert"    // v1.8.0
    "github.com/stretchr/testify/mock"      // v1.8.0
    "github.com/stretchr/testify/require"   // v1.8.0

    "bookman/portfolio-service/internal/models"
    "bookman/portfolio-service/internal/services"
    "bookman/portfolio-service/internal/repository"
)

const (
    testTimeout = 5 * time.Second
)

// mockPostgresRepository provides a thread-safe mock implementation of PostgresRepository
type mockPostgresRepository struct {
    mock.Mock
    mutex sync.RWMutex
}

func (m *mockPostgresRepository) CreatePortfolio(ctx context.Context, p *models.Portfolio) error {
    m.mutex.Lock()
    defer m.mutex.Unlock()
    args := m.Called(ctx, p)
    return args.Error(0)
}

func (m *mockPostgresRepository) GetPortfolio(ctx context.Context, id uuid.UUID) (*models.Portfolio, error) {
    m.mutex.Lock()
    defer m.mutex.Unlock()
    args := m.Called(ctx, id)
    if p := args.Get(0); p != nil {
        return p.(*models.Portfolio), args.Error(1)
    }
    return nil, args.Error(1)
}

func (m *mockPostgresRepository) UpdatePortfolio(ctx context.Context, p *models.Portfolio) error {
    m.mutex.Lock()
    defer m.mutex.Unlock()
    args := m.Called(ctx, p)
    return args.Error(0)
}

func (m *mockPostgresRepository) DeletePortfolio(ctx context.Context, id uuid.UUID) error {
    m.mutex.Lock()
    defer m.mutex.Unlock()
    args := m.Called(ctx, id)
    return args.Error(0)
}

func (m *mockPostgresRepository) WithTransaction(ctx context.Context, fn func(repository.PostgresRepository) error) error {
    m.mutex.Lock()
    defer m.mutex.Unlock()
    args := m.Called(ctx, fn)
    return args.Error(0)
}

// setupTestPortfolioService creates a new portfolio service instance with mocked dependencies
func setupTestPortfolioService(t *testing.T) (*services.PortfolioService, *mockPostgresRepository, context.Context, context.CancelFunc) {
    t.Helper()
    
    ctx, cancel := context.WithTimeout(context.Background(), testTimeout)
    mockRepo := new(mockPostgresRepository)
    
    service, err := services.NewPortfolioService(mockRepo, nil)
    require.NoError(t, err)
    require.NotNil(t, service)
    
    return service, mockRepo, ctx, cancel
}

// TestPortfolioCRUD tests all CRUD operations for portfolios
func TestPortfolioCRUD(t *testing.T) {
    t.Parallel()

    testCases := []struct {
        name     string
        setup    func(*mockPostgresRepository)
        test     func(*testing.T, *services.PortfolioService, context.Context)
        validate func(*testing.T, *mockPostgresRepository)
    }{
        {
            name: "Create Portfolio Success",
            setup: func(repo *mockPostgresRepository) {
                repo.On("WithTransaction", mock.Anything, mock.AnythingOfType("func(repository.PostgresRepository) error")).
                    Return(nil)
            },
            test: func(t *testing.T, s *services.PortfolioService, ctx context.Context) {
                portfolio := &models.Portfolio{
                    UserID:      uuid.New(),
                    Name:        "Test Portfolio",
                    Description: "Test Description",
                    Assets:      make([]models.Asset, 0),
                }
                
                result, err := s.CreatePortfolio(ctx, portfolio)
                require.NoError(t, err)
                assert.NotNil(t, result)
                assert.NotEqual(t, uuid.Nil, result.ID)
            },
            validate: func(t *testing.T, repo *mockPostgresRepository) {
                repo.AssertExpectations(t)
            },
        },
        {
            name: "Get Portfolio Success",
            setup: func(repo *mockPostgresRepository) {
                portfolio := &models.Portfolio{
                    ID:          uuid.New(),
                    UserID:      uuid.New(),
                    Name:        "Test Portfolio",
                    Description: "Test Description",
                    Assets:      make([]models.Asset, 0),
                    CreatedAt:   time.Now().UTC(),
                }
                repo.On("GetPortfolio", mock.Anything, mock.AnythingOfType("uuid.UUID")).
                    Return(portfolio, nil)
            },
            test: func(t *testing.T, s *services.PortfolioService, ctx context.Context) {
                result, err := s.GetPortfolio(ctx, uuid.New())
                require.NoError(t, err)
                assert.NotNil(t, result)
            },
            validate: func(t *testing.T, repo *mockPostgresRepository) {
                repo.AssertExpectations(t)
            },
        },
    }

    for _, tc := range testCases {
        tc := tc // Capture range variable
        t.Run(tc.name, func(t *testing.T) {
            t.Parallel()
            service, mockRepo, ctx, cancel := setupTestPortfolioService(t)
            defer cancel()

            tc.setup(mockRepo)
            tc.test(t, service, ctx)
            tc.validate(t, mockRepo)
        })
    }
}

// TestConcurrentOperations tests thread safety of portfolio operations
func TestConcurrentOperations(t *testing.T) {
    t.Parallel()
    
    service, mockRepo, ctx, cancel := setupTestPortfolioService(t)
    defer cancel()

    // Setup mock expectations for concurrent operations
    portfolio := &models.Portfolio{
        ID:          uuid.New(),
        UserID:      uuid.New(),
        Name:        "Concurrent Test Portfolio",
        Description: "Testing concurrent operations",
        Assets:      make([]models.Asset, 0),
    }

    mockRepo.On("GetPortfolio", mock.Anything, mock.AnythingOfType("uuid.UUID")).
        Return(portfolio, nil)
    mockRepo.On("WithTransaction", mock.Anything, mock.AnythingOfType("func(repository.PostgresRepository) error")).
        Return(nil)

    // Test concurrent portfolio operations
    var wg sync.WaitGroup
    numOperations := 10

    for i := 0; i < numOperations; i++ {
        wg.Add(1)
        go func() {
            defer wg.Done()

            // Perform random portfolio operations
            asset := models.Asset{
                ID:           uuid.New(),
                Type:        "cryptocurrency",
                Symbol:      "BTC",
                Amount:      decimal.NewFromFloat(1.0),
                CostBasis:   decimal.NewFromFloat(50000.0),
                LastUpdated: time.Now().UTC(),
            }

            err := service.AddAsset(ctx, portfolio.ID, &asset)
            assert.NoError(t, err)
        }()
    }

    wg.Wait()
    mockRepo.AssertExpectations(t)
}

// TestErrorScenarios tests various error conditions
func TestErrorScenarios(t *testing.T) {
    t.Parallel()

    testCases := []struct {
        name        string
        setup       func(*mockPostgresRepository)
        test        func(*testing.T, *services.PortfolioService, context.Context)
        expectedErr error
    }{
        {
            name: "Portfolio Not Found",
            setup: func(repo *mockPostgresRepository) {
                repo.On("GetPortfolio", mock.Anything, mock.AnythingOfType("uuid.UUID")).
                    Return(nil, repository.ErrPortfolioNotFound)
            },
            test: func(t *testing.T, s *services.PortfolioService, ctx context.Context) {
                _, err := s.GetPortfolio(ctx, uuid.New())
                assert.Error(t, err)
                assert.ErrorIs(t, err, services.ErrRepositoryOperation)
            },
            expectedErr: repository.ErrPortfolioNotFound,
        },
        {
            name: "Invalid Portfolio Data",
            setup: func(repo *mockPostgresRepository) {
                // No mock setup needed - validation happens before repository call
            },
            test: func(t *testing.T, s *services.PortfolioService, ctx context.Context) {
                _, err := s.CreatePortfolio(ctx, &models.Portfolio{})
                assert.Error(t, err)
                assert.ErrorIs(t, err, services.ErrInvalidPortfolio)
            },
            expectedErr: services.ErrInvalidPortfolio,
        },
    }

    for _, tc := range testCases {
        tc := tc // Capture range variable
        t.Run(tc.name, func(t *testing.T) {
            t.Parallel()
            service, mockRepo, ctx, cancel := setupTestPortfolioService(t)
            defer cancel()

            tc.setup(mockRepo)
            tc.test(t, service, ctx)
            mockRepo.AssertExpectations(t)
        })
    }
}

// TestPerformanceMetrics tests portfolio performance calculations
func TestPerformanceMetrics(t *testing.T) {
    t.Parallel()
    
    service, mockRepo, ctx, cancel := setupTestPortfolioService(t)
    defer cancel()

    // Create test portfolio with assets
    portfolio := &models.Portfolio{
        ID:     uuid.New(),
        UserID: uuid.New(),
        Assets: []models.Asset{
            {
                ID:           uuid.New(),
                Type:        "cryptocurrency",
                Symbol:      "BTC",
                Amount:      decimal.NewFromFloat(2.0),
                CostBasis:   decimal.NewFromFloat(80000.0),
                LastUpdated: time.Now().UTC(),
            },
            {
                ID:           uuid.New(),
                Type:        "cryptocurrency",
                Symbol:      "ETH",
                Amount:      decimal.NewFromFloat(10.0),
                CostBasis:   decimal.NewFromFloat(30000.0),
                LastUpdated: time.Now().UTC(),
            },
        },
    }

    mockRepo.On("GetPortfolio", mock.Anything, portfolio.ID).
        Return(portfolio, nil)

    // Test performance metrics calculation
    result, err := service.GetPerformanceMetrics(ctx, portfolio.ID)
    require.NoError(t, err)
    assert.NotNil(t, result)
    
    // Verify calculations
    assert.True(t, result.TotalValue.IsPositive())
    assert.NotNil(t, result.ProfitLoss)
    
    mockRepo.AssertExpectations(t)
}