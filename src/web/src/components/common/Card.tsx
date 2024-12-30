/**
 * @fileoverview A reusable card component that provides a container with consistent styling,
 * elevation, and layout options following the Bookman AI design system.
 * @version 1.0.0
 */

import React, { useMemo } from 'react'; // ^18.2.0
import classNames from 'classnames'; // ^2.3.2
import { BaseComponentProps } from '../../types/common.types';

/**
 * Props interface for the Card component extending BaseComponentProps
 * with additional styling and interaction options
 */
export interface CardProps extends BaseComponentProps {
  /** Visual style variant of the card */
  variant?: 'default' | 'elevated' | 'outlined';
  /** Padding size variant */
  padding?: 'default' | 'large';
  /** Shadow elevation level (1-3) */
  elevation?: 1 | 2 | 3;
  /** Whether the card can receive keyboard focus */
  focusable?: boolean;
  /** Whether the card has interactive hover/active states */
  interactive?: boolean;
}

/**
 * A flexible card component that serves as a container with consistent styling
 * and enhanced accessibility features.
 */
const Card: React.FC<CardProps> = React.memo(({
  className,
  children,
  variant = 'default',
  padding = 'default',
  elevation = 1,
  focusable = false,
  interactive = false,
  style,
  ariaLabel,
  id,
  dataTestId,
}) => {
  // Memoize class composition for performance
  const cardClasses = useMemo(() => classNames(
    'card',
    `card--${variant}`,
    `card--padding-${padding}`,
    `card--elevation-${elevation}`,
    {
      'card--interactive': interactive,
      'card--focusable': focusable,
    },
    className
  ), [variant, padding, elevation, interactive, focusable, className]);

  // Memoize shadow styles based on elevation
  const shadowStyle = useMemo(() => {
    const shadows = {
      1: '0 2px 4px rgba(0, 0, 0, 0.1)',
      2: '0 4px 8px rgba(0, 0, 0, 0.12)',
      3: '0 8px 16px rgba(0, 0, 0, 0.14)'
    };
    return shadows[elevation];
  }, [elevation]);

  // Combine custom styles with computed shadow
  const combinedStyles: React.CSSProperties = {
    ...style,
    boxShadow: variant === 'elevated' ? shadowStyle : undefined,
  };

  // Determine appropriate ARIA role
  const role = interactive ? 'button' : 'article';

  return (
    <div
      id={id}
      className={cardClasses}
      style={combinedStyles}
      role={role}
      aria-label={ariaLabel}
      tabIndex={focusable ? 0 : undefined}
      data-testid={dataTestId}
    >
      {children}
    </div>
  );
});

// Display name for debugging
Card.displayName = 'Card';

// Default props
Card.defaultProps = {
  variant: 'default',
  padding: 'default',
  elevation: 1,
  focusable: false,
  interactive: false,
};

export default Card;

/**
 * CSS Module styles (card.module.css):
 * 
 * .card {
 *   border-radius: 8px;
 *   transition: all 200ms ease-in-out;
 *   background-color: var(--color-background-paper);
 *   width: 100%;
 * }
 * 
 * .card--default {
 *   background-color: var(--color-background-paper);
 * }
 * 
 * .card--elevated {
 *   background-color: var(--color-background-paper);
 * }
 * 
 * .card--outlined {
 *   border: 1px solid var(--color-grey-200);
 * }
 * 
 * .card--padding-default {
 *   padding: 16px;
 * }
 * 
 * .card--padding-large {
 *   padding: 24px;
 * }
 * 
 * .card--interactive {
 *   cursor: pointer;
 *   transition: transform 200ms ease-in-out;
 * }
 * 
 * .card--interactive:hover {
 *   transform: translateY(-2px);
 * }
 * 
 * .card--focusable:focus {
 *   outline: 2px solid var(--color-primary-main);
 *   outline-offset: 2px;
 * }
 * 
 * @media (min-width: 768px) {
 *   .card--padding-default {
 *     padding: 20px;
 *   }
 *   
 *   .card--padding-large {
 *     padding: 32px;
 *   }
 * }
 * 
 * @media (min-width: 1024px) {
 *   .card--padding-default {
 *     padding: 24px;
 *   }
 *   
 *   .card--padding-large {
 *     padding: 40px;
 *   }
 * }
 */