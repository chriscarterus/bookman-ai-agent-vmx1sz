// External imports - v29.0.0
import { describe, beforeAll, beforeEach, afterAll, it, expect, jest } from 'jest';
// External imports - v6.3.3
import request from 'supertest';
// External imports - v8.13.0
import { MongoMemoryServer } from 'mongodb-memory-server';
// External imports - v8.0.0
import { faker } from '@faker-js/faker';
// External imports - v0.56.3
import RedisMock from 'redis-mock';

// Internal imports
import { ForumController } from '../src/controllers/forum.controller';
import { Post } from '../src/models/post.model';
import { NotificationService, NotificationType, NotificationPriority } from '../src/services/notification.service';
import { config } from '../config';

describe('Forum Controller Tests', () => {
  let mongoServer: MongoMemoryServer;
  let forumController: ForumController;
  let notificationService: NotificationService;
  let redisMock: any;

  // Test users with different roles
  const testUser = {
    id: 'test-user-id',
    username: 'testuser',
    role: 'user',
    expertStatus: false
  };

  const testExpert = {
    id: 'test-expert-id',
    username: 'expertuser',
    role: 'expert',
    expertStatus: true
  };

  const testAdmin = {
    id: 'test-admin-id',
    username: 'adminuser',
    role: 'admin',
    expertStatus: false
  };

  // Rate limiting configuration
  const rateLimits = {
    postCreation: 10,
    postUpdate: 20,
    likeAction: 50
  };

  beforeAll(async () => {
    // Setup MongoDB memory server
    mongoServer = await MongoMemoryServer.create({
      instance: {
        dbName: 'test-forum',
        storageEngine: 'wiredTiger'
      }
    });

    // Setup Redis mock
    redisMock = new RedisMock();

    // Initialize notification service mock
    notificationService = new NotificationService();
    jest.spyOn(notificationService, 'createNotification');
    jest.spyOn(notificationService, 'broadcastNotification');

    // Initialize forum controller with mocked dependencies
    forumController = new ForumController(notificationService, config.logger);

    // Setup database indexes
    await Post.createIndexes();
  });

  beforeEach(async () => {
    // Clear database collections
    await Post.deleteMany({});

    // Reset notification service mocks
    jest.clearAllMocks();

    // Reset rate limiting counters
    await redisMock.flushall();
  });

  afterAll(async () => {
    // Cleanup
    await mongoServer.stop();
    await redisMock.quit();
  });

  describe('Post Creation Tests', () => {
    it('should create a regular post successfully', async () => {
      const postData = {
        title: faker.lorem.sentence(),
        content: faker.lorem.paragraphs(2),
        type: 'discussion',
        tags: [faker.word.sample(), faker.word.sample()]
      };

      const response = await request(forumController)
        .post('/posts')
        .send(postData)
        .set('Authorization', `Bearer ${testUser.id}`);

      expect(response.status).toBe(201);
      expect(response.body.status).toBe('success');
      expect(response.body.data).toMatchObject({
        title: postData.title,
        content: postData.content,
        author_id: testUser.id,
        type: postData.type
      });

      // Verify notification was created
      expect(notificationService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: NotificationType.POST_COMMENT,
          userId: testUser.id
        })
      );
    });

    it('should enforce rate limiting for post creation', async () => {
      const postData = {
        title: faker.lorem.sentence(),
        content: faker.lorem.paragraph(),
        type: 'discussion'
      };

      // Create posts until rate limit is exceeded
      for (let i = 0; i <= rateLimits.postCreation; i++) {
        const response = await request(forumController)
          .post('/posts')
          .send(postData)
          .set('Authorization', `Bearer ${testUser.id}`);

        if (i < rateLimits.postCreation) {
          expect(response.status).toBe(201);
        } else {
          expect(response.status).toBe(429);
          expect(response.body.message).toContain('Rate limit exceeded');
        }
      }
    });

    it('should validate expert content creation permissions', async () => {
      const expertPostData = {
        title: faker.lorem.sentence(),
        content: faker.lorem.paragraphs(3),
        type: 'webinar',
        isExpertContent: true,
        expertCredentials: {
          certifications: ['CFA Level III'],
          experienceYears: 10,
          specialization: ['Cryptocurrency Trading']
        }
      };

      // Attempt with regular user
      const regularUserResponse = await request(forumController)
        .post('/posts')
        .send(expertPostData)
        .set('Authorization', `Bearer ${testUser.id}`);

      expect(regularUserResponse.status).toBe(403);

      // Attempt with expert user
      const expertResponse = await request(forumController)
        .post('/posts')
        .send(expertPostData)
        .set('Authorization', `Bearer ${testExpert.id}`);

      expect(expertResponse.status).toBe(201);
      expect(expertResponse.body.data.is_expert_content).toBe(true);
    });
  });

  describe('Post Retrieval Tests', () => {
    it('should retrieve posts with pagination and filtering', async () => {
      // Create test posts
      const posts = await Promise.all([
        Post.create({
          title: faker.lorem.sentence(),
          content: faker.lorem.paragraphs(2),
          type: 'discussion',
          author_id: testUser.id,
          status: 'published'
        }),
        Post.create({
          title: faker.lorem.sentence(),
          content: faker.lorem.paragraphs(2),
          type: 'webinar',
          author_id: testExpert.id,
          is_expert_content: true,
          status: 'published'
        })
      ]);

      // Test pagination
      const response = await request(forumController)
        .get('/posts')
        .query({
          page: 1,
          limit: 10,
          type: 'discussion,webinar',
          isExpertContent: true
        });

      expect(response.status).toBe(200);
      expect(response.body.data.posts).toHaveLength(1);
      expect(response.body.data.pagination).toMatchObject({
        page: 1,
        limit: 10,
        total: 1
      });
    });

    it('should properly sort and filter posts', async () => {
      // Create posts with different dates
      const posts = await Promise.all([
        Post.create({
          title: 'Older Post',
          content: faker.lorem.paragraphs(1),
          type: 'discussion',
          author_id: testUser.id,
          status: 'published',
          created_at: new Date('2023-01-01')
        }),
        Post.create({
          title: 'Newer Post',
          content: faker.lorem.paragraphs(1),
          type: 'discussion',
          author_id: testUser.id,
          status: 'published',
          created_at: new Date('2023-02-01')
        })
      ]);

      // Test sorting
      const response = await request(forumController)
        .get('/posts')
        .query({
          sortBy: 'created_at',
          sortOrder: 'desc'
        });

      expect(response.status).toBe(200);
      expect(response.body.data.posts[0].title).toBe('Newer Post');
    });
  });

  describe('Social Interaction Tests', () => {
    let testPost: any;

    beforeEach(async () => {
      testPost = await Post.create({
        title: faker.lorem.sentence(),
        content: faker.lorem.paragraphs(1),
        type: 'discussion',
        author_id: testUser.id,
        status: 'published'
      });
    });

    it('should handle post likes correctly', async () => {
      const response = await request(forumController)
        .post(`/posts/${testPost._id}/like`)
        .set('Authorization', `Bearer ${testUser.id}`);

      expect(response.status).toBe(200);
      expect(response.body.data.likes).toContain(testUser.id);

      // Verify notification was sent to post author
      expect(notificationService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: NotificationType.POST_LIKE,
          userId: testPost.author_id
        })
      );
    });

    it('should enforce rate limiting for social actions', async () => {
      // Create multiple likes to trigger rate limit
      for (let i = 0; i <= rateLimits.likeAction; i++) {
        const response = await request(forumController)
          .post(`/posts/${testPost._id}/like`)
          .set('Authorization', `Bearer ${testUser.id}`);

        if (i < rateLimits.likeAction) {
          expect(response.status).toBe(200);
        } else {
          expect(response.status).toBe(429);
        }
      }
    });
  });

  describe('Moderation Tests', () => {
    let flaggedPost: any;

    beforeEach(async () => {
      flaggedPost = await Post.create({
        title: faker.lorem.sentence(),
        content: faker.lorem.paragraphs(1),
        type: 'discussion',
        author_id: testUser.id,
        status: 'published',
        moderation_metadata: {
          review_status: 'pending'
        }
      });
    });

    it('should allow admins to moderate posts', async () => {
      const moderationData = {
        action: 'flag',
        reason: 'inappropriate',
        notes: 'Violates community guidelines'
      };

      const response = await request(forumController)
        .post(`/posts/${flaggedPost._id}/moderate`)
        .send(moderationData)
        .set('Authorization', `Bearer ${testAdmin.id}`);

      expect(response.status).toBe(200);
      expect(response.body.data.moderation_metadata).toMatchObject({
        review_status: 'rejected',
        reason: moderationData.reason,
        notes: moderationData.notes,
        moderator_id: testAdmin.id
      });

      // Verify notification was sent to post author
      expect(notificationService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: NotificationType.SYSTEM_ANNOUNCEMENT,
          userId: flaggedPost.author_id,
          priority: NotificationPriority.HIGH
        })
      );
    });

    it('should prevent non-admins from moderating posts', async () => {
      const response = await request(forumController)
        .post(`/posts/${flaggedPost._id}/moderate`)
        .send({ action: 'flag' })
        .set('Authorization', `Bearer ${testUser.id}`);

      expect(response.status).toBe(403);
    });
  });
});