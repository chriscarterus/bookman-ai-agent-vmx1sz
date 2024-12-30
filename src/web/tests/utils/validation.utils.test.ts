// External imports with version
import { describe, test, expect, beforeEach } from '@jest/globals'; // ^29.6.0

// Internal imports
import {
  validateEmail,
  validatePassword,
  sanitizeInput,
  validateApiResponse,
  validateUrl
} from '../../src/utils/validation.utils';
import { ErrorSeverity } from '../../src/types/api.types';

// Test fixtures for email validation
const VALID_EMAIL_FIXTURES = [
  "user@example.com",
  "test.user@domain.co.uk",
  "valid.email+tag@subdomain.domain.com",
  "user-name@domain.com",
  "first.last@domain.co.jp"
];

const INVALID_EMAIL_FIXTURES = [
  "invalid@",
  "@domain.com",
  "no-at-sign",
  "spaces in@email.com",
  "double@@domain.com",
  ".starts-with-dot@domain.com",
  "ends-with-dot@domain.com.",
  "a".repeat(255) + "@domain.com" // Exceeds max length
];

// Test fixtures for password validation
const VALID_PASSWORD_FIXTURES = [
  "StrongP@ss123",
  "C0mpl3x!Pass",
  "Secure&Pass123",
  "P@ssw0rd!2023",
  "Ultra$tr0ng!Pass"
];

const INVALID_PASSWORD_FIXTURES = [
  "weak",
  "nodigits!",
  "12345678",
  "NoSpecialChar1",
  "no_uppercase1!",
  "NO_LOWERCASE1!",
  "Sh0rt!"
];

// Test fixtures for XSS prevention
const XSS_TEST_FIXTURES = [
  "<script>alert('xss')</script>",
  "javascript:alert(1)",
  "<img src=x onerror=alert(1)>",
  "<svg onload=alert(1)>",
  "'><script>alert(document.cookie)</script>"
];

// Test fixtures for SQL injection prevention
const SQL_INJECTION_FIXTURES = [
  "' OR '1'='1",
  "; DROP TABLE users;",
  "' UNION SELECT * FROM users;",
  "--",
  "/**/"
];

// Test fixtures for API response validation
const VALID_API_RESPONSE = {
  success: true,
  data: { test: "data" },
  timestamp: new Date().toISOString(),
  requestId: "123e4567-e89b-12d3-a456-426614174000"
};

const INVALID_API_RESPONSE = {
  success: true,
  data: { test: "data" },
  error: { // Invalid because success=true with error object
    code: "ERR_001",
    message: "Error message",
    details: {},
    severity: ErrorSeverity.ERROR
  },
  timestamp: new Date().toISOString(),
  requestId: "123e4567-e89b-12d3-a456-426614174000"
};

describe('Email Validation Tests', () => {
  test.each(VALID_EMAIL_FIXTURES)(
    'should validate correct email format: %s',
    (email) => {
      expect(validateEmail(email)).toBe(true);
    }
  );

  test.each(INVALID_EMAIL_FIXTURES)(
    'should reject invalid email format: %s',
    (email) => {
      expect(validateEmail(email)).toBe(false);
    }
  );

  test('should handle empty email', () => {
    expect(validateEmail('')).toBe(false);
  });

  test('should handle null/undefined email', () => {
    expect(validateEmail(null as unknown as string)).toBe(false);
    expect(validateEmail(undefined as unknown as string)).toBe(false);
  });
});

describe('Password Validation Tests', () => {
  test.each(VALID_PASSWORD_FIXTURES)(
    'should validate strong password: %s',
    (password) => {
      const result = validatePassword(password);
      expect(result.isValid).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(80);
      expect(result.errors).toHaveLength(0);
    }
  );

  test.each(INVALID_PASSWORD_FIXTURES)(
    'should reject weak password: %s',
    (password) => {
      const result = validatePassword(password);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    }
  );

  test('should validate password complexity requirements', () => {
    const result = validatePassword('weakpassword');
    expect(result.errors).toContain('Password must contain at least one uppercase letter');
    expect(result.errors).toContain('Password must contain at least one number');
    expect(result.errors).toContain('Password must contain at least one special character');
  });

  test('should detect sequential characters', () => {
    const result = validatePassword('Password123!');
    expect(result.errors).toContain('Password cannot contain sequential characters');
  });
});

describe('Input Sanitization Tests', () => {
  test.each(XSS_TEST_FIXTURES)(
    'should sanitize XSS attack patterns: %s',
    (input) => {
      const sanitized = sanitizeInput(input);
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('javascript:');
      expect(sanitized).not.toContain('onerror=');
      expect(sanitized).not.toContain('onload=');
    }
  );

  test.each(SQL_INJECTION_FIXTURES)(
    'should sanitize SQL injection patterns: %s',
    (input) => {
      const sanitized = sanitizeInput(input);
      expect(sanitized).not.toEqual(input);
      expect(sanitized).toEqual(expect.not.stringMatching(/['";\-\/\*]/));
    }
  );

  test('should handle special characters', () => {
    const input = '&<>"\'';
    const sanitized = sanitizeInput(input);
    expect(sanitized).toEqual('&amp;&lt;&gt;&quot;&#x27;');
  });

  test('should trim whitespace', () => {
    expect(sanitizeInput('  test  ')).toBe('test');
  });
});

describe('URL Validation Tests', () => {
  test('should validate correct URLs', () => {
    expect(validateUrl('https://example.com')).toBe(true);
    expect(validateUrl('http://subdomain.example.com')).toBe(true);
    expect(validateUrl('https://example.com/path?query=1')).toBe(true);
  });

  test('should reject invalid URLs', () => {
    expect(validateUrl('not-a-url')).toBe(false);
    expect(validateUrl('ftp://example.com')).toBe(false);
    expect(validateUrl('http:/example.com')).toBe(false);
  });

  test('should reject URLs with auth credentials', () => {
    expect(validateUrl('https://user:pass@example.com')).toBe(false);
  });

  test('should handle empty/invalid input', () => {
    expect(validateUrl('')).toBe(false);
    expect(validateUrl('   ')).toBe(false);
    expect(validateUrl(null as unknown as string)).toBe(false);
  });
});

describe('API Response Validation Tests', () => {
  test('should validate correct API response', () => {
    expect(() => validateApiResponse(VALID_API_RESPONSE)).not.toThrow();
    const validated = validateApiResponse(VALID_API_RESPONSE);
    expect(validated.success).toBe(true);
    expect(validated.data).toBeDefined();
  });

  test('should reject invalid API response', () => {
    expect(() => validateApiResponse(INVALID_API_RESPONSE)).toThrow();
  });

  test('should validate error response', () => {
    const errorResponse = {
      success: false,
      data: null,
      error: {
        code: 'ERR_001',
        message: 'Error occurred',
        details: {},
        severity: ErrorSeverity.ERROR
      },
      timestamp: new Date().toISOString(),
      requestId: '123e4567-e89b-12d3-a456-426614174000'
    };
    expect(() => validateApiResponse(errorResponse)).not.toThrow();
  });

  test('should reject malformed responses', () => {
    expect(() => validateApiResponse({})).toThrow();
    expect(() => validateApiResponse(null)).toThrow();
    expect(() => validateApiResponse(undefined)).toThrow();
  });
});