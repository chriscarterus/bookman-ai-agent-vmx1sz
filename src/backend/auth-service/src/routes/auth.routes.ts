import express, { Router } from 'express'; // v4.18.0
import { body, validationResult } from 'express-validator'; // v7.0.0
import rateLimit from 'express-rate-limit'; // v6.7.0
import helmet from 'helmet'; // v7.0.0
import { AuthController } from '../controllers/auth.controller';
import { authenticateToken, validateRole } from '../middleware/jwt.middleware';
import { config } from '../config';

// Initialize router with security defaults
const router: Router = express.Router();

// Apply security headers
router.use(helmet({
  contentSecurityPolicy: config.security.headers.noSniff,
  xssFilter: config.security.headers.xssFilter,
  frameguard: config.security.headers.frameGuard,
  hsts: config.security.headers.hsts
}));

// Configure rate limiting
const authRateLimiter = rateLimit({
  windowMs: config.security.rateLimiting.windowMs,
  max: config.security.rateLimiting.maxRequests,
  standardHeaders: config.security.rateLimiting.headers,
  legacyHeaders: false,
  keyGenerator: config.security.rateLimiting.keyGenerator,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many requests',
      retryAfter: Math.ceil(config.security.rateLimiting.windowMs / 1000),
      requestId: req.ip
    });
  }
});

// Request validation schemas
const loginValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Invalid email format'),
  body('password')
    .isLength({ min: config.auth.passwordPolicy.minLength })
    .withMessage(`Password must be at least ${config.auth.passwordPolicy.minLength} characters long`)
];

const registerValidation = [
  ...loginValidation,
  body('username')
    .isLength({ min: 3, max: 30 })
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Username must be 3-30 characters and contain only letters, numbers, underscores, and hyphens'),
];

const mfaValidation = [
  body('code')
    .isLength({ min: 6, max: 6 })
    .isNumeric()
    .withMessage('MFA code must be 6 digits'),
  body('sessionToken')
    .notEmpty()
    .withMessage('Session token is required')
];

// Validation middleware
const validateRequest = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation error',
      details: errors.array(),
      requestId: req.ip
    });
  }
  next();
};

// Security event logging middleware
const logSecurityEvent = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const startTime = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    // Log security events (implementation would depend on logging infrastructure)
    console.log({
      type: 'security_event',
      path: req.path,
      method: req.method,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      statusCode: res.statusCode,
      duration,
      timestamp: new Date().toISOString()
    });
  });
  next();
};

// Route definitions with enhanced security
router.post('/login',
  authRateLimiter,
  loginValidation,
  validateRequest,
  logSecurityEvent,
  AuthController.login
);

router.post('/register',
  authRateLimiter,
  registerValidation,
  validateRequest,
  logSecurityEvent,
  AuthController.register
);

router.post('/verify-mfa',
  authRateLimiter,
  mfaValidation,
  validateRequest,
  logSecurityEvent,
  AuthController.verifyMfa
);

router.post('/refresh-token',
  authRateLimiter,
  authenticateToken,
  logSecurityEvent,
  AuthController.refreshToken
);

router.post('/logout',
  authenticateToken,
  logSecurityEvent,
  AuthController.logout
);

// OAuth routes with security measures
router.get('/oauth/google',
  authRateLimiter,
  logSecurityEvent,
  (req, res) => {
    const authUrl = `${config.auth.oauth.google.callbackUrl}?client_id=${config.auth.oauth.google.clientId}&response_type=code&scope=${config.auth.oauth.google.scopes.join(' ')}`;
    res.redirect(authUrl);
  }
);

router.get('/oauth/google/callback',
  authRateLimiter,
  logSecurityEvent,
  AuthController.googleAuth
);

// Protected routes with role-based access
router.get('/user/profile',
  authenticateToken,
  validateRole(['user', 'premium', 'admin']),
  logSecurityEvent,
  (req, res) => {
    res.json({ user: req.user });
  }
);

router.post('/user/security/mfa/enable',
  authenticateToken,
  validateRole(['user', 'premium', 'admin']),
  logSecurityEvent,
  (req, res) => {
    // MFA enablement logic would be implemented here
    res.status(501).json({ error: 'Not implemented' });
  }
);

// Health check endpoint
router.get('/health',
  (req, res) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString()
    });
  }
);

export default router;