/**
 * @fileoverview Enhanced select component with security, accessibility and responsive features
 * Implements Bookman AI platform's design system with comprehensive security and UX features
 * @version 1.0.0
 */

import React, { useCallback, useMemo, useState, useRef, useEffect } from 'react';
import classNames from 'classnames'; // ^2.3.2

// Internal imports
import { BaseComponentProps, ComponentSize } from '../../types/common.types';
import { sanitizeInput } from '../../utils/validation.utils';

// Constants for accessibility and security
const ARIA_EXPANDED_DEFAULT = false;
const MOBILE_BREAKPOINT = 768;
const DEFAULT_DEBOUNCE_DELAY = 150;

/**
 * Interface for individual select options
 */
interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

/**
 * Props interface for Select component extending base component props
 */
interface SelectProps extends BaseComponentProps {
  options: Array<SelectOption>;
  value: string | string[];
  onChange: (value: string | string[]) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  isMulti?: boolean;
  isDisabled?: boolean;
  size?: ComponentSize;
  placeholder?: string;
  error?: string;
  testId?: string;
}

/**
 * Enhanced select component with comprehensive security and accessibility features
 */
const Select: React.FC<SelectProps> = React.memo(({
  options,
  value,
  onChange,
  onFocus,
  onBlur,
  isMulti = false,
  isDisabled = false,
  size = ComponentSize.MEDIUM,
  placeholder = 'Select an option',
  error,
  className,
  id,
  style,
  ariaLabel,
  ariaDescribedBy,
  testId,
}) => {
  // State management
  const [isFocused, setIsFocused] = useState(false);
  const [internalValue, setInternalValue] = useState<string | string[]>(value);
  const [isExpanded, setIsExpanded] = useState(ARIA_EXPANDED_DEFAULT);
  
  // Refs
  const selectRef = useRef<HTMLSelectElement>(null);
  const isMobileDevice = useMemo(() => window.innerWidth <= MOBILE_BREAKPOINT, []);

  // Sanitize options on mount and when they change
  const sanitizedOptions = useMemo(() => {
    return options.map(option => ({
      ...option,
      value: sanitizeInput(option.value),
      label: sanitizeInput(option.label)
    }));
  }, [options]);

  /**
   * Handles value change with security checks and validation
   */
  const handleChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    event.preventDefault();

    const selectedOptions = Array.from(event.target.selectedOptions);
    const selectedValues = selectedOptions.map(option => sanitizeInput(option.value));

    // Validate selected values against allowed options
    const validValues = selectedValues.filter(val => 
      sanitizedOptions.some(option => option.value === val && !option.disabled)
    );

    const newValue = isMulti ? validValues : validValues[0];

    setInternalValue(newValue);
    onChange(newValue);

    // Update ARIA attributes
    if (selectRef.current) {
      selectRef.current.setAttribute('aria-selected', 'true');
    }
  }, [isMulti, onChange, sanitizedOptions]);

  /**
   * Handles focus state with enhanced accessibility
   */
  const handleFocus = useCallback((event: React.FocusEvent<HTMLSelectElement>) => {
    setIsFocused(true);
    setIsExpanded(true);
    onFocus?.();

    // Announce current selection to screen readers
    const selectedLabel = sanitizedOptions.find(opt => opt.value === internalValue)?.label;
    if (selectedLabel) {
      event.target.setAttribute('aria-label', `Selected: ${selectedLabel}`);
    }
  }, [onFocus, internalValue, sanitizedOptions]);

  /**
   * Handles blur state with cleanup
   */
  const handleBlur = useCallback(() => {
    setIsFocused(false);
    setIsExpanded(false);
    onBlur?.();
  }, [onBlur]);

  // Sync internal value with prop changes
  useEffect(() => {
    setInternalValue(value);
  }, [value]);

  // Generate component classes
  const selectClasses = useMemo(() => classNames(
    'bookman-select',
    `bookman-select--${size}`,
    {
      'bookman-select--focused': isFocused,
      'bookman-select--disabled': isDisabled,
      'bookman-select--error': error,
      'bookman-select--mobile': isMobileDevice,
      'bookman-select--multi': isMulti
    },
    className
  ), [size, isFocused, isDisabled, error, isMobileDevice, isMulti, className]);

  // Security attributes for the select element
  const securityAttributes = {
    'data-testid': testId,
    'data-sanitized': 'true',
    'autoComplete': 'off',
    'spellCheck': 'false'
  };

  // Accessibility attributes
  const accessibilityAttributes = {
    'aria-label': ariaLabel || placeholder,
    'aria-describedby': ariaDescribedBy,
    'aria-invalid': error ? 'true' : 'false',
    'aria-expanded': isExpanded,
    'aria-disabled': isDisabled,
    'aria-required': 'false',
    'role': 'listbox'
  };

  return (
    <div className="bookman-select-container">
      <select
        ref={selectRef}
        id={id}
        className={selectClasses}
        value={internalValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        disabled={isDisabled}
        multiple={isMulti}
        style={style}
        {...securityAttributes}
        {...accessibilityAttributes}
      >
        {placeholder && (
          <option value="" disabled>
            {sanitizeInput(placeholder)}
          </option>
        )}
        {sanitizedOptions.map((option) => (
          <option
            key={option.value}
            value={option.value}
            disabled={option.disabled}
            aria-selected={internalValue === option.value}
          >
            {option.label}
          </option>
        ))}
      </select>
      
      {error && (
        <div 
          className="bookman-select-error" 
          role="alert"
          aria-live="polite"
        >
          {error}
        </div>
      )}
    </div>
  );
});

// Display name for debugging
Select.displayName = 'Select';

export default Select;