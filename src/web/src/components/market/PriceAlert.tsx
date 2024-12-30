/**
 * @fileoverview PriceAlert component for creating and managing cryptocurrency price alerts
 * with enhanced security, validation, and accessibility features.
 * @version 1.0.0
 */

import React, { useState, useCallback, useEffect } from 'react';
import classnames from 'classnames'; // ^2.3.2
import { Input } from '../common/Input';
import { createMarketAlert } from '../../api/market';
import { MarketAlert, AlertCondition, ALERT_CONDITION_TYPES } from '../../types/market.types';
import { sanitizeInput } from '../../utils/validation.utils';

// Constants for validation and security
const MIN_THRESHOLD_MULTIPLIER = 0.5;
const MAX_THRESHOLD_MULTIPLIER = 2;
const DEBOUNCE_DELAY = 300;

/**
 * Validation error interface for structured error handling
 */
interface ValidationError {
  field: string;
  message: string;
  code: string;
}

/**
 * Props interface for PriceAlert component
 */
interface PriceAlertProps {
  symbol: string;
  currentPrice: number;
  onAlertCreated: (alert: MarketAlert) => void;
  className?: string;
  maxThreshold?: number;
  minThreshold?: number;
  disabled?: boolean;
}

/**
 * PriceAlert component for creating cryptocurrency price alerts
 */
const PriceAlert: React.FC<PriceAlertProps> = ({
  symbol,
  currentPrice,
  onAlertCreated,
  className,
  maxThreshold = currentPrice * MAX_THRESHOLD_MULTIPLIER,
  minThreshold = currentPrice * MIN_THRESHOLD_MULTIPLIER,
  disabled = false
}) => {
  // State management with type safety
  const [priceThreshold, setPriceThreshold] = useState<number | null>(null);
  const [alertCondition, setAlertCondition] = useState<AlertCondition>('above');
  const [error, setError] = useState<ValidationError | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationState, setValidationState] = useState({
    isValid: false,
    messages: [] as string[]
  });

  /**
   * Validates price threshold against security and business rules
   */
  const validatePriceThreshold = useCallback((value: number): boolean => {
    const messages: string[] = [];

    if (isNaN(value) || value <= 0) {
      messages.push('Please enter a valid price');
      return false;
    }

    if (value < minThreshold) {
      messages.push(`Minimum threshold is ${minThreshold}`);
      return false;
    }

    if (value > maxThreshold) {
      messages.push(`Maximum threshold is ${maxThreshold}`);
      return false;
    }

    setValidationState({ isValid: messages.length === 0, messages });
    return messages.length === 0;
  }, [minThreshold, maxThreshold]);

  /**
   * Handles price threshold input changes with validation
   */
  const handlePriceChange = useCallback((value: string | number) => {
    setError(null);
    
    // Sanitize and validate input
    const sanitizedValue = sanitizeInput(value.toString());
    const numericValue = parseFloat(sanitizedValue);

    if (validatePriceThreshold(numericValue)) {
      setPriceThreshold(numericValue);
    }
  }, [validatePriceThreshold]);

  /**
   * Handles alert condition selection
   */
  const handleConditionChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    const condition = event.target.value as AlertCondition;
    if (ALERT_CONDITION_TYPES.includes(condition)) {
      setAlertCondition(condition);
    }
  }, []);

  /**
   * Handles form submission with security measures
   */
  const handleSubmit = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (!priceThreshold || !validatePriceThreshold(priceThreshold)) {
        throw new Error('Invalid price threshold');
      }

      const alertData: Omit<MarketAlert, 'created_at'> = {
        symbol: symbol.toUpperCase(),
        condition: alertCondition,
        threshold: priceThreshold,
        user_id: '', // Will be set by backend based on auth token
        active: true
      };

      const createdAlert = await createMarketAlert(alertData);
      onAlertCreated(createdAlert);
      
      // Reset form
      setPriceThreshold(null);
      setAlertCondition('above');
      
    } catch (err) {
      setError({
        field: 'threshold',
        message: err instanceof Error ? err.message : 'Failed to create alert',
        code: 'ALERT_CREATION_ERROR'
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [symbol, alertCondition, priceThreshold, validatePriceThreshold, onAlertCreated]);

  // Effect for initial validation
  useEffect(() => {
    if (priceThreshold !== null) {
      validatePriceThreshold(priceThreshold);
    }
  }, [priceThreshold, validatePriceThreshold]);

  const containerClasses = classnames(
    'price-alert-container',
    {
      'price-alert-container--disabled': disabled,
      'price-alert-container--error': error !== null,
      'price-alert-container--submitting': isSubmitting
    },
    className
  );

  return (
    <form 
      className={containerClasses}
      onSubmit={handleSubmit}
      aria-label="Price Alert Form"
      noValidate
    >
      <div className="price-alert-inputs">
        <div className="price-alert-field">
          <label htmlFor="alertCondition" className="price-alert-label">
            Alert Condition
          </label>
          <select
            id="alertCondition"
            value={alertCondition}
            onChange={handleConditionChange}
            className="price-alert-select"
            disabled={disabled || isSubmitting}
            aria-invalid={error?.field === 'condition'}
          >
            {ALERT_CONDITION_TYPES.map((condition) => (
              <option key={condition} value={condition}>
                {condition.replace('_', ' ').toUpperCase()}
              </option>
            ))}
          </select>
        </div>

        <div className="price-alert-field">
          <label htmlFor="priceThreshold" className="price-alert-label">
            Price Threshold
          </label>
          <Input
            type="number"
            id="priceThreshold"
            value={priceThreshold || ''}
            onChange={handlePriceChange}
            min={minThreshold}
            max={maxThreshold}
            step="0.00000001"
            disabled={disabled || isSubmitting}
            aria-invalid={error?.field === 'threshold'}
            aria-describedby={error ? 'price-alert-error' : undefined}
            className="price-alert-input"
          />
        </div>
      </div>

      {error && (
        <div 
          id="price-alert-error"
          className="price-alert-error"
          role="alert"
          aria-live="polite"
        >
          {error.message}
        </div>
      )}

      {validationState.messages.length > 0 && (
        <div className="price-alert-validation" role="alert">
          {validationState.messages.map((message, index) => (
            <div key={index} className="price-alert-validation-message">
              {message}
            </div>
          ))}
        </div>
      )}

      <button
        type="submit"
        className="price-alert-submit"
        disabled={disabled || isSubmitting || !validationState.isValid}
        aria-busy={isSubmitting}
      >
        {isSubmitting ? 'Creating Alert...' : 'Create Alert'}
      </button>
    </form>
  );
};

export default PriceAlert;