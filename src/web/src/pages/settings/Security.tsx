/**
 * Enhanced Security Settings Page Component
 * @version 1.0.0
 * @description Provides comprehensive security management including 2FA, API keys,
 * real-time security monitoring, and detailed audit history with advanced threat detection
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { QRCode } from 'qrcode.react'; // ^3.1.0
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'; // ^2.7.0

// Internal imports
import { Button } from '../../components/common/Button';
import { useAuth } from '../../hooks/useAuth';
import { SecurityService } from '@security/service'; // ^1.0.0

// Types
import { ComponentSize } from '../../types/common.types';
import { ButtonVariant } from '../../components/common/Button';
import { ErrorSeverity } from '../../types/api.types';

// Constants
const SECURITY_SCORE_THRESHOLD = 80;
const AUDIT_HISTORY_LIMIT = 50;
const REFRESH_INTERVAL = 30000; // 30 seconds

interface SecurityScore {
  score: number;
  timestamp: string;
  factors: {
    mfa: number;
    passwordStrength: number;
    apiKeyUsage: number;
    recentActivity: number;
  };
}

interface AuditEvent {
  id: string;
  type: string;
  severity: ErrorSeverity;
  timestamp: string;
  details: Record<string, any>;
}

interface SecurityMetrics {
  totalAlerts: number;
  resolvedAlerts: number;
  securityScore: number;
  lastScan: string;
}

/**
 * Enhanced Security Settings Component
 */
const SecuritySettings: React.FC = React.memo(() => {
  // State management
  const [securityScore, setSecurityScore] = useState<SecurityScore | null>(null);
  const [auditHistory, setAuditHistory] = useState<AuditEvent[]>([]);
  const [metrics, setMetrics] = useState<SecurityMetrics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [mfaSetupStep, setMfaSetupStep] = useState<number>(0);
  const [mfaSecret, setMfaSecret] = useState<string>('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);

  // Hooks
  const { user, isAuthenticated, mfaStatus } = useAuth();

  // Memoized security service instance
  const securityService = useMemo(() => new SecurityService(), []);

  /**
   * Fetches security metrics and audit history
   */
  const fetchSecurityData = useCallback(async () => {
    try {
      const [scoreData, auditData, metricsData] = await Promise.all([
        securityService.getSecurityScore(),
        securityService.getAuditHistory(AUDIT_HISTORY_LIMIT),
        securityService.getSecurityMetrics()
      ]);

      setSecurityScore(scoreData);
      setAuditHistory(auditData);
      setMetrics(metricsData);
    } catch (error) {
      console.error('Failed to fetch security data:', error);
    } finally {
      setLoading(false);
    }
  }, [securityService]);

  /**
   * Handles 2FA setup process
   */
  const handle2FASetup = useCallback(async () => {
    try {
      setLoading(true);
      const { secret, qrCode, backupCodes } = await securityService.initiate2FA(user?.id);
      
      setMfaSecret(secret);
      setBackupCodes(backupCodes);
      setMfaSetupStep(1);
    } catch (error) {
      console.error('2FA setup failed:', error);
    } finally {
      setLoading(false);
    }
  }, [user, securityService]);

  /**
   * Verifies 2FA setup with provided code
   */
  const verify2FASetup = useCallback(async (code: string) => {
    try {
      setLoading(true);
      await securityService.verify2FA(user?.id, code);
      setMfaSetupStep(2);
      await fetchSecurityData(); // Refresh security metrics
    } catch (error) {
      console.error('2FA verification failed:', error);
    } finally {
      setLoading(false);
    }
  }, [user, securityService, fetchSecurityData]);

  /**
   * Handles API key management
   */
  const handleAPIKeyManagement = useCallback(async (action: 'create' | 'revoke', keyId?: string) => {
    try {
      setLoading(true);
      if (action === 'create') {
        await securityService.createAPIKey(user?.id);
      } else if (action === 'revoke' && keyId) {
        await securityService.revokeAPIKey(keyId);
      }
      await fetchSecurityData(); // Refresh security metrics
    } catch (error) {
      console.error('API key management failed:', error);
    } finally {
      setLoading(false);
    }
  }, [user, securityService, fetchSecurityData]);

  // Initialize security data and setup refresh interval
  useEffect(() => {
    if (isAuthenticated) {
      fetchSecurityData();
      const interval = setInterval(fetchSecurityData, REFRESH_INTERVAL);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, fetchSecurityData]);

  // Render security score chart
  const renderSecurityScoreChart = useMemo(() => {
    if (!securityScore) return null;

    return (
      <div className="security-score-chart">
        <h3>Security Score Trend</h3>
        <LineChart width={600} height={300} data={[securityScore]}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="timestamp" />
          <YAxis domain={[0, 100]} />
          <Tooltip />
          <Line 
            type="monotone" 
            dataKey="score" 
            stroke="#2563EB" 
            strokeWidth={2} 
          />
        </LineChart>
      </div>
    );
  }, [securityScore]);

  // Render 2FA setup interface
  const render2FASetup = useMemo(() => {
    if (!mfaSecret) return null;

    return (
      <div className="mfa-setup">
        <h3>Two-Factor Authentication Setup</h3>
        {mfaSetupStep === 1 && (
          <>
            <QRCode value={mfaSecret} size={200} level="H" />
            <div className="backup-codes">
              <h4>Backup Codes</h4>
              <ul>
                {backupCodes.map((code, index) => (
                  <li key={index}>{code}</li>
                ))}
              </ul>
            </div>
          </>
        )}
      </div>
    );
  }, [mfaSecret, mfaSetupStep, backupCodes]);

  return (
    <div className="security-settings">
      <h2>Security Settings</h2>

      {/* Security Score Overview */}
      <section className="security-score">
        <h3>Security Score</h3>
        {metrics && (
          <div className={`score ${metrics.securityScore >= SECURITY_SCORE_THRESHOLD ? 'good' : 'warning'}`}>
            {metrics.securityScore}%
          </div>
        )}
        {renderSecurityScoreChart}
      </section>

      {/* Two-Factor Authentication */}
      <section className="two-factor-auth">
        <h3>Two-Factor Authentication</h3>
        {!mfaStatus ? (
          <Button
            variant={ButtonVariant.PRIMARY}
            size={ComponentSize.MEDIUM}
            onClick={handle2FASetup}
            loading={loading}
          >
            Enable 2FA
          </Button>
        ) : (
          <div className="mfa-status">
            <span className="status-badge enabled">Enabled</span>
            {render2FASetup}
          </div>
        )}
      </section>

      {/* API Key Management */}
      <section className="api-keys">
        <h3>API Keys</h3>
        <Button
          variant={ButtonVariant.OUTLINE}
          size={ComponentSize.MEDIUM}
          onClick={() => handleAPIKeyManagement('create')}
          loading={loading}
        >
          Generate New API Key
        </Button>
      </section>

      {/* Security Audit History */}
      <section className="audit-history">
        <h3>Security Audit History</h3>
        <div className="audit-list">
          {auditHistory.map((event) => (
            <div key={event.id} className={`audit-event ${event.severity.toLowerCase()}`}>
              <span className="timestamp">{new Date(event.timestamp).toLocaleString()}</span>
              <span className="type">{event.type}</span>
              <span className="severity">{event.severity}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
});

SecuritySettings.displayName = 'SecuritySettings';

export default SecuritySettings;