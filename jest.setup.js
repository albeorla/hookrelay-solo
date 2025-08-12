// @ts-nocheck
/**
 * Jest Setup File
 *
 * This file is run before all tests to set up the testing environment.
 */

// Set test environment variables
if (process.env.NODE_ENV !== "test") {
  Object.defineProperty(process.env, "NODE_ENV", {
    value: "test",
    writable: true,
  });
}
process.env.MODULES_ENABLED = "true";
process.env.MODULE_HEALTH_CHECK_INTERVAL = "1000"; // 1 second for tests
process.env.MODULE_OPERATION_TIMEOUT = "5000"; // 5 seconds for tests

// Mock console methods in tests (unless explicitly testing them)
global.console = {
  ...console,
  // Suppress logs during testing unless LOG_LEVEL is set
  log: process.env.LOG_LEVEL ? console.log : jest.fn(),
  info: process.env.LOG_LEVEL ? console.info : jest.fn(),
  warn: process.env.LOG_LEVEL ? console.warn : jest.fn(),
  error: process.env.LOG_LEVEL ? console.error : jest.fn(),
};

// Global test utilities
global.delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Clean up after each test
afterEach(() => {
  // Reset module registry if it exists
  try {
    const { ModuleRegistry } = require("./src/core/module-registry");
    ModuleRegistry.resetInstance?.();
  } catch {
    // Module registry not loaded, that's fine
  }

  // Clear all timers
  jest.clearAllTimers();
  jest.useRealTimers();
});
