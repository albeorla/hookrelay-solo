/**
 * Vitest Setup File
 *
 * This file is run before all tests to set up the testing environment.
 */

import { afterEach, vi } from "vitest";
import "reflect-metadata";

// Extend global interface for test utilities
declare global {
  var delay: (ms: number) => Promise<void>;
}

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
if (!process.env.LOG_LEVEL) {
  globalThis.console = {
    ...console,
    log: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  } as Console;
}

// Global test utilities
globalThis.delay = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

// Clean up after each test
afterEach(() => {
  // Clear all timers
  vi.clearAllTimers();
  vi.useRealTimers();

  // Reset all mocks
  vi.resetAllMocks();
});
