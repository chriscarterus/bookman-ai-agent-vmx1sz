import React, { useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom'; // ^18.2.0
import classNames from 'classnames'; // ^2.3.2
import { AnimatePresence, motion } from 'framer-motion'; // ^10.0.0
import { BaseComponentProps, ComponentSize } from '../../types/common.types';
import { theme } from '../../config/theme.config';
import useDarkMode from '../../hooks/useDarkMode';

// Animation variants for modal transitions
const ANIMATION_VARIANTS = {
  initial: {
    opacity: 0,
    scale: 0.95,
    y: 20,
  },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: 'spring',
      damping: 25,
      stiffness: 500,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: 20,
    transition: {
      duration: 0.2,
    },
  },
};

// Modal size configurations
const MODAL_SIZES = {
  [ComponentSize.SMALL]: {
    mobile: '90vw',
    tablet: '400px',
    desktop: '400px',
  },
  [ComponentSize.MEDIUM]: {
    mobile: '95vw',
    tablet: '600px',
    desktop: '600px',
  },
  [ComponentSize.LARGE]: {
    mobile: '100vw',
    tablet: '90vw',
    desktop: '800px',
  },
};

interface ModalProps extends BaseComponentProps {
  isOpen: boolean;
  onClose: () => void;
  size?: ComponentSize;
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
  title?: string;
  animationConfig?: typeof ANIMATION_VARIANTS;
  disableFocusTrap?: boolean;
  overlayClassName?: string;
  contentClassName?: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  size = ComponentSize.MEDIUM,
  closeOnOverlayClick = true,
  closeOnEscape = true,
  title,
  children,
  className,
  animationConfig = ANIMATION_VARIANTS,
  disableFocusTrap = false,
  overlayClassName,
  contentClassName,
  ariaLabel,
  ariaDescribedby,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [isDarkMode] = useDarkMode();

  // Store previously focused element when modal opens
  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      return () => {
        previousFocusRef.current?.focus();
      };
    }
  }, [isOpen]);

  // Handle escape key press
  const handleEscapeKey = useCallback((event: KeyboardEvent) => {
    if (closeOnEscape && event.key === 'Escape') {
      onClose();
    }
  }, [closeOnEscape, onClose]);

  // Handle overlay click
  const handleOverlayClick = useCallback((event: React.MouseEvent | React.TouchEvent) => {
    if (closeOnOverlayClick && event.target === event.currentTarget) {
      event.preventDefault();
      onClose();
    }
  }, [closeOnOverlayClick, onClose]);

  // Focus trap implementation
  useEffect(() => {
    if (!disableFocusTrap && isOpen && modalRef.current) {
      const focusableElements = modalRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      
      const firstElement = focusableElements[0] as HTMLElement;
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

      const handleTabKey = (event: KeyboardEvent) => {
        if (event.key === 'Tab') {
          if (event.shiftKey) {
            if (document.activeElement === firstElement) {
              event.preventDefault();
              lastElement?.focus();
            }
          } else {
            if (document.activeElement === lastElement) {
              event.preventDefault();
              firstElement?.focus();
            }
          }
        }
      };

      document.addEventListener('keydown', handleTabKey);
      firstElement?.focus();

      return () => {
        document.removeEventListener('keydown', handleTabKey);
      };
    }
  }, [isOpen, disableFocusTrap]);

  // Add escape key listener
  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleEscapeKey);
      return () => {
        document.removeEventListener('keydown', handleEscapeKey);
      };
    }
  }, [isOpen, handleEscapeKey]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isOpen]);

  // Modal styles based on theme and size
  const modalStyles = {
    overlay: {
      backgroundColor: isDarkMode 
        ? 'rgba(0, 0, 0, 0.75)' 
        : 'rgba(0, 0, 0, 0.5)',
      backdropFilter: 'blur(4px)',
    },
    content: {
      width: MODAL_SIZES[size].mobile,
      [`@media (min-width: ${theme.breakpoints.values.sm}px)`]: {
        width: MODAL_SIZES[size].tablet,
      },
      [`@media (min-width: ${theme.breakpoints.values.md}px)`]: {
        width: MODAL_SIZES[size].desktop,
      },
      backgroundColor: isDarkMode 
        ? theme.palette.background.paper 
        : theme.palette.background.default,
      boxShadow: theme.shadows[4],
    },
  };

  return createPortal(
    <AnimatePresence mode="wait">
      {isOpen && (
        <motion.div
          className={classNames(
            'fixed inset-0 z-50 flex items-center justify-center p-4',
            overlayClassName
          )}
          style={modalStyles.overlay}
          onClick={handleOverlayClick}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            ref={modalRef}
            className={classNames(
              'relative max-h-[90vh] overflow-auto rounded-lg',
              contentClassName
            )}
            style={modalStyles.content}
            variants={animationConfig}
            initial="initial"
            animate="animate"
            exit="exit"
            role="dialog"
            aria-modal="true"
            aria-label={ariaLabel || title}
            aria-describedby={ariaDescribedby}
          >
            {title && (
              <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
                <h2 className="text-xl font-semibold">{title}</h2>
              </div>
            )}
            <div className={classNames('p-6', className)}>
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default Modal;