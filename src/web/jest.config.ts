import type { Config } from '@jest/types';

/**
 * Comprehensive Jest configuration for the Bookman AI React frontend application.
 * Version: Jest 29.5.0
 * 
 * Features:
 * - TypeScript support with ts-jest preset
 * - JSDOM test environment for React components
 * - Comprehensive module resolution and path mapping
 * - Strict coverage thresholds
 * - Performance optimizations
 * - Enhanced security settings
 */
const config: Config.InitialOptions = {
  // Use ts-jest preset for TypeScript support
  preset: 'ts-jest',

  // Use jsdom environment for React component testing
  testEnvironment: 'jsdom',

  // Define root directories for tests and source files
  roots: [
    '<rootDir>/src',
    '<rootDir>/tests'
  ],

  // Module name mapping for path aliases and asset mocking
  moduleNameMapper: {
    // Path aliases matching tsconfig paths
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@components/(.*)$': '<rootDir>/src/components/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',

    // Asset mocks
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|svg|webp)$': '<rootDir>/tests/__mocks__/fileMock.ts'
  },

  // Setup files to run before tests
  setupFilesAfterEnv: [
    '@testing-library/jest-dom',
    '<rootDir>/tests/setupTests.ts'
  ],

  // Test matching patterns
  testMatch: [
    '**/__tests__/**/*.+(ts|tsx|js)',
    '**/?(*.)+(spec|test).+(ts|tsx|js)',
    '!**/__mocks__/**'
  ],

  // TypeScript transformation configuration
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.json'
      }
    ]
  },

  // Supported file extensions
  moduleFileExtensions: [
    'ts',
    'tsx',
    'js',
    'jsx',
    'json',
    'node'
  ],

  // Coverage collection configuration
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/vite-env.d.ts',
    '!src/main.tsx',
    '!src/**/*.stories.{ts,tsx}',
    '!src/**/__mocks__/**',
    '!src/**/types/**'
  ],

  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },

  // Performance and debugging settings
  verbose: true,
  testTimeout: 10000,
  maxWorkers: '50%',
  
  // Security and cleanup settings
  errorOnDeprecated: true,
  clearMocks: true,
  restoreMocks: true,
  resetMocks: true,

  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/coverage/'
  ],
  watchPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/coverage/'
  ],

  // Cache configuration
  cacheDirectory: '<rootDir>/node_modules/.cache/jest'
};

export default config;