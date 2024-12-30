import React from 'react';
import { spin } from '../../styles/animations.css';
import { loading } from '../../styles/components.css';

interface LoadingProps {
  /**
   * Size variant of the loading spinner
   * @default 'medium'
   */
  size?: 'small' | 'medium' | 'large';
  
  /**
   * Color theme using design system variables
   * @default 'primary'
   */
  color?: 'primary' | 'secondary' | 'white';
  
  /**
   * Whether to show spinner with semi-transparent overlay
   * @default false
   */
  overlay?: boolean;
  
  /**
   * Accessible label for screen readers
   * @default 'Loading...'
   */
  label?: string;
}

/**
 * A reusable loading spinner component that provides visual feedback during
 * asynchronous operations. Implements GPU-accelerated animations and
 * accessibility features.
 */
export const Loading: React.FC<LoadingProps> = ({
  size = 'medium',
  color = 'primary',
  overlay = false,
  label = 'Loading...'
}) => {
  // Map size variants to dimensions
  const sizeMap = {
    small: 16,
    medium: 24,
    large: 32
  };

  // Map color variants to design system variables
  const colorMap = {
    primary: 'var(--color-primary)',
    secondary: 'var(--color-secondary)',
    white: 'var(--color-white)'
  };

  // Dynamic styles based on props
  const spinnerStyles: React.CSSProperties = {
    width: sizeMap[size],
    height: sizeMap[size],
    color: colorMap[color],
    willChange: 'transform',
    contain: 'strict',
    animation: `${spin} 1s linear infinite`
  };

  const containerStyles: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    ...(overlay && {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(255, 255, 255, 0.8)',
      zIndex: 'var(--z-index-modal)'
    })
  };

  return (
    <div 
      className={loading}
      style={containerStyles}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <svg
        style={spinnerStyles}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle 
          cx="12" 
          cy="12" 
          r="10" 
          stroke="currentColor" 
          strokeWidth="3" 
          strokeLinecap="round"
          strokeDasharray="40 60"
        />
      </svg>
      <span className="sr-only">{label}</span>
    </div>
  );
};

// Enable tree-shaking
export default Loading;