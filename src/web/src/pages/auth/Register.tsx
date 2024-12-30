/**
 * @fileoverview Registration page component with enhanced security features
 * and comprehensive form validation for the Bookman AI platform.
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, ButtonVariant } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { validateEmail, validatePassword, sanitizeInput } from '../../utils/validation.utils';
import { authService } from '../../services/auth.service';
import { LoadingState, ErrorSeverity } from '../../types/api.types';

// Form state interface
interface RegistrationForm {
  email: string;
  password: string;
  confirmPassword: string;
  securityQuestion: string;
  securityAnswer: string;
}

// Error state interface
interface FormErrors {
  email: string;
  password: string;
  confirmPassword: string;
  securityQuestion: string;
  securityAnswer: string;
  general: string;
}

// Constants
const INITIAL_FORM_STATE: RegistrationForm = {
  email: '',
  password: '',
  confirmPassword: '',
  securityQuestion: '',
  securityAnswer: ''
};

const INITIAL_ERROR_STATE: FormErrors = {
  email: '',
  password: '',
  confirmPassword: '',
  securityQuestion: '',
  securityAnswer: '',
  general: ''
};

const SECURITY_QUESTIONS = [
  'What was your first pet\'s name?',
  'In which city were you born?',
  'What is your mother\'s maiden name?',
  'What was the name of your first school?'
];

/**
 * Enhanced registration component with comprehensive security features
 */
export const Register: React.FC = () => {
  // State management
  const [formData, setFormData] = useState<RegistrationForm>(INITIAL_FORM_STATE);
  const [errors, setErrors] = useState<FormErrors>(INITIAL_ERROR_STATE);
  const [loadingState, setLoadingState] = useState<LoadingState>(LoadingState.IDLE);
  const [passwordStrength, setPasswordStrength] = useState<number>(0);
  const submitAttempts = useRef<number>(0);
  const lastSubmitTime = useRef<number>(0);
  const navigate = useNavigate();

  // Rate limiting check
  const checkRateLimit = useCallback((): boolean => {
    const now = Date.now();
    const timeSinceLastSubmit = now - lastSubmitTime.current;
    
    if (submitAttempts.current >= 5 && timeSinceLastSubmit < 300000) {
      setErrors(prev => ({
        ...prev,
        general: 'Too many attempts. Please try again later.'
      }));
      return false;
    }
    
    if (timeSinceLastSubmit > 300000) {
      submitAttempts.current = 0;
    }
    
    return true;
  }, []);

  // Reset rate limiting after timeout
  useEffect(() => {
    const resetTimer = setTimeout(() => {
      submitAttempts.current = 0;
    }, 300000);

    return () => clearTimeout(resetTimer);
  }, []);

  /**
   * Validates the entire form with enhanced security checks
   */
  const validateForm = useCallback((): boolean => {
    const newErrors: FormErrors = { ...INITIAL_ERROR_STATE };
    let isValid = true;

    // Email validation
    if (!validateEmail(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
      isValid = false;
    }

    // Password validation
    const passwordValidation = validatePassword(formData.password);
    if (!passwordValidation.isValid) {
      newErrors.password = passwordValidation.errors[0];
      isValid = false;
    }
    setPasswordStrength(passwordValidation.score);

    // Confirm password validation
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
      isValid = false;
    }

    // Security question validation
    if (!formData.securityQuestion.trim()) {
      newErrors.securityQuestion = 'Please select a security question';
      isValid = false;
    }

    // Security answer validation
    if (!formData.securityAnswer.trim()) {
      newErrors.securityAnswer = 'Please provide an answer to the security question';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  }, [formData]);

  /**
   * Handles input changes with sanitization
   */
  const handleInputChange = useCallback((field: keyof RegistrationForm, value: string) => {
    const sanitizedValue = field !== 'password' && field !== 'confirmPassword' 
      ? sanitizeInput(value)
      : value;

    setFormData(prev => ({
      ...prev,
      [field]: sanitizedValue
    }));

    // Clear field-specific error when user starts typing
    setErrors(prev => ({
      ...prev,
      [field]: '',
      general: ''
    }));
  }, []);

  /**
   * Handles form submission with enhanced security
   */
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    // Rate limiting check
    if (!checkRateLimit()) {
      return;
    }

    // Validate form
    if (!validateForm()) {
      return;
    }

    setLoadingState(LoadingState.LOADING);
    submitAttempts.current += 1;
    lastSubmitTime.current = Date.now();

    try {
      // Register user
      const response = await authService.register({
        email: formData.email,
        password: formData.password,
        securityQuestion: formData.securityQuestion,
        securityAnswer: formData.securityAnswer
      });

      if (response.success) {
        setLoadingState(LoadingState.SUCCESS);
        navigate('/auth/verify-email', { 
          state: { email: formData.email }
        });
      }
    } catch (error: any) {
      setLoadingState(LoadingState.ERROR);
      setErrors(prev => ({
        ...prev,
        general: error.message || 'Registration failed. Please try again.'
      }));

      // Log error for monitoring
      console.error('Registration error:', {
        error,
        email: formData.email,
        timestamp: new Date().toISOString()
      });
    }
  };

  return (
    <div className="register-container" data-testid="register-form">
      <h1>Create Your Account</h1>
      
      {errors.general && (
        <div 
          className="error-message" 
          role="alert" 
          aria-live="polite"
        >
          {errors.general}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <Input
          type="email"
          value={formData.email}
          onChange={(value) => handleInputChange('email', value)}
          error={errors.email}
          placeholder="Email address"
          required
          aria-label="Email address"
          autoComplete="email"
          data-testid="email-input"
        />

        <Input
          type="password"
          value={formData.password}
          onChange={(value) => handleInputChange('password', value)}
          error={errors.password}
          placeholder="Password"
          required
          aria-label="Password"
          autoComplete="new-password"
          data-testid="password-input"
        />

        {passwordStrength > 0 && (
          <div 
            className={`password-strength strength-${passwordStrength}`}
            aria-label={`Password strength: ${passwordStrength}%`}
          >
            <div 
              className="strength-bar" 
              style={{ width: `${passwordStrength}%` }}
            />
          </div>
        )}

        <Input
          type="password"
          value={formData.confirmPassword}
          onChange={(value) => handleInputChange('confirmPassword', value)}
          error={errors.confirmPassword}
          placeholder="Confirm password"
          required
          aria-label="Confirm password"
          autoComplete="new-password"
          data-testid="confirm-password-input"
        />

        <select
          value={formData.securityQuestion}
          onChange={(e) => handleInputChange('securityQuestion', e.target.value)}
          className={errors.securityQuestion ? 'error' : ''}
          required
          aria-label="Security question"
          data-testid="security-question-select"
        >
          <option value="">Select a security question</option>
          {SECURITY_QUESTIONS.map((question, index) => (
            <option key={index} value={question}>
              {question}
            </option>
          ))}
        </select>

        <Input
          type="text"
          value={formData.securityAnswer}
          onChange={(value) => handleInputChange('securityAnswer', value)}
          error={errors.securityAnswer}
          placeholder="Answer to security question"
          required
          aria-label="Security answer"
          data-testid="security-answer-input"
        />

        <Button
          type="submit"
          variant={ButtonVariant.PRIMARY}
          loading={loadingState === LoadingState.LOADING}
          disabled={loadingState === LoadingState.LOADING}
          fullWidth
          data-testid="register-button"
        >
          Create Account
        </Button>
      </form>
    </div>
  );
};

export default Register;