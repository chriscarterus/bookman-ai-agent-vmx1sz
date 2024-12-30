/**
 * Authentication Service for Bookman AI Platform
 * @version 1.0.0
 * @description Handles user authentication, token management, and session handling
 * with enhanced security features including MFA support and secure token storage
 */

// External imports
import jwtDecode from 'jwt-decode'; // ^3.1.2
import CryptoJS from 'crypto-js'; // ^4.1.1

// Internal imports
import { apiService } from './api.service';
import { AuthResponse } from '../types/api.types';
import { API_ENDPOINTS } from '../constants/api.constants';

// Constants
const TOKEN_STORAGE_KEY = 'bookman_auth_token';
const REFRESH_TOKEN_STORAGE_KEY = 'bookman_refresh_token';
const TOKEN_REFRESH_INTERVAL = 300000; // 5 minutes
const MAX_TOKEN_AGE = 3600000; // 1 hour
const MFA_TIMEOUT = 300000; // 5 minutes
const SESSION_TIMEOUT = 1800000; // 30 minutes
const ENCRYPTION_KEY = process.env.VITE_TOKEN_ENCRYPTION_KEY || 'default-key';

/**
 * Interface for decoded JWT token
 */
interface DecodedToken {
  exp: number;
  sub: string;
  roles: string[];
  mfa_verified?: boolean;
}

/**
 * Interface for session status
 */
interface SessionStatus {
  isActive: boolean;
  lastActivity: number;
  expiresAt: number;
}

/**
 * Authentication Service Class
 */
class AuthService {
  private refreshTimer: NodeJS.Timeout | null = null;
  private sessionTimer: NodeJS.Timeout | null = null;
  private lastActivity: number = Date.now();

  constructor() {
    this.initializeSession();
    this.setupActivityMonitoring();
  }

  /**
   * Encrypts sensitive data before storage
   */
  private encrypt(data: string): string {
    return CryptoJS.AES.encrypt(data, ENCRYPTION_KEY).toString();
  }

  /**
   * Decrypts stored sensitive data
   */
  private decrypt(encryptedData: string): string {
    const bytes = CryptoJS.AES.decrypt(encryptedData, ENCRYPTION_KEY);
    return bytes.toString(CryptoJS.enc.Utf8);
  }

  /**
   * Handles user login with enhanced security
   */
  public async login(
    email: string,
    password: string,
    rememberMe: boolean = false
  ): Promise<AuthResponse> {
    try {
      const response = await apiService.post<AuthResponse>(API_ENDPOINTS.AUTH.LOGIN, {
        email,
        password,
        rememberMe
      });

      if (response.data.mfa_required) {
        return response.data;
      }

      this.handleAuthenticationSuccess(response.data);
      return response.data;
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  }

  /**
   * Handles MFA verification
   */
  public async verifyMfa(mfaToken: string, mfaCode: string): Promise<AuthResponse> {
    try {
      const response = await apiService.post<AuthResponse>(API_ENDPOINTS.AUTH.MFA, {
        mfaToken,
        mfaCode
      });

      this.handleAuthenticationSuccess(response.data);
      return response.data;
    } catch (error) {
      console.error('MFA verification failed:', error);
      throw error;
    }
  }

  /**
   * Handles successful authentication
   */
  private handleAuthenticationSuccess(authResponse: AuthResponse): void {
    const { access_token, refresh_token } = authResponse;
    
    // Encrypt tokens before storage
    const encryptedAccessToken = this.encrypt(access_token);
    const encryptedRefreshToken = this.encrypt(refresh_token);

    // Store encrypted tokens
    localStorage.setItem(TOKEN_STORAGE_KEY, encryptedAccessToken);
    localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, encryptedRefreshToken);

    // Initialize timers
    this.setupTokenRefresh();
    this.initializeSession();
  }

  /**
   * Sets up automatic token refresh
   */
  private setupTokenRefresh(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }

    this.refreshTimer = setInterval(async () => {
      try {
        await this.refreshToken();
      } catch (error) {
        console.error('Token refresh failed:', error);
        this.logout();
      }
    }, TOKEN_REFRESH_INTERVAL);
  }

  /**
   * Refreshes the access token
   */
  public async refreshToken(): Promise<AuthResponse> {
    const encryptedRefreshToken = localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
    if (!encryptedRefreshToken) {
      throw new Error('No refresh token available');
    }

    const refreshToken = this.decrypt(encryptedRefreshToken);
    const response = await apiService.post<AuthResponse>(API_ENDPOINTS.AUTH.REFRESH, {
      refreshToken
    });

    this.handleAuthenticationSuccess(response.data);
    return response.data;
  }

  /**
   * Logs out the user and cleans up session
   */
  public async logout(): Promise<void> {
    try {
      await apiService.post(API_ENDPOINTS.AUTH.LOGOUT);
    } finally {
      this.clearAuthenticationState();
    }
  }

  /**
   * Clears all authentication state
   */
  private clearAuthenticationState(): void {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
    
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }
    if (this.sessionTimer) {
      clearInterval(this.sessionTimer);
    }

    // Broadcast logout event to other tabs
    window.dispatchEvent(new Event('auth:logout'));
  }

  /**
   * Gets the current access token
   */
  public getAccessToken(): string | null {
    const encryptedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!encryptedToken) return null;
    
    try {
      const token = this.decrypt(encryptedToken);
      const decoded = jwtDecode<DecodedToken>(token);
      
      if (Date.now() >= decoded.exp * 1000) {
        this.clearAuthenticationState();
        return null;
      }
      
      return token;
    } catch (error) {
      this.clearAuthenticationState();
      return null;
    }
  }

  /**
   * Checks if user is authenticated
   */
  public isAuthenticated(): boolean {
    const token = this.getAccessToken();
    return !!token;
  }

  /**
   * Initializes session monitoring
   */
  private initializeSession(): void {
    this.lastActivity = Date.now();
    if (this.sessionTimer) {
      clearInterval(this.sessionTimer);
    }

    this.sessionTimer = setInterval(() => {
      if (Date.now() - this.lastActivity > SESSION_TIMEOUT) {
        this.logout();
      }
    }, 60000); // Check every minute
  }

  /**
   * Sets up user activity monitoring
   */
  private setupActivityMonitoring(): void {
    ['mousedown', 'keydown', 'scroll', 'touchstart'].forEach(eventType => {
      window.addEventListener(eventType, () => {
        this.lastActivity = Date.now();
      });
    });
  }

  /**
   * Gets current session status
   */
  public getSessionStatus(): SessionStatus {
    const token = this.getAccessToken();
    if (!token) {
      return {
        isActive: false,
        lastActivity: 0,
        expiresAt: 0
      };
    }

    return {
      isActive: true,
      lastActivity: this.lastActivity,
      expiresAt: this.lastActivity + SESSION_TIMEOUT
    };
  }
}

// Create singleton instance
const authService = new AuthService();

// Export service instance and types
export { authService };
export type { AuthResponse, SessionStatus };