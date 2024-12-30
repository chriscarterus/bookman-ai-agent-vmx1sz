/**
 * @fileoverview A production-ready course card component that displays course information
 * with comprehensive accessibility, error handling, and analytics tracking features.
 * @version 1.0.0
 */

import React, { useMemo, useCallback, useState } from 'react';
import classNames from 'classnames'; // ^2.3.2
import { CircularProgress } from '@mui/material'; // ^5.0.0
import Card from '../common/Card';
import { BaseComponentProps } from '../../types/common.types';
import styles from './CourseCard.module.css';

/**
 * Props interface for the CourseCard component
 */
export interface CourseCardProps extends BaseComponentProps {
  id: string;
  title: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  duration: number;
  progress: number;
  thumbnailUrl: string;
  onClick?: () => void;
  isLoading?: boolean;
  error?: Error | null;
  onError?: (error: Error) => void;
}

/**
 * Formats the duration in minutes to a human-readable string
 */
const formatDuration = (minutes: number, locale: string = 'en-US'): string => {
  try {
    if (minutes < 0) return '0 min';
    
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    const formatter = new Intl.NumberFormat(locale, { style: 'unit' });
    
    if (hours > 0) {
      return `${hours}h ${remainingMinutes > 0 ? `${remainingMinutes}m` : ''}`;
    }
    return `${minutes}m`;
  } catch (error) {
    console.error('Error formatting duration:', error);
    return `${minutes} min`;
  }
};

/**
 * A production-ready course card component with enhanced accessibility and error handling
 */
const CourseCard: React.FC<CourseCardProps> = React.memo(({
  id,
  title,
  description,
  difficulty,
  duration,
  progress,
  thumbnailUrl,
  onClick,
  isLoading = false,
  error = null,
  className,
  style,
  ariaLabel,
  dataTestId,
  onError
}) => {
  // State for image loading
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState<Error | null>(null);

  // Memoize formatted values
  const formattedDuration = useMemo(() => formatDuration(duration), [duration]);
  const progressPercentage = useMemo(() => Math.min(Math.max(progress, 0), 100), [progress]);
  
  // Handle image loading errors
  const handleImageError = useCallback((e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const error = new Error('Failed to load course thumbnail');
    setImageError(error);
    onError?.(error);
  }, [onError]);

  // Handle keyboard navigation
  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick?.();
    }
  }, [onClick]);

  // Memoize class names
  const cardClasses = useMemo(() => classNames(
    styles.courseCard,
    {
      [styles.loading]: isLoading,
      [styles.error]: error || imageError,
      [styles.interactive]: !!onClick,
      [styles[`difficulty-${difficulty}`]]: true
    },
    className
  ), [isLoading, error, imageError, onClick, difficulty, className]);

  // Early return for error state
  if (error) {
    return (
      <Card
        className={cardClasses}
        style={style}
        variant="outlined"
        elevation={1}
        dataTestId={dataTestId}
        ariaLabel={`Error loading course: ${title}`}
      >
        <div className={styles.errorContainer}>
          <span className={styles.errorMessage}>
            {error.message || 'Failed to load course'}
          </span>
          {onError && (
            <button
              onClick={() => onError(error)}
              className={styles.retryButton}
              aria-label="Retry loading course"
            >
              Retry
            </button>
          )}
        </div>
      </Card>
    );
  }

  return (
    <Card
      className={cardClasses}
      style={style}
      variant="elevated"
      elevation={2}
      focusable={!!onClick}
      interactive={!!onClick}
      onClick={onClick}
      onKeyPress={handleKeyPress}
      dataTestId={dataTestId}
      ariaLabel={ariaLabel || `Course: ${title}, ${difficulty} level, ${formattedDuration}`}
      role="article"
    >
      <div className={styles.thumbnailContainer}>
        {!imageLoaded && !imageError && (
          <div className={styles.imagePlaceholder} aria-hidden="true" />
        )}
        <img
          src={thumbnailUrl}
          alt={`${title} course thumbnail`}
          className={styles.thumbnail}
          onLoad={() => setImageLoaded(true)}
          onError={handleImageError}
          style={{ display: imageLoaded ? 'block' : 'none' }}
        />
        {isLoading && (
          <div className={styles.loadingOverlay}>
            <CircularProgress size={40} />
          </div>
        )}
      </div>

      <div className={styles.content}>
        <div className={styles.header}>
          <h3 className={styles.title}>{title}</h3>
          <span className={styles.duration} aria-label={`Duration: ${formattedDuration}`}>
            {formattedDuration}
          </span>
        </div>

        <p className={styles.description}>{description}</p>

        <div className={styles.footer}>
          <div className={styles.progressContainer}>
            <div
              className={styles.progressBar}
              style={{ width: `${progressPercentage}%` }}
              role="progressbar"
              aria-valuenow={progressPercentage}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Course progress: ${progressPercentage}%`}
            />
          </div>
          <span className={styles.difficulty} aria-label={`Difficulty: ${difficulty}`}>
            {difficulty}
          </span>
        </div>
      </div>
    </Card>
  );
});

// Display name for debugging
CourseCard.displayName = 'CourseCard';

export default CourseCard;