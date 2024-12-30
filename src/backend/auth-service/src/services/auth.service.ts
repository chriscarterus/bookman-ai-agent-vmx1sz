import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { Model } from 'mongoose';
import { OAuth2Client } from 'google-auth-library'; // v8.0.0
import * as speakeasy from 'speakeasy'; // v2.0.0
import * as bcrypt from 'bcrypt'; // v5.1.0
import { JwtService } from '@nestjs/jwt';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { User } from '../models/user.model';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';

// Constants for authentication configuration
const LOGIN_ATTEMPT_WINDOW = 15 * 60 * 1000; // 15 minutes
const MAX_LOGIN_ATTEMPTS = 5;
const TOKEN_VERSION_KEY = 'auth:token:version:';
const MFA_TOKEN_WINDOW = 30; // 30 seconds window for TOTP

// Types for authentication
interface LoginDTO {
  email: string;
  password: string;
  ip_address: string;
  user_agent?: string;
}

interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user: {
    user_id: string;
    email: string;
    role: string;
    two_factor_enabled: boolean;
  };
  requires_mfa: boolean;
}

@Injectable()
export class AuthService {
  private readonly googleClient: OAuth2Client;
  private readonly rateLimiter: RateLimiterMemory;

  constructor(
    private readonly userModel: Model<User>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService
  ) {
    // Initialize Google OAuth client
    this.googleClient = new OAuth2Client({
      clientId: this.configService.get<string>('GOOGLE_CLIENT_ID'),
      clientSecret: this.configService.get<string>('GOOGLE_CLIENT_SECRET'),
    });

    // Initialize rate limiter
    this.rateLimiter = new RateLimiterMemory({
      points: MAX_LOGIN_ATTEMPTS,
      duration: LOGIN_ATTEMPT_WINDOW,
    });
  }

  /**
   * Enhanced login with security monitoring and MFA support
   */
  async login(credentials: LoginDTO, mfaToken?: string): Promise<AuthResponse> {
    try {
      // Check rate limiting
      await this.rateLimiter.consume(credentials.ip_address);

      // Find user and validate basic credentials
      const user = await this.userModel.findOne({ email: credentials.email.toLowerCase() });
      if (!user) {
        throw new UnauthorizedException('Invalid credentials');
      }

      // Check account status
      if (user.status === 'locked') {
        if (user.account_locked_until && user.account_locked_until > new Date()) {
          throw new UnauthorizedException('Account is locked. Please try again later.');
        }
        // Reset lock if duration has passed
        user.status = 'active';
        user.failed_login_attempts = 0;
        await user.save();
      }

      // Validate password
      const isPasswordValid = await user.comparePassword(credentials.password);
      if (!isPasswordValid) {
        await user.incrementLoginAttempts();
        throw new UnauthorizedException('Invalid credentials');
      }

      // Check MFA requirement
      if (user.security_settings.two_factor_enabled) {
        if (!mfaToken) {
          return {
            access_token: null,
            refresh_token: null,
            user: {
              user_id: user.user_id,
              email: user.email,
              role: user.role,
              two_factor_enabled: true
            },
            requires_mfa: true
          };
        }

        const isMfaValid = await this.validateMFA(user.user_id, mfaToken);
        if (!isMfaValid) {
          throw new UnauthorizedException('Invalid MFA token');
        }
      }

      // Generate tokens
      const tokenVersion = await this.getTokenVersion(user.user_id);
      const tokens = await this.generateTokens(user, tokenVersion);

      // Update user login metrics
      user.last_login = new Date();
      user.failed_login_attempts = 0;
      await user.logSecurityEvent('login_success', {
        ip_address: credentials.ip_address,
        user_agent: credentials.user_agent
      });
      await user.save();

      return {
        ...tokens,
        user: {
          user_id: user.user_id,
          email: user.email,
          role: user.role,
          two_factor_enabled: user.security_settings.two_factor_enabled
        },
        requires_mfa: false
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new BadRequestException('Login failed');
    }
  }

  /**
   * Validates MFA token and manages backup codes
   */
  async validateMFA(userId: string, token: string): Promise<boolean> {
    const user = await this.userModel.findOne({ user_id: userId });
    if (!user || !user.security_settings.two_factor_enabled) {
      return false;
    }

    // Check if token matches a backup code
    const backupCodeIndex = user.security_settings.backup_codes.indexOf(token);
    if (backupCodeIndex !== -1) {
      // Remove used backup code
      user.security_settings.backup_codes.splice(backupCodeIndex, 1);
      await user.save();
      return true;
    }

    // Validate TOTP
    return speakeasy.totp.verify({
      secret: user.security_settings.two_factor_secret,
      encoding: 'base32',
      token: token,
      window: MFA_TOKEN_WINDOW
    });
  }

  /**
   * Generates new JWT tokens with versioning
   */
  private async generateTokens(user: User, version: number): Promise<{ access_token: string; refresh_token: string }> {
    const payload = {
      sub: user.user_id,
      email: user.email,
      role: user.role,
      version
    };

    const access_token = this.jwtService.sign(payload, {
      expiresIn: '15m'
    });

    const refresh_token = this.jwtService.sign(
      { ...payload, tokenType: 'refresh' },
      { expiresIn: '7d' }
    );

    return { access_token, refresh_token };
  }

  /**
   * Manages token versioning for invalidation
   */
  private async getTokenVersion(userId: string): Promise<number> {
    const versionKey = `${TOKEN_VERSION_KEY}${userId}`;
    // Implementation would typically use Redis or similar for token version management
    return 1; // Placeholder for demonstration
  }
}