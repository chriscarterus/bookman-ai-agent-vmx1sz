/// <reference types="vite/client" />

/**
 * Type definitions for Vite environment variables
 * @version 4.3.0
 */
interface ImportMetaEnv {
  /** API endpoint URL for backend services */
  readonly VITE_API_URL: string;
  
  /** WebSocket endpoint URL for real-time updates */
  readonly VITE_WS_URL: string;
  
  /** Authentication provider domain */
  readonly VITE_AUTH_DOMAIN: string;
  
  /** OAuth2 client identifier */
  readonly VITE_AUTH_CLIENT_ID: string;
  
  /** Current deployment environment */
  readonly VITE_ENVIRONMENT: 'development' | 'staging' | 'production';
  
  /** Vite mode (development/production) */
  readonly MODE: string;
  
  /** Base URL for asset imports */
  readonly BASE_URL: string;
  
  /** Production mode flag */
  readonly PROD: boolean;
  
  /** Development mode flag */
  readonly DEV: boolean;
  
  /** Server-side rendering flag */
  readonly SSR: boolean;
}

/**
 * Augment the ImportMeta interface with env property
 */
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/**
 * Module declarations for static assets
 */
declare module '*.svg' {
  const url: string;
  export default url;
}

declare module '*.png' {
  const url: string;
  export default url;
}

declare module '*.jpg' {
  const url: string;
  export default url;
}

declare module '*.jpeg' {
  const url: string;
  export default url;
}

declare module '*.gif' {
  const url: string;
  export default url;
}

/**
 * Module declarations for style files
 * Enables typed CSS/SCSS modules
 */
declare module '*.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}

declare module '*.scss' {
  const classes: { readonly [key: string]: string };
  export default classes;
}