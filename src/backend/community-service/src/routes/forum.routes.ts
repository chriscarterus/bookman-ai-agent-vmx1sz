// External imports - v4.18.2
import { Router } from 'express';
// External imports - v6.7.0
import rateLimit from 'express-rate-limit';
// External imports - v1.0.0
import cache from 'express-cache-middleware';

// Internal imports
import { ForumController } from '../controllers/forum.controller';
import { authenticateToken, validateRole } from '../../auth-service/src/middleware/jwt.middleware';
import { config } from '../config';

/**
 * Rate limit configurations for different user roles
 * Graduated rate limiting based on user privileges
 */
const standardRateLimit = rateLimit({
  windowMs: config.server.rateLimitWindow,
  max: config.server.rateLimitMax,
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false
});

const expertRateLimit = rateLimit({
  windowMs: config.server.rateLimitWindow,
  max: config.server.rateLimitMax * 2, // Double limit for experts
  message: 'Expert rate limit exceeded',
  standardHeaders: true,
  legacyHeaders: false
});

const moderatorRateLimit = rateLimit({
  windowMs: config.server.rateLimitWindow,
  max: config.server.rateLimitMax * 3, // Triple limit for moderators
  message: 'Moderator rate limit exceeded',
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Cache configuration for read operations
 */
const cacheMiddleware = cache({
  ttl: 300, // 5 minutes cache
  prefix: 'forum:',
  exclude: ['/posts/like', '/posts/flag']
});

/**
 * Initializes forum routes with enhanced security and moderation features
 * @param forumController Instance of ForumController
 * @returns Configured Express router
 */
export function initializeForumRoutes(forumController: ForumController): Router {
  const router = Router();

  // Configure caching for read operations
  router.use(cacheMiddleware);

  // GET /posts - Retrieve paginated list of forum posts
  router.get(
    '/posts',
    standardRateLimit,
    async (req, res) => await forumController.getPosts(req, res)
  );

  // POST /posts - Create new forum post with expert content validation
  router.post(
    '/posts',
    expertRateLimit,
    authenticateToken,
    validateRole(['user', 'expert', 'admin'], {
      customPermissions: ['create:post'],
      requireAllPermissions: true
    }),
    async (req, res) => await forumController.createPost(req, res)
  );

  // GET /posts/:id - Retrieve specific post by ID
  router.get(
    '/posts/:id',
    standardRateLimit,
    async (req, res) => await forumController.getPostById(req, res)
  );

  // PUT /posts/:id - Update existing post with ownership verification
  router.put(
    '/posts/:id',
    expertRateLimit,
    authenticateToken,
    validateRole(['user', 'expert', 'admin'], {
      customPermissions: ['update:post'],
      requireAllPermissions: true
    }),
    async (req, res) => await forumController.updatePost(req, res)
  );

  // DELETE /posts/:id - Delete post with enhanced moderation controls
  router.delete(
    '/posts/:id',
    moderatorRateLimit,
    authenticateToken,
    validateRole(['admin', 'moderator'], {
      customPermissions: ['delete:post'],
      requireAllPermissions: true
    }),
    async (req, res) => await forumController.deletePost(req, res)
  );

  // POST /posts/:id/like - Toggle like status on post
  router.post(
    '/posts/:id/like',
    standardRateLimit,
    authenticateToken,
    async (req, res) => await forumController.likePost(req, res)
  );

  // POST /posts/:id/comments - Add comment to post with threading support
  router.post(
    '/posts/:id/comments',
    standardRateLimit,
    authenticateToken,
    validateRole(['user', 'expert', 'admin']),
    async (req, res) => await forumController.addComment(req, res)
  );

  // POST /posts/:id/flag - Flag content for moderation review
  router.post(
    '/posts/:id/flag',
    standardRateLimit,
    authenticateToken,
    async (req, res) => await forumController.flagContent(req, res)
  );

  // POST /posts/:id/validate - Validate expert content
  router.post(
    '/posts/:id/validate',
    expertRateLimit,
    authenticateToken,
    validateRole(['expert', 'admin'], {
      customPermissions: ['validate:expert_content'],
      requireAllPermissions: true
    }),
    async (req, res) => await forumController.validateExpertContent(req, res)
  );

  return router;
}

// Export configured router
export const forumRouter = initializeForumRoutes(new ForumController());