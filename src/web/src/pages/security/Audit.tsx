/**
 * @fileoverview Smart Contract Audit Page Component for Bookman AI Platform
 * @version 1.0.0
 * @description Provides comprehensive smart contract security auditing functionality
 * with real-time monitoring, accessibility features, and detailed analysis reporting.
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { debounce } from 'lodash';

// Internal imports
import DashboardLayout from '../../layouts/DashboardLayout';
import AuditReport from '../../components/security/AuditReport';
import { auditSmartContract } from '../../api/security';
import { ErrorSeverity, LoadingState } from '../../types/api.types';

// Interface for audit page state management
interface AuditPageState {
  contractAddress: string;
  contractCode: string;
  isLoading: boolean;
  error: string | null;
  auditProgress: number;
  validationErrors: Record<string, string>;
  auditResult: AuditResult | null;
}

// Interface for audit result
interface AuditResult {
  vulnerabilities: Array<{
    id: string;
    type: string;
    severity: ErrorSeverity;
    location: string;
    description: string;
    recommendation: string;
  }>;
  gasAnalysis: {
    totalGasUsed: number;
    optimizationSuggestions: string[];
  };
  overallRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  auditId: string;
  timestamp: string;
}

/**
 * Smart Contract Audit Page Component
 * Provides interface for submitting and reviewing smart contract security audits
 */
const AuditPage: React.FC = React.memo(() => {
  const navigate = useNavigate();
  
  // State management
  const [state, setState] = useState<AuditPageState>({
    contractAddress: '',
    contractCode: '',
    isLoading: false,
    error: null,
    auditProgress: 0,
    validationErrors: {},
    auditResult: null
  });

  // Memoized validation function
  const validateContract = useMemo(() => 
    debounce((address: string) => {
      const errors: Record<string, string> = {};
      
      if (!address) {
        errors.address = 'Contract address is required';
      } else if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
        errors.address = 'Invalid Ethereum contract address';
      }

      setState(prev => ({
        ...prev,
        validationErrors: errors
      }));
    }, 300),
    []
  );

  // Handle contract address change
  const handleAddressChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const address = event.target.value;
    setState(prev => ({
      ...prev,
      contractAddress: address,
      error: null
    }));
    validateContract(address);
  }, [validateContract]);

  // Handle form submission
  const handleSubmit = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();

    if (Object.keys(state.validationErrors).length > 0) {
      return;
    }

    setState(prev => ({
      ...prev,
      isLoading: true,
      error: null,
      auditProgress: 0
    }));

    try {
      const response = await auditSmartContract({
        contractAddress: state.contractAddress,
        chainId: 1, // Ethereum mainnet
        sourceCode: state.contractCode
      });

      setState(prev => ({
        ...prev,
        isLoading: false,
        auditResult: response.data,
        auditProgress: 100
      }));

    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Audit failed',
        auditProgress: 0
      }));
    }
  }, [state.contractAddress, state.contractCode, state.validationErrors]);

  // Handle audit completion
  const handleAuditComplete = useCallback((result: AuditResult) => {
    // Store audit result in session storage for persistence
    sessionStorage.setItem('lastAuditResult', JSON.stringify(result));
    
    // Update state with results
    setState(prev => ({
      ...prev,
      auditResult: result,
      isLoading: false,
      auditProgress: 100
    }));
  }, []);

  // Handle audit error
  const handleAuditError = useCallback((error: Error) => {
    setState(prev => ({
      ...prev,
      error: error.message,
      isLoading: false,
      auditProgress: 0
    }));
  }, []);

  // Restore previous audit result if available
  useEffect(() => {
    const savedResult = sessionStorage.getItem('lastAuditResult');
    if (savedResult) {
      try {
        const parsedResult = JSON.parse(savedResult);
        setState(prev => ({
          ...prev,
          auditResult: parsedResult
        }));
      } catch (error) {
        console.error('Failed to restore previous audit result:', error);
      }
    }
  }, []);

  return (
    <DashboardLayout>
      <div className="audit-page" role="main" aria-label="Smart Contract Audit">
        <div className="audit-page__header">
          <h1>Smart Contract Security Audit</h1>
          <p className="audit-page__description">
            Analyze your smart contract for security vulnerabilities, gas optimization,
            and best practice violations.
          </p>
        </div>

        <form 
          className="audit-page__form"
          onSubmit={handleSubmit}
          aria-label="Contract audit form"
        >
          <div className="audit-page__input-group">
            <label htmlFor="contractAddress">Contract Address</label>
            <input
              id="contractAddress"
              type="text"
              value={state.contractAddress}
              onChange={handleAddressChange}
              placeholder="0x..."
              aria-invalid={!!state.validationErrors.address}
              aria-describedby="addressError"
              disabled={state.isLoading}
            />
            {state.validationErrors.address && (
              <span id="addressError" className="audit-page__error">
                {state.validationErrors.address}
              </span>
            )}
          </div>

          <button
            type="submit"
            className="audit-page__submit"
            disabled={state.isLoading || Object.keys(state.validationErrors).length > 0}
            aria-busy={state.isLoading}
          >
            {state.isLoading ? 'Analyzing...' : 'Start Audit'}
          </button>
        </form>

        {state.error && (
          <div 
            className="audit-page__error-message"
            role="alert"
            aria-live="polite"
          >
            {state.error}
          </div>
        )}

        {state.isLoading && (
          <div 
            className="audit-page__progress"
            role="progressbar"
            aria-valuenow={state.auditProgress}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            Audit in progress: {state.auditProgress}%
          </div>
        )}

        {state.auditResult && (
          <AuditReport
            contractId={state.auditResult.auditId}
            contractAddress={state.contractAddress}
            onAuditComplete={handleAuditComplete}
            onError={handleAuditError}
            severityThreshold={ErrorSeverity.INFO}
            refreshInterval={0}
            className="audit-page__report"
          />
        )}
      </div>
    </DashboardLayout>
  );
});

// Display name for debugging
AuditPage.displayName = 'AuditPage';

export default AuditPage;