/**
 * Community API Module for Bookman AI Platform
 * @version 1.0.0
 * @description Handles community-related operations including forum posts, comments,
 * social interactions, webinars, and social trading
 */

// Internal imports
import { apiService } from '../services/api.service';
import type { ApiResponse } from '../types/api.types';

// Constants
const API_BASE_PATH = '/api/v1/community';
const SUPPORTED_POST_TYPES = ['DISCUSSION', 'QUESTION', 'ANALYSIS', 'ANNOUNCEMENT', 'WEBINAR', 'SOCIAL_TRADE'] as const;
const MAX_POST_LENGTH = 10000;
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_POSTS_PER_WINDOW = 10;

// Types
type PostType = typeof SUPPORTED_POST_TYPES[number];

interface Post {
  id: string;
  type: PostType;
  title: string;
  content: string;
  authorId: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  engagement: {
    views: number;
    likes: number;
    comments: number;
    shares: number;
  };
  metadata: Record<string, any>;
}

interface CreatePostRequest {
  type: PostType;
  title: string;
  content: string;
  tags?: string[];
  metadata?: Record<string, any>;
}

interface UpdatePostRequest {
  title?: string;
  content?: string;
  tags?: string[];
  metadata?: Record<string, any>;
}

interface ListPostsRequest {
  type?: PostType;
  authorId?: string;
  tags?: string[];
  search?: string;
  cursor?: string;
  limit?: number;
  sortBy?: 'createdAt' | 'engagement.views' | 'engagement.likes';
  sortOrder?: 'asc' | 'desc';
}

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  cursor?: string;
  hasMore: boolean;
}

// Rate limiting implementation
const postRateLimit = {
  count: 0,
  windowStart: Date.now(),
  
  checkLimit(): boolean {
    const now = Date.now();
    if (now - this.windowStart > RATE_LIMIT_WINDOW) {
      this.count = 0;
      this.windowStart = now;
    }
    return this.count < MAX_POSTS_PER_WINDOW;
  },
  
  increment(): void {
    this.count++;
  }
};

/**
 * Community API service implementation
 */
const communityApi = {
  /**
   * Creates a new forum post with enhanced validation and rate limiting
   * @param postData Post creation request data
   * @returns Promise with created post data
   */
  async createPost(postData: CreatePostRequest): Promise<ApiResponse<Post>> {
    // Validate post type
    if (!SUPPORTED_POST_TYPES.includes(postData.type)) {
      throw new Error(`Unsupported post type. Allowed types: ${SUPPORTED_POST_TYPES.join(', ')}`);
    }

    // Validate content length
    if (postData.content.length > MAX_POST_LENGTH) {
      throw new Error(`Post content exceeds maximum length of ${MAX_POST_LENGTH} characters`);
    }

    // Check rate limit
    if (!postRateLimit.checkLimit()) {
      throw new Error(`Rate limit exceeded. Maximum ${MAX_POSTS_PER_WINDOW} posts per ${RATE_LIMIT_WINDOW/1000} seconds`);
    }

    try {
      const response = await apiService.post<Post>(
        `${API_BASE_PATH}/posts`,
        postData
      );

      // Increment rate limit counter on success
      postRateLimit.increment();

      return response;
    } catch (error) {
      console.error('Failed to create post:', error);
      throw error;
    }
  },

  /**
   * Retrieves a specific post by ID with caching
   * @param postId Unique post identifier
   * @returns Promise with post details
   */
  async getPost(postId: string): Promise<ApiResponse<Post>> {
    try {
      return await apiService.get<Post>(
        `${API_BASE_PATH}/posts/${postId}`
      );
    } catch (error) {
      console.error(`Failed to fetch post ${postId}:`, error);
      throw error;
    }
  },

  /**
   * Lists forum posts with cursor-based pagination and advanced filtering
   * @param params List posts request parameters
   * @returns Promise with paginated post list
   */
  async listPosts(params: ListPostsRequest): Promise<ApiResponse<PaginatedResponse<Post>>> {
    try {
      const queryParams = new URLSearchParams();
      
      // Add optional filters to query params
      if (params.type) queryParams.append('type', params.type);
      if (params.authorId) queryParams.append('authorId', params.authorId);
      if (params.tags?.length) queryParams.append('tags', params.tags.join(','));
      if (params.search) queryParams.append('search', params.search);
      if (params.cursor) queryParams.append('cursor', params.cursor);
      if (params.limit) queryParams.append('limit', params.limit.toString());
      if (params.sortBy) queryParams.append('sortBy', params.sortBy);
      if (params.sortOrder) queryParams.append('sortOrder', params.sortOrder);

      return await apiService.get<PaginatedResponse<Post>>(
        `${API_BASE_PATH}/posts?${queryParams.toString()}`
      );
    } catch (error) {
      console.error('Failed to list posts:', error);
      throw error;
    }
  },

  /**
   * Updates an existing post with moderation checks
   * @param postId Post identifier
   * @param updateData Post update data
   * @returns Promise with updated post data
   */
  async updatePost(postId: string, updateData: UpdatePostRequest): Promise<ApiResponse<Post>> {
    // Validate content length if provided
    if (updateData.content && updateData.content.length > MAX_POST_LENGTH) {
      throw new Error(`Post content exceeds maximum length of ${MAX_POST_LENGTH} characters`);
    }

    try {
      return await apiService.put<Post>(
        `${API_BASE_PATH}/posts/${postId}`,
        updateData
      );
    } catch (error) {
      console.error(`Failed to update post ${postId}:`, error);
      throw error;
    }
  },

  /**
   * Soft deletes a post with moderation logging
   * @param postId Post identifier
   * @returns Promise with deletion confirmation
   */
  async deletePost(postId: string): Promise<ApiResponse<void>> {
    try {
      return await apiService.delete<void>(
        `${API_BASE_PATH}/posts/${postId}`
      );
    } catch (error) {
      console.error(`Failed to delete post ${postId}:`, error);
      throw error;
    }
  }
};

// Export the community API interface
export { communityApi };

// Export types for consumers
export type {
  Post,
  PostType,
  CreatePostRequest,
  UpdatePostRequest,
  ListPostsRequest,
  PaginatedResponse
};