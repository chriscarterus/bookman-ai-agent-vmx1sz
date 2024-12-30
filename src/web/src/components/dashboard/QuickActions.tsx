/**
 * @fileoverview QuickActions component providing quick access buttons for common user actions
 * in the Bookman AI platform dashboard with enhanced accessibility and analytics.
 * @version 1.0.0
 */

import React, { useCallback, useState, useEffect } from 'react'; // ^18.2.0
import { useNavigate } from 'react-router-dom'; // ^6.14.0
import Button from '../common/Button';
import Card from '../common/Card';
import { usePortfolio } from '../../hooks/usePortfolio';
import { ButtonVariant, ComponentSize } from '../../types/common.types';

/**
 * Props interface for QuickActions component
 */
interface QuickActionsProps {
  className?: string;
  style?: React.CSSProperties;
  onActionComplete?: () => void;
  onError?: (error: Error) => void;
  throttleDelay?: number;
}

/**
 * QuickActions component providing rapid access to key platform features
 */
const QuickActions: React.FC<QuickActionsProps> = React.memo(({
  className,
  style,
  onActionComplete,
  onError,
  throttleDelay = 300
}) => {
  // Hooks
  const navigate = useNavigate();
  const { addAsset, isLoading, error } = usePortfolio('default');
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  // Error handling effect
  useEffect(() => {
    if (error && onError) {
      onError(error);
    }
  }, [error, onError]);

  /**
   * Throttled action handler to prevent rapid clicking
   */
  const handleThrottledAction = useCallback((
    action: () => Promise<void>,
    actionId: string
  ) => {
    if (actionInProgress) return;

    setActionInProgress(actionId);
    action().finally(() => {
      setTimeout(() => {
        setActionInProgress(null);
        onActionComplete?.();
      }, throttleDelay);
    });
  }, [actionInProgress, throttleDelay, onActionComplete]);

  /**
   * Navigate to add asset page with analytics tracking
   */
  const handleAddAsset = useCallback(async () => {
    try {
      await handleThrottledAction(async () => {
        navigate('/portfolio/add-asset', { 
          state: { source: 'quick_actions' } 
        });
      }, 'add_asset');
    } catch (err) {
      onError?.(err as Error);
    }
  }, [navigate, handleThrottledAction, onError]);

  /**
   * Navigate to create alert page with analytics tracking
   */
  const handleCreateAlert = useCallback(async () => {
    try {
      await handleThrottledAction(async () => {
        navigate('/alerts/create', { 
          state: { source: 'quick_actions' } 
        });
      }, 'create_alert');
    } catch (err) {
      onError?.(err as Error);
    }
  }, [navigate, handleThrottledAction, onError]);

  /**
   * Navigate to learning modules with analytics tracking
   */
  const handleStartLearning = useCallback(async () => {
    try {
      await handleThrottledAction(async () => {
        navigate('/learning/modules', { 
          state: { source: 'quick_actions' } 
        });
      }, 'start_learning');
    } catch (err) {
      onError?.(err as Error);
    }
  }, [navigate, handleThrottledAction, onError]);

  return (
    <Card
      className={`quick-actions ${className || ''}`}
      style={style}
      variant="default"
      padding="large"
      elevation={1}
      data-testid="quick-actions"
      aria-label="Quick actions menu"
    >
      <div className="quick-actions__grid">
        <Button
          variant={ButtonVariant.PRIMARY}
          size={ComponentSize.LARGE}
          onClick={handleAddAsset}
          loading={actionInProgress === 'add_asset'}
          disabled={isLoading}
          fullWidth
          className="quick-actions__button"
          data-testid="quick-actions-add-asset"
          aria-label="Add new asset to portfolio"
        >
          Add Asset
        </Button>

        <Button
          variant={ButtonVariant.SECONDARY}
          size={ComponentSize.LARGE}
          onClick={handleCreateAlert}
          loading={actionInProgress === 'create_alert'}
          disabled={isLoading}
          fullWidth
          className="quick-actions__button"
          data-testid="quick-actions-create-alert"
          aria-label="Create new price alert"
        >
          Create Alert
        </Button>

        <Button
          variant={ButtonVariant.OUTLINE}
          size={ComponentSize.LARGE}
          onClick={handleStartLearning}
          loading={actionInProgress === 'start_learning'}
          disabled={isLoading}
          fullWidth
          className="quick-actions__button"
          data-testid="quick-actions-start-learning"
          aria-label="Start learning modules"
        >
          Start Learning
        </Button>
      </div>
    </Card>
  );
});

// Display name for debugging
QuickActions.displayName = 'QuickActions';

export default QuickActions;

/**
 * CSS Module styles (quick-actions.module.css):
 * 
 * .quick-actions {
 *   width: 100%;
 *   margin-bottom: 24px;
 * }
 * 
 * .quick-actions__grid {
 *   display: grid;
 *   gap: 16px;
 *   grid-template-columns: repeat(1, 1fr);
 * }
 * 
 * .quick-actions__button {
 *   min-height: 48px;
 *   transition: transform 200ms ease-in-out;
 * }
 * 
 * .quick-actions__button:hover:not(:disabled) {
 *   transform: translateY(-2px);
 * }
 * 
 * @media (min-width: 768px) {
 *   .quick-actions__grid {
 *     grid-template-columns: repeat(2, 1fr);
 *   }
 * }
 * 
 * @media (min-width: 1024px) {
 *   .quick-actions__grid {
 *     grid-template-columns: repeat(3, 1fr);
 *   }
 * }
 */