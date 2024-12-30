import express, { Express, Request, Response, NextFunction } from 'express'; // v4.18.0
import cors from 'cors'; // v2.8.5
import helmet from 'helmet'; // v7.0.0
import compression from 'compression'; // v1.7.4
import morgan from 'morgan'; // v1.10.0
import rateLimit from 'express-rate-limit'; // v6.7.0
import { config } from './config';
import router from './routes/auth.routes';

/**
 * Initializes and configures the Express server with comprehensive security middleware
 * @returns Configured Express application
 */
function initializeServer(): Express {
  const app = express();

  // Security middleware configuration
  app.use(helmet({
    contentSecurityPolicy: config.security.headers.noSniff,
    xssFilter: config.security.headers.xssFilter,
    frameguard: config.security.headers.frameGuard,
    hsts: config.security.headers.hsts
  }));

  // CORS configuration with environment-specific settings
  app.use(cors({
    origin: config.server.cors.origin,
    credentials: config.server.cors.credentials,
    methods: config.server.cors.methods,
    allowedHeaders: config.server.cors.allowedHeaders,
    maxAge: config.server.cors.maxAge
  }));

  // Request compression
  app.use(compression());

  // Request logging with detailed format
  app.use(morgan('[:date[iso]] :method :url :status :response-time ms - :res[content-length] - :remote-addr - :user-agent'));

  // Global rate limiting
  app.use(rateLimit({
    windowMs: config.security.rateLimiting.windowMs,
    max: config.security.rateLimiting.maxRequests,
    standardHeaders: config.security.rateLimiting.headers,
    legacyHeaders: false,
    keyGenerator: config.security.rateLimiting.keyGenerator,
    handler: (req: Request, res: Response) => {
      res.status(429).json({
        error: 'Too many requests',
        retryAfter: Math.ceil(config.security.rateLimiting.windowMs / 1000),
        requestId: req.ip
      });
    }
  }));

  // Request timeout handling
  app.use((req: Request, res: Response, next: NextFunction) => {
    req.setTimeout(30000, () => {
      res.status(408).json({
        error: 'Request timeout',
        requestId: req.ip
      });
    });
    next();
  });

  // Body parser with security limits
  app.use(express.json({
    limit: '10kb',
    verify: (req: Request, res: Response, buf: Buffer) => {
      if (buf.length > 10240) {
        throw new Error('Request entity too large');
      }
    }
  }));

  // Mount authentication routes
  app.use('/api/v1/auth', router);

  // Health check endpoint
  app.get('/health', (req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version
    });
  });

  // Global error handling middleware
  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error(`[Error] ${err.stack}`);
    res.status(500).json({
      error: 'Internal Server Error',
      message: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : err.message,
      requestId: req.ip,
      timestamp: new Date().toISOString()
    });
  });

  return app;
}

/**
 * Starts the server with graceful shutdown handling
 * @param app Configured Express application
 */
async function startServer(app: Express): Promise<void> {
  const server = app.listen(config.server.port, config.server.host, () => {
    console.log(`[Server] Authentication service listening on port ${config.server.port}`);
    console.log(`[Server] Environment: ${process.env.NODE_ENV}`);
  });

  // Graceful shutdown handling
  const shutdown = async (signal: string) => {
    console.log(`[Server] ${signal} received. Starting graceful shutdown...`);
    
    server.close(() => {
      console.log('[Server] HTTP server closed');
      process.exit(0);
    });

    // Force shutdown after 30 seconds
    setTimeout(() => {
      console.error('[Server] Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 30000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Unhandled error handlers
  process.on('uncaughtException', (error: Error) => {
    console.error('[Error] Uncaught Exception:', error);
    shutdown('UNCAUGHT_EXCEPTION');
  });

  process.on('unhandledRejection', (reason: any) => {
    console.error('[Error] Unhandled Rejection:', reason);
    shutdown('UNHANDLED_REJECTION');
  });
}

// Initialize and start server
if (require.main === module) {
  try {
    const app = initializeServer();
    startServer(app).catch(handleUncaughtErrors);
  } catch (error) {
    handleUncaughtErrors(error);
  }
}

/**
 * Global error handler for uncaught errors
 * @param error Error object
 */
function handleUncaughtErrors(error: Error): void {
  console.error('[Fatal Error]', {
    error: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString()
  });
  process.exit(1);
}

// Export for testing
export { initializeServer, startServer };