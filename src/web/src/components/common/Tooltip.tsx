import React, { useState, useEffect, useCallback, useRef } from 'react';
import { BaseComponentProps } from '../../types/common.types';
import { theme } from '../../config/theme.config';

/**
 * Enum for tooltip placement options
 */
export enum TooltipPlacement {
  TOP = 'top',
  TOP_START = 'top-start',
  TOP_END = 'top-end',
  BOTTOM = 'bottom',
  BOTTOM_START = 'bottom-start',
  BOTTOM_END = 'bottom-end',
  LEFT = 'left',
  LEFT_START = 'left-start',
  LEFT_END = 'left-end',
  RIGHT = 'right',
  RIGHT_START = 'right-start',
  RIGHT_END = 'right-end'
}

/**
 * Interface for tooltip component props
 */
export interface TooltipProps extends BaseComponentProps {
  content: React.ReactNode;
  placement?: TooltipPlacement;
  delay?: number;
  offset?: number;
  disabled?: boolean;
  trigger?: 'hover' | 'click' | 'focus';
  'aria-label'?: string;
  role?: string;
  id?: string;
}

/**
 * Interface for tooltip position
 */
interface Position {
  top: number;
  left: number;
  transformOrigin: string;
}

/**
 * Calculates tooltip position based on trigger element and placement
 */
const calculatePosition = (
  triggerRect: DOMRect,
  tooltipRect: DOMRect,
  placement: TooltipPlacement,
  viewport: { width: number; height: number }
): Position => {
  let top = 0;
  let left = 0;
  let transformOrigin = 'center bottom';

  const offset = 8; // Default offset from trigger element

  switch (placement) {
    case TooltipPlacement.TOP:
    case TooltipPlacement.TOP_START:
    case TooltipPlacement.TOP_END:
      top = triggerRect.top - tooltipRect.height - offset;
      left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
      transformOrigin = 'center bottom';
      break;
    case TooltipPlacement.BOTTOM:
    case TooltipPlacement.BOTTOM_START:
    case TooltipPlacement.BOTTOM_END:
      top = triggerRect.bottom + offset;
      left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
      transformOrigin = 'center top';
      break;
    case TooltipPlacement.LEFT:
    case TooltipPlacement.LEFT_START:
    case TooltipPlacement.LEFT_END:
      top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
      left = triggerRect.left - tooltipRect.width - offset;
      transformOrigin = 'right center';
      break;
    case TooltipPlacement.RIGHT:
    case TooltipPlacement.RIGHT_START:
    case TooltipPlacement.RIGHT_END:
      top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
      left = triggerRect.right + offset;
      transformOrigin = 'left center';
      break;
  }

  // Boundary detection and adjustment
  if (left < 0) left = offset;
  if (left + tooltipRect.width > viewport.width) {
    left = viewport.width - tooltipRect.width - offset;
  }
  if (top < 0) top = offset;
  if (top + tooltipRect.height > viewport.height) {
    top = viewport.height - tooltipRect.height - offset;
  }

  return { top, left, transformOrigin };
};

/**
 * Tooltip component for displaying contextual information
 */
export const Tooltip: React.FC<TooltipProps> = ({
  children,
  content,
  placement = TooltipPlacement.TOP,
  delay = 200,
  offset = 8,
  disabled = false,
  trigger = 'hover',
  className = '',
  'aria-label': ariaLabel,
  role = 'tooltip',
  id,
  ...props
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState<Position>({ top: 0, left: 0, transformOrigin: 'center bottom' });
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const showTooltip = useCallback(() => {
    if (disabled) return;
    
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
      
      if (triggerRef.current && tooltipRef.current) {
        const triggerRect = triggerRef.current.getBoundingClientRect();
        const tooltipRect = tooltipRef.current.getBoundingClientRect();
        const viewport = {
          width: window.innerWidth,
          height: window.innerHeight
        };
        
        setPosition(calculatePosition(triggerRect, tooltipRect, placement, viewport));
      }
    }, delay);
  }, [disabled, delay, placement]);

  const hideTooltip = useCallback(() => {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setIsVisible(false);
    }, 100);
  }, []);

  useEffect(() => {
    return () => {
      clearTimeout(timeoutRef.current);
    };
  }, []);

  const tooltipStyles: React.CSSProperties = {
    position: 'fixed',
    top: position.top,
    left: position.left,
    zIndex: theme.zIndex?.tooltip || 1500,
    padding: `${theme.spacing(1)}px ${theme.spacing(2)}px`,
    backgroundColor: theme.palette.grey[800],
    color: theme.palette.common.white,
    borderRadius: theme.shape.borderRadius,
    fontSize: '0.875rem',
    maxWidth: 300,
    wordWrap: 'break-word',
    transformOrigin: position.transformOrigin,
    transition: theme.transitions.create(['opacity', 'transform'], {
      duration: theme.transitions.duration.shorter
    }),
    opacity: isVisible ? 1 : 0,
    transform: isVisible ? 'scale(1)' : 'scale(0.8)',
    pointerEvents: 'none',
    boxShadow: theme.shadows[2]
  };

  const triggerProps = {
    onMouseEnter: trigger === 'hover' ? showTooltip : undefined,
    onMouseLeave: trigger === 'hover' ? hideTooltip : undefined,
    onClick: trigger === 'click' ? showTooltip : undefined,
    onFocus: trigger === 'focus' ? showTooltip : undefined,
    onBlur: trigger === 'focus' ? hideTooltip : undefined,
    ref: triggerRef,
    'aria-describedby': isVisible ? id : undefined,
    className
  };

  return (
    <>
      <div {...triggerProps} {...props}>
        {children}
      </div>
      {isVisible && (
        <div
          ref={tooltipRef}
          role={role}
          id={id}
          aria-label={ariaLabel}
          style={tooltipStyles}
        >
          {content}
        </div>
      )}
    </>
  );
};

export default Tooltip;