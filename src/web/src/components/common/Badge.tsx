/**
 * @fileoverview A reusable badge component for displaying status indicators, counts,
 * and labels with full accessibility and theme support.
 * @version 1.0.0
 */

import React, { memo } from 'react'; // ^18.2.0
import classNames from 'classnames'; // ^2.3.2
import { BaseComponentProps, ComponentSize } from '../../types/common.types';

/**
 * Props interface for the Badge component extending base component props
 */
interface BadgeProps extends BaseComponentProps {
  /** Visual variant of the badge */
  variant?: 'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'info';
  /** Size variant of the badge */
  size?: ComponentSize;
  /** Content to be displayed within the badge */
  content?: string | number;
  /** Theme variant for light/dark mode support */
  theme?: 'light' | 'dark';
  /** Accessibility label for screen readers */
  ariaLabel?: string;
  /** ARIA live region behavior */
  ariaLive?: 'polite' | 'assertive';
  /** Test ID for component testing */
  dataTestId?: string;
}

/**
 * Default props for the Badge component
 */
const defaultProps: Partial<BadgeProps> = {
  variant: 'primary',
  size: ComponentSize.MEDIUM,
  theme: 'light',
  ariaLive: 'polite',
};

/**
 * Badge component for displaying status indicators, counts, or labels
 * with proper accessibility support and theme variants.
 */
const Badge: React.FC<BadgeProps> = memo(({
  variant = defaultProps.variant,
  size = defaultProps.size,
  content,
  theme = defaultProps.theme,
  className,
  style,
  ariaLabel,
  ariaLive = defaultProps.ariaLive,
  dataTestId,
  children,
}) => {
  // Combine class names based on props
  const badgeClasses = classNames(
    'badge',
    `badge--${variant}`,
    `badge--${size}`,
    `badge--${theme}`,
    className,
    {
      'badge--with-content': Boolean(content),
    }
  );

  return (
    <span
      className={badgeClasses}
      style={style}
      role="status"
      aria-label={ariaLabel}
      aria-live={ariaLive}
      data-testid={dataTestId}
    >
      {content || children}
    </span>
  );
});

// Display name for debugging
Badge.displayName = 'Badge';

// Default export
export default Badge;

/**
 * CSS Module styles for the Badge component
 * Note: These styles should be in a separate .module.css file
 * but are included here for reference
 */
/*
.badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: 'Inter', sans-serif;
  font-weight: 500;
  border-radius: 16px;
  padding: 0 8px;
  transition: all 200ms ease-in-out;
  white-space: nowrap;
}

.badge--small {
  height: 24px;
  font-size: 12px;
  min-width: 24px;
}

.badge--medium {
  height: 32px;
  font-size: 14px;
  min-width: 32px;
}

.badge--large {
  height: 40px;
  font-size: 16px;
  min-width: 40px;
}

.badge--primary {
  background-color: #2563EB;
  color: #FFFFFF;
}

.badge--secondary {
  background-color: #10B981;
  color: #FFFFFF;
}

.badge--success {
  background-color: #059669;
  color: #FFFFFF;
}

.badge--error {
  background-color: #DC2626;
  color: #FFFFFF;
}

.badge--warning {
  background-color: #F59E0B;
  color: #000000;
}

.badge--info {
  background-color: #3B82F6;
  color: #FFFFFF;
}

.badge--light {
  background-color: #F3F4F6;
  color: #1F2937;
}

.badge--dark {
  background-color: #1F2937;
  color: #F3F4F6;
}

.badge--with-content {
  padding: 0 12px;
}

@media (prefers-reduced-motion: reduce) {
  .badge {
    transition: none;
  }
}
*/
```

This implementation includes:

1. Full TypeScript support with proper typing and interfaces
2. Accessibility features:
   - ARIA roles and labels
   - Live region support
   - Screen reader compatibility
3. Theme support:
   - Light/dark mode
   - Multiple color variants
   - Responsive sizing
4. Performance optimizations:
   - Memoization with React.memo
   - Efficient class name handling with classnames utility
5. Design system compliance:
   - Follows spacing units (8px base)
   - Uses specified color palette
   - Implements typography scale
6. Responsive design:
   - Multiple size variants
   - Mobile-friendly dimensions
7. Testing support:
   - Data test IDs
   - Descriptive display name
8. Developer experience:
   - Comprehensive JSDoc documentation
   - Clear prop types
   - Default props
9. Maintainability:
   - Modular CSS structure
   - Clear component organization
   - Consistent naming conventions

The component is exported as a default export for easy importing and usage throughout the application. The CSS styles are included as comments for reference but should be moved to a separate `.module.css` file in a production environment.

Usage example:
```typescript
// Basic usage
<Badge content="New" />

// With variant and size
<Badge variant="success" size={ComponentSize.LARGE} content="99+" />

// With custom styling
<Badge 
  variant="warning"
  theme="dark"
  ariaLabel="3 unread messages"
  className="custom-badge"
  style={{ marginLeft: '8px' }}
>
  3
</Badge>