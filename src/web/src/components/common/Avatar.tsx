/**
 * @fileoverview A comprehensive React component for rendering user avatars with advanced features
 * including responsive sizing, fallback initials display, theme integration, and accessibility support.
 * @version 1.0.0
 */

import React, { useMemo } from 'react';
import classNames from 'classnames'; // ^2.3.2
import { BaseComponentProps, ComponentSize } from '../../types/common.types';
import styles from './Avatar.module.css';

/**
 * Props interface for the Avatar component extending base component props
 */
interface AvatarProps extends BaseComponentProps {
  /** URL of the avatar image */
  src?: string;
  /** User's name for fallback initials and accessibility */
  name: string;
  /** Size variant of the avatar */
  size?: ComponentSize;
  /** Alternative text for the image */
  alt?: string;
  /** Custom aria label for enhanced accessibility */
  ariaLabel?: string;
}

/**
 * Extracts initials from a user's name
 * @param name - The full name to extract initials from
 * @returns Formatted initials (max 2 characters)
 */
const getInitials = (name: string): string => {
  const normalized = name.trim().replace(/[^a-zA-Z\s]/g, '');
  const parts = normalized.split(/\s+/);
  
  if (parts.length === 0) return '';
  
  const firstInitial = parts[0].charAt(0);
  const lastInitial = parts.length > 1 ? parts[parts.length - 1].charAt(0) : '';
  
  return (firstInitial + lastInitial).toUpperCase().slice(0, 2);
};

/**
 * Size mapping for avatar dimensions
 */
const sizeMap = {
  [ComponentSize.SMALL]: styles.small,
  [ComponentSize.MEDIUM]: styles.medium,
  [ComponentSize.LARGE]: styles.large,
};

/**
 * Avatar component for displaying user profile pictures with fallback to initials
 * @param props - Avatar component props
 * @returns React component
 */
export const Avatar: React.FC<AvatarProps> = ({
  src,
  name,
  size = ComponentSize.MEDIUM,
  alt,
  ariaLabel,
  className,
  dataTestId,
  ...rest
}) => {
  // Memoize initials calculation
  const initials = useMemo(() => getInitials(name), [name]);

  // Handle image load error
  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    e.currentTarget.style.display = 'none';
  };

  const avatarClasses = classNames(
    styles.avatar,
    sizeMap[size],
    {
      [styles.withImage]: !!src,
      [styles.withInitials]: !src,
    },
    className
  );

  return (
    <div
      className={avatarClasses}
      role="img"
      aria-label={ariaLabel || `Avatar for ${name}`}
      data-testid={dataTestId}
      {...rest}
    >
      {src ? (
        <img
          src={src}
          alt={alt || name}
          className={styles.image}
          onError={handleImageError}
          loading="lazy"
        />
      ) : (
        <span className={styles.initials} aria-hidden="true">
          {initials}
        </span>
      )}
    </div>
  );
};

// CSS Module definition (Avatar.module.css)
/**
 * .avatar {
 *   position: relative;
 *   display: inline-flex;
 *   align-items: center;
 *   justify-content: center;
 *   border-radius: 50%;
 *   overflow: hidden;
 *   background-color: var(--avatar-bg, #2563EB);
 *   color: var(--avatar-text, #FFFFFF);
 *   font-family: var(--font-family-primary, 'Inter', sans-serif);
 *   transition: opacity 0.2s ease-in-out, background-color 0.2s ease-in-out;
 * }
 * 
 * .small {
 *   width: 32px;
 *   height: 32px;
 *   font-size: 12px;
 * }
 * 
 * .medium {
 *   width: 40px;
 *   height: 40px;
 *   font-size: 14px;
 * }
 * 
 * .large {
 *   width: 48px;
 *   height: 48px;
 *   font-size: 16px;
 * }
 * 
 * .image {
 *   width: 100%;
 *   height: 100%;
 *   object-fit: cover;
 * }
 * 
 * .initials {
 *   font-weight: 500;
 *   text-transform: uppercase;
 *   user-select: none;
 * }
 * 
 * .withInitials {
 *   background-color: var(--avatar-fallback-bg, #2563EB);
 * }
 * 
 * @media (prefers-color-scheme: dark) {
 *   .withInitials {
 *     background-color: var(--avatar-fallback-bg-dark, #1D4ED8);
 *   }
 * }
 * 
 * @media (forced-colors: active) {
 *   .avatar {
 *     border: 2px solid currentColor;
 *   }
 * }
 */

export default Avatar;