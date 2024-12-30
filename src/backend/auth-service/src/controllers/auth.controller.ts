import { Request, Response } from 'express';
import httpStatus from 'http-status'; // v1.6.0
import { RateLimiterRedis } from 'rate-limiter-flexible'; // v2.4.1
import { validate } from 'class-validator'; // v0.14.0
import { AuthService } from '../services/auth.service';
import { authenticateToken, validateRole, AuthenticatedRequest } from '../middleware/jwt.middleware';
import { config } from '../config';

// Request DTOs with validation
class LoginDTO {
  @IsEmail()
  email!: string;

  @MinLength(8)
  @Matches(/^(?=.*[A-Z])(?=.*[!@#$&*])(?=.*[0-9])(?=.*[a-z]).{8,}$/)
  password!: string;
}

class MFAVerifyDTO {
  @IsString()
  @Length(6, 6)
  code!: string;

  @IsString()
  sessionToken!: string;
}

class RegisterDTO {
  @IsEmail()
  email!: string;

  @MinLength(8)
  @Matches(/^(?=.*[A-Z])(?=.*[!@#$&*])(?=.*[0-9])(?=.*[a-z]).{8,}$/)
  password!: string;

  @IsString()
  @MinLength(3)
  username!: string;
}

/**
 * Enhanced authentication controller with comprehensive security features
 */
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly rateLimiter: RateLimiterRedis
  ) {}

  /**
   * Handles user login with MFA and security monitoring
   */
  async login(req: Request, res: Response): Promise<Response> {
    try {
      // Validate request body
      const loginDto = new LoginDTO();
      Object.assign(loginDto, req.body);
      const errors = await validate(loginDto);
      if (errors.length > 0) {
        return res.status(httpStatus.BAD_REQUEST).json({ errors });
      }

      // Apply rate limiting
      await this.rateLimiter.consume(req.ip);

      // Process login request
      const result = await this.authService.login({
        email: loginDto.email,
        password: loginDto.password,
        ip_address: req.ip,
        user_agent: req.headers['user-agent']
      });

      // Set secure headers
      res.set({
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block'
      });

      // Handle MFA requirement
      if (result.requires_mfa) {
        return res.status(httpStatus.OK).json({
          requires_mfa: true,
          user: result.user
        });
      }

      // Set secure cookie with refresh token
      res.cookie('refresh_token', result.refresh_token, {
        httpOnly: true,
        secure: config.security.session.cookie.secure,
        sameSite: 'strict',
        maxAge: config.security.session.cookie.maxAge
      });

      return res.status(httpStatus.OK).json({
        access_token: result.access_token,
        user: result.user
      });
    } catch (error) {
      return res.status(httpStatus.UNAUTHORIZED).json({
        error: 'Authentication failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Handles MFA verification step
   */
  async verifyMFA(req: Request, res: Response): Promise<Response> {
    try {
      // Validate MFA verification request
      const mfaDto = new MFAVerifyDTO();
      Object.assign(mfaDto, req.body);
      const errors = await validate(mfaDto);
      if (errors.length > 0) {
        return res.status(httpStatus.BAD_REQUEST).json({ errors });
      }

      // Verify MFA code
      const result = await this.authService.verifyMFA(
        mfaDto.sessionToken,
        mfaDto.code
      );

      // Set secure cookie with refresh token
      res.cookie('refresh_token', result.refresh_token, {
        httpOnly: true,
        secure: config.security.session.cookie.secure,
        sameSite: 'strict',
        maxAge: config.security.session.cookie.maxAge
      });

      return res.status(httpStatus.OK).json({
        access_token: result.access_token,
        user: result.user
      });
    } catch (error) {
      return res.status(httpStatus.UNAUTHORIZED).json({
        error: 'MFA verification failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Handles user registration with enhanced security
   */
  async register(req: Request, res: Response): Promise<Response> {
    try {
      // Validate registration request
      const registerDto = new RegisterDTO();
      Object.assign(registerDto, req.body);
      const errors = await validate(registerDto);
      if (errors.length > 0) {
        return res.status(httpStatus.BAD_REQUEST).json({ errors });
      }

      // Process registration
      const result = await this.authService.register({
        email: registerDto.email,
        password: registerDto.password,
        username: registerDto.username,
        ip_address: req.ip,
        user_agent: req.headers['user-agent']
      });

      return res.status(httpStatus.CREATED).json({
        message: 'Registration successful',
        user: result.user
      });
    } catch (error) {
      return res.status(httpStatus.BAD_REQUEST).json({
        error: 'Registration failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Handles token refresh with security validation
   */
  async refreshToken(req: Request, res: Response): Promise<Response> {
    try {
      const refreshToken = req.cookies.refresh_token;
      if (!refreshToken) {
        return res.status(httpStatus.UNAUTHORIZED).json({
          error: 'Refresh token required'
        });
      }

      const result = await this.authService.refreshToken(refreshToken);

      // Update refresh token cookie
      res.cookie('refresh_token', result.refresh_token, {
        httpOnly: true,
        secure: config.security.session.cookie.secure,
        sameSite: 'strict',
        maxAge: config.security.session.cookie.maxAge
      });

      return res.status(httpStatus.OK).json({
        access_token: result.access_token
      });
    } catch (error) {
      return res.status(httpStatus.UNAUTHORIZED).json({
        error: 'Token refresh failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Handles secure logout with token invalidation
   */
  async logout(req: AuthenticatedRequest, res: Response): Promise<Response> {
    try {
      await this.authService.logout(req.user?.id);

      // Clear refresh token cookie
      res.clearCookie('refresh_token');

      return res.status(httpStatus.OK).json({
        message: 'Logout successful'
      });
    } catch (error) {
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        error: 'Logout failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Handles OAuth authentication callback
   */
  async googleAuth(req: Request, res: Response): Promise<Response> {
    try {
      const { code } = req.query;
      if (!code || typeof code !== 'string') {
        return res.status(httpStatus.BAD_REQUEST).json({
          error: 'Invalid OAuth code'
        });
      }

      const result = await this.authService.googleAuth(code, {
        ip_address: req.ip,
        user_agent: req.headers['user-agent']
      });

      // Set secure cookie with refresh token
      res.cookie('refresh_token', result.refresh_token, {
        httpOnly: true,
        secure: config.security.session.cookie.secure,
        sameSite: 'strict',
        maxAge: config.security.session.cookie.maxAge
      });

      return res.status(httpStatus.OK).json({
        access_token: result.access_token,
        user: result.user
      });
    } catch (error) {
      return res.status(httpStatus.UNAUTHORIZED).json({
        error: 'OAuth authentication failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}