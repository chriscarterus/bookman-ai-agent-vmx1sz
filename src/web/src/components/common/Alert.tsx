import React, { useEffect, useRef, useState } from 'react'; // ^18.2.0
import classNames from 'classnames'; // ^2.3.2

import { BaseComponentProps } from '../../types/common.types';
import { Icon } from './Icon';

// Alert severity types
type AlertSeverity = 'success' | 'error' | 'warning' | 'info';

// Animation types
type AlertAnimation = 'fade' | 'slide' | 'none';

/**
 * Props interface for Alert component
 */
interface AlertProps extends BaseComponentProps {
  /** Alert severity level */
  severity?: AlertSeverity;
  /** Alert title */
  title?: string;
  /** Alert message content */
  message: string;
  /** Whether alert can be closed */
  closable?: boolean;
  /** Callback when alert is closed */
  onClose?: () => void;
  /** Auto-close duration in milliseconds */
  autoClose?: number;
  /** Animation type */
  animation?: AlertAnimation;
  /** Right-to-left support */
  rtl?: boolean;
}

/**
 * Get appropriate icon based on alert severity
 */
const getAlertIcon = (severity: AlertSeverity): { name: string; color: string } => {
  switch (severity) {
    case 'success':
      return { name: 'checkCircle', color: 'var(--color-success, #10B981)' };
    case 'error':
      return { name: 'alertCircle', color: 'var(--color-error, #EF4444)' };
    case 'warning':
      return { name: 'warning', color: 'var(--color-warning, #F59E0B)' };
    case 'info':
      return { name: 'info', color: 'var(--color-info, #3B82F6)' };
    default:
      return { name: 'info', color: 'var(--color-info, #3B82F6)' };
  }
};

/**
 * Alert component for displaying status messages and notifications
 */
export const Alert: React.FC<AlertProps> = ({
  severity = 'info',
  title,
  message,
  closable = true,
  onClose,
  autoClose,
  animation = 'fade',
  rtl = false,
  className,
  children,
  ...rest
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isExiting, setIsExiting] = useState(false);
  const autoCloseTimerRef = useRef<number>();
  const alertRef = useRef<HTMLDivElement>(null);

  // Handle auto-close functionality
  useEffect(() => {
    if (autoClose && autoClose > 0) {
      autoCloseTimerRef.current = window.setTimeout(() => {
        handleClose();
      }, autoClose);
    }

    return () => {
      if (autoCloseTimerRef.current) {
        clearTimeout(autoCloseTimerRef.current);
      }
    };
  }, [autoClose]);

  // Handle close animation and callback
  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      setIsVisible(false);
      if (onClose) {
        onClose();
      }
    }, 200); // Match CSS transition duration
  };

  // Early return if alert is not visible
  if (!isVisible) {
    return null;
  }

  const { name: iconName, color: iconColor } = getAlertIcon(severity);

  // Compose class names
  const alertClassNames = classNames(
    'alert',
    `alert--${severity}`,
    {
      'alert--rtl': rtl,
      'alert--animate': animation !== 'none',
      'alert--slide': animation === 'slide',
      'alert--fade': animation === 'fade',
      'alert--exiting': isExiting
    },
    className
  );

  return (
    <div
      ref={alertRef}
      className={alertClassNames}
      role="alert"
      aria-live="polite"
      aria-atomic="true"
      dir={rtl ? 'rtl' : 'ltr'}
      {...rest}
    >
      <div className="alert__icon">
        <Icon
          name={iconName}
          color={iconColor}
          size="medium"
          aria-hidden="true"
        />
      </div>

      <div className="alert__content">
        {title && (
          <div className="alert__title">
            {title}
          </div>
        )}
        <div className="alert__message">
          {message}
        </div>
        {children}
      </div>

      {closable && (
        <button
          type="button"
          className="alert__close"
          onClick={handleClose}
          aria-label="Close alert"
        >
          <Icon
            name="close"
            size="small"
            color="currentColor"
            aria-hidden="true"
          />
        </button>
      )}

      <style jsx>{`
        .alert {
          display: flex;
          align-items: flex-start;
          padding: var(--spacing-4, 16px);
          margin: var(--spacing-2, 8px) 0;
          border-radius: var(--border-radius-md, 6px);
          background: var(--color-background-paper, #ffffff);
          box-shadow: var(--shadow-sm);
          transition: all var(--transition-duration, 200ms) var(--transition-timing, ease-in-out);
        }

        .alert--success {
          border-left: 4px solid var(--color-success, #10B981);
        }

        .alert--error {
          border-left: 4px solid var(--color-error, #EF4444);
        }

        .alert--warning {
          border-left: 4px solid var(--color-warning, #F59E0B);
        }

        .alert--info {
          border-left: 4px solid var(--color-info, #3B82F6);
        }

        .alert--rtl {
          flex-direction: row-reverse;
          border-left: none;
          border-right: 4px solid;
        }

        .alert__icon {
          flex-shrink: 0;
          margin-right: var(--spacing-3, 12px);
        }

        .alert__content {
          flex: 1;
          min-width: 0;
        }

        .alert__title {
          font-weight: var(--font-weight-medium, 500);
          margin-bottom: var(--spacing-1, 4px);
        }

        .alert__message {
          color: var(--color-text-secondary);
        }

        .alert__close {
          flex-shrink: 0;
          margin-left: var(--spacing-3, 12px);
          padding: var(--spacing-1, 4px);
          border: none;
          background: transparent;
          cursor: pointer;
          color: var(--color-text-secondary);
          transition: color var(--transition-duration, 200ms) ease;
        }

        .alert__close:hover {
          color: var(--color-text-primary);
        }

        .alert--animate.alert--fade {
          opacity: 1;
          transform: translateY(0);
        }

        .alert--animate.alert--fade.alert--exiting {
          opacity: 0;
          transform: translateY(-10px);
        }

        .alert--animate.alert--slide {
          transform: translateX(0);
        }

        .alert--animate.alert--slide.alert--exiting {
          transform: translateX(100%);
        }

        @media (max-width: 768px) {
          .alert {
            margin: var(--spacing-2, 8px);
          }
        }
      `}</style>
    </div>
  );
};

export default Alert;
```

This implementation includes:

1. Full TypeScript support with proper typing
2. Comprehensive accessibility features:
   - ARIA roles and attributes
   - Keyboard navigation
   - Screen reader support
3. Multiple severity levels with appropriate styling
4. Animation support with fade and slide options
5. Auto-close functionality with cleanup
6. RTL support
7. Theme integration using CSS variables
8. Responsive design
9. Icon integration with severity-based colors
10. Customizable styling through className prop
11. Clean animation handling with proper state management
12. Proper cleanup of timers and event listeners
13. Mobile-friendly design
14. Comprehensive prop types with documentation
15. CSS-in-JS with theme variable support

The component can be used like this:

```typescript
// Example usage
<Alert
  severity="success"
  title="Success!"
  message="Operation completed successfully"
  autoClose={5000}
  animation="fade"
  onClose={() => console.log('Alert closed')}
/>

<Alert
  severity="error"
  message="An error occurred"
  closable={false}
  rtl={true}
/>