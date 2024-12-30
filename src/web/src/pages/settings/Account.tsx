/**
 * Account Settings Page Component
 * @version 1.0.0
 * @description Provides comprehensive user profile management, enhanced security settings,
 * and personalized preferences with strict security controls and accessibility features
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import * as yup from 'yup';
import { Button } from '../../components/common/Button';
import { authService } from '../../services/auth.service';
import { LoadingState, ErrorSeverity, ApiError } from '../../types/api.types';

// Form validation schemas
const profileSchema = yup.object().shape({
  email: yup.string().email('Invalid email format').required('Email is required'),
  displayName: yup.string().min(2, 'Display name too short').max(50, 'Display name too long').required('Display name is required'),
  timezone: yup.string().required('Timezone is required'),
  notifications: yup.boolean(),
  securityPreferences: yup.object().shape({
    mfaEnabled: yup.boolean(),
    sessionTimeout: yup.number().min(5).max(60),
    loginNotifications: yup.boolean()
  })
});

const passwordSchema = yup.object().shape({
  currentPassword: yup.string().required('Current password is required'),
  newPassword: yup
    .string()
    .required('New password is required')
    .min(12, 'Password must be at least 12 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, 
      'Password must contain uppercase, lowercase, number and special character'),
  confirmPassword: yup
    .string()
    .oneOf([yup.ref('newPassword')], 'Passwords must match')
    .required('Password confirmation is required')
});

// Component interfaces
interface ProfileFormData {
  email: string;
  displayName: string;
  timezone: string;
  notifications: boolean;
  securityPreferences: SecuritySettings;
}

interface SecuritySettings {
  mfaEnabled: boolean;
  sessionTimeout: number;
  loginNotifications: boolean;
}

interface SessionInfo {
  lastActivity: number;
  expiresAt: number;
  isActive: boolean;
}

interface NotificationSettings {
  email: boolean;
  push: boolean;
  sms: boolean;
}

/**
 * Account Settings Page Component
 */
const Account: React.FC = () => {
  // State management
  const [loading, setLoading] = useState<LoadingState>(LoadingState.IDLE);
  const [error, setError] = useState<ApiError | null>(null);
  const [mfaEnabled, setMfaEnabled] = useState<boolean>(false);
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [notifications, setNotifications] = useState<NotificationSettings>({
    email: true,
    push: true,
    sms: false
  });

  // Form management
  const { register: profileRegister, handleSubmit: handleProfileSubmit, formState: { errors: profileErrors } } = 
    useForm<ProfileFormData>({ mode: 'onChange', resolver: yup.object().shape(profileSchema) });

  const { register: passwordRegister, handleSubmit: handlePasswordSubmit, formState: { errors: passwordErrors } } = 
    useForm({ mode: 'onChange', resolver: yup.object().shape(passwordSchema) });

  // Initialize component data
  useEffect(() => {
    const initializeSettings = async () => {
      try {
        setLoading(LoadingState.LOADING);
        const session = authService.getSessionStatus();
        setSessionInfo(session);
        setMfaEnabled(session.mfaEnabled || false);
        setLoading(LoadingState.SUCCESS);
      } catch (err) {
        setError({
          code: 'INIT_ERROR',
          message: 'Failed to initialize settings',
          details: err,
          severity: ErrorSeverity.ERROR
        });
        setLoading(LoadingState.ERROR);
      }
    };

    initializeSettings();
  }, []);

  /**
   * Handles profile information updates
   */
  const handleProfileUpdate = useCallback(async (formData: ProfileFormData) => {
    try {
      setLoading(LoadingState.LOADING);
      setError(null);

      await authService.updateProfile({
        ...formData,
        securityPreferences: {
          ...formData.securityPreferences,
          mfaEnabled
        }
      });

      setLoading(LoadingState.SUCCESS);
    } catch (err) {
      setError({
        code: 'UPDATE_ERROR',
        message: 'Failed to update profile',
        details: err,
        severity: ErrorSeverity.ERROR
      });
      setLoading(LoadingState.ERROR);
    }
  }, [mfaEnabled]);

  /**
   * Handles password changes with security validation
   */
  const handlePasswordChange = useCallback(async (formData: any) => {
    try {
      setLoading(LoadingState.LOADING);
      setError(null);

      await authService.changePassword({
        currentPassword: formData.currentPassword,
        newPassword: formData.newPassword
      });

      setLoading(LoadingState.SUCCESS);
    } catch (err) {
      setError({
        code: 'PASSWORD_ERROR',
        message: 'Failed to change password',
        details: err,
        severity: ErrorSeverity.ERROR
      });
      setLoading(LoadingState.ERROR);
    }
  }, []);

  /**
   * Handles MFA configuration
   */
  const handleMfaToggle = useCallback(async (enabled: boolean) => {
    try {
      setLoading(LoadingState.LOADING);
      setError(null);

      await authService.configureMfa(enabled);
      setMfaEnabled(enabled);

      setLoading(LoadingState.SUCCESS);
    } catch (err) {
      setError({
        code: 'MFA_ERROR',
        message: 'Failed to configure MFA',
        details: err,
        severity: ErrorSeverity.ERROR
      });
      setLoading(LoadingState.ERROR);
    }
  }, []);

  return (
    <div className="account-settings" role="main" aria-label="Account Settings">
      {/* Profile Section */}
      <section className="settings-section" aria-labelledby="profile-heading">
        <h2 id="profile-heading">Profile Settings</h2>
        <form onSubmit={handleProfileSubmit(handleProfileUpdate)}>
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              {...profileRegister('email')}
              aria-invalid={!!profileErrors.email}
              aria-describedby="email-error"
            />
            {profileErrors.email && (
              <span id="email-error" className="error-message">
                {profileErrors.email.message}
              </span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="displayName">Display Name</label>
            <input
              type="text"
              id="displayName"
              {...profileRegister('displayName')}
              aria-invalid={!!profileErrors.displayName}
              aria-describedby="displayName-error"
            />
            {profileErrors.displayName && (
              <span id="displayName-error" className="error-message">
                {profileErrors.displayName.message}
              </span>
            )}
          </div>

          <Button
            type="submit"
            variant="primary"
            size="medium"
            isLoading={loading === LoadingState.LOADING}
            disabled={loading === LoadingState.LOADING}
          >
            Save Profile Changes
          </Button>
        </form>
      </section>

      {/* Security Section */}
      <section className="settings-section" aria-labelledby="security-heading">
        <h2 id="security-heading">Security Settings</h2>
        
        {/* Password Change Form */}
        <form onSubmit={handlePasswordSubmit(handlePasswordChange)}>
          <div className="form-group">
            <label htmlFor="currentPassword">Current Password</label>
            <input
              type="password"
              id="currentPassword"
              {...passwordRegister('currentPassword')}
              aria-invalid={!!passwordErrors.currentPassword}
              aria-describedby="currentPassword-error"
            />
            {passwordErrors.currentPassword && (
              <span id="currentPassword-error" className="error-message">
                {passwordErrors.currentPassword.message}
              </span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="newPassword">New Password</label>
            <input
              type="password"
              id="newPassword"
              {...passwordRegister('newPassword')}
              aria-invalid={!!passwordErrors.newPassword}
              aria-describedby="newPassword-error"
            />
            {passwordErrors.newPassword && (
              <span id="newPassword-error" className="error-message">
                {passwordErrors.newPassword.message}
              </span>
            )}
          </div>

          <Button
            type="submit"
            variant="primary"
            size="medium"
            isLoading={loading === LoadingState.LOADING}
            disabled={loading === LoadingState.LOADING}
          >
            Change Password
          </Button>
        </form>

        {/* MFA Configuration */}
        <div className="mfa-section">
          <h3>Two-Factor Authentication</h3>
          <div className="mfa-toggle">
            <label htmlFor="mfa-toggle">Enable 2FA</label>
            <input
              type="checkbox"
              id="mfa-toggle"
              checked={mfaEnabled}
              onChange={(e) => handleMfaToggle(e.target.checked)}
              aria-describedby="mfa-description"
            />
            <p id="mfa-description" className="helper-text">
              Enhance your account security with two-factor authentication
            </p>
          </div>
        </div>
      </section>

      {/* Notification Preferences */}
      <section className="settings-section" aria-labelledby="notifications-heading">
        <h2 id="notifications-heading">Notification Preferences</h2>
        <div className="notification-options">
          {Object.entries(notifications).map(([key, value]) => (
            <div key={key} className="notification-option">
              <label htmlFor={`notification-${key}`}>{key.charAt(0).toUpperCase() + key.slice(1)} Notifications</label>
              <input
                type="checkbox"
                id={`notification-${key}`}
                checked={value}
                onChange={(e) => setNotifications(prev => ({
                  ...prev,
                  [key]: e.target.checked
                }))}
              />
            </div>
          ))}
        </div>
      </section>

      {/* Error Display */}
      {error && (
        <div 
          className="error-container" 
          role="alert" 
          aria-live="polite"
        >
          <p className="error-message">{error.message}</p>
        </div>
      )}
    </div>
  );
};

export default Account;