/**
 * @fileoverview A comprehensive React component for displaying detailed forum post views
 * with real-time updates, accessibility features, and performance optimizations.
 * @version 1.0.0
 */

import React, { useEffect, useMemo, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from 'react-query'; // ^3.39.3
import { useVirtualizer } from 'react-virtual'; // ^2.10.4
import { useParams, useNavigate } from 'react-router-dom';
import ForumPost from '../../components/community/ForumPost';
import { communityApi } from '../../api/community';
import Button from '../../components/common/Button';
import Card from '../../components/common/Card';
import { LoadingState, ErrorSeverity } from '../../types/api.types';
import styles from './PostDetail.module.css';

// Constants for virtualization and real-time updates
const COMMENT_ITEM_SIZE = 100;
const COMMENTS_CONTAINER_HEIGHT = 600;
const REAL_TIME_UPDATE_INTERVAL = 5000;

/**
 * Props interface for the PostDetail component
 */
interface PostDetailProps {
  moderationEnabled?: boolean;
  realTimeUpdates?: boolean;
  className?: string;
}

/**
 * Custom hook for managing real-time comment subscriptions
 */
const useCommentSubscription = (postId: string) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const setupSubscription = async () => {
      try {
        unsubscribe = await communityApi.subscribeToComments(postId, (newComment) => {
          queryClient.setQueryData(['post', postId, 'comments'], (oldData: any) => ({
            ...oldData,
            items: [newComment, ...(oldData?.items || [])]
          }));
        });
      } catch (error) {
        console.error('Failed to setup comment subscription:', error);
      }
    };

    setupSubscription();
    return () => {
      unsubscribe?.();
    };
  }, [postId, queryClient]);
};

/**
 * PostDetail component for displaying comprehensive forum post information
 * with real-time updates and accessibility features
 */
const PostDetail: React.FC<PostDetailProps> = ({
  moderationEnabled = false,
  realTimeUpdates = true,
  className
}) => {
  const { postId } = useParams<{ postId: string }>();
  const navigate = useNavigate();
  const commentsContainerRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // Setup real-time comment subscription if enabled
  if (realTimeUpdates) {
    useCommentSubscription(postId!);
  }

  // Fetch post data with react-query
  const { data: post, isLoading, error } = useQuery(
    ['post', postId],
    () => communityApi.getPost(postId!),
    {
      staleTime: 30000,
      cacheTime: 300000,
      retry: 2,
      refetchOnWindowFocus: true
    }
  );

  // Virtual list configuration for comments
  const rowVirtualizer = useVirtualizer({
    count: post?.data?.comments?.length || 0,
    getScrollElement: () => commentsContainerRef.current,
    estimateSize: () => COMMENT_ITEM_SIZE,
    overscan: 5
  });

  // Memoized handlers for post interactions
  const handleLike = useCallback(async () => {
    try {
      await communityApi.updatePost(postId!, {
        engagement: {
          ...post?.data.engagement,
          likes: (post?.data.engagement.likes || 0) + 1
        }
      });
      queryClient.invalidateQueries(['post', postId]);
    } catch (error) {
      console.error('Failed to like post:', error);
    }
  }, [postId, post, queryClient]);

  const handleDelete = useCallback(async () => {
    if (!moderationEnabled) return;
    
    try {
      await communityApi.deletePost(postId!);
      navigate('/community');
    } catch (error) {
      console.error('Failed to delete post:', error);
    }
  }, [postId, moderationEnabled, navigate]);

  // Loading state handler with accessibility
  if (isLoading) {
    return (
      <div 
        className={styles.loading}
        role="status"
        aria-live="polite"
      >
        <span className="sr-only">Loading post details...</span>
      </div>
    );
  }

  // Error state handler with accessibility
  if (error || !post) {
    return (
      <Card
        className={styles.error}
        role="alert"
        aria-live="assertive"
      >
        <h2>Error Loading Post</h2>
        <p>{error?.message || 'Failed to load post details'}</p>
        <Button
          variant="primary"
          onClick={() => queryClient.invalidateQueries(['post', postId])}
        >
          Retry
        </Button>
      </Card>
    );
  }

  return (
    <article 
      className={styles.postDetail}
      aria-labelledby="post-title"
    >
      {/* Main post content */}
      <ForumPost
        id={post.data.id}
        author={post.data.author}
        content={post.data.content}
        createdAt={new Date(post.data.createdAt)}
        engagement={post.data.engagement}
        userInteraction={{
          isLiked: false,
          isBookmarked: false,
          hasCommented: false
        }}
        onLike={handleLike}
        className={styles.mainPost}
      />

      {/* Moderation controls */}
      {moderationEnabled && (
        <div 
          className={styles.moderationControls}
          role="group"
          aria-label="Post moderation controls"
        >
          <Button
            variant="outline"
            onClick={handleDelete}
            className={styles.deleteButton}
            aria-label="Delete post"
          >
            Delete Post
          </Button>
        </div>
      )}

      {/* Comments section */}
      <section 
        className={styles.comments}
        aria-label="Post comments"
      >
        <h2 id="comments-heading">Comments</h2>
        <div
          ref={commentsContainerRef}
          className={styles.commentsContainer}
          style={{ height: COMMENTS_CONTAINER_HEIGHT }}
        >
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative'
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => (
              <div
                key={virtualRow.index}
                className={styles.commentItem}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`
                }}
              >
                {post.data.comments[virtualRow.index]}
              </div>
            ))}
          </div>
        </div>
      </section>
    </article>
  );
};

export default PostDetail;

/**
 * CSS Module styles (PostDetail.module.css):
 * 
 * .postDetail {
 *   max-width: 1200px;
 *   margin: 0 auto;
 *   padding: 24px;
 * }
 * 
 * .mainPost {
 *   margin-bottom: 32px;
 * }
 * 
 * .moderationControls {
 *   margin-bottom: 24px;
 *   padding: 16px;
 *   background-color: var(--color-background-paper);
 *   border-radius: 8px;
 * }
 * 
 * .deleteButton {
 *   color: var(--color-error-main);
 * }
 * 
 * .comments {
 *   background-color: var(--color-background-paper);
 *   border-radius: 8px;
 *   padding: 24px;
 * }
 * 
 * .commentsContainer {
 *   overflow-y: auto;
 *   border: 1px solid var(--color-border);
 *   border-radius: 4px;
 * }
 * 
 * .commentItem {
 *   padding: 16px;
 *   border-bottom: 1px solid var(--color-border);
 * }
 * 
 * .loading {
 *   display: flex;
 *   justify-content: center;
 *   align-items: center;
 *   min-height: 400px;
 * }
 * 
 * .error {
 *   max-width: 600px;
 *   margin: 32px auto;
 *   text-align: center;
 * }
 */