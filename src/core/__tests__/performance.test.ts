/**
 * Module System Performance Tests
 *
 * These tests verify that the module system meets the performance
 * requirement of <5ms overhead per module operation.
 */

import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { ModuleRegistry } from "../module-registry";
import { ModuleFactory } from "../module-factory";
import { LifecycleManager } from "../lifecycle-manager";
import { BaseModuleStrategy } from "../module-strategy";
import {
  ModulePriority,
  HealthStatus,
  type ModuleConfig,
  type HealthCheckResult,
} from "../types";

// Lightweight test module for performance testing
class PerformanceTestModule extends BaseModuleStrategy {
  async getRouters() {
    return {};
  }
  async getMiddleware() {
    return [];
  }
  async getEventHandlers() {
    return [];
  }
  async getMigrations() {
    return [];
  }

  async healthCheck(): Promise<HealthCheckResult> {
    return {
      status: HealthStatus.HEALTHY,
      details: {
        uptime: Date.now(),
        lastCheck: new Date(),
        dependencies: [],
      },
    };
  }

  protected async onStart(): Promise<void> {
    // Minimal startup logic
  }

  protected async onStop(): Promise<void> {
    // Minimal shutdown logic
  }
}

describe("Module System Performance", () => {
  let registry: ModuleRegistry;
  let factory: ModuleFactory;
  let lifecycleManager: LifecycleManager;

  beforeEach(() => {
    ModuleRegistry.resetInstance();
    registry = ModuleRegistry.getInstance();
    factory = new ModuleFactory();
    lifecycleManager = new LifecycleManager(registry);

    // Helper to register module name in both factory and registry
    const register = (name: string) => {
      try {
        factory.registerModule(name, PerformanceTestModule, "1.0.0");
      } catch {}
      try {
        registry.registerModuleType(name, PerformanceTestModule, "1.0.0");
      } catch {}
    };

    // Common base registration
    register("perf-test");

    // Pre-register frequently used names
    [
      "perf-test-1",
      "perf-test-2",
      "perf-test-install",
      "perf-test-configure",
      "perf-test-start",
      "perf-test-stop",
      "perf-test-health",
    ].forEach(register);
  });

  afterEach(() => {
    ModuleRegistry.resetInstance();
  });

  const createTestConfig = (name: string): ModuleConfig => ({
    name,
    version: "1.0.0",
    description: "Performance test module",
    priority: ModulePriority.MEDIUM,
    dependencies: [],
    requiredPermissions: [],
    requiredEnvVars: [],
    settings: {},
    supportsHotReload: true,
  });

  describe("Module Creation Performance", () => {
    it("should create module instance in <5ms", async () => {
      const config = createTestConfig("perf-test-1");

      const start = performance.now();
      const instance = await factory.createModule(config);
      const end = performance.now();

      expect(instance).toBeDefined();
      expect(end - start).toBeLessThan(5); // <5ms requirement
    });

    it("should handle cached instances in <1ms", async () => {
      const config = createTestConfig("perf-test-2");

      // First creation (uncached)
      await factory.createModule(config);

      // Second creation (cached)
      const start = performance.now();
      const instance = await factory.createModule(config);
      const end = performance.now();

      expect(instance).toBeDefined();
      expect(end - start).toBeLessThan(1); // Cached should be very fast
    });
  });

  describe("Registry Operations Performance", () => {
    it("should install module in <5ms", async () => {
      const config = createTestConfig("perf-test-install");

      const start = performance.now();
      await registry.installModule(config);
      const end = performance.now();

      expect(end - start).toBeLessThan(5);
    });

    it("should configure module in <5ms", async () => {
      const config = createTestConfig("perf-test-configure");
      await registry.installModule(config);

      const start = performance.now();
      await registry.configureModule(config.name, {});
      const end = performance.now();

      expect(end - start).toBeLessThan(5);
    });

    it("should start module in <5ms", async () => {
      const config = createTestConfig("perf-test-start");
      await registry.installModule(config);
      await registry.configureModule(config.name, {});

      const start = performance.now();
      await registry.startModule(config.name);
      const end = performance.now();

      expect(end - start).toBeLessThan(5);
    });

    it("should stop module in <5ms", async () => {
      const config = createTestConfig("perf-test-stop");
      await registry.installModule(config);
      await registry.configureModule(config.name, {});
      await registry.startModule(config.name);

      const start = performance.now();
      await registry.stopModule(config.name);
      const end = performance.now();

      expect(end - start).toBeLessThan(5);
    });
  });

  describe("Health Check Performance", () => {
    it("should perform health check in <5ms", async () => {
      const config = createTestConfig("perf-test-health");
      await registry.installModule(config);
      await registry.configureModule(config.name, {});
      await registry.startModule(config.name);

      const start = performance.now();
      const results = await registry.performHealthCheck();
      const end = performance.now();

      expect(results.size).toBe(1);
      expect(end - start).toBeLessThan(5);
    });
  });

  describe("Bulk Operations Performance", () => {
    it("should handle multiple modules efficiently", async () => {
      const moduleCount = 10;
      const configs: ModuleConfig[] = [];

      // Register multiple test modules
      for (let i = 0; i < moduleCount; i++) {
        const moduleName = `perf-test-bulk-${i}`;
        // Register in both factory and registry
        try {
          factory.registerModule(moduleName, PerformanceTestModule, "1.0.0");
        } catch {}
        try {
          registry.registerModuleType(
            moduleName,
            PerformanceTestModule,
            "1.0.0",
          );
        } catch {}
        configs.push(createTestConfig(moduleName));
      }

      // Install all modules
      const installStart = performance.now();
      for (const config of configs) {
        await registry.installModule(config);
      }
      const installEnd = performance.now();

      // Configure all modules
      const configureStart = performance.now();
      for (const config of configs) {
        await registry.configureModule(config.name, {});
      }
      const configureEnd = performance.now();

      // Start all modules
      const startStart = performance.now();
      for (const config of configs) {
        await registry.startModule(config.name);
      }
      const startEnd = performance.now();

      // Check performance per module
      const avgInstallTime = (installEnd - installStart) / moduleCount;
      const avgConfigureTime = (configureEnd - configureStart) / moduleCount;
      const avgStartTime = (startEnd - startStart) / moduleCount;

      expect(avgInstallTime).toBeLessThan(5);
      expect(avgConfigureTime).toBeLessThan(5);
      expect(avgStartTime).toBeLessThan(5);
    });

    it("should startup sequence stay under performance limits", async () => {
      const moduleCount = 5;

      // Register and install multiple modules
      for (let i = 0; i < moduleCount; i++) {
        const moduleName = `perf-test-startup-${i}`;
        try {
          factory.registerModule(moduleName, PerformanceTestModule, "1.0.0");
        } catch {}
        try {
          registry.registerModuleType(
            moduleName,
            PerformanceTestModule,
            "1.0.0",
          );
        } catch {}
        const config = createTestConfig(moduleName);
        await registry.installModule(config);
        await registry.configureModule(config.name, {});
      }

      const start = performance.now();
      const result = await lifecycleManager.startupSequence({
        maxConcurrency: 5,
        continueOnError: false,
      });
      const end = performance.now();

      expect(result.succeededModules).toHaveLength(moduleCount);

      // Total time should be reasonable (modules can start in parallel)
      const totalTime = end - start;
      const avgTimePerModule = totalTime / moduleCount;

      // With parallel execution, average time per module should be very low
      expect(avgTimePerModule).toBeLessThan(10); // Slightly higher due to coordination overhead
    });
  });

  describe("Memory Performance", () => {
    it("should not leak memory during module operations", async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Perform many module operations
      for (let i = 0; i < 50; i++) {
        const moduleName = `perf-test-memory-${i}`;
        try {
          factory.registerModule(moduleName, PerformanceTestModule, "1.0.0");
        } catch {}
        try {
          registry.registerModuleType(
            moduleName,
            PerformanceTestModule,
            "1.0.0",
          );
        } catch {}

        const config = createTestConfig(moduleName);
        await registry.installModule(config);
        await registry.configureModule(config.name, {});
        await registry.startModule(config.name);
        await registry.stopModule(config.name);
        await registry.uninstallModule(config.name);

        factory.unregisterModule(moduleName);
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be minimal (less than 10MB)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });
  });

  describe("Concurrent Operations Performance", () => {
    it("should handle concurrent module operations efficiently", async () => {
      const concurrentCount = 20;
      const operations: Promise<void>[] = [];

      // Register modules
      for (let i = 0; i < concurrentCount; i++) {
        const moduleName = `perf-test-concurrent-${i}`;
        try {
          factory.registerModule(moduleName, PerformanceTestModule, "1.0.0");
        } catch {}
        try {
          registry.registerModuleType(
            moduleName,
            PerformanceTestModule,
            "1.0.0",
          );
        } catch {}
      }

      const start = performance.now();

      // Start concurrent operations
      for (let i = 0; i < concurrentCount; i++) {
        const moduleName = `perf-test-concurrent-${i}`;
        const config = createTestConfig(moduleName);

        const operation = (async () => {
          await registry.installModule(config);
          await registry.configureModule(config.name, {});
          await registry.startModule(config.name);
        })();

        operations.push(operation);
      }

      // Wait for all operations to complete
      await Promise.all(operations);
      const end = performance.now();

      const avgTimePerOperation = (end - start) / concurrentCount;

      // With proper concurrent handling, average time should be reasonable
      expect(avgTimePerOperation).toBeLessThan(20); // Higher limit due to concurrency coordination
    });
  });

  describe("Registry Query Performance", () => {
    it("should query module information quickly", async () => {
      // Set up some modules
      for (let i = 0; i < 10; i++) {
        const moduleName = `perf-test-query-${i}`;
        try {
          factory.registerModule(moduleName, PerformanceTestModule, "1.0.0");
        } catch {}
        try {
          registry.registerModuleType(
            moduleName,
            PerformanceTestModule,
            "1.0.0",
          );
        } catch {}
        const config = createTestConfig(moduleName);
        await registry.installModule(config);
        await registry.configureModule(config.name, {});
        await registry.startModule(config.name);
      }

      // Test query performance
      const start = performance.now();

      const allModules = registry.getAllModules();
      const runningModules = registry.getRunningModules();
      const statistics = registry.getStatistics();

      const end = performance.now();

      expect(allModules.size).toBe(10);
      expect(runningModules.size).toBe(10);
      expect(statistics.totalModules).toBe(10);
      expect(end - start).toBeLessThan(1); // Queries should be very fast
    });
  });
});
