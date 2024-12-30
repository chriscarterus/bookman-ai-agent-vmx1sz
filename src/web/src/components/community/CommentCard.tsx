/**
 * @fileoverview A reusable React component for displaying user comments in the community forum
 * with support for user avatars, timestamps, voting, moderation actions, real-time updates,
 * and enhanced accessibility features.
 * @version 1.0.0
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import classNames from 'classnames'; // ^2.3.2
import { formatDistanceToNow } from 'date-fns'; // ^2.30.0

// Internal imports
import { BaseComponentProps } from '../../types/common.types';
import { Avatar } from '../common/Avatar';
import { communityApi } from '../../api/community';

// Constants
const VOTE_DEBOUNCE_MS = 500;
const MAX_CONTENT_LENGTH = 10000;
const MODERATION_STATUSES = {
  APPROVED: 'approved',
  PENDING: 'pending',
  FLAGGED: 'flagged',
  REMOVED: 'removed'
} as const;

/**
 * Props interface for CommentCard component with enhanced accessibility and moderation
 */
interface CommentCardProps extends BaseComponentProps {
  comment: {
    id: string;
    content: string;
    author: {
      id: string;
      name: string;
      avatarUrl?: string;
      role: string;
    };
    createdAt: Date;
    updatedAt?: Date;
    votes: number;
    isEdited: boolean;
    moderationStatus: string;
    reports: number;
  };
  onVote: (commentId: string, direction: string, isUndo: boolean) => Promise<void>;
  onEdit: (commentId: string, newContent: string, moderationNote?: string) => Promise<void>;
  onDelete: (commentId: string, reason: string) => Promise<void>;
  onReport: (commentId: string, reason: string, details: string) => Promise<void>;
  isCurrentUser: boolean;
  isModerator: boolean;
  darkMode?: boolean;
  realTimeUpdates?: boolean;
}

/**
 * CommentCard component for displaying user comments with enhanced functionality
 */
export const CommentCard: React.FC<CommentCardProps> = ({
  comment,
  onVote,
  onEdit,
  onDelete,
  onReport,
  isCurrentUser,
  isModerator,
  darkMode = false,
  realTimeUpdates = true,
  className,
  ariaLabel,
  ...rest
}) => {
  // State management
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [voteCount, setVoteCount] = useState(comment.votes);
  const [userVote, setUserVote] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs
  const voteDebounceTimer = useRef<NodeJS.Timeout>();
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);

  /**
   * Handles voting with debouncing and optimistic updates
   */
  const handleVote = useCallback(async (direction: string, isUndo: boolean = false) => {
    if (voteDebounceTimer.current) {
      clearTimeout(voteDebounceTimer.current);
    }

    // Optimistic update
    const voteChange = isUndo ? (direction === 'up' ? -1 : 1) : (direction === 'up' ? 1 : -1);
    setVoteCount(prev => prev + voteChange);
    setUserVote(isUndo ? null : direction);

    voteDebounceTimer.current = setTimeout(async () => {
      try {
        await onVote(comment.id, direction, isUndo);
      } catch (err) {
        // Revert optimistic update on error
        setVoteCount(prev => prev - voteChange);
        setUserVote(isUndo ? direction : null);
        setError('Failed to register vote. Please try again.');
      }
    }, VOTE_DEBOUNCE_MS);
  }, [comment.id, onVote]);

  /**
   * Handles comment editing with validation and sanitization
   */
  const handleEdit = useCallback(async () => {
    if (!editContent.trim() || editContent.length > MAX_CONTENT_LENGTH) {
      setError('Invalid comment content');
      return;
    }

    setIsLoading(true);
    try {
      await onEdit(comment.id, editContent);
      setIsEditing(false);
      setError(null);
    } catch (err) {
      setError('Failed to update comment. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [comment.id, editContent, onEdit]);

  /**
   * Handles comment deletion with confirmation
   */
  const handleDelete = useCallback(async () => {
    if (!window.confirm('Are you sure you want to delete this comment?')) {
      return;
    }

    setIsLoading(true);
    try {
      await onDelete(comment.id, 'User initiated deletion');
    } catch (err) {
      setError('Failed to delete comment. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [comment.id, onDelete]);

  /**
   * Handles comment reporting with reason
   */
  const handleReport = useCallback(async () => {
    const reason = window.prompt('Please provide a reason for reporting this comment:');
    if (!reason) return;

    try {
      await onReport(comment.id, reason, 'User reported content');
    } catch (err) {
      setError('Failed to report comment. Please try again.');
    }
  }, [comment.id, onReport]);

  // Real-time updates subscription
  useEffect(() => {
    if (!realTimeUpdates) return;

    const unsubscribe = communityApi.subscribeToUpdates(comment.id, (updatedComment) => {
      setVoteCount(updatedComment.votes);
    });

    return () => {
      unsubscribe?.();
    };
  }, [comment.id, realTimeUpdates]);

  // Focus textarea when editing starts
  useEffect(() => {
    if (isEditing && editTextareaRef.current) {
      editTextareaRef.current.focus();
    }
  }, [isEditing]);

  return (
    <div
      className={classNames(
        'comment-card',
        {
          'comment-card--dark': darkMode,
          'comment-card--flagged': comment.moderationStatus === MODERATION_STATUSES.FLAGGED,
          'comment-card--removed': comment.moderationStatus === MODERATION_STATUSES.REMOVED
        },
        className
      )}
      aria-label={ariaLabel || `Comment by ${comment.author.name}`}
      {...rest}
    >
      <div className="comment-card__header">
        <Avatar
          src={comment.author.avatarUrl}
          name={comment.author.name}
          size="small"
          darkMode={darkMode}
        />
        <div className="comment-card__meta">
          <span className="comment-card__author">{comment.author.name}</span>
          <span className="comment-card__role">{comment.author.role}</span>
          <time className="comment-card__time" dateTime={comment.createdAt.toISOString()}>
            {formatDistanceToNow(comment.createdAt, { addSuffix: true })}
          </time>
          {comment.isEdited && (
            <span className="comment-card__edited" aria-label="Comment was edited">
              (edited)
            </span>
          )}
        </div>
      </div>

      <div className="comment-card__content">
        {isEditing ? (
          <textarea
            ref={editTextareaRef}
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            maxLength={MAX_CONTENT_LENGTH}
            disabled={isLoading}
            aria-label="Edit comment"
          />
        ) : (
          <p>{comment.content}</p>
        )}
      </div>

      <div className="comment-card__actions">
        <div className="comment-card__votes" aria-label={`${voteCount} votes`}>
          <button
            onClick={() => handleVote('up', userVote === 'up')}
            className={classNames('vote-button', { active: userVote === 'up' })}
            aria-label="Upvote"
            disabled={isLoading}
          >
            ▲
          </button>
          <span>{voteCount}</span>
          <button
            onClick={() => handleVote('down', userVote === 'down')}
            className={classNames('vote-button', { active: userVote === 'down' })}
            aria-label="Downvote"
            disabled={isLoading}
          >
            ▼
          </button>
        </div>

        {(isCurrentUser || isModerator) && (
          <div className="comment-card__moderation">
            {isEditing ? (
              <>
                <button
                  onClick={handleEdit}
                  disabled={isLoading}
                  aria-label="Save edit"
                >
                  Save
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  disabled={isLoading}
                  aria-label="Cancel edit"
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setIsEditing(true)}
                  disabled={isLoading}
                  aria-label="Edit comment"
                >
                  Edit
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isLoading}
                  aria-label="Delete comment"
                >
                  Delete
                </button>
              </>
            )}
          </div>
        )}

        {!isCurrentUser && (
          <button
            onClick={handleReport}
            className="comment-card__report"
            disabled={isLoading}
            aria-label="Report comment"
          >
            Report
          </button>
        )}
      </div>

      {error && (
        <div className="comment-card__error" role="alert">
          {error}
        </div>
      )}
    </div>
  );
};

export default CommentCard;