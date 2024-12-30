import dotenv from 'dotenv'; // v16.0.0
import ms from 'ms'; // v2.1.3

// Load environment variables
dotenv.config();

// Global constants
const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PRODUCTION = NODE_ENV === 'production';
const MIN_SECRET_LENGTH = 32;

/**
 * Validates the configuration parameters with enhanced security checks
 * @throws {Error} Detailed error message if validation fails
 */
const validateConfig = (): void => {
  // Required environment variables check
  const requiredEnvVars = [
    'JWT_ACCESS_SECRET',
    'JWT_REFRESH_SECRET',
    'SESSION_SECRET',
    'DATABASE_URL'
  ];

  const missingVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }

  // JWT secret length validation
  const secrets = {
    JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET!,
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET!,
    SESSION_SECRET: process.env.SESSION_SECRET!
  };

  Object.entries(secrets).forEach(([key, value]) => {
    if (value.length < MIN_SECRET_LENGTH) {
      throw new Error(`${key} must be at least ${MIN_SECRET_LENGTH} characters long`);
    }
  });

  // Database URL format validation
  const dbUrlRegex = /^(mongodb(\+srv)?:\/\/).+/;
  if (!dbUrlRegex.test(process.env.DATABASE_URL!)) {
    throw new Error('Invalid DATABASE_URL format');
  }

  // Token expiration validation
  try {
    ms(process.env.JWT_ACCESS_EXPIRES || (IS_PRODUCTION ? '15m' : '1h'));
    ms(process.env.JWT_REFRESH_EXPIRES || (IS_PRODUCTION ? '7d' : '30d'));
  } catch (error) {
    throw new Error('Invalid token expiration format');
  }

  // OAuth configuration validation
  if (IS_PRODUCTION) {
    const oauthConfigs = {
      GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
      GOOGLE_CALLBACK_URL: process.env.GOOGLE_CALLBACK_URL,
      GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
      GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET,
      GITHUB_CALLBACK_URL: process.env.GITHUB_CALLBACK_URL
    };

    Object.entries(oauthConfigs).forEach(([key, value]) => {
      if (!value) {
        throw new Error(`Missing OAuth configuration: ${key}`);
      }
    });
  }
};

// Validate configuration on load
validateConfig();

/**
 * Immutable configuration object for the authentication service
 */
export const config = {
  server: {
    port: process.env.PORT || 3001,
    host: process.env.HOST || '0.0.0.0',
    cors: {
      origin: process.env.CORS_ORIGIN || (IS_PRODUCTION ? '' : '*'),
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      maxAge: 7200
    }
  },

  auth: {
    accessToken: {
      secret: process.env.JWT_ACCESS_SECRET!,
      expiresIn: process.env.JWT_ACCESS_EXPIRES || (IS_PRODUCTION ? '15m' : '1h'),
      algorithm: 'HS512' as const,
      issuer: 'bookman-auth-service',
      audience: 'bookman-platform'
    },
    refreshToken: {
      secret: process.env.JWT_REFRESH_SECRET!,
      expiresIn: process.env.JWT_REFRESH_EXPIRES || (IS_PRODUCTION ? '7d' : '30d'),
      algorithm: 'HS512' as const,
      issuer: 'bookman-auth-service',
      audience: 'bookman-platform'
    },
    oauth: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackUrl: process.env.GOOGLE_CALLBACK_URL,
        scopes: ['profile', 'email']
      },
      github: {
        clientId: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        callbackUrl: process.env.GITHUB_CALLBACK_URL,
        scopes: ['user:email']
      }
    },
    passwordPolicy: {
      minLength: IS_PRODUCTION ? 12 : 8,
      requireSpecialChar: true,
      requireNumber: true,
      requireUppercase: true,
      maxLoginAttempts: IS_PRODUCTION ? 5 : 10,
      lockoutDuration: IS_PRODUCTION ? '30m' : '5m',
      passwordHistory: IS_PRODUCTION ? 5 : 0
    }
  },

  database: {
    url: process.env.DATABASE_URL!,
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      retryWrites: true,
      maxPoolSize: IS_PRODUCTION ? 100 : 10,
      minPoolSize: IS_PRODUCTION ? 5 : 1,
      connectTimeoutMS: 30000,
      socketTimeoutMS: 45000
    }
  },

  security: {
    bcryptRounds: IS_PRODUCTION ? 12 : 4,
    rateLimiting: {
      windowMs: IS_PRODUCTION ? ms('15m') : ms('5m'),
      maxRequests: IS_PRODUCTION ? 100 : 1000,
      skipSuccessfulRequests: false,
      headers: true,
      keyGenerator: (req: any) => req.ip,
      handler: 'customRateLimitHandler'
    },
    session: {
      secret: process.env.SESSION_SECRET!,
      name: 'bookman.sid',
      cookie: {
        secure: IS_PRODUCTION,
        httpOnly: true,
        maxAge: ms('24h'),
        sameSite: 'strict' as const,
        domain: process.env.COOKIE_DOMAIN,
        path: '/'
      },
      rolling: true,
      resave: false,
      saveUninitialized: false
    },
    headers: {
      hsts: {
        enabled: IS_PRODUCTION,
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      },
      noSniff: true,
      xssFilter: true,
      frameGuard: {
        action: 'deny' as const
      }
    }
  }
} as const;

// Type exports for configuration consumers
export type Config = typeof config;
export type AuthConfig = typeof config.auth;
export type SecurityConfig = typeof config.security;
export type DatabaseConfig = typeof config.database;