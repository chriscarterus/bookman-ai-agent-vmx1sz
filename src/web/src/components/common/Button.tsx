/**
 * @fileoverview A comprehensive, accessible, and highly customizable button component
 * that implements the design system specifications with support for multiple variants,
 * sizes, states, and loading conditions while maintaining WCAG compliance.
 * @version 1.0.0
 */

import React, { useMemo } from 'react'; // ^18.2.0
import classNames from 'classnames'; // ^2.3.2
import { BaseComponentProps, ComponentSize } from '../types/common.types';

// Constants for button configuration
const TRANSITION_DURATION = 200;
const DEBOUNCE_DELAY = 300;

/**
 * Button variant enumeration defining available button styles
 */
export enum ButtonVariant {
  PRIMARY = 'primary',
  SECONDARY = 'secondary',
  OUTLINE = 'outline',
  TEXT = 'text'
}

/**
 * Icon position enumeration for button icon placement
 */
export enum IconPosition {
  LEFT = 'left',
  RIGHT = 'right'
}

/**
 * Interface defining button component props
 */
export interface ButtonProps extends BaseComponentProps {
  variant?: ButtonVariant;
  size?: ComponentSize;
  disabled?: boolean;
  loading?: boolean;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  type?: 'button' | 'submit' | 'reset';
  icon?: React.ReactNode;
  iconPosition?: IconPosition;
  fullWidth?: boolean;
  theme?: 'light' | 'dark';
}

/**
 * Generates button CSS classes based on props and state
 */
const getButtonClasses = (props: ButtonProps): string => {
  const {
    variant = ButtonVariant.PRIMARY,
    size = ComponentSize.MEDIUM,
    disabled,
    loading,
    fullWidth,
    className,
    theme = 'light'
  } = props;

  return classNames(
    'btn',
    `btn--${variant}`,
    `btn--${size}`,
    `btn--${theme}`,
    {
      'btn--disabled': disabled,
      'btn--loading': loading,
      'btn--full-width': fullWidth,
      'btn--with-icon': props.icon,
      [`btn--icon-${props.iconPosition}`]: props.icon && props.iconPosition,
    },
    className
  );
};

/**
 * Button component with comprehensive state management and accessibility features
 */
export const Button: React.FC<ButtonProps> = React.memo((props) => {
  const {
    children,
    variant = ButtonVariant.PRIMARY,
    size = ComponentSize.MEDIUM,
    disabled = false,
    loading = false,
    onClick,
    type = 'button',
    icon,
    iconPosition = IconPosition.LEFT,
    fullWidth = false,
    theme = 'light',
    ariaLabel,
    style,
    dataTestId,
  } = props;

  // Memoize button classes for performance
  const buttonClasses = useMemo(
    () => getButtonClasses(props),
    [variant, size, disabled, loading, fullWidth, className, theme]
  );

  // Memoize click handler with debounce protection
  const handleClick = useMemo(
    () => (event: React.MouseEvent<HTMLButtonElement>) => {
      if (disabled || loading) return;

      // Debounce protection
      const button = event.currentTarget;
      button.disabled = true;
      setTimeout(() => {
        button.disabled = false;
      }, DEBOUNCE_DELAY);

      onClick?.(event);
    },
    [disabled, loading, onClick]
  );

  // Render loading spinner if in loading state
  const renderSpinner = () => {
    if (!loading) return null;
    return (
      <span className="btn__spinner" role="status" aria-hidden="true">
        <svg className="btn__spinner-svg" viewBox="0 0 24 24">
          <circle
            className="btn__spinner-circle"
            cx="12"
            cy="12"
            r="10"
            fill="none"
            strokeWidth="3"
          />
        </svg>
      </span>
    );
  };

  // Render button icon
  const renderIcon = () => {
    if (!icon) return null;
    return <span className="btn__icon">{icon}</span>;
  };

  return (
    <button
      className={buttonClasses}
      onClick={handleClick}
      disabled={disabled || loading}
      type={type}
      aria-label={ariaLabel}
      aria-disabled={disabled || loading}
      aria-busy={loading}
      data-testid={dataTestId}
      style={{
        ...style,
        transition: `all ${TRANSITION_DURATION}ms ease-in-out`,
      }}
    >
      {loading && renderSpinner()}
      {icon && iconPosition === IconPosition.LEFT && renderIcon()}
      <span className="btn__content">{children}</span>
      {icon && iconPosition === IconPosition.RIGHT && renderIcon()}
    </button>
  );
});

// Display name for debugging
Button.displayName = 'Button';

// Default props
Button.defaultProps = {
  variant: ButtonVariant.PRIMARY,
  size: ComponentSize.MEDIUM,
  disabled: false,
  loading: false,
  type: 'button',
  iconPosition: IconPosition.LEFT,
  fullWidth: false,
  theme: 'light',
};

export default Button;