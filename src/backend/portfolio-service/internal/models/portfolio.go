// Package models provides core data structures and business logic for portfolio management
package models

import (
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"           // v1.3.0
	"github.com/shopspring/decimal"    // v1.3.1
)

var (
	// SUPPORTED_ASSET_TYPES defines the valid asset types that can be managed
	SUPPORTED_ASSET_TYPES = []string{
		"cryptocurrency",
		"token",
		"nft",
		"defi_lp",
		"staked_asset",
	}

	// SUPPORTED_TRANSACTION_TYPES defines valid transaction operations
	SUPPORTED_TRANSACTION_TYPES = []string{
		"buy",
		"sell",
		"transfer_in",
		"transfer_out",
		"stake",
		"unstake",
		"reward",
		"fee",
	}

	// MIN_TRANSACTION_AMOUNT defines the smallest allowed transaction value
	MIN_TRANSACTION_AMOUNT = decimal.NewFromFloat(0.000000001)

	// MAX_ASSETS_PER_PORTFOLIO defines the maximum number of assets per portfolio
	MAX_ASSETS_PER_PORTFOLIO = 1000

	// Common errors
	ErrInvalidAssetType      = errors.New("invalid asset type")
	ErrInvalidTransactionType = errors.New("invalid transaction type")
	ErrPortfolioFull         = errors.New("portfolio has reached maximum asset limit")
	ErrInvalidAmount         = errors.New("transaction amount below minimum threshold")
)

// Asset represents a single asset holding within a portfolio
type Asset struct {
	ID            uuid.UUID       `json:"id"`
	Type          string         `json:"type"`
	Symbol        string         `json:"symbol"`
	Amount        decimal.Decimal `json:"amount"`
	CostBasis     decimal.Decimal `json:"cost_basis"`
	CurrentValue  decimal.Decimal `json:"current_value"`
	LastUpdated   time.Time      `json:"last_updated"`
}

// Transaction represents a portfolio transaction
type Transaction struct {
	ID            uuid.UUID       `json:"id"`
	PortfolioID   uuid.UUID       `json:"portfolio_id"`
	AssetID       uuid.UUID       `json:"asset_id"`
	Type          string         `json:"type"`
	Amount        decimal.Decimal `json:"amount"`
	Price         decimal.Decimal `json:"price"`
	Timestamp     time.Time      `json:"timestamp"`
	Fee           decimal.Decimal `json:"fee"`
}

// Portfolio represents a user's portfolio with thread-safe operations
type Portfolio struct {
	mutex       sync.RWMutex    // Ensures thread-safe operations
	ID          uuid.UUID       `json:"id"`
	UserID      uuid.UUID       `json:"user_id"`
	Name        string         `json:"name"`
	Description string         `json:"description"`
	Assets      []Asset        `json:"assets"`
	TotalValue  decimal.Decimal `json:"total_value"`
	ProfitLoss  decimal.Decimal `json:"profit_loss"`
	LastUpdated time.Time      `json:"last_updated"`
	CreatedAt   time.Time      `json:"created_at"`
}

// NewPortfolio creates a new portfolio instance with initialized values
func NewPortfolio(userID uuid.UUID, name, description string) *Portfolio {
	return &Portfolio{
		ID:          uuid.New(),
		UserID:      userID,
		Name:        name,
		Description: description,
		Assets:      make([]Asset, 0),
		TotalValue:  decimal.Zero,
		ProfitLoss:  decimal.Zero,
		LastUpdated: time.Now().UTC(),
		CreatedAt:   time.Now().UTC(),
	}
}

// ValidateAssetType checks if the given asset type is supported
func ValidateAssetType(assetType string) error {
	for _, supported := range SUPPORTED_ASSET_TYPES {
		if assetType == supported {
			return nil
		}
	}
	return fmt.Errorf("%w: %s", ErrInvalidAssetType, assetType)
}

// ValidateTransactionType validates transaction type compatibility
func ValidateTransactionType(transactionType, assetType string) error {
	// First validate basic transaction type
	validType := false
	for _, supported := range SUPPORTED_TRANSACTION_TYPES {
		if transactionType == supported {
			validType = true
			break
		}
	}
	if !validType {
		return fmt.Errorf("%w: %s", ErrInvalidTransactionType, transactionType)
	}

	// Validate type-specific constraints
	switch assetType {
	case "nft":
		if transactionType == "stake" || transactionType == "unstake" {
			return fmt.Errorf("transaction type %s not supported for NFTs", transactionType)
		}
	case "staked_asset":
		if transactionType != "stake" && transactionType != "unstake" && transactionType != "reward" {
			return fmt.Errorf("invalid transaction type %s for staked assets", transactionType)
		}
	}

	return nil
}

// AddAsset adds a new asset to the portfolio
func (p *Portfolio) AddAsset(asset Asset) error {
	p.mutex.Lock()
	defer p.mutex.Unlock()

	if len(p.Assets) >= MAX_ASSETS_PER_PORTFOLIO {
		return ErrPortfolioFull
	}

	if err := ValidateAssetType(asset.Type); err != nil {
		return err
	}

	p.Assets = append(p.Assets, asset)
	p.LastUpdated = time.Now().UTC()
	return nil
}

// CalculateTotalValue computes the total portfolio value
func (p *Portfolio) CalculateTotalValue(currentPrices map[string]decimal.Decimal) decimal.Decimal {
	p.mutex.Lock()
	defer p.mutex.Unlock()

	total := decimal.Zero
	for i := range p.Assets {
		if price, exists := currentPrices[p.Assets[i].Symbol]; exists {
			assetValue := p.Assets[i].Amount.Mul(price)
			total = total.Add(assetValue)
			p.Assets[i].CurrentValue = assetValue
			p.Assets[i].LastUpdated = time.Now().UTC()
		}
	}

	p.TotalValue = total
	p.LastUpdated = time.Now().UTC()
	return total
}

// CalculateProfitLoss computes the total profit/loss
func (p *Portfolio) CalculateProfitLoss() decimal.Decimal {
	p.mutex.RLock()
	defer p.mutex.RUnlock()

	totalCostBasis := decimal.Zero
	for _, asset := range p.Assets {
		totalCostBasis = totalCostBasis.Add(asset.CostBasis)
	}

	p.ProfitLoss = p.TotalValue.Sub(totalCostBasis)
	return p.ProfitLoss
}

// GetAsset retrieves an asset by ID
func (p *Portfolio) GetAsset(assetID uuid.UUID) (*Asset, error) {
	p.mutex.RLock()
	defer p.mutex.RUnlock()

	for i := range p.Assets {
		if p.Assets[i].ID == assetID {
			return &p.Assets[i], nil
		}
	}
	return nil, fmt.Errorf("asset not found: %s", assetID)
}

// UpdateAsset updates an existing asset's details
func (p *Portfolio) UpdateAsset(assetID uuid.UUID, amount decimal.Decimal) error {
	p.mutex.Lock()
	defer p.mutex.Unlock()

	for i := range p.Assets {
		if p.Assets[i].ID == assetID {
			if amount.LessThan(MIN_TRANSACTION_AMOUNT) && !amount.IsZero() {
				return ErrInvalidAmount
			}
			p.Assets[i].Amount = amount
			p.Assets[i].LastUpdated = time.Now().UTC()
			p.LastUpdated = time.Now().UTC()
			return nil
		}
	}
	return fmt.Errorf("asset not found: %s", assetID)
}