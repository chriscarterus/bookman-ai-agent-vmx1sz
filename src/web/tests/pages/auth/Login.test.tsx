/**
 * @fileoverview Comprehensive test suite for Login component
 * @version 1.0.0
 * @description Tests authentication flow, security controls, and UI implementation
 */

import React from 'react';
import { render, fireEvent, waitFor, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import Login from '../../src/pages/auth/Login';
import { useAuth } from '../../src/hooks/useAuth';
import { validateEmail, validatePassword } from '../../src/utils/validation.utils';

// Mock dependencies
vi.mock('react-router-dom', () => ({
  useNavigate: vi.fn(),
}));

vi.mock('../../src/hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../src/utils/validation.utils', () => ({
  validateEmail: vi.fn(),
  validatePassword: vi.fn(),
}));

// Test constants
const TEST_EMAIL = 'test@example.com';
const TEST_PASSWORD = 'TestPassword123!';
const MOCK_API_ERROR = {
  code: 'AUTH_ERROR',
  message: 'Invalid credentials',
  details: {},
  severity: 'ERROR'
};

describe('Login Component', () => {
  // Setup variables
  const mockNavigate = vi.fn();
  const mockLogin = vi.fn();
  const mockValidateMfa = vi.fn();
  
  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Setup navigation mock
    (useNavigate as jest.Mock).mockReturnValue(mockNavigate);
    
    // Setup auth hook mock
    (useAuth as jest.Mock).mockReturnValue({
      login: mockLogin,
      validateMfa: mockValidateMfa,
      loading: false,
      error: null,
      mfaRequired: false
    });

    // Setup validation mocks
    (validateEmail as jest.Mock).mockReturnValue(true);
    (validatePassword as jest.Mock).mockReturnValue({ isValid: true, errors: [] });
  });

  it('renders login form correctly', () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    // Verify form elements
    expect(screen.getByRole('heading', { name: /welcome to bookman ai/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/remember me/i)).toBeInTheDocument();
    expect(screen.getByText(/forgot password/i)).toBeInTheDocument();
    expect(screen.getByText(/create account/i)).toBeInTheDocument();
  });

  it('handles form validation', async () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    const submitButton = screen.getByRole('button', { name: /sign in/i });
    const emailInput = screen.getByLabelText(/email address/i);
    const passwordInput = screen.getByLabelText(/password/i);

    // Test empty form submission
    fireEvent.click(submitButton);
    expect(await screen.findByText(/please enter a valid email address/i)).toBeInTheDocument();

    // Test invalid email
    (validateEmail as jest.Mock).mockReturnValue(false);
    await userEvent.type(emailInput, 'invalid-email');
    expect(await screen.findByText(/please enter a valid email address/i)).toBeInTheDocument();

    // Test invalid password
    (validatePassword as jest.Mock).mockReturnValue({ 
      isValid: false, 
      errors: ['Password must contain at least one uppercase letter'] 
    });
    await userEvent.type(passwordInput, 'weakpassword');
    expect(await screen.findByText(/password must contain at least one uppercase letter/i)).toBeInTheDocument();
  });

  it('handles successful login', async () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    // Setup successful validation
    (validateEmail as jest.Mock).mockReturnValue(true);
    (validatePassword as jest.Mock).mockReturnValue({ isValid: true, errors: [] });
    mockLogin.mockResolvedValue(undefined);

    // Fill and submit form
    await userEvent.type(screen.getByLabelText(/email address/i), TEST_EMAIL);
    await userEvent.type(screen.getByLabelText(/password/i), TEST_PASSWORD);
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    // Verify login attempt
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        rememberMe: false
      });
    });

    // Verify navigation
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });

  it('handles MFA flow', async () => {
    // Setup MFA requirement
    (useAuth as jest.Mock).mockReturnValue({
      login: mockLogin,
      validateMfa: mockValidateMfa,
      loading: false,
      error: null,
      mfaRequired: true
    });

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    // Verify MFA input is shown
    expect(screen.getByLabelText(/mfa code/i)).toBeInTheDocument();
    
    // Submit MFA code
    await userEvent.type(screen.getByLabelText(/mfa code/i), '123456');
    await userEvent.click(screen.getByRole('button', { name: /verify mfa/i }));

    // Verify MFA validation
    await waitFor(() => {
      expect(mockValidateMfa).toHaveBeenCalledWith('123456');
    });
  });

  it('handles API errors', async () => {
    // Setup error state
    (useAuth as jest.Mock).mockReturnValue({
      login: mockLogin,
      validateMfa: mockValidateMfa,
      loading: false,
      error: MOCK_API_ERROR,
      mfaRequired: false
    });

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    // Verify error message
    expect(screen.getByText(MOCK_API_ERROR.message)).toBeInTheDocument();
  });

  it('handles loading state', async () => {
    // Setup loading state
    (useAuth as jest.Mock).mockReturnValue({
      login: mockLogin,
      validateMfa: mockValidateMfa,
      loading: true,
      error: null,
      mfaRequired: false
    });

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    // Verify loading state
    const submitButton = screen.getByRole('button', { name: /sign in/i });
    expect(submitButton).toBeDisabled();
    expect(submitButton).toHaveAttribute('aria-busy', 'true');
  });

  it('handles remember me functionality', async () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    // Toggle remember me
    const rememberMeCheckbox = screen.getByLabelText(/remember me/i);
    await userEvent.click(rememberMeCheckbox);

    // Submit form
    await userEvent.type(screen.getByLabelText(/email address/i), TEST_EMAIL);
    await userEvent.type(screen.getByLabelText(/password/i), TEST_PASSWORD);
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    // Verify login called with remember me
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        rememberMe: true
      });
    });
  });

  it('handles account lockout', async () => {
    // Mock localStorage for attempt tracking
    const mockLocalStorage = {
      getItem: vi.fn().mockReturnValue('5'), // Max attempts reached
      setItem: vi.fn(),
    };
    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage
    });

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    // Verify lockout message
    expect(screen.getByText(/account temporarily locked/i)).toBeInTheDocument();
    
    // Verify form is disabled
    expect(screen.getByLabelText(/email address/i)).toBeDisabled();
    expect(screen.getByLabelText(/password/i)).toBeDisabled();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeDisabled();
  });
});