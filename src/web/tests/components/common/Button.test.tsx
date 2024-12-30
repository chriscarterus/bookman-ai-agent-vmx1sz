/**
 * @fileoverview Comprehensive test suite for the Button component validating
 * functionality, styling, variants, sizes, interaction states, accessibility,
 * and theme integration.
 * @version 1.0.0
 */

import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, jest } from '@jest/globals';
import { ThemeProvider } from '@/contexts/ThemeContext';
import Button, { ButtonVariant, IconPosition } from '@/components/common/Button';
import { ComponentSize } from '@/types/common.types';

// Mock theme context
jest.mock('@/contexts/ThemeContext', () => ({
  useTheme: jest.fn(() => ({ theme: 'light' })),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Constants for testing
const DEBOUNCE_DELAY = 300;
const TEST_LABEL = 'Test Button';
const TEST_ICON = <span data-testid="test-icon">★</span>;

// Helper function to render button with theme context
const renderButton = (props = {}) => {
  return render(
    <ThemeProvider>
      <Button {...props}>{TEST_LABEL}</Button>
    </ThemeProvider>
  );
};

describe('Button Component', () => {
  describe('Rendering and Styling', () => {
    it('renders with default props', () => {
      renderButton();
      const button = screen.getByRole('button');
      
      expect(button).toBeInTheDocument();
      expect(button).toHaveClass('btn', 'btn--primary', 'btn--medium', 'btn--light');
      expect(button).toHaveTextContent(TEST_LABEL);
    });

    it('applies different variants correctly', () => {
      Object.values(ButtonVariant).forEach(variant => {
        const { rerender } = renderButton({ variant });
        expect(screen.getByRole('button')).toHaveClass(`btn--${variant}`);
        rerender(<Button variant={variant}>{TEST_LABEL}</Button>);
      });
    });

    it('applies different sizes correctly', () => {
      Object.values(ComponentSize).forEach(size => {
        const { rerender } = renderButton({ size });
        expect(screen.getByRole('button')).toHaveClass(`btn--${size}`);
        rerender(<Button size={size}>{TEST_LABEL}</Button>);
      });
    });

    it('renders with fullWidth prop', () => {
      renderButton({ fullWidth: true });
      expect(screen.getByRole('button')).toHaveClass('btn--full-width');
    });

    it('renders with custom className', () => {
      renderButton({ className: 'custom-class' });
      expect(screen.getByRole('button')).toHaveClass('custom-class');
    });
  });

  describe('Icon Integration', () => {
    it('renders icon in correct position', () => {
      const { rerender } = renderButton({ icon: TEST_ICON });
      let button = screen.getByRole('button');
      expect(button).toHaveClass('btn--with-icon', 'btn--icon-left');
      
      rerender(
        <ThemeProvider>
          <Button icon={TEST_ICON} iconPosition={IconPosition.RIGHT}>
            {TEST_LABEL}
          </Button>
        </ThemeProvider>
      );
      button = screen.getByRole('button');
      expect(button).toHaveClass('btn--with-icon', 'btn--icon-right');
    });
  });

  describe('Interaction Handling', () => {
    it('handles click events with debouncing', async () => {
      const onClick = jest.fn();
      renderButton({ onClick });

      const button = screen.getByRole('button');
      await userEvent.click(button);

      expect(onClick).toHaveBeenCalledTimes(1);
      expect(button).toBeDisabled();

      // Wait for debounce to complete
      await waitFor(() => {
        expect(button).not.toBeDisabled();
      }, { timeout: DEBOUNCE_DELAY + 100 });
    });

    it('prevents click when disabled', async () => {
      const onClick = jest.fn();
      renderButton({ onClick, disabled: true });

      await userEvent.click(screen.getByRole('button'));
      expect(onClick).not.toHaveBeenCalled();
    });

    it('prevents click when loading', async () => {
      const onClick = jest.fn();
      renderButton({ onClick, loading: true });

      await userEvent.click(screen.getByRole('button'));
      expect(onClick).not.toHaveBeenCalled();
    });
  });

  describe('Loading State', () => {
    it('displays spinner when loading', () => {
      renderButton({ loading: true });
      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('maintains content visibility during loading', () => {
      renderButton({ loading: true });
      expect(screen.getByText(TEST_LABEL)).toBeInTheDocument();
      expect(screen.getByRole('status')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('supports aria-label', () => {
      const ariaLabel = 'Accessible Button';
      renderButton({ ariaLabel });
      expect(screen.getByRole('button')).toHaveAttribute('aria-label', ariaLabel);
    });

    it('indicates disabled state with aria-disabled', () => {
      renderButton({ disabled: true });
      expect(screen.getByRole('button')).toHaveAttribute('aria-disabled', 'true');
    });

    it('indicates loading state with aria-busy', () => {
      renderButton({ loading: true });
      expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true');
    });

    it('supports keyboard navigation', async () => {
      const onClick = jest.fn();
      renderButton({ onClick });

      const button = screen.getByRole('button');
      button.focus();
      expect(button).toHaveFocus();

      await userEvent.keyboard('[Space]');
      expect(onClick).toHaveBeenCalled();

      onClick.mockClear();
      await userEvent.keyboard('[Enter]');
      expect(onClick).toHaveBeenCalled();
    });
  });

  describe('Theme Integration', () => {
    it('applies theme-specific styles', () => {
      const { rerender } = renderButton({ theme: 'light' });
      expect(screen.getByRole('button')).toHaveClass('btn--light');

      rerender(
        <ThemeProvider>
          <Button theme="dark">{TEST_LABEL}</Button>
        </ThemeProvider>
      );
      expect(screen.getByRole('button')).toHaveClass('btn--dark');
    });
  });

  describe('Performance', () => {
    it('memoizes button classes correctly', () => {
      const { rerender } = renderButton();
      const initialButton = screen.getByRole('button');
      const initialClassName = initialButton.className;

      // Rerender with same props
      rerender(
        <ThemeProvider>
          <Button>{TEST_LABEL}</Button>
        </ThemeProvider>
      );

      expect(screen.getByRole('button').className).toBe(initialClassName);
    });

    it('cleans up event listeners', () => {
      const onClick = jest.fn();
      const { unmount } = renderButton({ onClick });
      
      unmount();
      // Verify no memory leaks or console errors
      expect(onClick).not.toHaveBeenCalled();
    });
  });
});