/**
 * @fileoverview Enhanced UserProfile component for displaying user information in the community section
 * @version 1.0.0
 */

import React, { useCallback, useEffect, useMemo } from 'react';
import classNames from 'classnames'; // ^2.3.2
import { useTranslation } from 'react-i18next'; // ^13.0.0
import useAnalytics from '@bookman/analytics'; // ^1.0.0

// Internal imports
import { BaseComponentProps, ComponentSize } from '../../types/common.types';
import { Avatar } from '../common/Avatar';
import { Badge } from '../common/Badge';
import { communityApi } from '../../api/community';
import { LoadingState } from '../../types/api.types';

// Styles
import styles from './UserProfile.module.css';

/**
 * Enhanced UserProfile component props extending base component props
 */
interface UserProfileProps extends BaseComponentProps {
  userId: string;
  avatarUrl?: string;
  username: string;
  reputation: number;
  badges: Array<{
    type: string;
    label: string;
    tooltip?: string;
  }>;
  joinDate: Date;
  stats: {
    posts: number;
    comments: number;
    contributions: number;
    reactions: number;
  };
  isLoading?: boolean;
  error?: Error | null;
  theme?: 'light' | 'dark';
}

/**
 * Formats join date with localization support
 */
const formatJoinDate = (date: Date, locale: string): string => {
  try {
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(date);
  } catch (error) {
    console.error('Date formatting error:', error);
    return date.toLocaleDateString();
  }
};

/**
 * Enhanced UserProfile component with optimizations and accessibility
 */
const UserProfile: React.FC<UserProfileProps> = React.memo(({
  userId,
  avatarUrl,
  username,
  reputation,
  badges,
  joinDate,
  stats,
  isLoading = false,
  error = null,
  theme = 'light',
  className,
  ...rest
}) => {
  // Hooks
  const { t } = useTranslation('community');
  const { trackEvent } = useAnalytics();

  // Memoized class names
  const containerClasses = useMemo(() => classNames(
    styles.userProfile,
    styles[`userProfile--${theme}`],
    {
      [styles['userProfile--loading']]: isLoading,
      [styles['userProfile--error']]: error
    },
    className
  ), [theme, isLoading, error, className]);

  // Track profile view
  useEffect(() => {
    trackEvent('profile_view', {
      userId,
      timestamp: new Date().toISOString()
    });
  }, [userId, trackEvent]);

  // Handle retry on error
  const handleRetry = useCallback(async () => {
    try {
      await communityApi.getUserStats(userId);
    } catch (err) {
      console.error('Failed to retry loading user stats:', err);
    }
  }, [userId]);

  // Early return for loading state
  if (isLoading) {
    return (
      <div className={containerClasses} aria-busy="true" role="alert">
        <div className={styles.userProfile__loading}>
          {t('profile.loading')}
        </div>
      </div>
    );
  }

  // Early return for error state
  if (error) {
    return (
      <div className={containerClasses} role="alert">
        <div className={styles.userProfile__error}>
          <p>{t('profile.error')}</p>
          <button 
            onClick={handleRetry}
            className={styles.userProfile__retryButton}
            aria-label={t('profile.retryButton')}
          >
            {t('profile.retry')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={containerClasses}
      data-testid="user-profile"
      {...rest}
    >
      {/* Profile Header */}
      <header className={styles.userProfile__header}>
        <Avatar
          src={avatarUrl}
          name={username}
          size={ComponentSize.LARGE}
          className={styles.userProfile__avatar}
        />
        <div className={styles.userProfile__info}>
          <h2 className={styles.userProfile__username}>
            {username}
          </h2>
          <p className={styles.userProfile__joinDate}>
            {t('profile.memberSince', {
              date: formatJoinDate(joinDate, t('common:locale'))
            })}
          </p>
        </div>
      </header>

      {/* Reputation and Badges */}
      <div className={styles.userProfile__reputation}>
        <Badge
          variant="primary"
          content={reputation.toLocaleString()}
          tooltip={t('profile.reputationTooltip')}
          size={ComponentSize.MEDIUM}
        />
        <div className={styles.userProfile__badges}>
          {badges.map((badge, index) => (
            <Badge
              key={`${badge.type}-${index}`}
              variant={badge.type}
              content={badge.label}
              tooltip={badge.tooltip}
              size={ComponentSize.SMALL}
              className={styles.userProfile__badge}
            />
          ))}
        </div>
      </div>

      {/* Statistics Grid */}
      <div className={styles.userProfile__stats}>
        <div className={styles.userProfile__stat}>
          <span className={styles.userProfile__statLabel}>
            {t('profile.stats.posts')}
          </span>
          <span className={styles.userProfile__statValue}>
            {stats.posts.toLocaleString()}
          </span>
        </div>
        <div className={styles.userProfile__stat}>
          <span className={styles.userProfile__statLabel}>
            {t('profile.stats.comments')}
          </span>
          <span className={styles.userProfile__statValue}>
            {stats.comments.toLocaleString()}
          </span>
        </div>
        <div className={styles.userProfile__stat}>
          <span className={styles.userProfile__statLabel}>
            {t('profile.stats.contributions')}
          </span>
          <span className={styles.userProfile__statValue}>
            {stats.contributions.toLocaleString()}
          </span>
        </div>
        <div className={styles.userProfile__stat}>
          <span className={styles.userProfile__statLabel}>
            {t('profile.stats.reactions')}
          </span>
          <span className={styles.userProfile__statValue}>
            {stats.reactions.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
});

// Display name for debugging
UserProfile.displayName = 'UserProfile';

// Default export
export default UserProfile;