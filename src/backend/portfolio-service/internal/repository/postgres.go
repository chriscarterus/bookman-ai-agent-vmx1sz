// Package repository implements the data access layer for the portfolio service
package repository

import (
    "context"
    "database/sql"
    "errors"
    "fmt"
    "sync"
    "time"

    "github.com/lib/pq"           // v1.10.9
    "github.com/prometheus/client_golang/prometheus" // v1.16.0
    "go.uber.org/zap"            // v1.24.0
    
    "github.com/google/uuid"
    
    "bookman/portfolio-service/internal/config"
    "bookman/portfolio-service/internal/models"
)

// Common errors returned by the repository
var (
    ErrPortfolioNotFound  = errors.New("portfolio not found")
    ErrAssetNotFound      = errors.New("asset not found")
    ErrTransactionFailed  = errors.New("transaction failed")
    ErrInvalidPortfolio   = errors.New("invalid portfolio data")
    ErrDatabaseConnection = errors.New("database connection error")
)

// Metrics keys for monitoring database operations
const (
    metricQueryDuration = "portfolio_db_query_duration_seconds"
    metricQueryTotal    = "portfolio_db_query_total"
    metricQueryErrors   = "portfolio_db_query_errors_total"
    metricConnections   = "portfolio_db_connections"
)

// PostgresRepository implements thread-safe database operations for portfolios
type PostgresRepository struct {
    db        *sql.DB
    logger    *zap.Logger
    metrics   *prometheus.Registry
    stmts     map[string]*sql.Stmt
    stmtMutex sync.RWMutex
}

// preparedStatements contains all SQL prepared statement queries
var preparedStatements = map[string]string{
    "createPortfolio": `
        INSERT INTO portfolios (id, user_id, name, description, total_value, profit_loss, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id`,
    "getPortfolio": `
        SELECT id, user_id, name, description, total_value, profit_loss, created_at, updated_at
        FROM portfolios
        WHERE id = $1 AND deleted_at IS NULL`,
    "updatePortfolio": `
        UPDATE portfolios
        SET name = $2, description = $3, total_value = $4, profit_loss = $5, updated_at = $6
        WHERE id = $1 AND deleted_at IS NULL
        RETURNING id`,
    "deletePortfolio": `
        UPDATE portfolios
        SET deleted_at = $2
        WHERE id = $1 AND deleted_at IS NULL`,
    "createAsset": `
        INSERT INTO portfolio_assets (id, portfolio_id, type, symbol, amount, cost_basis, current_value, last_updated)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    "getAssets": `
        SELECT id, type, symbol, amount, cost_basis, current_value, last_updated
        FROM portfolio_assets
        WHERE portfolio_id = $1 AND deleted_at IS NULL`,
}

// NewPostgresRepository creates a new PostgreSQL repository instance
func NewPostgresRepository(cfg *config.Config, logger *zap.Logger) (*PostgresRepository, error) {
    if cfg == nil || logger == nil {
        return nil, errors.New("invalid configuration or logger")
    }

    // Construct connection string with SSL settings
    connStr := fmt.Sprintf(
        "host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
        cfg.Database.Host,
        cfg.Database.Port,
        cfg.Database.User,
        cfg.Database.Password,
        cfg.Database.Database,
        cfg.Database.SSLMode,
    )

    // Add SSL certificate configuration if provided
    if cfg.Database.SSLCert != "" {
        connStr += fmt.Sprintf(" sslcert=%s sslkey=%s sslrootcert=%s",
            cfg.Database.SSLCert,
            cfg.Database.SSLKey,
            cfg.Database.SSLRootCert,
        )
    }

    // Initialize database connection
    db, err := sql.Open("postgres", connStr)
    if err != nil {
        return nil, fmt.Errorf("failed to connect to database: %w", err)
    }

    // Configure connection pool
    db.SetMaxOpenConns(cfg.Database.MaxOpenConns)
    db.SetMaxIdleConns(cfg.Database.MaxIdleConns)
    db.SetConnMaxLifetime(cfg.Database.ConnMaxLifetime)
    db.SetConnMaxIdleTime(cfg.Database.ConnMaxIdleTime)

    // Initialize repository instance
    repo := &PostgresRepository{
        db:      db,
        logger:  logger,
        metrics: prometheus.NewRegistry(),
        stmts:   make(map[string]*sql.Stmt),
    }

    // Initialize metrics collectors
    repo.initMetrics()

    // Prepare statements
    if err := repo.prepareStatements(); err != nil {
        db.Close()
        return nil, fmt.Errorf("failed to prepare statements: %w", err)
    }

    // Verify connection
    if err := db.Ping(); err != nil {
        db.Close()
        return nil, fmt.Errorf("failed to ping database: %w", err)
    }

    return repo, nil
}

// initMetrics initializes Prometheus metrics collectors
func (r *PostgresRepository) initMetrics() {
    // Query duration histogram
    prometheus.MustRegister(prometheus.NewHistogramVec(
        prometheus.HistogramOpts{
            Name: metricQueryDuration,
            Help: "Duration of database queries in seconds",
        },
        []string{"operation"},
    ))

    // Query counter
    prometheus.MustRegister(prometheus.NewCounterVec(
        prometheus.CounterOpts{
            Name: metricQueryTotal,
            Help: "Total number of database queries",
        },
        []string{"operation"},
    ))

    // Error counter
    prometheus.MustRegister(prometheus.NewCounterVec(
        prometheus.CounterOpts{
            Name: metricQueryErrors,
            Help: "Total number of database query errors",
        },
        []string{"operation"},
    ))

    // Connection gauge
    prometheus.MustRegister(prometheus.NewGauge(
        prometheus.GaugeOpts{
            Name: metricConnections,
            Help: "Current number of database connections",
        },
    ))
}

// prepareStatements prepares all SQL statements
func (r *PostgresRepository) prepareStatements() error {
    r.stmtMutex.Lock()
    defer r.stmtMutex.Unlock()

    for name, query := range preparedStatements {
        stmt, err := r.db.Prepare(query)
        if err != nil {
            return fmt.Errorf("failed to prepare statement %s: %w", name, err)
        }
        r.stmts[name] = stmt
    }
    return nil
}

// CreatePortfolio creates a new portfolio with transaction support
func (r *PostgresRepository) CreatePortfolio(ctx context.Context, p *models.Portfolio) error {
    if p == nil {
        return ErrInvalidPortfolio
    }

    // Start transaction
    tx, err := r.db.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelSerializable})
    if err != nil {
        return fmt.Errorf("failed to begin transaction: %w", err)
    }
    defer tx.Rollback()

    // Execute prepared statement within transaction
    start := time.Now()
    _, err = tx.StmtContext(ctx, r.stmts["createPortfolio"]).ExecContext(ctx,
        p.ID,
        p.UserID,
        p.Name,
        p.Description,
        p.TotalValue,
        p.ProfitLoss,
        p.CreatedAt,
        p.LastUpdated,
    )
    
    // Record metrics
    duration := time.Since(start).Seconds()
    prometheus.NewHistogram(prometheus.HistogramOpts{
        Name: metricQueryDuration,
    }).Observe(duration)

    if err != nil {
        prometheus.NewCounter(prometheus.CounterOpts{
            Name: metricQueryErrors,
        }).Inc()
        return fmt.Errorf("failed to create portfolio: %w", err)
    }

    // Create assets in batch if any exist
    if len(p.Assets) > 0 {
        stmt := r.stmts["createAsset"]
        for _, asset := range p.Assets {
            _, err = tx.StmtContext(ctx, stmt).ExecContext(ctx,
                asset.ID,
                p.ID,
                asset.Type,
                asset.Symbol,
                asset.Amount,
                asset.CostBasis,
                asset.CurrentValue,
                asset.LastUpdated,
            )
            if err != nil {
                return fmt.Errorf("failed to create asset: %w", err)
            }
        }
    }

    // Commit transaction
    if err := tx.Commit(); err != nil {
        return fmt.Errorf("failed to commit transaction: %w", err)
    }

    prometheus.NewCounter(prometheus.CounterOpts{
        Name: metricQueryTotal,
    }).Inc()

    r.logger.Info("Portfolio created successfully",
        zap.String("portfolio_id", p.ID.String()),
        zap.String("user_id", p.UserID.String()),
    )

    return nil
}

// Close closes the database connection and prepared statements
func (r *PostgresRepository) Close() error {
    r.stmtMutex.Lock()
    defer r.stmtMutex.Unlock()

    for _, stmt := range r.stmts {
        if err := stmt.Close(); err != nil {
            r.logger.Error("Failed to close prepared statement", zap.Error(err))
        }
    }

    return r.db.Close()
}