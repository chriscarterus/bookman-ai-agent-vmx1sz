/**
 * @fileoverview Enhanced Login page component for Bookman AI platform
 * @version 1.0.0
 * @description Implements secure authentication with MFA support, comprehensive validation,
 * and advanced security features following the platform's design system
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDebounce } from 'use-debounce';

// Internal imports
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import useAuth from '../../hooks/useAuth';
import { validateEmail, validatePassword } from '../../utils/validation.utils';

// Constants for security and validation
const LOGIN_ATTEMPT_KEY = 'login_attempts';
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes
const DEBOUNCE_DELAY = 300;

interface LoginState {
  email: string;
  password: string;
  mfaCode: string;
  rememberMe: boolean;
}

interface ValidationState {
  email: string;
  password: string;
  mfaCode: string;
}

/**
 * Enhanced Login component with comprehensive security features
 */
const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login, validateMfa, loading, error, mfaRequired } = useAuth();

  // Form state management
  const [formState, setFormState] = useState<LoginState>({
    email: '',
    password: '',
    mfaCode: '',
    rememberMe: false
  });

  // Validation state management
  const [validationErrors, setValidationErrors] = useState<ValidationState>({
    email: '',
    password: '',
    mfaCode: ''
  });

  // Security state management
  const [loginAttempts, setLoginAttempts] = useState<number>(
    parseInt(localStorage.getItem(LOGIN_ATTEMPT_KEY) || '0')
  );
  const [isLocked, setIsLocked] = useState<boolean>(false);

  // Debounced email validation
  const [debouncedEmail] = useDebounce(formState.email, DEBOUNCE_DELAY);

  /**
   * Validates email input with debounce
   */
  useEffect(() => {
    if (debouncedEmail) {
      const isValidEmail = validateEmail(debouncedEmail);
      setValidationErrors(prev => ({
        ...prev,
        email: isValidEmail ? '' : 'Please enter a valid email address'
      }));
    }
  }, [debouncedEmail]);

  /**
   * Handles login attempt tracking and lockout
   */
  const handleLoginAttempt = useCallback((success: boolean) => {
    const attempts = success ? 0 : loginAttempts + 1;
    setLoginAttempts(attempts);
    localStorage.setItem(LOGIN_ATTEMPT_KEY, attempts.toString());

    if (attempts >= MAX_LOGIN_ATTEMPTS) {
      setIsLocked(true);
      localStorage.setItem('lockout_time', Date.now().toString());
      setTimeout(() => {
        setIsLocked(false);
        setLoginAttempts(0);
        localStorage.setItem(LOGIN_ATTEMPT_KEY, '0');
      }, LOCKOUT_DURATION);
    }
  }, [loginAttempts]);

  /**
   * Validates form input comprehensively
   */
  const validateForm = useCallback((): boolean => {
    const errors: ValidationState = {
      email: '',
      password: '',
      mfaCode: ''
    };

    // Email validation
    if (!validateEmail(formState.email)) {
      errors.email = 'Please enter a valid email address';
    }

    // Password validation
    const passwordValidation = validatePassword(formState.password);
    if (!passwordValidation.isValid) {
      errors.password = passwordValidation.errors[0];
    }

    // MFA code validation if required
    if (mfaRequired && !/^\d{6}$/.test(formState.mfaCode)) {
      errors.mfaCode = 'Please enter a valid 6-digit MFA code';
    }

    setValidationErrors(errors);
    return !Object.values(errors).some(error => error !== '');
  }, [formState, mfaRequired]);

  /**
   * Handles form submission with security checks
   */
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (isLocked) {
      return;
    }

    if (!validateForm()) {
      return;
    }

    try {
      if (mfaRequired) {
        await validateMfa(formState.mfaCode);
        navigate('/dashboard');
      } else {
        await login({
          email: formState.email,
          password: formState.password,
          rememberMe: formState.rememberMe
        });
        handleLoginAttempt(true);
        navigate('/dashboard');
      }
    } catch (error) {
      handleLoginAttempt(false);
      console.error('Login failed:', error);
    }
  };

  /**
   * Handles input changes with validation
   */
  const handleInputChange = (field: keyof LoginState) => (
    value: string,
    isValid: boolean
  ) => {
    setFormState(prev => ({ ...prev, [field]: value }));
    setValidationErrors(prev => ({
      ...prev,
      [field]: isValid ? '' : `Invalid ${field}`
    }));
  };

  return (
    <div className="login-container">
      <form onSubmit={handleSubmit} className="login-form">
        <h1>Welcome to Bookman AI</h1>
        
        {isLocked && (
          <div className="error-message" role="alert">
            Account temporarily locked. Please try again later.
          </div>
        )}

        {!mfaRequired ? (
          <>
            <Input
              type="email"
              value={formState.email}
              onChange={handleInputChange('email')}
              error={validationErrors.email}
              disabled={isLocked || loading}
              required
              aria-label="Email address"
              autoComplete="email"
            />

            <Input
              type="password"
              value={formState.password}
              onChange={handleInputChange('password')}
              error={validationErrors.password}
              disabled={isLocked || loading}
              required
              aria-label="Password"
              autoComplete="current-password"
            />

            <label className="remember-me">
              <input
                type="checkbox"
                checked={formState.rememberMe}
                onChange={e => setFormState(prev => ({
                  ...prev,
                  rememberMe: e.target.checked
                }))}
                disabled={isLocked}
              />
              Remember me
            </label>
          </>
        ) : (
          <Input
            type="text"
            value={formState.mfaCode}
            onChange={handleInputChange('mfaCode')}
            error={validationErrors.mfaCode}
            disabled={loading}
            required
            aria-label="MFA Code"
            pattern="\d{6}"
            maxLength={6}
          />
        )}

        {error && (
          <div className="error-message" role="alert">
            {error.message}
          </div>
        )}

        <Button
          type="submit"
          disabled={isLocked || loading || Object.values(validationErrors).some(error => error !== '')}
          loading={loading}
          fullWidth
        >
          {mfaRequired ? 'Verify MFA' : 'Sign In'}
        </Button>

        <div className="login-links">
          <a href="/forgot-password">Forgot password?</a>
          <a href="/register">Create account</a>
        </div>
      </form>
    </div>
  );
};

export default Login;