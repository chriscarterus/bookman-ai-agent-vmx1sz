import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BaseComponentProps } from '../../types/common.types';
import styles from './Toast.module.css';

// Constants
const DEFAULT_DURATION = 5000;
const ANIMATION_DURATION = 200;

// Types and Interfaces
export interface ToastItem {
  id: string;
  message: string | React.ReactNode;
  type: ToastType;
  duration: number;
  position: ToastPosition;
}

export type ToastType = 'success' | 'error' | 'warning' | 'info';
export type ToastPosition = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';

export interface ToastProps extends BaseComponentProps {
  message: string | React.ReactNode;
  type?: ToastType;
  duration?: number;
  position?: ToastPosition;
  onClose?: () => void;
  autoClose?: boolean;
  closeOnClick?: boolean;
  pauseOnHover?: boolean;
  draggable?: boolean;
  progressBar?: boolean;
  rtl?: boolean;
}

// Animation variants
const toastAnimationVariants = {
  initial: { opacity: 0, y: -20, scale: 0.9 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -20, scale: 0.9 },
  transition: { duration: 0.2, ease: 'easeOut' }
};

// Custom hook for managing toasts
export const useToast = () => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [isVisible, setIsVisible] = useState(false);

  const show = useCallback((props: Omit<ToastItem, 'id'>) => {
    const newToast = {
      id: Math.random().toString(36).substr(2, 9),
      ...props
    };
    setToasts(prev => [...prev, newToast]);
    setIsVisible(true);
  }, []);

  const hide = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
    if (toasts.length <= 1) {
      setIsVisible(false);
    }
  }, [toasts.length]);

  const clearAll = useCallback(() => {
    setToasts([]);
    setIsVisible(false);
  }, []);

  return { show, hide, clearAll, toasts, isVisible };
};

// Toast Component
export const Toast: React.FC<ToastProps> = ({
  message,
  type = 'info',
  duration = DEFAULT_DURATION,
  position = 'top-right',
  onClose,
  autoClose = true,
  closeOnClick = true,
  pauseOnHover = true,
  draggable = true,
  progressBar = true,
  rtl = false,
  className,
  style,
  dataTestId
}) => {
  const [progress, setProgress] = useState(100);
  const progressInterval = useRef<NodeJS.Timeout>();
  const pausedRef = useRef<boolean>(false);

  useEffect(() => {
    if (autoClose && !pausedRef.current) {
      const startTime = Date.now();
      const endTime = startTime + duration;

      progressInterval.current = setInterval(() => {
        const now = Date.now();
        const remaining = endTime - now;
        const progressPercent = (remaining / duration) * 100;

        if (progressPercent <= 0) {
          clearInterval(progressInterval.current);
          onClose?.();
        } else {
          setProgress(progressPercent);
        }
      }, 10);

      return () => clearInterval(progressInterval.current);
    }
  }, [autoClose, duration, onClose]);

  const handleMouseEnter = () => {
    if (pauseOnHover) {
      pausedRef.current = true;
      clearInterval(progressInterval.current);
    }
  };

  const handleMouseLeave = () => {
    if (pauseOnHover) {
      pausedRef.current = false;
      // Restart progress
      const remainingTime = (progress / 100) * duration;
      if (autoClose) {
        const startTime = Date.now();
        const endTime = startTime + remainingTime;

        progressInterval.current = setInterval(() => {
          const now = Date.now();
          const remaining = endTime - now;
          const progressPercent = (remaining / remainingTime) * 100;

          if (progressPercent <= 0) {
            clearInterval(progressInterval.current);
            onClose?.();
          } else {
            setProgress(progressPercent);
          }
        }, 10);
      }
    }
  };

  const handleClick = () => {
    if (closeOnClick) {
      onClose?.();
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        className={`${styles.toast} ${styles[type]} ${styles[position]} ${rtl ? styles.rtl : ''} ${className || ''}`}
        style={style}
        data-testid={dataTestId}
        variants={toastAnimationVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={toastAnimationVariants.transition}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        drag={draggable ? 'x' : false}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.2}
        role="alert"
        aria-live="polite"
      >
        <div className={styles.content}>
          <div className={styles.icon}>
            {type === 'success' && <CheckIcon />}
            {type === 'error' && <ErrorIcon />}
            {type === 'warning' && <WarningIcon />}
            {type === 'info' && <InfoIcon />}
          </div>
          <div className={styles.message}>{message}</div>
          <button
            className={styles.closeButton}
            onClick={(e) => {
              e.stopPropagation();
              onClose?.();
            }}
            aria-label="Close notification"
          >
            <CloseIcon />
          </button>
        </div>
        {progressBar && autoClose && (
          <div 
            className={styles.progressBar}
            style={{ width: `${progress}%` }}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
            aria-label={`Notification will close in ${Math.ceil((progress / 100) * duration / 1000)} seconds`}
          />
        )}
      </motion.div>
    </AnimatePresence>
  );
};

// Icon Components
const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
  </svg>
);

const ErrorIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" />
  </svg>
);

const WarningIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
    <path d="M12 5.99L19.53 19H4.47L12 5.99M12 2L1 21h22L12 2zm1 14h-2v2h2v-2zm0-6h-2v4h2v-4z" />
  </svg>
);

const InfoIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
  </svg>
);

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" />
  </svg>
);

export default Toast;