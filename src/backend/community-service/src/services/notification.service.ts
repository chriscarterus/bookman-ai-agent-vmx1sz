// External imports
import Redis from 'ioredis'; // v5.3.0
import WebSocket from 'ws'; // v8.13.0
import { Logger, createLogger, format, transports } from 'winston'; // v3.10.0
import { RateLimiterRedis } from 'rate-limiter-flexible'; // v2.4.1
import { validate } from 'class-validator'; // v0.14.0
import { v4 as uuidv4 } from 'uuid'; // v9.0.0

// Internal imports
import { config } from '../config';
import { Post } from '../models/post.model';

// Type definitions
export enum NotificationType {
  POST_LIKE = 'POST_LIKE',
  POST_COMMENT = 'POST_COMMENT',
  MENTION = 'MENTION',
  SYSTEM_ANNOUNCEMENT = 'SYSTEM_ANNOUNCEMENT',
  EXPERT_WEBINAR = 'EXPERT_WEBINAR',
  TRADING_ALERT = 'TRADING_ALERT'
}

export enum NotificationPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT'
}

interface NotificationPayload {
  id?: string;
  type: NotificationType;
  userId: string;
  title: string;
  message: string;
  metadata?: Record<string, any>;
  priority?: NotificationPriority;
  expiresAt?: Date;
}

interface BroadcastOptions {
  priority?: NotificationPriority;
  retryCount?: number;
  ttl?: number;
}

interface PaginationOptions {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

interface FilterOptions {
  type?: NotificationType[];
  priority?: NotificationPriority[];
  startDate?: Date;
  endDate?: Date;
  read?: boolean;
}

@Injectable()
export class NotificationService {
  private readonly redisCluster: Redis.Cluster;
  private readonly wsServer: WebSocket.Server;
  private readonly userConnections: Map<string, Set<WebSocket>>;
  private readonly rateLimiter: RateLimiterRedis;
  private readonly logger: Logger;

  constructor() {
    // Initialize Redis cluster
    this.redisCluster = new Redis.Cluster([
      {
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password
      }
    ], {
      redisOptions: {
        enableAutoPipelining: true,
        maxRetriesPerRequest: config.redis.maxRetries,
        tls: config.redis.tls ? {} : undefined
      }
    });

    // Initialize WebSocket server with SSL
    this.wsServer = new WebSocket.Server({
      server: config.features.enableWebSockets ? server : undefined,
      perMessageDeflate: true,
      maxPayload: 1024 * 1024, // 1MB
      clientTracking: true
    });

    // Initialize rate limiter
    this.rateLimiter = new RateLimiterRedis({
      storeClient: this.redisCluster,
      keyPrefix: 'notification_limit',
      points: 100, // Max notifications per window
      duration: 60, // Per 1 minute
      blockDuration: 60 * 2 // Block for 2 minutes if exceeded
    });

    // Initialize connection tracking
    this.userConnections = new Map();

    // Initialize logger
    this.logger = createLogger({
      level: config.app.logLevel,
      format: format.combine(
        format.timestamp(),
        format.json()
      ),
      transports: [
        new transports.Console(),
        new transports.File({ filename: 'notification-service.log' })
      ]
    });

    this.initializeWebSocketHandlers();
  }

  private initializeWebSocketHandlers(): void {
    this.wsServer.on('connection', async (ws: WebSocket, request: any) => {
      try {
        await this.handleConnection(ws, request);
      } catch (error) {
        this.logger.error('WebSocket connection error:', error);
        ws.close(1011, 'Internal server error');
      }
    });
  }

  @RateLimit()
  @Authenticate()
  private async handleConnection(ws: WebSocket, request: any): Promise<void> {
    const userId = await this.authenticateConnection(request);
    if (!userId) {
      ws.close(1008, 'Authentication failed');
      return;
    }

    // Add to connection pool
    if (!this.userConnections.has(userId)) {
      this.userConnections.set(userId, new Set());
    }
    this.userConnections.get(userId)!.add(ws);

    // Setup heartbeat
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    }, 30000);

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('close', () => {
      clearInterval(pingInterval);
      this.userConnections.get(userId)?.delete(ws);
      if (this.userConnections.get(userId)?.size === 0) {
        this.userConnections.delete(userId);
      }
    });
  }

  @Validate()
  @Retry(3)
  public async createNotification(payload: NotificationPayload, priority: NotificationPriority = NotificationPriority.MEDIUM): Promise<any> {
    try {
      // Rate limiting check
      await this.rateLimiter.consume(payload.userId);

      // Generate notification ID if not provided
      const notificationId = payload.id || uuidv4();

      // Validate payload
      const errors = await validate(payload);
      if (errors.length > 0) {
        throw new Error(`Validation failed: ${errors.toString()}`);
      }

      // Prepare notification object
      const notification = {
        ...payload,
        id: notificationId,
        priority,
        createdAt: new Date(),
        read: false,
        delivered: false
      };

      // Store in Redis with TTL
      const ttl = payload.expiresAt 
        ? Math.floor((payload.expiresAt.getTime() - Date.now()) / 1000)
        : 604800; // 7 days default

      await this.redisCluster.setex(
        `notifications:${payload.userId}:${notificationId}`,
        ttl,
        JSON.stringify(notification)
      );

      // Broadcast to connected clients
      await this.broadcastNotification(payload.userId, notification);

      this.logger.info('Notification created:', { notificationId, userId: payload.userId });
      return notification;

    } catch (error) {
      this.logger.error('Error creating notification:', error);
      throw error;
    }
  }

  @Cache(300)
  @RateLimit()
  public async getUserNotifications(
    userId: string,
    options: PaginationOptions,
    filters: FilterOptions = {}
  ): Promise<any> {
    try {
      const pattern = `notifications:${userId}:*`;
      const keys = await this.redisCluster.keys(pattern);
      let notifications = await Promise.all(
        keys.map(async (key) => {
          const data = await this.redisCluster.get(key);
          return data ? JSON.parse(data) : null;
        })
      );

      // Apply filters
      notifications = notifications.filter((notification) => {
        if (!notification) return false;
        if (filters.type && !filters.type.includes(notification.type)) return false;
        if (filters.priority && !filters.priority.includes(notification.priority)) return false;
        if (filters.read !== undefined && notification.read !== filters.read) return false;
        if (filters.startDate && new Date(notification.createdAt) < filters.startDate) return false;
        if (filters.endDate && new Date(notification.createdAt) > filters.endDate) return false;
        return true;
      });

      // Apply pagination
      const startIndex = (options.page - 1) * options.limit;
      const endIndex = startIndex + options.limit;
      const paginatedNotifications = notifications.slice(startIndex, endIndex);

      return {
        notifications: paginatedNotifications,
        total: notifications.length,
        page: options.page,
        totalPages: Math.ceil(notifications.length / options.limit)
      };

    } catch (error) {
      this.logger.error('Error fetching notifications:', error);
      throw error;
    }
  }

  @Retry(3)
  @Monitor()
  private async broadcastNotification(
    userId: string,
    notification: any,
    options: BroadcastOptions = {}
  ): Promise<any> {
    const connections = this.userConnections.get(userId);
    if (!connections || connections.size === 0) {
      return { delivered: false, reason: 'No active connections' };
    }

    const deliveryResults = await Promise.all(
      Array.from(connections).map(async (ws) => {
        try {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(notification));
            return { success: true, connectionId: ws.id };
          }
          return { success: false, reason: 'Connection not open', connectionId: ws.id };
        } catch (error) {
          return { success: false, error: error.message, connectionId: ws.id };
        }
      })
    );

    const successCount = deliveryResults.filter(r => r.success).length;
    const failureCount = deliveryResults.filter(r => !r.success).length;

    return {
      delivered: successCount > 0,
      totalConnections: connections.size,
      successCount,
      failureCount,
      results: deliveryResults
    };
  }
}

export default NotificationService;