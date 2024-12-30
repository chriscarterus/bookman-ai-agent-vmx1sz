/**
 * @fileoverview A reusable tabbed interface component that implements WCAG 2.1 Level AA
 * accessibility standards with support for responsive layouts, keyboard navigation,
 * and theme customization.
 * @version 1.0.0
 */

import React, { useState, useCallback, useEffect, useRef } from 'react'; // ^18.2.0
import classNames from 'classnames'; // ^2.3.2
import { BaseComponentProps } from '../../types/common.types';
import styles from './Tabs.module.css';

// Constants for keyboard navigation
const KEYS = {
  ARROW_LEFT: 'ArrowLeft',
  ARROW_RIGHT: 'ArrowRight',
  ARROW_UP: 'ArrowUp',
  ARROW_DOWN: 'ArrowDown',
  HOME: 'Home',
  END: 'End',
  ENTER: 'Enter',
  SPACE: ' ',
};

/**
 * Props interface for individual tab items
 */
export interface TabProps extends BaseComponentProps {
  label: string;
  value: string;
  disabled?: boolean;
  icon?: React.ReactNode;
  loading?: boolean;
  tabIndex?: number;
  onKeyDown?: (event: React.KeyboardEvent) => void;
}

/**
 * Props interface for the Tabs container component
 */
export interface TabsProps extends BaseComponentProps {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  tabs: TabProps[];
  orientation?: 'horizontal' | 'vertical';
  variant?: 'default' | 'contained' | 'outlined';
  size?: 'small' | 'medium' | 'large';
  scrollable?: boolean;
  onKeyDown?: (event: React.KeyboardEvent) => void;
  tabIndex?: number;
}

/**
 * Individual Tab component with accessibility support
 */
const Tab: React.FC<TabProps> = ({
  label,
  value,
  disabled = false,
  icon,
  loading = false,
  className,
  tabIndex,
  onKeyDown,
  children,
  ...props
}) => {
  const tabRef = useRef<HTMLButtonElement>(null);

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    onKeyDown?.(event);
  }, [onKeyDown]);

  return (
    <button
      ref={tabRef}
      role="tab"
      aria-selected={props['aria-selected']}
      aria-controls={`tabpanel-${value}`}
      id={`tab-${value}`}
      tabIndex={tabIndex}
      disabled={disabled || loading}
      className={classNames(
        styles.tab,
        {
          [styles.tabDisabled]: disabled,
          [styles.tabLoading]: loading,
        },
        className
      )}
      onKeyDown={handleKeyDown}
      {...props}
    >
      {icon && <span className={styles.tabIcon}>{icon}</span>}
      <span className={styles.tabLabel}>{label}</span>
      {loading && (
        <span className={styles.loadingIndicator} aria-hidden="true" />
      )}
    </button>
  );
};

/**
 * Main Tabs container component
 */
export const Tabs: React.FC<TabsProps> = ({
  value: controlledValue,
  defaultValue,
  onChange,
  tabs,
  orientation = 'horizontal',
  variant = 'default',
  size = 'medium',
  scrollable = false,
  className,
  children,
  onKeyDown,
  tabIndex = 0,
  ...props
}) => {
  const [activeTab, setActiveTab] = useState<string>(
    controlledValue || defaultValue || tabs[0]?.value || ''
  );
  const tabListRef = useRef<HTMLDivElement>(null);
  const [focusedTabIndex, setFocusedTabIndex] = useState<number>(-1);

  // Update active tab when controlled value changes
  useEffect(() => {
    if (controlledValue !== undefined) {
      setActiveTab(controlledValue);
    }
  }, [controlledValue]);

  // Handle tab selection
  const handleTabSelect = useCallback((tabValue: string) => {
    if (controlledValue === undefined) {
      setActiveTab(tabValue);
    }
    onChange?.(tabValue);
  }, [controlledValue, onChange]);

  // Keyboard navigation handler
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    const tabCount = tabs.length;
    const currentIndex = tabs.findIndex(tab => tab.value === activeTab);
    let nextIndex = currentIndex;

    switch (event.key) {
      case KEYS.ARROW_RIGHT:
      case KEYS.ARROW_DOWN:
        event.preventDefault();
        nextIndex = (currentIndex + 1) % tabCount;
        break;
      case KEYS.ARROW_LEFT:
      case KEYS.ARROW_UP:
        event.preventDefault();
        nextIndex = (currentIndex - 1 + tabCount) % tabCount;
        break;
      case KEYS.HOME:
        event.preventDefault();
        nextIndex = 0;
        break;
      case KEYS.END:
        event.preventDefault();
        nextIndex = tabCount - 1;
        break;
      case KEYS.ENTER:
      case KEYS.SPACE:
        event.preventDefault();
        if (focusedTabIndex >= 0) {
          handleTabSelect(tabs[focusedTabIndex].value);
        }
        break;
    }

    // Skip disabled tabs
    while (tabs[nextIndex]?.disabled && nextIndex !== currentIndex) {
      nextIndex = (nextIndex + 1) % tabCount;
    }

    setFocusedTabIndex(nextIndex);
    onKeyDown?.(event);
  }, [activeTab, tabs, focusedTabIndex, handleTabSelect, onKeyDown]);

  // Set up intersection observer for scrollable tabs
  useEffect(() => {
    if (scrollable && tabListRef.current) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach(entry => {
            if (entry.target.parentElement) {
              entry.target.parentElement.classList.toggle(
                styles.scrollShadowStart,
                !entry.isIntersecting && entry.boundingClientRect.left < 0
              );
            }
          });
        },
        { root: tabListRef.current, threshold: 1 }
      );

      const firstTab = tabListRef.current.firstElementChild;
      if (firstTab) {
        observer.observe(firstTab);
      }

      return () => observer.disconnect();
    }
  }, [scrollable]);

  return (
    <div
      className={classNames(
        styles.container,
        styles[variant],
        styles[size],
        {
          [styles.vertical]: orientation === 'vertical',
          [styles.scrollable]: scrollable,
        },
        className
      )}
      {...props}
    >
      <div
        ref={tabListRef}
        role="tablist"
        aria-orientation={orientation}
        className={styles.tabList}
        onKeyDown={handleKeyDown}
      >
        {tabs.map((tab, index) => (
          <Tab
            key={tab.value}
            {...tab}
            aria-selected={activeTab === tab.value}
            tabIndex={focusedTabIndex === index ? tabIndex : -1}
            className={classNames({
              [styles.tabActive]: activeTab === tab.value,
            })}
            onClick={() => !tab.disabled && handleTabSelect(tab.value)}
          />
        ))}
      </div>
      <div className={styles.tabPanels}>
        {tabs.map(tab => (
          <div
            key={tab.value}
            role="tabpanel"
            id={`tabpanel-${tab.value}`}
            aria-labelledby={`tab-${tab.value}`}
            hidden={activeTab !== tab.value}
            className={styles.tabPanel}
          >
            {activeTab === tab.value && tab.children}
          </div>
        ))}
      </div>
    </div>
  );
};

// Compound component pattern support
Tabs.Tab = Tab;

export default Tabs;