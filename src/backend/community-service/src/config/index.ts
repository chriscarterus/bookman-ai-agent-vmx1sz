import dotenv from 'dotenv'; // v16.0.0
import Joi from 'joi'; // v17.9.0

// Load environment variables
dotenv.config();

// Global constants
const DEFAULT_PORT = 3002;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const MAX_TITLE_LENGTH = 200;
const MAX_CONTENT_LENGTH = 10000;
const SUPPORTED_POST_TYPES = ['DISCUSSION', 'QUESTION', 'ANALYSIS', 'ANNOUNCEMENT', 'WEBINAR', 'TRADING_IDEA'];
const DEFAULT_RATE_LIMIT_WINDOW = 60000; // 1 minute in ms
const DEFAULT_RATE_LIMIT_MAX = 100;

// Configuration validation schema
const configSchema = Joi.object({
  app: Joi.object({
    name: Joi.string().required(),
    env: Joi.string().valid('development', 'test', 'production').required(),
    version: Joi.string().required(),
    logLevel: Joi.string().valid('error', 'warn', 'info', 'debug').required(),
    debug: Joi.boolean().default(false)
  }).required(),

  server: Joi.object({
    host: Joi.string().hostname().required(),
    port: Joi.number().port().default(DEFAULT_PORT),
    corsOrigins: Joi.array().items(Joi.string().uri()).required(),
    rateLimitWindow: Joi.number().positive().default(DEFAULT_RATE_LIMIT_WINDOW),
    rateLimitMax: Joi.number().positive().default(DEFAULT_RATE_LIMIT_MAX),
    trustProxy: Joi.boolean().default(false),
    requestTimeout: Joi.number().positive().default(30000)
  }).required(),

  database: Joi.object({
    host: Joi.string().required(),
    port: Joi.number().port().default(5432),
    name: Joi.string().required(),
    user: Joi.string().required(),
    password: Joi.string().required(),
    poolSize: Joi.number().positive().default(10),
    connectionTimeout: Joi.number().positive().default(30000),
    ssl: Joi.boolean().default(false),
    maxRetries: Joi.number().min(0).default(3)
  }).required(),

  redis: Joi.object({
    host: Joi.string().required(),
    port: Joi.number().port().default(6379),
    password: Joi.string().allow('').optional(),
    db: Joi.number().min(0).default(0),
    keyPrefix: Joi.string().default('community:'),
    tls: Joi.boolean().default(false),
    maxRetries: Joi.number().min(0).default(3)
  }).required(),

  features: Joi.object({
    enableNotifications: Joi.boolean().default(true),
    enableWebSockets: Joi.boolean().default(true),
    enableModeration: Joi.boolean().default(true),
    enableAnalytics: Joi.boolean().default(true),
    enableExpertWebinars: Joi.boolean().default(true),
    enableSocialTrading: Joi.boolean().default(true),
    enableKnowledgeSharing: Joi.boolean().default(true)
  }).required(),

  security: Joi.object({
    enableRateLimit: Joi.boolean().default(true),
    enableXssProtection: Joi.boolean().default(true),
    enableCsrf: Joi.boolean().default(true),
    moderationQueueSize: Joi.number().positive().default(1000),
    maxLoginAttempts: Joi.number().positive().default(5),
    loginLockoutTime: Joi.number().positive().default(900000) // 15 minutes
  }).required(),

  content: Joi.object({
    maxTitleLength: Joi.number().positive().default(MAX_TITLE_LENGTH),
    maxContentLength: Joi.number().positive().default(MAX_CONTENT_LENGTH),
    supportedPostTypes: Joi.array().items(Joi.string()).default(SUPPORTED_POST_TYPES),
    defaultPageSize: Joi.number().positive().default(DEFAULT_PAGE_SIZE),
    maxPageSize: Joi.number().positive().default(MAX_PAGE_SIZE),
    moderationEnabled: Joi.boolean().default(true),
    autoModeration: Joi.boolean().default(false)
  }).required()
});

// Configuration class
class Config {
  private static instance: Config;
  public readonly app: any;
  public readonly server: any;
  public readonly database: any;
  public readonly redis: any;
  public readonly features: any;
  public readonly security: any;
  public readonly content: any;

  private constructor() {
    const config = {
      app: {
        name: 'community-service',
        env: process.env.NODE_ENV || 'development',
        version: process.env.APP_VERSION || '1.0.0',
        logLevel: process.env.LOG_LEVEL || 'info',
        debug: process.env.DEBUG === 'true'
      },
      server: {
        host: process.env.HOST || '0.0.0.0',
        port: parseInt(process.env.PORT || DEFAULT_PORT.toString(), 10),
        corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
        rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW || DEFAULT_RATE_LIMIT_WINDOW.toString(), 10),
        rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || DEFAULT_RATE_LIMIT_MAX.toString(), 10),
        trustProxy: process.env.TRUST_PROXY === 'true',
        requestTimeout: parseInt(process.env.REQUEST_TIMEOUT || '30000', 10)
      },
      database: {
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT || '5432', 10),
        name: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        poolSize: parseInt(process.env.DB_POOL_SIZE || '10', 10),
        connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT || '30000', 10),
        ssl: process.env.DB_SSL === 'true',
        maxRetries: parseInt(process.env.DB_MAX_RETRIES || '3', 10)
      },
      redis: {
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB || '0', 10),
        keyPrefix: process.env.REDIS_KEY_PREFIX || 'community:',
        tls: process.env.REDIS_TLS === 'true',
        maxRetries: parseInt(process.env.REDIS_MAX_RETRIES || '3', 10)
      },
      features: {
        enableNotifications: process.env.ENABLE_NOTIFICATIONS === 'true',
        enableWebSockets: process.env.ENABLE_WEBSOCKETS === 'true',
        enableModeration: process.env.ENABLE_MODERATION === 'true',
        enableAnalytics: process.env.ENABLE_ANALYTICS === 'true',
        enableExpertWebinars: process.env.ENABLE_EXPERT_WEBINARS === 'true',
        enableSocialTrading: process.env.ENABLE_SOCIAL_TRADING === 'true',
        enableKnowledgeSharing: process.env.ENABLE_KNOWLEDGE_SHARING === 'true'
      },
      security: {
        enableRateLimit: process.env.ENABLE_RATE_LIMIT === 'true',
        enableXssProtection: process.env.ENABLE_XSS_PROTECTION === 'true',
        enableCsrf: process.env.ENABLE_CSRF === 'true',
        moderationQueueSize: parseInt(process.env.MODERATION_QUEUE_SIZE || '1000', 10),
        maxLoginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5', 10),
        loginLockoutTime: parseInt(process.env.LOGIN_LOCKOUT_TIME || '900000', 10)
      },
      content: {
        maxTitleLength: MAX_TITLE_LENGTH,
        maxContentLength: MAX_CONTENT_LENGTH,
        supportedPostTypes: SUPPORTED_POST_TYPES,
        defaultPageSize: DEFAULT_PAGE_SIZE,
        maxPageSize: MAX_PAGE_SIZE,
        moderationEnabled: process.env.CONTENT_MODERATION_ENABLED === 'true',
        autoModeration: process.env.AUTO_MODERATION === 'true'
      }
    };

    const { error, value } = configSchema.validate(config, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      throw new Error(`Configuration validation error: ${error.message}`);
    }

    Object.assign(this, value);
  }

  public static getInstance(): Config {
    if (!Config.instance) {
      Config.instance = new Config();
    }
    return Config.instance;
  }
}

// Export singleton instance
export const config = Config.getInstance();

// Export configuration types
export type AppConfig = typeof config.app;
export type ServerConfig = typeof config.server;
export type DatabaseConfig = typeof config.database;
export type RedisConfig = typeof config.redis;
export type FeaturesConfig = typeof config.features;
export type SecurityConfig = typeof config.security;
export type ContentConfig = typeof config.content;