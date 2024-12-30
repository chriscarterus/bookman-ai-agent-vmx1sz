/**
 * @fileoverview Enhanced form input component implementing Bookman AI's design system
 * with comprehensive security, accessibility, and validation features.
 * @version 1.0.0
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import classnames from 'classnames'; // ^2.3.2
import { BaseComponentProps } from '../../types/common.types';
import { validateEmail, sanitizeInput } from '../../utils/validation.utils';

// Constants for input validation and security
const INPUT_MAX_LENGTHS = {
  text: 255,
  email: 254,
  password: 128,
  search: 100,
  number: 20
} as const;

const INPUT_PATTERNS = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  number: /^\d*\.?\d*$/
} as const;

/**
 * Enhanced props interface for Input component extending base component props
 */
export interface InputProps extends BaseComponentProps {
  type?: 'text' | 'email' | 'password' | 'number' | 'search';
  value?: string | number;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  maxLength?: number;
  pattern?: string;
  name?: string;
  'aria-label'?: string;
  'aria-describedby'?: string;
  onChange?: (value: string | number, isValid: boolean) => void;
  onBlur?: (isValid: boolean) => void;
  autoComplete?: string;
  min?: number;
  max?: number;
  step?: number;
}

/**
 * Enhanced form input component with comprehensive security and accessibility features
 */
export const Input: React.FC<InputProps> = ({
  type = 'text',
  value = '',
  placeholder = '',
  error = '',
  disabled = false,
  required = false,
  maxLength,
  pattern,
  name,
  className,
  style,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
  onChange,
  onBlur,
  autoComplete,
  min,
  max,
  step
}) => {
  // State management
  const [internalValue, setInternalValue] = useState<string | number>(value);
  const [isTouched, setIsTouched] = useState(false);
  const [internalError, setInternalError] = useState(error);
  const inputRef = useRef<HTMLInputElement>(null);

  // Generate unique IDs for accessibility
  const inputId = useRef(`input-${Math.random().toString(36).substr(2, 9)}`);
  const errorId = useRef(`error-${inputId.current}`);

  /**
   * Validates input value based on type and constraints
   */
  const validateInput = useCallback((value: string | number): boolean => {
    if (required && (!value || value.toString().trim() === '')) {
      setInternalError('This field is required');
      return false;
    }

    const stringValue = value.toString();

    // Type-specific validation
    switch (type) {
      case 'email':
        if (stringValue && !validateEmail(stringValue)) {
          setInternalError('Please enter a valid email address');
          return false;
        }
        break;

      case 'number':
        const numValue = Number(value);
        if (isNaN(numValue)) {
          setInternalError('Please enter a valid number');
          return false;
        }
        if (min !== undefined && numValue < min) {
          setInternalError(`Value must be at least ${min}`);
          return false;
        }
        if (max !== undefined && numValue > max) {
          setInternalError(`Value must be at most ${max}`);
          return false;
        }
        break;

      default:
        if (pattern && !new RegExp(pattern).test(stringValue)) {
          setInternalError('Please match the requested format');
          return false;
        }
    }

    // Length validation
    const effectiveMaxLength = maxLength || INPUT_MAX_LENGTHS[type] || 255;
    if (stringValue.length > effectiveMaxLength) {
      setInternalError(`Maximum length is ${effectiveMaxLength} characters`);
      return false;
    }

    setInternalError('');
    return true;
  }, [type, required, pattern, maxLength, min, max]);

  /**
   * Handles input value changes with security measures
   */
  const handleChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    event.preventDefault();
    let newValue = event.target.value;

    // Apply sanitization for text inputs
    if (type !== 'password') {
      newValue = sanitizeInput(newValue);
    }

    // Handle number type conversion
    if (type === 'number') {
      const numValue = newValue === '' ? '' : Number(newValue);
      setInternalValue(numValue);
      const isValid = validateInput(numValue);
      onChange?.(numValue, isValid);
      return;
    }

    setInternalValue(newValue);
    const isValid = validateInput(newValue);
    onChange?.(newValue, isValid);
  }, [type, onChange, validateInput]);

  /**
   * Handles input blur events with validation
   */
  const handleBlur = useCallback((event: React.FocusEvent<HTMLInputElement>) => {
    setIsTouched(true);
    const isValid = validateInput(event.target.value);
    onBlur?.(isValid);
  }, [validateInput, onBlur]);

  // Sync internal value with prop value
  useEffect(() => {
    setInternalValue(value);
  }, [value]);

  // Update error state from props
  useEffect(() => {
    setInternalError(error);
  }, [error]);

  // Compute classes for styling
  const inputClasses = classnames(
    'bookman-input',
    {
      'bookman-input--error': (internalError && isTouched),
      'bookman-input--disabled': disabled,
      'bookman-input--touched': isTouched,
    },
    className
  );

  return (
    <div className="bookman-input-wrapper" style={style}>
      <input
        ref={inputRef}
        id={inputId.current}
        type={type}
        value={internalValue}
        onChange={handleChange}
        onBlur={handleBlur}
        disabled={disabled}
        required={required}
        maxLength={maxLength || INPUT_MAX_LENGTHS[type]}
        pattern={pattern}
        placeholder={placeholder}
        name={name}
        className={inputClasses}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy || (internalError ? errorId.current : undefined)}
        aria-invalid={!!internalError}
        aria-required={required}
        autoComplete={autoComplete}
        min={min}
        max={max}
        step={step}
        data-testid="bookman-input"
      />
      {internalError && isTouched && (
        <div
          id={errorId.current}
          className="bookman-input-error"
          role="alert"
          aria-live="polite"
        >
          {internalError}
        </div>
      )}
    </div>
  );
};

export default Input;