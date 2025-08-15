import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    // Test environment
    environment: "node",

    // Test file patterns
    include: [
      "src/**/*.{test,spec}.{ts,tsx}",
      "src/**/__tests__/**/*.{ts,tsx}",
    ],

    // Exclude patterns
    exclude: ["node_modules", "e2e", "services", "dist", ".next"],

    // Global setup
    globals: true,

    // Coverage configuration
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html", "json-summary"],
      reportsDirectory: "coverage",
      include: ["src/core/**/*.{ts,tsx}"],
      exclude: [
        "src/core/**/*.d.ts",
        "src/core/__tests__/**",
        "src/core/**/*.test.{ts,tsx}",
        "src/core/**/*.spec.{ts,tsx}",
      ],
      thresholds: {
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
    },

    // Timeout configuration
    testTimeout: 10000, // 10 seconds

    // Clear mocks between tests
    clearMocks: true,

    // Setup files
    setupFiles: ["./vitest.setup.ts"],
  },

  // Path resolution
  resolve: {
    alias: {
      "~": resolve(__dirname, "./src"),
    },
  },
});
