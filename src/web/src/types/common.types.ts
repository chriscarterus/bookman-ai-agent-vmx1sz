/**
 * @fileoverview Core TypeScript type definitions and interfaces for common UI components,
 * theme configuration, and shared utilities across the Bookman AI platform frontend.
 * @version 1.0.0
 */

import { ReactNode } from 'react'; // ^18.2.0

// Global constants for responsive breakpoints
export const MOBILE_BREAKPOINT = 320;
export const TABLET_BREAKPOINT = 768;
export const DESKTOP_BREAKPOINT = 1024;
export const LARGE_DESKTOP_BREAKPOINT = 1440;

// Global constants for styling
export const BASE_SPACING_UNIT = 8;
export const DEFAULT_TRANSITION_DURATION = 200;
export const DEFAULT_THEME = 'light';

/**
 * Theme type definition for application-wide theming support
 */
export type Theme = 'light' | 'dark' | 'system';

/**
 * Enum for responsive breakpoints with additional large desktop size
 */
export enum Breakpoint {
  MOBILE = MOBILE_BREAKPOINT,
  TABLET = TABLET_BREAKPOINT,
  DESKTOP = DESKTOP_BREAKPOINT,
  LARGE_DESKTOP = LARGE_DESKTOP_BREAKPOINT
}

/**
 * Enum for component size variants
 */
export enum ComponentSize {
  SMALL = 'small',
  MEDIUM = 'medium',
  LARGE = 'large'
}

/**
 * Base interface for common component props including accessibility attributes
 */
export interface BaseComponentProps {
  className?: string;
  children?: ReactNode;
  id?: string;
  style?: React.CSSProperties;
  ariaLabel?: string;
  ariaDescribedBy?: string;
  dataTestId?: string;
}

/**
 * Typography configuration interface
 */
export interface TypographyConfig {
  fontFamily: {
    primary: string;
    secondary: string;
  };
  fontSize: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    xxl: number;
  };
  fontWeight: {
    regular: number;
    medium: number;
    bold: number;
  };
  lineHeight: {
    tight: number;
    normal: number;
    relaxed: number;
  };
}

/**
 * Color configuration interface
 */
export interface ColorConfig {
  primary: {
    main: string;
    light: string;
    dark: string;
    contrastText: string;
  };
  secondary: {
    main: string;
    light: string;
    dark: string;
    contrastText: string;
  };
  error: {
    main: string;
    light: string;
    dark: string;
    contrastText: string;
  };
  warning: {
    main: string;
    light: string;
    dark: string;
    contrastText: string;
  };
  success: {
    main: string;
    light: string;
    dark: string;
    contrastText: string;
  };
  info: {
    main: string;
    light: string;
    dark: string;
    contrastText: string;
  };
  grey: {
    50: string;
    100: string;
    200: string;
    300: string;
    400: string;
    500: string;
    600: string;
    700: string;
    800: string;
    900: string;
  };
  text: {
    primary: string;
    secondary: string;
    disabled: string;
  };
  background: {
    default: string;
    paper: string;
  };
}

/**
 * Spacing configuration interface
 */
export interface SpacingConfig {
  unit: number;
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  xxl: number;
}

/**
 * Shadow configuration interface
 */
export interface ShadowConfig {
  none: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
}

/**
 * Border radius configuration interface
 */
export interface BorderRadiusConfig {
  none: number;
  sm: number;
  md: number;
  lg: number;
  full: string;
}

/**
 * Transition configuration interface
 */
export interface TransitionConfig {
  duration: {
    shortest: number;
    short: number;
    standard: number;
    long: number;
  };
  easing: {
    easeInOut: string;
    easeOut: string;
    easeIn: string;
    sharp: string;
  };
}

/**
 * Comprehensive interface for theme configuration including all styling options
 */
export interface ThemeConfig {
  typography: TypographyConfig;
  colors: ColorConfig;
  spacing: SpacingConfig;
  shadows: ShadowConfig;
  borderRadius: BorderRadiusConfig;
  transitions: TransitionConfig;
}

/**
 * Layout configuration for responsive design
 */
export interface LayoutConfig {
  container: {
    maxWidth: {
      sm: number;
      md: number;
      lg: number;
      xl: number;
    };
    padding: {
      mobile: number;
      tablet: number;
      desktop: number;
    };
  };
  grid: {
    columns: number;
    gutter: {
      mobile: number;
      tablet: number;
      desktop: number;
    };
  };
}

/**
 * Z-index configuration for consistent layering
 */
export enum ZIndex {
  MODAL = 1000,
  POPOVER = 900,
  DRAWER = 800,
  DROPDOWN = 700,
  STICKY = 600,
  HEADER = 500,
  TOOLTIP = 400
}

/**
 * Animation configuration interface
 */
export interface AnimationConfig {
  duration: {
    shortest: number;
    shorter: number;
    short: number;
    standard: number;
    complex: number;
    enteringScreen: number;
    leavingScreen: number;
  };
  easing: {
    easeInOut: string;
    easeOut: string;
    easeIn: string;
    sharp: string;
  };
}

/**
 * Accessibility configuration interface
 */
export interface AccessibilityConfig {
  focusOutline: string;
  skipLinks: {
    height: number;
    padding: number;
    background: string;
  };
  contrast: {
    minimum: number;
    enhanced: number;
  };
}