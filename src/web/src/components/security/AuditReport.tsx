/**
 * @fileoverview Smart contract audit report component with detailed findings display,
 * severity-based categorization, and performance optimizations.
 * @version 1.0.0
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react'; // ^18.2.0
import classNames from 'classnames'; // ^2.3.2
import { FixedSizeList as VirtualList } from 'react-window'; // ^1.8.9

// Internal imports
import { BaseComponentProps } from '../../types/common.types';
import Card from '../common/Card';
import { auditSmartContract } from '../../api/security';
import { LoadingState, ErrorSeverity } from '../../types/api.types';

// Types and interfaces
interface AuditFinding {
  id: string;
  type: string;
  severity: ErrorSeverity;
  location: string;
  description: string;
  recommendation: string;
}

interface AuditResult {
  vulnerabilities: AuditFinding[];
  gasAnalysis: {
    totalGasUsed: number;
    optimizationSuggestions: string[];
  };
  overallRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  auditId: string;
  timestamp: string;
}

interface AuditReportProps extends BaseComponentProps {
  contractId: string;
  contractAddress: string;
  onAuditComplete?: (report: AuditResult) => void;
  onError?: (error: Error) => void;
  severityThreshold?: ErrorSeverity;
  refreshInterval?: number;
  cacheTimeout?: number;
}

/**
 * AuditReport component displays smart contract security audit results
 * with severity-based categorization and performance optimizations
 */
const AuditReport: React.FC<AuditReportProps> = React.memo(({
  contractId,
  contractAddress,
  className,
  style,
  onAuditComplete,
  onError,
  severityThreshold = ErrorSeverity.INFO,
  refreshInterval = 0,
  cacheTimeout = 300000, // 5 minutes default cache
  ariaLabel = 'Smart Contract Audit Report',
}) => {
  // State management
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null);
  const [loadingState, setLoadingState] = useState<LoadingState>(LoadingState.IDLE);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Memoized severity levels for filtering
  const severityLevels = useMemo(() => ({
    [ErrorSeverity.CRITICAL]: 4,
    [ErrorSeverity.ERROR]: 3,
    [ErrorSeverity.WARNING]: 2,
    [ErrorSeverity.INFO]: 1,
  }), []);

  // Fetch audit results with caching
  const fetchAuditResults = useCallback(async () => {
    try {
      setLoadingState(LoadingState.LOADING);

      const response = await auditSmartContract({
        contractAddress,
        chainId: 1, // Default to Ethereum mainnet
        sourceCode: '', // Fetched automatically by backend
      });

      const result = response.data;
      setAuditResult(result);
      setLoadingState(LoadingState.SUCCESS);
      setLastUpdated(new Date());
      onAuditComplete?.(result);

    } catch (err) {
      setError(err as Error);
      setLoadingState(LoadingState.ERROR);
      onError?.(err as Error);
    }
  }, [contractAddress, onAuditComplete, onError]);

  // Filter findings based on severity threshold
  const filteredFindings = useMemo(() => {
    if (!auditResult?.vulnerabilities) return [];
    
    return auditResult.vulnerabilities.filter(finding => 
      severityLevels[finding.severity] >= severityLevels[severityThreshold]
    );
  }, [auditResult, severityThreshold, severityLevels]);

  // Group findings by severity
  const groupedFindings = useMemo(() => {
    return filteredFindings.reduce((acc, finding) => {
      if (!acc[finding.severity]) {
        acc[finding.severity] = [];
      }
      acc[finding.severity].push(finding);
      return acc;
    }, {} as Record<ErrorSeverity, AuditFinding[]>);
  }, [filteredFindings]);

  // Setup refresh interval
  useEffect(() => {
    if (refreshInterval > 0) {
      const intervalId = setInterval(fetchAuditResults, refreshInterval);
      return () => clearInterval(intervalId);
    }
  }, [refreshInterval, fetchAuditResults]);

  // Initial fetch
  useEffect(() => {
    fetchAuditResults();
  }, [fetchAuditResults]);

  // Render finding item for virtual list
  const FindingItem = useCallback(({ index, style }: { index: number, style: React.CSSProperties }) => {
    const finding = filteredFindings[index];
    return (
      <Card
        className={classNames(
          'audit-report__finding',
          `audit-report__severity-${finding.severity.toLowerCase()}`
        )}
        style={style}
        variant="outlined"
        padding="default"
        focusable
      >
        <h4>{finding.type}</h4>
        <p className="audit-report__finding-description">{finding.description}</p>
        <div className="audit-report__finding-location">Location: {finding.location}</div>
        <div className="audit-report__finding-recommendation">
          <strong>Recommendation:</strong> {finding.recommendation}
        </div>
      </Card>
    );
  }, [filteredFindings]);

  // Render loading state
  if (loadingState === LoadingState.LOADING) {
    return (
      <Card className={classNames('audit-report', 'audit-report--loading', className)} style={style}>
        <div className="audit-report__loader">Loading audit results...</div>
      </Card>
    );
  }

  // Render error state
  if (loadingState === LoadingState.ERROR) {
    return (
      <Card className={classNames('audit-report', 'audit-report--error', className)} style={style}>
        <div className="audit-report__error">
          <h3>Error Loading Audit Report</h3>
          <p>{error?.message}</p>
          <button onClick={fetchAuditResults}>Retry</button>
        </div>
      </Card>
    );
  }

  return (
    <div 
      className={classNames('audit-report', className)}
      style={style}
      role="region"
      aria-label={ariaLabel}
    >
      {/* Header Section */}
      <Card className="audit-report__header">
        <h2>Smart Contract Audit Report</h2>
        <div className="audit-report__meta">
          <span>Contract: {contractAddress}</span>
          <span>Last Updated: {lastUpdated.toLocaleString()}</span>
        </div>
        <div className={`audit-report__risk audit-report__risk--${auditResult?.overallRisk.toLowerCase()}`}>
          Overall Risk: {auditResult?.overallRisk}
        </div>
      </Card>

      {/* Findings Summary */}
      <Card className="audit-report__summary">
        <h3>Findings Summary</h3>
        {Object.entries(groupedFindings).map(([severity, findings]) => (
          <div key={severity} className="audit-report__summary-item">
            <span className={`audit-report__severity-badge audit-report__severity-${severity.toLowerCase()}`}>
              {severity}
            </span>
            <span className="audit-report__count">{findings.length}</span>
          </div>
        ))}
      </Card>

      {/* Virtualized Findings List */}
      <Card className="audit-report__findings">
        <h3>Detailed Findings</h3>
        <VirtualList
          height={400}
          width="100%"
          itemCount={filteredFindings.length}
          itemSize={150}
          overscanCount={2}
        >
          {FindingItem}
        </VirtualList>
      </Card>

      {/* Gas Analysis */}
      <Card className="audit-report__gas">
        <h3>Gas Analysis</h3>
        <div className="audit-report__gas-usage">
          Total Gas Used: {auditResult?.gasAnalysis.totalGasUsed.toLocaleString()}
        </div>
        <div className="audit-report__optimizations">
          <h4>Optimization Suggestions:</h4>
          <ul>
            {auditResult?.gasAnalysis.optimizationSuggestions.map((suggestion, index) => (
              <li key={index}>{suggestion}</li>
            ))}
          </ul>
        </div>
      </Card>
    </div>
  );
});

AuditReport.displayName = 'AuditReport';

export default AuditReport;