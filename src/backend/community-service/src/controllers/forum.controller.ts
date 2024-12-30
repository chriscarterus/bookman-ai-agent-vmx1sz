// External imports
import { Request, Response } from 'express'; // v4.18.2
import { validate } from 'class-validator'; // v0.14.0
import { Logger } from 'winston'; // v3.8.0
import { RateLimiterRedis } from 'rate-limiter-flexible'; // v2.4.1
import { v4 as uuidv4 } from 'uuid'; // v9.0.0

// Internal imports
import { Post, PostDocument } from '../models/post.model';
import { NotificationService, NotificationType, NotificationPriority } from '../services/notification.service';
import { config } from '../config';

// Types and interfaces
interface PaginationOptions {
  page: number;
  limit: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

interface FilterOptions {
  type?: string[];
  tags?: string[];
  author?: string;
  isExpertContent?: boolean;
  status?: string[];
  fromDate?: Date;
  toDate?: Date;
}

@Controller('forum')
@UseGuards(AuthGuard)
export class ForumController {
  private readonly rateLimiter: RateLimiterRedis;

  constructor(
    private readonly notificationService: NotificationService,
    private readonly logger: Logger
  ) {
    // Initialize rate limiter
    this.rateLimiter = new RateLimiterRedis({
      storeClient: config.redis,
      keyPrefix: 'forum_rate_limit',
      points: config.server.rateLimitMax,
      duration: config.server.rateLimitWindow,
      blockDuration: 300 // 5 minutes block
    });
  }

  @Post('posts')
  @ValidateRequest()
  @RateLimit(10, '1m')
  async createPost(req: Request, res: Response): Promise<Response> {
    try {
      // Rate limiting check
      await this.rateLimiter.consume(req.user.id);

      // Validate request body
      const errors = await validate(req.body);
      if (errors.length > 0) {
        return res.status(400).json({
          status: 'error',
          message: 'Validation failed',
          errors: errors.map(error => error.constraints)
        });
      }

      // Extract user info from JWT token
      const { id: authorId, username: authorUsername, role } = req.user;

      // Create post object
      const post: Partial<PostDocument> = {
        title: req.body.title,
        content: req.body.content,
        type: req.body.type,
        author_id: authorId,
        author_username: authorUsername,
        is_expert_content: req.body.isExpertContent || false,
        tags: req.body.tags || [],
        status: 'draft',
        moderation_metadata: {
          review_status: 'pending'
        },
        engagement_metrics: {
          view_count: 0,
          like_count: 0,
          comment_count: 0,
          share_count: 0,
          save_count: 0,
          expert_endorsements: []
        }
      };

      // Handle expert content validation
      if (post.is_expert_content) {
        if (role !== 'expert') {
          return res.status(403).json({
            status: 'error',
            message: 'Only verified experts can create expert content'
          });
        }

        // Add expert credentials
        post.expert_credentials = {
          certifications: req.body.expertCredentials.certifications,
          experience_years: req.body.expertCredentials.experienceYears,
          specialization: req.body.expertCredentials.specialization,
          verification_date: new Date()
        };
      }

      // Create post
      const createdPost = await Post.create(post);

      // Create notification for followers
      await this.notificationService.createNotification({
        type: NotificationType.POST_COMMENT,
        userId: authorId,
        title: 'New Post Created',
        message: `Your post "${post.title}" has been created successfully`,
        metadata: {
          postId: createdPost._id,
          postType: post.type
        },
        priority: NotificationPriority.LOW
      });

      // Notify experts if expert content
      if (post.is_expert_content) {
        await this.notificationService.notifyExperts({
          type: NotificationType.EXPERT_WEBINAR,
          title: 'New Expert Content Available',
          message: `Expert ${authorUsername} has posted new content: "${post.title}"`,
          metadata: {
            postId: createdPost._id,
            expertId: authorId
          },
          priority: NotificationPriority.MEDIUM
        });
      }

      this.logger.info('Post created successfully', {
        postId: createdPost._id,
        authorId,
        type: post.type
      });

      return res.status(201).json({
        status: 'success',
        data: createdPost
      });

    } catch (error) {
      this.logger.error('Error creating post:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Internal server error'
      });
    }
  }

  @Get('posts')
  @RateLimit(100, '1m')
  async getPosts(req: Request, res: Response): Promise<Response> {
    try {
      // Extract pagination parameters
      const pagination: PaginationOptions = {
        page: parseInt(req.query.page as string) || 1,
        limit: Math.min(
          parseInt(req.query.limit as string) || config.content.defaultPageSize,
          config.content.maxPageSize
        ),
        sortBy: (req.query.sortBy as string) || 'created_at',
        sortOrder: (req.query.sortOrder as 'asc' | 'desc') || 'desc'
      };

      // Extract filter parameters
      const filters: FilterOptions = {
        type: req.query.type ? (req.query.type as string).split(',') : undefined,
        tags: req.query.tags ? (req.query.tags as string).split(',') : undefined,
        author: req.query.author as string,
        isExpertContent: req.query.isExpertContent === 'true',
        status: ['published'], // Default to published posts only
        fromDate: req.query.fromDate ? new Date(req.query.fromDate as string) : undefined,
        toDate: req.query.toDate ? new Date(req.query.toDate as string) : undefined
      };

      // Build query
      const query: any = {
        status: { $in: filters.status }
      };

      if (filters.type) query.type = { $in: filters.type };
      if (filters.tags) query.tags = { $in: filters.tags };
      if (filters.author) query.author_id = filters.author;
      if (filters.isExpertContent) query.is_expert_content = true;
      if (filters.fromDate) query.created_at = { $gte: filters.fromDate };
      if (filters.toDate) query.created_at = { $lte: filters.toDate };

      // Execute query with pagination
      const [posts, total] = await Promise.all([
        Post.find(query)
          .sort({ [pagination.sortBy]: pagination.sortOrder })
          .skip((pagination.page - 1) * pagination.limit)
          .limit(pagination.limit)
          .lean(),
        Post.countDocuments(query)
      ]);

      this.logger.info('Posts retrieved successfully', {
        total,
        page: pagination.page,
        limit: pagination.limit
      });

      return res.status(200).json({
        status: 'success',
        data: {
          posts,
          pagination: {
            total,
            page: pagination.page,
            limit: pagination.limit,
            totalPages: Math.ceil(total / pagination.limit)
          }
        }
      });

    } catch (error) {
      this.logger.error('Error retrieving posts:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Internal server error'
      });
    }
  }
}

export default ForumController;