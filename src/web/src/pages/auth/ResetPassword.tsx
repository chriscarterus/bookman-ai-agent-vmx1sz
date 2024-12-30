import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import zxcvbn from 'zxcvbn'; // ^4.4.2

// Internal imports
import { AuthLayout } from '../../layouts/AuthLayout';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Alert } from '../../components/common/Alert';
import { useAuth } from '../../hooks/useAuth';
import { validatePassword, sanitizeInput } from '../../utils/validation.utils';

// Constants for security and validation
const RATE_LIMIT_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW = 300000; // 5 minutes
const MIN_PASSWORD_LENGTH = 8;
const PASSWORD_TIMEOUT = 300000; // 5 minutes

interface ResetPasswordFormData {
  email: string;
  token: string | null;
  newPassword: string | null;
  confirmPassword: string | null;
  deviceFingerprint: string;
  lastAttemptTimestamp: number;
}

interface PasswordValidationResult {
  isValid: boolean;
  score: number;
  feedback: string[];
  requirements: Record<string, boolean>;
}

const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const { resetPassword, confirmPasswordReset, loading, error } = useAuth();

  // Form state management
  const [formData, setFormData] = useState<ResetPasswordFormData>({
    email: '',
    token: new URLSearchParams(window.location.search).get('token'),
    newPassword: null,
    confirmPassword: null,
    deviceFingerprint: crypto.randomUUID(),
    lastAttemptTimestamp: 0
  });

  // Validation state
  const [validationState, setValidationState] = useState<PasswordValidationResult>({
    isValid: false,
    score: 0,
    feedback: [],
    requirements: {
      length: false,
      uppercase: false,
      lowercase: false,
      number: false,
      special: false
    }
  });

  const [attempts, setAttempts] = useState<number>(0);
  const [isRateLimited, setIsRateLimited] = useState<boolean>(false);
  const [showSuccess, setShowSuccess] = useState<boolean>(false);

  // Reset rate limiting after window expires
  useEffect(() => {
    if (isRateLimited) {
      const timer = setTimeout(() => {
        setIsRateLimited(false);
        setAttempts(0);
      }, RATE_LIMIT_WINDOW);
      return () => clearTimeout(timer);
    }
  }, [isRateLimited]);

  // Validate password strength and requirements
  const validatePasswordStrength = useCallback((password: string): PasswordValidationResult => {
    const result = validatePassword(password);
    const zxcvbnResult = zxcvbn(password);

    return {
      isValid: result.isValid && zxcvbnResult.score >= 3,
      score: zxcvbnResult.score * 20,
      feedback: [
        ...result.errors,
        ...zxcvbnResult.feedback.suggestions
      ],
      requirements: {
        length: password.length >= MIN_PASSWORD_LENGTH,
        uppercase: /[A-Z]/.test(password),
        lowercase: /[a-z]/.test(password),
        number: /[0-9]/.test(password),
        special: /[!@#$%^&*(),.?":{}|<>]/.test(password)
      }
    };
  }, []);

  // Handle input changes with validation
  const handleInputChange = useCallback((name: keyof ResetPasswordFormData, value: string) => {
    const sanitizedValue = sanitizeInput(value);
    setFormData(prev => ({ ...prev, [name]: sanitizedValue }));

    if (name === 'newPassword') {
      const validationResult = validatePasswordStrength(sanitizedValue);
      setValidationState(validationResult);
    }
  }, [validatePasswordStrength]);

  // Handle form submission with security checks
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Rate limiting check
    if (isRateLimited || attempts >= RATE_LIMIT_ATTEMPTS) {
      setIsRateLimited(true);
      return;
    }

    // Update attempt counter
    setAttempts(prev => prev + 1);
    setFormData(prev => ({ ...prev, lastAttemptTimestamp: Date.now() }));

    try {
      if (!formData.token) {
        // Step 1: Request password reset
        await resetPassword(formData.email);
        setShowSuccess(true);
      } else {
        // Step 2: Confirm password reset
        if (!formData.newPassword || !formData.confirmPassword) {
          throw new Error('Please enter and confirm your new password');
        }

        if (formData.newPassword !== formData.confirmPassword) {
          throw new Error('Passwords do not match');
        }

        if (!validationState.isValid) {
          throw new Error('Password does not meet security requirements');
        }

        await confirmPasswordReset(
          formData.token,
          formData.newPassword,
          formData.deviceFingerprint
        );

        // Navigate to login on success
        navigate('/auth/login', { 
          state: { message: 'Password reset successful. Please log in with your new password.' }
        });
      }
    } catch (err) {
      console.error('Password reset error:', err);
      if (attempts >= RATE_LIMIT_ATTEMPTS - 1) {
        setIsRateLimited(true);
      }
    }
  };

  // Render password requirements feedback
  const renderRequirements = () => (
    <div className="password-requirements" role="alert" aria-live="polite">
      <ul>
        {Object.entries(validationState.requirements).map(([req, met]) => (
          <li key={req} className={met ? 'met' : 'unmet'}>
            <span aria-hidden="true">{met ? '✓' : '×'}</span>
            {req.charAt(0).toUpperCase() + req.slice(1)} requirement
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <AuthLayout>
      <div className="reset-password">
        <h1>{formData.token ? 'Reset Your Password' : 'Request Password Reset'}</h1>

        {error && (
          <Alert
            severity="error"
            message={error.message}
            role="alert"
          />
        )}

        {showSuccess && !formData.token && (
          <Alert
            severity="success"
            message="If an account exists with this email, you will receive password reset instructions."
            role="alert"
          />
        )}

        {isRateLimited && (
          <Alert
            severity="error"
            message={`Too many attempts. Please try again in ${RATE_LIMIT_WINDOW / 60000} minutes.`}
            role="alert"
          />
        )}

        <form onSubmit={handleSubmit} noValidate>
          {!formData.token ? (
            <Input
              type="email"
              value={formData.email}
              onChange={(value) => handleInputChange('email', value as string)}
              placeholder="Enter your email"
              disabled={loading || isRateLimited}
              required
              aria-label="Email address"
              autoComplete="email"
            />
          ) : (
            <>
              <Input
                type="password"
                value={formData.newPassword || ''}
                onChange={(value) => handleInputChange('newPassword', value as string)}
                placeholder="New password"
                disabled={loading || isRateLimited}
                required
                aria-label="New password"
                autoComplete="new-password"
              />
              <Input
                type="password"
                value={formData.confirmPassword || ''}
                onChange={(value) => handleInputChange('confirmPassword', value as string)}
                placeholder="Confirm new password"
                disabled={loading || isRateLimited}
                required
                aria-label="Confirm new password"
                autoComplete="new-password"
              />
              {formData.newPassword && renderRequirements()}
            </>
          )}

          <Button
            type="submit"
            disabled={loading || isRateLimited}
            loading={loading}
            fullWidth
            aria-label={formData.token ? 'Reset password' : 'Request password reset'}
          >
            {formData.token ? 'Reset Password' : 'Request Reset'}
          </Button>
        </form>
      </div>
    </AuthLayout>
  );
};

export default ResetPassword;