/**
 * @fileoverview Enhanced Forum page component for the Bookman AI platform
 * Implements real-time forum functionality with advanced features like
 * virtualization, accessibility, and security measures
 * @version 1.0.0
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useVirtualizer } from 'react-virtual';
import { useErrorBoundary } from 'react-error-boundary';
import ForumPost from '../../components/community/ForumPost';
import PostEditor from '../../components/community/PostEditor';
import { communityApi } from '../../api/community';
import { LoadingState, ErrorSeverity } from '../../types/api.types';
import Button from '../../components/common/Button';
import styles from './Forum.module.css';

// Constants for forum configuration
const POSTS_PER_PAGE = 20;
const VIRTUALIZATION_OPTIONS = {
  overscan: 5,
  estimateSize: () => 250,
};

// Interface for forum state management
interface ForumState {
  posts: Array<{
    id: string;
    author: {
      id: string;
      name: string;
      avatarUrl: string;
      role: string;
      reputation: number;
    };
    content: string;
    createdAt: Date;
    engagement: {
      likes: number;
      comments: number;
      shares: number;
    };
    userInteraction: {
      isLiked: boolean;
      isBookmarked: boolean;
      hasCommented: boolean;
    };
  }>;
  loadingState: LoadingState;
  error: string | null;
  currentPage: number;
  hasMore: boolean;
  isCreatingPost: boolean;
}

/**
 * Enhanced Forum component with real-time updates and accessibility
 */
const Forum: React.FC = React.memo(() => {
  // State management
  const [state, setState] = useState<ForumState>({
    posts: [],
    loadingState: LoadingState.IDLE,
    error: null,
    currentPage: 1,
    hasMore: true,
    isCreatingPost: false,
  });

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const lastLoadTimeRef = useRef<number>(Date.now());
  
  // Error boundary integration
  const { showBoundary } = useErrorBoundary();

  // Virtual list configuration
  const rowVirtualizer = useVirtualizer({
    count: state.posts.length + (state.hasMore ? 1 : 0),
    getScrollElement: () => containerRef.current,
    ...VIRTUALIZATION_OPTIONS,
  });

  /**
   * Fetches forum posts with error handling and rate limiting
   */
  const fetchPosts = useCallback(async (page: number) => {
    // Rate limiting check
    const now = Date.now();
    if (now - lastLoadTimeRef.current < 1000) {
      return;
    }
    lastLoadTimeRef.current = now;

    try {
      setState(prev => ({
        ...prev,
        loadingState: LoadingState.LOADING,
        error: null,
      }));

      const response = await communityApi.listPosts({
        limit: POSTS_PER_PAGE,
        page,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      setState(prev => ({
        ...prev,
        posts: page === 1 ? response.data.items : [...prev.posts, ...response.data.items],
        hasMore: response.data.hasMore,
        currentPage: page,
        loadingState: LoadingState.SUCCESS,
      }));
    } catch (error) {
      console.error('Failed to fetch posts:', error);
      setState(prev => ({
        ...prev,
        loadingState: LoadingState.ERROR,
        error: 'Failed to load forum posts. Please try again.',
      }));
      showBoundary(error);
    }
  }, [showBoundary]);

  /**
   * Handles infinite scroll loading
   */
  const handleLoadMore = useCallback(() => {
    if (state.loadingState === LoadingState.LOADING || !state.hasMore) return;
    fetchPosts(state.currentPage + 1);
  }, [state.loadingState, state.hasMore, state.currentPage, fetchPosts]);

  /**
   * Handles post creation
   */
  const handleCreatePost = useCallback(async (content: string) => {
    try {
      setState(prev => ({ ...prev, isCreatingPost: true }));
      
      await communityApi.createPost({
        type: 'DISCUSSION',
        title: '',
        content,
      });

      // Refresh posts after creation
      fetchPosts(1);
      setState(prev => ({ ...prev, isCreatingPost: false }));
    } catch (error) {
      console.error('Failed to create post:', error);
      setState(prev => ({
        ...prev,
        isCreatingPost: false,
        error: 'Failed to create post. Please try again.',
      }));
      showBoundary(error);
    }
  }, [fetchPosts, showBoundary]);

  // Initial load
  useEffect(() => {
    fetchPosts(1);
  }, [fetchPosts]);

  // Intersection observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) {
          handleLoadMore();
        }
      },
      { threshold: 0.5 }
    );

    const lastItem = containerRef.current?.lastElementChild;
    if (lastItem) {
      observer.observe(lastItem);
    }

    return () => observer.disconnect();
  }, [handleLoadMore]);

  return (
    <div className={styles.forum} role="main" aria-label="Community Forum">
      <header className={styles.forum__header}>
        <h1>Community Forum</h1>
        <Button
          variant="primary"
          size="medium"
          onClick={() => setState(prev => ({ ...prev, isCreatingPost: true }))}
          aria-label="Create new post"
        >
          Create Post
        </Button>
      </header>

      {state.error && (
        <div 
          className={styles.forum__error}
          role="alert"
          aria-live="polite"
        >
          {state.error}
        </div>
      )}

      {state.isCreatingPost && (
        <PostEditor
          postType="DISCUSSION"
          onSubmit={handleCreatePost}
          onCancel={() => setState(prev => ({ ...prev, isCreatingPost: false }))}
          aria-label="Create new forum post"
        />
      )}

      <div 
        ref={containerRef}
        className={styles.forum__content}
        role="feed"
        aria-busy={state.loadingState === LoadingState.LOADING}
      >
        {rowVirtualizer.getVirtualItems().map(virtualRow => {
          const post = state.posts[virtualRow.index];
          return post ? (
            <ForumPost
              key={post.id}
              id={post.id}
              author={post.author}
              content={post.content}
              createdAt={new Date(post.createdAt)}
              engagement={post.engagement}
              userInteraction={post.userInteraction}
              className={styles.forum__post}
            />
          ) : null;
        })}

        {state.loadingState === LoadingState.LOADING && (
          <div 
            className={styles.forum__loading}
            role="status"
            aria-label="Loading more posts"
          >
            Loading...
          </div>
        )}
      </div>
    </div>
  );
});

// Display name for debugging
Forum.displayName = 'Forum';

export default Forum;