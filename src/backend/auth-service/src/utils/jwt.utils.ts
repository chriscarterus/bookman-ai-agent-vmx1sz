import { sign, verify, JwtPayload, SignOptions, VerifyOptions } from 'jsonwebtoken'; // v9.0.0
import ms from 'ms'; // v2.1.3
import { auth } from '../config';

// Token management constants
const TOKEN_TYPES = {
  ACCESS: 'access',
  REFRESH: 'refresh',
  BLACKLIST: new Set<string>()
} as const;

const TOKEN_VERSION = '1';

// Custom error types for token operations
class TokenError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'TokenError';
  }
}

// Interface definitions
interface TokenPayload extends JwtPayload {
  userId: string;
  type: typeof TOKEN_TYPES[keyof typeof TOKEN_TYPES];
  version: string;
  permissions?: string[];
  correlationId?: string;
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  metadata: {
    accessExpires: number;
    refreshExpires: number;
    correlationId: string;
  };
}

/**
 * Generates a cryptographically secure JWT token with enhanced metadata and validation
 * @param payload - Token payload containing user data and permissions
 * @param type - Token type (access or refresh)
 * @param options - Additional signing options
 * @returns Promise resolving to the generated token
 * @throws {TokenError} If token generation fails
 */
export async function generateToken(
  payload: Omit<TokenPayload, 'type' | 'version'>,
  type: keyof typeof TOKEN_TYPES,
  options?: Partial<SignOptions>
): Promise<string> {
  try {
    // Validate payload
    if (!payload.userId) {
      throw new TokenError('Invalid payload: userId is required', 'INVALID_PAYLOAD');
    }

    // Select appropriate configuration based on token type
    const config = type === TOKEN_TYPES.ACCESS ? auth.accessToken : auth.refreshToken;

    // Prepare enhanced payload with security metadata
    const enhancedPayload: TokenPayload = {
      ...payload,
      type,
      version: TOKEN_VERSION,
      iat: Math.floor(Date.now() / 1000),
      iss: config.issuer,
      aud: config.audience
    };

    // Sign token with enhanced options
    const token = await new Promise<string>((resolve, reject) => {
      sign(
        enhancedPayload,
        config.secret,
        {
          algorithm: config.algorithm,
          expiresIn: config.expiresIn,
          ...options
        },
        (err, token) => {
          if (err || !token) reject(new TokenError('Token generation failed', 'GENERATION_ERROR'));
          else resolve(token);
        }
      );
    });

    return token;
  } catch (error) {
    throw error instanceof TokenError ? error : new TokenError('Token generation failed', 'UNKNOWN_ERROR');
  }
}

/**
 * Comprehensive token verification with multiple security checks
 * @param token - JWT token to verify
 * @param type - Expected token type
 * @param options - Additional verification options
 * @returns Promise resolving to the verified token payload
 * @throws {TokenError} If token verification fails
 */
export async function verifyToken(
  token: string,
  type: keyof typeof TOKEN_TYPES,
  options?: Partial<VerifyOptions>
): Promise<TokenPayload> {
  try {
    // Check token blacklist
    if (TOKEN_TYPES.BLACKLIST.has(token)) {
      throw new TokenError('Token has been blacklisted', 'TOKEN_BLACKLISTED');
    }

    // Select appropriate configuration
    const config = type === TOKEN_TYPES.ACCESS ? auth.accessToken : auth.refreshToken;

    // Verify token with enhanced options
    const payload = await new Promise<TokenPayload>((resolve, reject) => {
      verify(
        token,
        config.secret,
        {
          algorithms: [config.algorithm],
          issuer: config.issuer,
          audience: config.audience,
          ...options
        },
        (err, decoded) => {
          if (err) reject(new TokenError('Token verification failed', 'VERIFICATION_ERROR'));
          else resolve(decoded as TokenPayload);
        }
      );
    });

    // Additional security validations
    if (payload.type !== type) {
      throw new TokenError('Invalid token type', 'INVALID_TYPE');
    }

    if (payload.version !== TOKEN_VERSION) {
      throw new TokenError('Invalid token version', 'INVALID_VERSION');
    }

    return payload;
  } catch (error) {
    throw error instanceof TokenError ? error : new TokenError('Token verification failed', 'UNKNOWN_ERROR');
  }
}

/**
 * Generates secure access and refresh token pair with correlation
 * @param userData - User data and permissions for token payload
 * @param options - Additional token generation options
 * @returns Promise resolving to correlated token pair
 * @throws {TokenError} If token pair generation fails
 */
export async function generateTokenPair(
  userData: Omit<TokenPayload, 'type' | 'version' | 'correlationId'>,
  options?: Partial<SignOptions>
): Promise<TokenPair> {
  try {
    // Generate correlation ID for token pair
    const correlationId = crypto.randomUUID();

    // Generate access token
    const accessToken = await generateToken(
      { ...userData, correlationId },
      TOKEN_TYPES.ACCESS,
      options
    );

    // Generate refresh token
    const refreshToken = await generateToken(
      { ...userData, correlationId },
      TOKEN_TYPES.REFRESH,
      options
    );

    // Calculate expiration times
    const accessExpires = Date.now() + ms(auth.accessToken.expiresIn);
    const refreshExpires = Date.now() + ms(auth.refreshToken.expiresIn);

    return {
      accessToken,
      refreshToken,
      metadata: {
        accessExpires,
        refreshExpires,
        correlationId
      }
    };
  } catch (error) {
    throw error instanceof TokenError ? error : new TokenError('Token pair generation failed', 'UNKNOWN_ERROR');
  }
}

/**
 * Securely refreshes access token with comprehensive validation
 * @param refreshToken - Valid refresh token
 * @param options - Additional token generation options
 * @returns Promise resolving to new access token with metadata
 * @throws {TokenError} If token refresh fails
 */
export async function refreshAccessToken(
  refreshToken: string,
  options?: Partial<SignOptions>
): Promise<{ accessToken: string; metadata: { accessExpires: number } }> {
  try {
    // Verify refresh token
    const payload = await verifyToken(refreshToken, TOKEN_TYPES.REFRESH);

    // Generate new access token with same correlation ID
    const accessToken = await generateToken(
      {
        userId: payload.userId,
        permissions: payload.permissions,
        correlationId: payload.correlationId
      },
      TOKEN_TYPES.ACCESS,
      options
    );

    // Calculate new access token expiration
    const accessExpires = Date.now() + ms(auth.accessToken.expiresIn);

    return {
      accessToken,
      metadata: {
        accessExpires
      }
    };
  } catch (error) {
    throw error instanceof TokenError ? error : new TokenError('Access token refresh failed', 'UNKNOWN_ERROR');
  }
}