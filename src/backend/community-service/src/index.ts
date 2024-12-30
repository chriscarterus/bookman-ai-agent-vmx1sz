// External imports
import express from 'express'; // v4.18.2
import cors from 'cors'; // v2.8.5
import helmet from 'helmet'; // v7.0.0
import morgan from 'morgan'; // v1.10.0
import winston from 'winston'; // v3.10.0
import rateLimit from 'express-rate-limit'; // v6.9.0
import compression from 'compression'; // v1.7.4
import { Server } from 'http';
import cluster from 'cluster';
import os from 'os';

// Internal imports
import { config } from './config';
import { forumRouter } from './routes/forum.routes';
import { NotificationService } from './services/notification.service';

// Initialize global logger
const logger = winston.createLogger({
  level: config.app.logLevel,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'error.log', level: 'error' })
  ]
});

// Initialize Express app
const app = express();

/**
 * Configures comprehensive Express middleware stack with enhanced security
 * @param app Express application instance
 */
function setupMiddleware(app: express.Application): void {
  // Configure CORS with dynamic origin validation
  app.use(cors({
    origin: config.server.corsOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400 // 24 hours
  }));

  // Add Helmet security middleware with strict CSP
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", ...config.server.corsOrigins],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"]
      }
    },
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    crossOriginResourcePolicy: { policy: 'same-site' }
  }));

  // Setup Morgan request logging with detailed format
  app.use(morgan('combined', {
    stream: { write: message => logger.info(message.trim()) }
  }));

  // Configure role-based rate limiting
  const standardLimiter = rateLimit({
    windowMs: config.server.rateLimitWindow,
    max: config.server.rateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many requests, please try again later'
  });

  app.use('/api/', standardLimiter);

  // Add body parsers with security limits
  app.use(express.json({ 
    limit: '10kb',
    type: ['application/json', 'application/vnd.api+json']
  }));
  
  app.use(express.urlencoded({ 
    extended: true,
    limit: '10kb'
  }));

  // Add compression
  app.use(compression());

  // Add security headers
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });
}

/**
 * Configures API routes with enhanced security and validation
 * @param app Express application instance
 */
function setupRoutes(app: express.Application): void {
  // API routes
  app.use('/api/v1/forum', forumRouter);

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: config.app.version
    });
  });

  // Error handling middleware
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.error('Unhandled error:', err);
    res.status(err.status || 500).json({
      status: 'error',
      message: config.app.env === 'production' ? 'Internal server error' : err.message,
      code: err.code
    });
  });

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      status: 'error',
      message: 'Resource not found'
    });
  });
}

/**
 * Initializes server with enhanced features and monitoring
 */
async function startServer(): Promise<void> {
  try {
    // Initialize notification service
    const notificationService = new NotificationService();

    // Setup middleware and routes
    setupMiddleware(app);
    setupRoutes(app);

    // Create HTTP server
    const server = new Server(app);

    // Setup WebSocket server if enabled
    if (config.features.enableWebSockets) {
      await notificationService.setupWebSocket(server);
    }

    // Start server with clustering in production
    if (config.app.env === 'production' && cluster.isPrimary) {
      const numCPUs = os.cpus().length;
      
      logger.info(`Primary ${process.pid} is running`);
      
      // Fork workers
      for (let i = 0; i < numCPUs; i++) {
        cluster.fork();
      }

      cluster.on('exit', (worker, code, signal) => {
        logger.warn(`Worker ${worker.process.pid} died. Restarting...`);
        cluster.fork();
      });
    } else {
      // Start server
      server.listen(config.server.port, () => {
        logger.info(`Server running on port ${config.server.port} in ${config.app.env} mode`);
      });

      // Graceful shutdown
      process.on('SIGTERM', () => {
        logger.info('SIGTERM received. Starting graceful shutdown...');
        server.close(() => {
          logger.info('Server closed');
          process.exit(0);
        });
      });
    }
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start server
startServer().catch(error => {
  logger.error('Server startup failed:', error);
  process.exit(1);
});

export { app };