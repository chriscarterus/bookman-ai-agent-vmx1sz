/**
 * @fileoverview A comprehensive React component for rendering forum posts with 
 * enhanced accessibility, performance optimization, and responsive design.
 * @version 1.0.0
 */

import React, { useMemo } from 'react';
import classNames from 'classnames'; // ^2.3.2
import { formatDistanceToNow } from 'date-fns'; // ^2.30.0
import Avatar from '../common/Avatar';
import Button from '../common/Button';
import Card from '../common/Card';
import { ComponentSize } from '../../types/common.types';
import styles from './ForumPost.module.css';

/**
 * Interface for author information with enhanced metadata
 */
interface PostAuthor {
  id: string;
  name: string;
  avatarUrl: string;
  role: string;
  reputation: number;
}

/**
 * Interface for post engagement metrics
 */
interface PostEngagement {
  likes: number;
  comments: number;
  shares: number;
}

/**
 * Interface for user interaction states
 */
interface UserInteraction {
  isLiked: boolean;
  isBookmarked: boolean;
  hasCommented: boolean;
}

/**
 * Props interface for the ForumPost component
 */
export interface ForumPostProps {
  id: string;
  author: PostAuthor;
  content: string;
  createdAt: Date;
  engagement: PostEngagement;
  userInteraction: UserInteraction;
  loading?: boolean;
  error?: string | null;
  onLike?: (postId: string) => Promise<void>;
  onComment?: (postId: string) => void;
  onShare?: (postId: string) => void;
  onBookmark?: (postId: string) => Promise<void>;
  className?: string;
}

/**
 * A memoized component for rendering individual forum posts with comprehensive
 * features and accessibility support.
 */
export const ForumPost: React.FC<ForumPostProps> = React.memo(({
  id,
  author,
  content,
  createdAt,
  engagement,
  userInteraction,
  loading = false,
  error = null,
  onLike,
  onComment,
  onShare,
  onBookmark,
  className,
}) => {
  // Memoize formatted timestamp
  const formattedTime = useMemo(() => 
    formatDistanceToNow(createdAt, { addSuffix: true }),
    [createdAt]
  );

  // Memoize reputation display
  const formattedReputation = useMemo(() => 
    new Intl.NumberFormat('en-US', { notation: 'compact' }).format(author.reputation),
    [author.reputation]
  );

  // Handle post interactions with loading states
  const handleLike = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!loading && onLike) {
      await onLike(id);
    }
  };

  const handleBookmark = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!loading && onBookmark) {
      await onBookmark(id);
    }
  };

  const handleComment = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!loading && onComment) {
      onComment(id);
    }
  };

  const handleShare = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!loading && onShare) {
      onShare(id);
    }
  };

  return (
    <Card
      variant="default"
      elevation={1}
      className={classNames(styles.post, className)}
      dataTestId={`forum-post-${id}`}
    >
      {/* Post Header with Author Information */}
      <header className={styles.post__header}>
        <div className={styles.post__author}>
          <Avatar
            src={author.avatarUrl}
            name={author.name}
            size={ComponentSize.MEDIUM}
            alt={`${author.name}'s avatar`}
            loading="lazy"
          />
          <div className={styles.post__authorInfo}>
            <h3 className={styles.post__authorName}>
              {author.name}
              <span className={styles.post__authorRole}>{author.role}</span>
            </h3>
            <div className={styles.post__metadata}>
              <span className={styles.post__reputation} title="User reputation">
                {formattedReputation} points
              </span>
              <time 
                className={styles.post__timestamp}
                dateTime={createdAt.toISOString()}
                title={createdAt.toLocaleString()}
              >
                {formattedTime}
              </time>
            </div>
          </div>
        </div>
      </header>

      {/* Post Content */}
      <div 
        className={styles.post__content}
        role="article"
      >
        {content}
      </div>

      {/* Error Message */}
      {error && (
        <div 
          className={styles.post__error}
          role="alert"
          aria-live="polite"
        >
          {error}
        </div>
      )}

      {/* Post Actions */}
      <footer className={styles.post__footer}>
        <div className={styles.post__actions}>
          <Button
            variant="text"
            onClick={handleLike}
            loading={loading}
            disabled={loading}
            className={classNames(styles.post__action, {
              [styles['post__action--active']]: userInteraction.isLiked
            })}
            aria-label={`Like post by ${author.name}`}
            aria-pressed={userInteraction.isLiked}
          >
            <span className={styles.post__actionIcon}>👍</span>
            <span className={styles.post__actionCount}>{engagement.likes}</span>
          </Button>

          <Button
            variant="text"
            onClick={handleComment}
            disabled={loading}
            className={styles.post__action}
            aria-label={`Comment on post by ${author.name}`}
          >
            <span className={styles.post__actionIcon}>💬</span>
            <span className={styles.post__actionCount}>{engagement.comments}</span>
          </Button>

          <Button
            variant="text"
            onClick={handleShare}
            disabled={loading}
            className={styles.post__action}
            aria-label={`Share post by ${author.name}`}
          >
            <span className={styles.post__actionIcon}>↗️</span>
            <span className={styles.post__actionCount}>{engagement.shares}</span>
          </Button>

          <Button
            variant="text"
            onClick={handleBookmark}
            loading={loading}
            disabled={loading}
            className={classNames(styles.post__action, {
              [styles['post__action--active']]: userInteraction.isBookmarked
            })}
            aria-label={`Bookmark post by ${author.name}`}
            aria-pressed={userInteraction.isBookmarked}
          >
            <span className={styles.post__actionIcon}>
              {userInteraction.isBookmarked ? '🔖' : '📑'}
            </span>
          </Button>
        </div>
      </footer>
    </Card>
  );
});

// Display name for debugging
ForumPost.displayName = 'ForumPost';

export default ForumPost;

/**
 * CSS Module styles (ForumPost.module.css):
 * 
 * .post {
 *   margin-bottom: 1rem;
 *   transition: transform 0.2s ease-in-out;
 * }
 * 
 * .post__header {
 *   display: flex;
 *   align-items: center;
 *   justify-content: space-between;
 *   margin-bottom: 1rem;
 * }
 * 
 * .post__author {
 *   display: flex;
 *   align-items: center;
 *   gap: 0.75rem;
 * }
 * 
 * .post__authorInfo {
 *   display: flex;
 *   flex-direction: column;
 * }
 * 
 * .post__authorName {
 *   font-weight: 600;
 *   font-size: 1rem;
 *   color: var(--color-text-primary);
 *   display: flex;
 *   align-items: center;
 *   gap: 0.5rem;
 * }
 * 
 * .post__authorRole {
 *   font-size: 0.875rem;
 *   color: var(--color-text-secondary);
 *   font-weight: normal;
 * }
 * 
 * .post__metadata {
 *   display: flex;
 *   align-items: center;
 *   gap: 0.75rem;
 *   font-size: 0.875rem;
 *   color: var(--color-text-secondary);
 * }
 * 
 * .post__content {
 *   font-size: 1rem;
 *   line-height: 1.5;
 *   color: var(--color-text-primary);
 *   margin-bottom: 1rem;
 *   white-space: pre-wrap;
 *   word-break: break-word;
 * }
 * 
 * .post__footer {
 *   border-top: 1px solid var(--color-border);
 *   padding-top: 1rem;
 * }
 * 
 * .post__actions {
 *   display: flex;
 *   gap: 1rem;
 *   align-items: center;
 * }
 * 
 * .post__action {
 *   display: flex;
 *   align-items: center;
 *   gap: 0.5rem;
 *   color: var(--color-text-secondary);
 *   transition: color 0.2s ease-in-out;
 * }
 * 
 * .post__action--active {
 *   color: var(--color-primary);
 * }
 * 
 * .post__actionCount {
 *   font-size: 0.875rem;
 * }
 * 
 * .post__error {
 *   background-color: var(--color-error-light);
 *   color: var(--color-error-dark);
 *   padding: 0.75rem;
 *   border-radius: 4px;
 *   margin-bottom: 1rem;
 * }
 * 
 * @media (max-width: 768px) {
 *   .post__header {
 *     flex-direction: column;
 *     align-items: flex-start;
 *   }
 * 
 *   .post__actions {
 *     justify-content: space-between;
 *     width: 100%;
 *   }
 * }
 */