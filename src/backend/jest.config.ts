import type { JestConfigWithTsJest } from 'ts-jest';
import { pathsToModuleNameMapper } from 'ts-jest';
import { compilerOptions } from './tsconfig.json';

/**
 * Base Jest configuration for backend services
 * @version Jest 29.0.0
 * @version ts-jest 29.0.0
 */
const baseConfig: JestConfigWithTsJest = {
  // TypeScript configuration
  preset: 'ts-jest',
  testEnvironment: 'node',
  
  // Test file detection
  roots: ['<rootDir>/src'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  testMatch: [
    '**/__tests__/**/*.[jt]s?(x)',
    '**/?(*.)+(spec|test).[jt]s?(x)',
    '!**/*.e2e.test.ts'
  ],

  // Module resolution
  moduleNameMapper: {
    ...pathsToModuleNameMapper(compilerOptions.paths || {}, {
      prefix: '<rootDir>/'
    }),
    '^@/(.*)$': '<rootDir>/src/$1'
  },

  // Test environment setup
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  testTimeout: 10000,

  // Coverage configuration
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'clover', 'json'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/coverage/',
    '/__mocks__/',
    '/migrations/',
    '/seeds/',
    '\\.d\\.ts$'
  ],

  // Performance and debugging
  maxWorkers: '50%',
  verbose: true,
  detectOpenHandles: true,
  forceExit: true,

  // Error handling
  bail: 1,
  errorOnDeprecated: true
};

/**
 * Creates a service-specific Jest configuration by extending the base configuration
 * @param serviceConfig - Service-specific Jest configuration overrides
 * @returns Complete Jest configuration merged with service-specific settings
 */
export const createJestConfig = (
  serviceConfig: Partial<JestConfigWithTsJest>
): JestConfigWithTsJest => {
  return {
    ...baseConfig,
    ...serviceConfig,
    // Merge coverage thresholds if provided
    coverageThreshold: {
      ...baseConfig.coverageThreshold,
      ...(serviceConfig.coverageThreshold || {})
    },
    // Merge module name mapper if provided
    moduleNameMapper: {
      ...baseConfig.moduleNameMapper,
      ...(serviceConfig.moduleNameMapper || {})
    }
  };
};

// Export default configuration for root-level testing
export default baseConfig;