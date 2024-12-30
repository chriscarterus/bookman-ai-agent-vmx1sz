// External imports with versions
import validator from 'validator'; // ^13.9.0
import { z } from 'zod'; // ^3.21.4

// Internal imports
import { ApiError, ApiResponse, ErrorSeverity } from '../types/api.types';

// Constants for validation rules
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;
const MAX_EMAIL_LENGTH = 254;
const SPECIAL_CHARS_REGEX = /[!@#$%^&*(),.?":{}|<>]/;
const SEQUENTIAL_CHARS_REGEX = /(abc|bcd|cde|def|efg|123|234|345|456|567|678|789)/i;
const COMMON_PASSWORDS = new Set(['password', 'admin123', '12345678', 'qwerty123']);

/**
 * Enhanced email validation with security checks
 * @param email - Email address to validate
 * @returns boolean indicating if email is valid and secure
 */
export const validateEmail = (email: string): boolean => {
  try {
    // Normalize and trim email
    const normalizedEmail = email.trim().toLowerCase();

    // Basic validation checks
    if (!normalizedEmail || normalizedEmail.length > MAX_EMAIL_LENGTH) {
      return false;
    }

    // Enhanced email validation with strict mode
    const emailOptions = {
      allow_utf8_local_part: false,
      require_tld: true,
      allow_ip_domain: false,
      domain_specific_validation: true,
      blacklisted_chars: '<>()[]\\,;:',
    };

    if (!validator.isEmail(normalizedEmail, emailOptions)) {
      return false;
    }

    // Check for suspicious patterns
    const [localPart, domain] = normalizedEmail.split('@');
    
    // Prevent local part from starting/ending with dots
    if (localPart.startsWith('.') || localPart.endsWith('.')) {
      return false;
    }

    // Check for suspicious domain patterns
    const suspiciousDomains = [
      'tempmail',
      'throwaway',
      'disposable',
      'temporary'
    ];
    
    if (suspiciousDomains.some(pattern => domain.includes(pattern))) {
      return false;
    }

    return true;
  } catch (error) {
    console.error('Email validation error:', error);
    return false;
  }
};

/**
 * Interface for password validation result
 */
interface PasswordValidationResult {
  isValid: boolean;
  score: number;
  errors: string[];
}

/**
 * Enhanced password validation with comprehensive security checks
 * @param password - Password to validate
 * @returns PasswordValidationResult object with validation details
 */
export const validatePassword = (password: string): PasswordValidationResult => {
  const errors: string[] = [];
  let score = 0;

  try {
    // Basic length check
    if (password.length < MIN_PASSWORD_LENGTH) {
      errors.push(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long`);
    } else if (password.length > MAX_PASSWORD_LENGTH) {
      errors.push(`Password cannot exceed ${MAX_PASSWORD_LENGTH} characters`);
    } else {
      score += 20;
    }

    // Character type checks
    if (/[A-Z]/.test(password)) score += 20;
    if (/[a-z]/.test(password)) score += 20;
    if (/[0-9]/.test(password)) score += 20;
    if (SPECIAL_CHARS_REGEX.test(password)) score += 20;

    // Complexity requirements
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }
    if (!SPECIAL_CHARS_REGEX.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    // Check for sequential characters
    if (SEQUENTIAL_CHARS_REGEX.test(password)) {
      errors.push('Password cannot contain sequential characters');
      score -= 20;
    }

    // Check against common passwords
    if (COMMON_PASSWORDS.has(password.toLowerCase())) {
      errors.push('Password is too common');
      score = 0;
    }

    // Entropy check for additional security
    const entropy = calculatePasswordEntropy(password);
    if (entropy < 50) {
      errors.push('Password is not complex enough');
      score = Math.min(score, 60);
    }

    return {
      isValid: errors.length === 0 && score >= 80,
      score: Math.max(0, Math.min(100, score)),
      errors
    };
  } catch (error) {
    console.error('Password validation error:', error);
    return {
      isValid: false,
      score: 0,
      errors: ['Password validation failed']
    };
  }
};

/**
 * Calculate password entropy for strength measurement
 * @param password - Password to analyze
 * @returns number representing password entropy
 */
const calculatePasswordEntropy = (password: string): number => {
  const charSet = new Set(password.split(''));
  const poolSize = charSet.size;
  return Math.log2(Math.pow(poolSize, password.length));
};

/**
 * Generic API response schema using Zod
 */
const apiResponseSchema = z.object({
  success: z.boolean(),
  data: z.unknown(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.unknown()),
    severity: z.nativeEnum(ErrorSeverity)
  }).optional(),
  timestamp: z.string().datetime(),
  requestId: z.string().uuid()
});

/**
 * Validates API response with comprehensive type checking
 * @param response - Unknown response object to validate
 * @returns Validated and typed API response
 * @throws Error if validation fails
 */
export const validateApiResponse = <T>(response: unknown): ApiResponse<T> => {
  try {
    // Parse and validate basic structure
    const validatedResponse = apiResponseSchema.parse(response);

    // Additional validation for success case
    if (validatedResponse.success && validatedResponse.error) {
      throw new Error('Success response cannot contain error object');
    }

    // Additional validation for error case
    if (!validatedResponse.success && !validatedResponse.error) {
      throw new Error('Error response must contain error object');
    }

    // Type assertion after validation
    return validatedResponse as ApiResponse<T>;
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`API Response validation failed: ${error.errors.map(e => e.message).join(', ')}`);
    }
    throw error;
  }
};

/**
 * Sanitizes user input to prevent XSS attacks
 * @param input - String to sanitize
 * @returns Sanitized string
 */
export const sanitizeInput = (input: string): string => {
  return validator.escape(validator.trim(input));
};

/**
 * Validates and sanitizes URL for security
 * @param url - URL to validate
 * @returns boolean indicating if URL is valid and safe
 */
export const validateUrl = (url: string): boolean => {
  const sanitizedUrl = validator.trim(url);
  return validator.isURL(sanitizedUrl, {
    protocols: ['http', 'https'],
    require_protocol: true,
    require_valid_protocol: true,
    disallow_auth: true,
    allow_fragments: false
  });
};