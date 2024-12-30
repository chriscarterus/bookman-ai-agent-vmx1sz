/**
 * @fileoverview Centralized route path constants for the Bookman AI platform frontend.
 * Defines all public and protected route paths used across the application with
 * TypeScript type safety and comprehensive route organization.
 * @version 1.0.0
 */

/**
 * Type definitions for route path structures to ensure type safety
 */
type RouteParams = {
  id?: string;
  token?: string;
  address?: string;
};

type PortfolioRoutes = {
  ROOT: string;
  OVERVIEW: string;
  TRANSACTIONS: string;
  ASSETS: string;
  ASSET_DETAILS: string;
  PERFORMANCE: string;
};

type EducationRoutes = {
  ROOT: string;
  COURSES: string;
  COURSE: string;
  MODULE: string;
  QUIZ: string;
  PROGRESS: string;
  CERTIFICATES: string;
};

type MarketRoutes = {
  ROOT: string;
  OVERVIEW: string;
  COIN_ANALYSIS: string;
  WATCHLIST: string;
  ALERTS: string;
  TRENDS: string;
  PREDICTIONS: string;
};

type SecurityRoutes = {
  ROOT: string;
  ALERTS: string;
  AUDIT: string;
  REPORTS: string;
  SETTINGS: string;
  SCAN: string;
};

type CommunityRoutes = {
  ROOT: string;
  FORUM: string;
  POST: string;
  MEMBERS: string;
  PROFILE: string;
  MESSAGES: string;
  EVENTS: string;
};

type SettingsRoutes = {
  ROOT: string;
  ACCOUNT: string;
  PREFERENCES: string;
  SECURITY: string;
  NOTIFICATIONS: string;
  API_KEYS: string;
  CONNECTED_ACCOUNTS: string;
};

type PublicRoutes = {
  HOME: string;
  LOGIN: string;
  REGISTER: string;
  RESET_PASSWORD: string;
  VERIFY_EMAIL: string;
  FORGOT_PASSWORD: string;
};

type PrivateRoutes = {
  DASHBOARD: string;
  PORTFOLIO: PortfolioRoutes;
  EDUCATION: EducationRoutes;
  MARKET: MarketRoutes;
  SECURITY: SecurityRoutes;
  COMMUNITY: CommunityRoutes;
  SETTINGS: SettingsRoutes;
};

/**
 * Route constants object containing all application routes
 * Organized into PUBLIC and PRIVATE sections for clear access control
 */
export const ROUTES = {
  PUBLIC: {
    HOME: '/',
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    RESET_PASSWORD: '/auth/reset-password',
    VERIFY_EMAIL: '/auth/verify-email/:token',
    FORGOT_PASSWORD: '/auth/forgot-password'
  } as const satisfies PublicRoutes,

  PRIVATE: {
    DASHBOARD: '/dashboard',
    
    PORTFOLIO: {
      ROOT: '/portfolio',
      OVERVIEW: '/portfolio/overview',
      TRANSACTIONS: '/portfolio/transactions',
      ASSETS: '/portfolio/assets',
      ASSET_DETAILS: '/portfolio/asset/:id',
      PERFORMANCE: '/portfolio/performance'
    } as const satisfies PortfolioRoutes,

    EDUCATION: {
      ROOT: '/education',
      COURSES: '/education/courses',
      COURSE: '/education/course/:id',
      MODULE: '/education/module/:id',
      QUIZ: '/education/quiz/:id',
      PROGRESS: '/education/progress',
      CERTIFICATES: '/education/certificates'
    } as const satisfies EducationRoutes,

    MARKET: {
      ROOT: '/market',
      OVERVIEW: '/market/overview',
      COIN_ANALYSIS: '/market/coin/:id',
      WATCHLIST: '/market/watchlist',
      ALERTS: '/market/alerts',
      TRENDS: '/market/trends',
      PREDICTIONS: '/market/predictions'
    } as const satisfies MarketRoutes,

    SECURITY: {
      ROOT: '/security',
      ALERTS: '/security/alerts',
      AUDIT: '/security/audit',
      REPORTS: '/security/reports',
      SETTINGS: '/security/settings',
      SCAN: '/security/scan/:address'
    } as const satisfies SecurityRoutes,

    COMMUNITY: {
      ROOT: '/community',
      FORUM: '/community/forum',
      POST: '/community/post/:id',
      MEMBERS: '/community/members',
      PROFILE: '/community/profile/:id',
      MESSAGES: '/community/messages',
      EVENTS: '/community/events'
    } as const satisfies CommunityRoutes,

    SETTINGS: {
      ROOT: '/settings',
      ACCOUNT: '/settings/account',
      PREFERENCES: '/settings/preferences',
      SECURITY: '/settings/security',
      NOTIFICATIONS: '/settings/notifications',
      API_KEYS: '/settings/api-keys',
      CONNECTED_ACCOUNTS: '/settings/connected-accounts'
    } as const satisfies SettingsRoutes
  } as const satisfies PrivateRoutes
} as const;

/**
 * Helper type for extracting route parameters from path patterns
 */
export type ExtractRouteParams<T extends string> = string extends T
  ? RouteParams
  : T extends `${infer _Start}:${infer Param}/${infer Rest}`
  ? { [K in Param | keyof ExtractRouteParams<Rest>]: string }
  : T extends `${infer _Start}:${infer Param}`
  ? { [K in Param]: string }
  : {};

/**
 * Type-safe route generation helper
 * @param path Route path pattern with parameters
 * @param params Route parameters to inject
 * @returns Generated route path with injected parameters
 */
export const generatePath = <T extends string>(
  path: T,
  params: ExtractRouteParams<T>
): string => {
  return Object.entries(params).reduce(
    (path, [key, value]) => path.replace(`:${key}`, value),
    path
  );
};