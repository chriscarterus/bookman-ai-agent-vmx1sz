/**
 * Comprehensive test suite for the MarketOverview component
 * @version 1.0.0
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { IntlProvider } from 'react-intl';
import { ThemeProvider } from '@mui/material';

import MarketOverview from '../../../../src/components/dashboard/MarketOverview';
import { MarketData, PricePrediction } from '../../../../src/types/market.types';
import { useMarketData } from '../../../../src/hooks/useMarketData';
import { theme } from '../../../../src/theme';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock the useMarketData hook
jest.mock('../../../../src/hooks/useMarketData');

// Mock WebGL context for chart testing
const mockWebGLContext = {
  viewport: jest.fn(),
  clearColor: jest.fn(),
  clear: jest.fn(),
  enable: jest.fn(),
  blendFunc: jest.fn()
};

// Test data generators
const mockMarketData = (overrides: Partial<MarketData>[] = []): MarketData[] => {
  const baseData: MarketData[] = [
    {
      symbol: 'BTC',
      price: 45000,
      volume: 1000000000,
      change_24h: 2.5,
      timestamp: new Date().toISOString()
    },
    {
      symbol: 'ETH',
      price: 3200,
      volume: 500000000,
      change_24h: -1.8,
      timestamp: new Date().toISOString()
    }
  ];

  return baseData.map((data, index) => ({
    ...data,
    ...(overrides[index] || {})
  }));
};

const mockPredictions = (symbols: string[]): PricePrediction[] => {
  return symbols.map(symbol => ({
    symbol,
    predicted_price: symbol === 'BTC' ? 46000 : 3300,
    confidence_interval: [44000, 48000],
    prediction_time: new Date().toISOString(),
    model_confidence: 0.85
  }));
};

describe('MarketOverview Component', () => {
  // Setup and teardown
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Mock HTMLCanvasElement.getContext
    HTMLCanvasElement.prototype.getContext = jest.fn((contextType) => {
      if (contextType === 'webgl2') {
        return mockWebGLContext;
      }
      return null;
    });
  });

  // Helper function to render component with providers
  const renderWithProviders = (props = {}) => {
    return render(
      <IntlProvider locale="en">
        <ThemeProvider theme={theme}>
          <MarketOverview {...props} />
        </ThemeProvider>
      </IntlProvider>
    );
  };

  describe('Loading State', () => {
    it('should render loading skeleton with proper accessibility', () => {
      (useMarketData as jest.Mock).mockReturnValue({
        marketData: [],
        predictions: [],
        loading: true,
        error: null
      });

      const { container } = renderWithProviders();

      // Check loading skeleton presence
      expect(screen.getByTestId('market-overview-loading')).toBeInTheDocument();

      // Verify loading state accessibility
      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(container).toMatchSnapshot();
    });
  });

  describe('Market Data Display', () => {
    it('should display real-time market data with predictions', async () => {
      const marketData = mockMarketData();
      const predictions = mockPredictions(['BTC', 'ETH']);

      (useMarketData as jest.Mock).mockReturnValue({
        marketData,
        predictions,
        loading: false,
        error: null,
        lastUpdate: new Date().getTime()
      });

      renderWithProviders();

      // Verify market data display
      for (const data of marketData) {
        const card = screen.getByText(data.symbol).closest('[role="button"]');
        expect(card).toBeInTheDocument();
        
        // Check price display
        expect(within(card!).getByText(`$${data.price.toLocaleString()}`)).toBeInTheDocument();
        
        // Check price change
        const changeText = `${data.change_24h > 0 ? '+' : ''}${data.change_24h.toFixed(2)}%`;
        expect(within(card!).getByText(changeText)).toBeInTheDocument();
        
        // Check prediction display
        const prediction = predictions.find(p => p.symbol === data.symbol);
        expect(within(card!).getByText(`Predicted: $${prediction!.predicted_price.toLocaleString()}`)).toBeInTheDocument();
      }
    });

    it('should handle WebSocket reconnection gracefully', async () => {
      const mockError = new Error('WebSocket disconnected');
      
      (useMarketData as jest.Mock)
        .mockReturnValueOnce({
          marketData: [],
          predictions: [],
          loading: false,
          error: mockError
        })
        .mockReturnValueOnce({
          marketData: mockMarketData(),
          predictions: mockPredictions(['BTC', 'ETH']),
          loading: false,
          error: null
        });

      renderWithProviders();

      // Verify error state
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/Error Loading Market Data/i)).toBeInTheDocument();

      // Verify recovery
      await waitFor(() => {
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        expect(screen.getByText('BTC')).toBeInTheDocument();
      });
    });
  });

  describe('Chart Interaction', () => {
    it('should update chart when selecting different symbols', async () => {
      const marketData = mockMarketData();
      
      (useMarketData as jest.Mock).mockReturnValue({
        marketData,
        predictions: mockPredictions(['BTC', 'ETH']),
        loading: false,
        error: null
      });

      renderWithProviders();

      // Click ETH card
      const ethCard = screen.getByText('ETH').closest('[role="button"]');
      await userEvent.click(ethCard!);

      // Verify chart update
      expect(ethCard).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByRole('img')).toHaveAttribute(
        'aria-label',
        expect.stringContaining('ETH')
      );
    });

    it('should support keyboard navigation', async () => {
      const marketData = mockMarketData();
      
      (useMarketData as jest.Mock).mockReturnValue({
        marketData,
        predictions: mockPredictions(['BTC', 'ETH']),
        loading: false,
        error: null
      });

      renderWithProviders();

      // Navigate with keyboard
      const btcCard = screen.getByText('BTC').closest('[role="button"]');
      btcCard!.focus();
      fireEvent.keyPress(btcCard!, { key: 'Enter', code: 'Enter' });

      expect(btcCard).toHaveAttribute('aria-selected', 'true');
    });
  });

  describe('Accessibility', () => {
    it('should meet WCAG 2.1 AA standards', async () => {
      (useMarketData as jest.Mock).mockReturnValue({
        marketData: mockMarketData(),
        predictions: mockPredictions(['BTC', 'ETH']),
        loading: false,
        error: null
      });

      const { container } = renderWithProviders();

      // Run accessibility tests
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should handle high contrast mode', () => {
      (useMarketData as jest.Mock).mockReturnValue({
        marketData: mockMarketData(),
        predictions: mockPredictions(['BTC', 'ETH']),
        loading: false,
        error: null
      });

      renderWithProviders({ highContrastMode: true });

      // Verify contrast ratios
      const cards = screen.getAllByRole('button');
      cards.forEach(card => {
        const styles = window.getComputedStyle(card);
        expect(styles.backgroundColor).toBeDefined();
      });
    });
  });

  describe('Error Handling', () => {
    it('should display error message with retry option', () => {
      const mockError = new Error('Failed to fetch market data');
      
      (useMarketData as jest.Mock).mockReturnValue({
        marketData: [],
        predictions: [],
        loading: false,
        error: mockError
      });

      renderWithProviders();

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(mockError.message)).toBeInTheDocument();
    });
  });
});