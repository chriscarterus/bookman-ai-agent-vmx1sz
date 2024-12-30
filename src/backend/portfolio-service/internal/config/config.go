// Package config provides configuration management for the portfolio service
// with comprehensive validation and security features.
package config

import (
	"errors"
	"fmt"
	"os"
	"time"

	"github.com/spf13/viper" // v1.15.0
)

const (
	defaultConfigPath = "/etc/portfolio-service/config.yaml"
	defaultDBPort    = 5432
	defaultServerPort = 8080
	defaultMetricsPort = 9090
)

// Config represents the main configuration structure containing all service settings
type Config struct {
	Database DatabaseConfig `mapstructure:"database"`
	Server   ServerConfig   `mapstructure:"server"`
	Metrics  MetricsConfig  `mapstructure:"metrics"`
	Cache    CacheConfig    `mapstructure:"cache"`
	Version  string         `mapstructure:"version"`
}

// DatabaseConfig contains comprehensive database connection settings
type DatabaseConfig struct {
	Host            string        `mapstructure:"host"`
	Port            int           `mapstructure:"port"`
	User            string        `mapstructure:"user"`
	Password        string        `mapstructure:"password"`
	Database        string        `mapstructure:"database"`
	SSLMode         string        `mapstructure:"ssl_mode"`
	SSLCert         string        `mapstructure:"ssl_cert"`
	SSLKey          string        `mapstructure:"ssl_key"`
	SSLRootCert     string        `mapstructure:"ssl_root_cert"`
	MaxOpenConns    int           `mapstructure:"max_open_conns"`
	MaxIdleConns    int           `mapstructure:"max_idle_conns"`
	ConnMaxLifetime time.Duration `mapstructure:"conn_max_lifetime"`
	ConnMaxIdleTime time.Duration `mapstructure:"conn_max_idle_time"`
	StatementTimeout time.Duration `mapstructure:"statement_timeout"`
}

// ServerConfig contains API server configuration settings
type ServerConfig struct {
	Host            string        `mapstructure:"host"`
	Port            int           `mapstructure:"port"`
	ReadTimeout     time.Duration `mapstructure:"read_timeout"`
	WriteTimeout    time.Duration `mapstructure:"write_timeout"`
	IdleTimeout     time.Duration `mapstructure:"idle_timeout"`
	ShutdownTimeout time.Duration `mapstructure:"shutdown_timeout"`
	MaxHeaderBytes  int           `mapstructure:"max_header_bytes"`
	TLSEnabled      bool          `mapstructure:"tls_enabled"`
	TLSCert         string        `mapstructure:"tls_cert"`
	TLSKey          string        `mapstructure:"tls_key"`
}

// MetricsConfig contains metrics and monitoring configuration
type MetricsConfig struct {
	Enabled            bool              `mapstructure:"enabled"`
	Host               string            `mapstructure:"host"`
	Port               int               `mapstructure:"port"`
	Path               string            `mapstructure:"path"`
	CollectionInterval time.Duration     `mapstructure:"collection_interval"`
	Labels             map[string]string `mapstructure:"labels"`
}

// CacheConfig contains Redis cache configuration settings
type CacheConfig struct {
	Enabled       bool          `mapstructure:"enabled"`
	Host          string        `mapstructure:"host"`
	Port          int           `mapstructure:"port"`
	Password      string        `mapstructure:"password"`
	DB            int           `mapstructure:"db"`
	TTL           time.Duration `mapstructure:"ttl"`
	PoolSize      int           `mapstructure:"pool_size"`
	MinIdleConns  int           `mapstructure:"min_idle_conns"`
	MaxRetries    int           `mapstructure:"max_retries"`
	TLSEnabled    bool          `mapstructure:"tls_enabled"`
	TLSCert       string        `mapstructure:"tls_cert"`
}

// LoadConfig loads and validates service configuration from environment variables
// and config file with fallback to defaults
func LoadConfig() (*Config, error) {
	v := viper.New()

	// Set up environment variable bindings
	v.SetEnvPrefix("PORTFOLIO")
	v.AutomaticEnv()

	// Set default configuration path
	configPath := os.Getenv("PORTFOLIO_CONFIG_PATH")
	if configPath == "" {
		configPath = defaultConfigPath
	}

	// Configure viper
	v.SetConfigFile(configPath)
	v.SetConfigType("yaml")

	// Set default values
	setDefaults(v)

	// Read configuration file if it exists
	if err := v.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			return nil, fmt.Errorf("error reading config file: %w", err)
		}
	}

	var config Config
	if err := v.Unmarshal(&config); err != nil {
		return nil, fmt.Errorf("error unmarshaling config: %w", err)
	}

	// Validate configuration
	if err := validateConfig(&config); err != nil {
		return nil, fmt.Errorf("config validation failed: %w", err)
	}

	return &config, nil
}

// setDefaults sets default values for all configuration parameters
func setDefaults(v *viper.Viper) {
	// Database defaults
	v.SetDefault("database.port", defaultDBPort)
	v.SetDefault("database.max_open_conns", 25)
	v.SetDefault("database.max_idle_conns", 5)
	v.SetDefault("database.conn_max_lifetime", time.Hour)
	v.SetDefault("database.conn_max_idle_time", time.Minute*30)
	v.SetDefault("database.statement_timeout", time.Second*30)
	v.SetDefault("database.ssl_mode", "verify-full")

	// Server defaults
	v.SetDefault("server.port", defaultServerPort)
	v.SetDefault("server.read_timeout", time.Second*15)
	v.SetDefault("server.write_timeout", time.Second*15)
	v.SetDefault("server.idle_timeout", time.Second*60)
	v.SetDefault("server.shutdown_timeout", time.Second*30)
	v.SetDefault("server.max_header_bytes", 1<<20) // 1MB

	// Metrics defaults
	v.SetDefault("metrics.enabled", true)
	v.SetDefault("metrics.port", defaultMetricsPort)
	v.SetDefault("metrics.path", "/metrics")
	v.SetDefault("metrics.collection_interval", time.Second*15)

	// Cache defaults
	v.SetDefault("cache.enabled", true)
	v.SetDefault("cache.port", 6379)
	v.SetDefault("cache.db", 0)
	v.SetDefault("cache.ttl", time.Minute*15)
	v.SetDefault("cache.pool_size", 10)
	v.SetDefault("cache.min_idle_conns", 2)
	v.SetDefault("cache.max_retries", 3)
}

// validateConfig performs comprehensive validation of all configuration values
func validateConfig(config *Config) error {
	if err := validateDatabase(&config.Database); err != nil {
		return fmt.Errorf("database config validation failed: %w", err)
	}

	if err := validateServer(&config.Server); err != nil {
		return fmt.Errorf("server config validation failed: %w", err)
	}

	if err := validateMetrics(&config.Metrics); err != nil {
		return fmt.Errorf("metrics config validation failed: %w", err)
	}

	if err := validateCache(&config.Cache); err != nil {
		return fmt.Errorf("cache config validation failed: %w", err)
	}

	return nil
}

// validateDatabase validates database configuration
func validateDatabase(config *DatabaseConfig) error {
	if config.Host == "" {
		return errors.New("database host is required")
	}

	if config.Port <= 0 || config.Port > 65535 {
		return errors.New("invalid database port")
	}

	if config.User == "" {
		return errors.New("database user is required")
	}

	if config.Password == "" {
		return errors.New("database password is required")
	}

	if config.Database == "" {
		return errors.New("database name is required")
	}

	if config.MaxOpenConns <= 0 {
		return errors.New("invalid max_open_conns value")
	}

	return nil
}

// validateServer validates server configuration
func validateServer(config *ServerConfig) error {
	if config.Port <= 0 || config.Port > 65535 {
		return errors.New("invalid server port")
	}

	if config.ReadTimeout <= 0 {
		return errors.New("invalid read_timeout value")
	}

	if config.WriteTimeout <= 0 {
		return errors.New("invalid write_timeout value")
	}

	if config.TLSEnabled {
		if config.TLSCert == "" {
			return errors.New("TLS cert path is required when TLS is enabled")
		}
		if config.TLSKey == "" {
			return errors.New("TLS key path is required when TLS is enabled")
		}
	}

	return nil
}

// validateMetrics validates metrics configuration
func validateMetrics(config *MetricsConfig) error {
	if !config.Enabled {
		return nil
	}

	if config.Port <= 0 || config.Port > 65535 {
		return errors.New("invalid metrics port")
	}

	if config.Path == "" {
		return errors.New("metrics path is required when metrics are enabled")
	}

	if config.CollectionInterval <= 0 {
		return errors.New("invalid collection_interval value")
	}

	return nil
}

// validateCache validates cache configuration
func validateCache(config *CacheConfig) error {
	if !config.Enabled {
		return nil
	}

	if config.Host == "" {
		return errors.New("cache host is required when cache is enabled")
	}

	if config.Port <= 0 || config.Port > 65535 {
		return errors.New("invalid cache port")
	}

	if config.TTL <= 0 {
		return errors.New("invalid cache TTL value")
	}

	if config.TLSEnabled && config.TLSCert == "" {
		return errors.New("TLS cert path is required when cache TLS is enabled")
	}

	return nil
}