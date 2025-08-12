/** @type {import('jest').Config} */
const config = {
  // Test environment
  testEnvironment: "node",

  // TypeScript support
  preset: "ts-jest",
  extensionsToTreatAsEsm: [".ts"],

  // Module resolution
  moduleNameMapper: {
    "^~/(.*)$": "<rootDir>/src/$1",
  },

  // Test file patterns
  testMatch: [
    "<rootDir>/src/**/__tests__/**/*.{ts,tsx}",
    "<rootDir>/src/**/*.{test,spec}.{ts,tsx}",
  ],

  // Ignore patterns
  testPathIgnorePatterns: [
    "<rootDir>/node_modules/",
    "<rootDir>/e2e/",
    "<rootDir>/services/",
  ],

  // Coverage configuration
  collectCoverageFrom: [
    "src/core/**/*.{ts,tsx}",
    "!src/core/**/*.d.ts",
    "!src/core/__tests__/**",
    "!src/core/**/*.test.{ts,tsx}",
    "!src/core/**/*.spec.{ts,tsx}",
  ],

  coverageReporters: ["text", "lcov", "html", "json-summary"],

  coverageDirectory: "coverage",

  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    // Stricter requirements for core module system
    "src/core/**/*.ts": {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },

  // Setup files
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],

  // Transform configuration
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        useESM: true,
        tsconfig: {
          module: "esnext",
          target: "es2022",
          moduleResolution: "bundler",
        },
      },
    ],
  },

  // Clear mocks between tests
  clearMocks: true,

  // Verbose output in CI
  verbose: process.env.CI === "true",

  // Timeout configuration
  testTimeout: 10000, // 10 seconds

  // Error handling
  errorOnDeprecated: true,

  // Performance
  maxWorkers: process.env.CI ? 2 : "50%",
};

export default config;
