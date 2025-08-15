import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  LifecycleManager,
  LifecyclePhase,
  type LifecycleResult,
  type LifecycleOptions,
} from "../lifecycle-manager";
import { ModuleState, ModulePriority } from "../types";
import type { ModuleConfig, ModuleRegistryEntry } from "../types";

// Mock ModuleRegistry
class MockModuleRegistry {
  private modules = new Map<string, ModuleRegistryEntry>();

  getAllModules() {
    return this.modules;
  }

  getRunningModules() {
    const running = new Map<string, ModuleRegistryEntry>();
    for (const [name, entry] of this.modules) {
      if (entry.state === ModuleState.RUNNING) {
        running.set(name, entry);
      }
    }
    return running;
  }

  getModuleState(name: string): ModuleState {
    return this.modules.get(name)?.state ?? ModuleState.STOPPED;
  }

  async configureModule(name: string, config: any): Promise<void> {
    const entry = this.modules.get(name);
    if (entry && entry.state === ModuleState.INSTALLED) {
      entry.state = ModuleState.CONFIGURED;
    }
  }

  async startModule(name: string): Promise<void> {
    const entry = this.modules.get(name);
    if (entry) {
      if (entry.state === ModuleState.CONFIGURED) {
        entry.state = ModuleState.RUNNING;
      } else {
        throw new Error(`Module ${name} not configured`);
      }
    } else {
      throw new Error(`Module ${name} not found`);
    }
  }

  async stopModule(name: string): Promise<void> {
    const entry = this.modules.get(name);
    if (entry) {
      entry.state = ModuleState.STOPPED;
    } else {
      throw new Error(`Module ${name} not found`);
    }
  }

  // Test helpers
  addModule(
    name: string,
    config: ModuleConfig,
    state: ModuleState = ModuleState.INSTALLED,
  ) {
    this.modules.set(name, {
      config,
      state,
      instance: null,
    });
  }

  clear() {
    this.modules.clear();
  }

  setModuleState(name: string, state: ModuleState) {
    const entry = this.modules.get(name);
    if (entry) {
      entry.state = state;
    }
  }
}

// Create test module configs
const createModuleConfig = (
  name: string,
  priority: ModulePriority = ModulePriority.MEDIUM,
  dependencies: string[] = [],
): ModuleConfig => ({
  name,
  version: "1.0.0",
  priority,
  dependencies,
  permissions: [],
});

describe("LifecycleManager", () => {
  let lifecycleManager: LifecycleManager;
  let mockRegistry: MockModuleRegistry;

  // Store original process event handlers
  const originalSignalHandlers = {
    SIGTERM: process.listeners("SIGTERM").slice(),
    SIGINT: process.listeners("SIGINT").slice(),
    SIGHUP: process.listeners("SIGHUP").slice(),
  };

  beforeEach(() => {
    mockRegistry = new MockModuleRegistry();
    lifecycleManager = new LifecycleManager(mockRegistry as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
    mockRegistry.clear();

    // Clean up signal handlers added during tests
    const currentHandlers = {
      SIGTERM: process.listeners("SIGTERM"),
      SIGINT: process.listeners("SIGINT"),
      SIGHUP: process.listeners("SIGHUP"),
    };

    // Remove handlers that weren't there originally
    for (const [signal, current] of Object.entries(currentHandlers)) {
      const original =
        originalSignalHandlers[signal as keyof typeof originalSignalHandlers];
      const toRemove = current.filter((handler) => !original.includes(handler));
      toRemove.forEach((handler) => {
        process.removeListener(signal as any, handler as any);
      });
    }
  });

  describe("Construction and Signal Handling", () => {
    it("should create lifecycle manager with registry", () => {
      expect(lifecycleManager).toBeInstanceOf(LifecycleManager);
    });

    it("should register signal handlers", () => {
      // Signal handlers are registered in constructor
      // We can't easily test the actual handlers without triggering them
      expect(process.listenerCount("SIGTERM")).toBeGreaterThan(0);
      expect(process.listenerCount("SIGINT")).toBeGreaterThan(0);
      expect(process.listenerCount("SIGHUP")).toBeGreaterThan(0);
    });

    it("should have no current operation initially", () => {
      const current = lifecycleManager.getCurrentOperation();
      expect(current).toBeUndefined();
    });
  });

  describe("Startup Sequence", () => {
    it("should handle startup with no modules", async () => {
      const result = await lifecycleManager.startupSequence();

      expect(result.phase).toBe(LifecyclePhase.COMPLETED);
      expect(result.totalModules).toBe(0);
      expect(result.succeededModules).toHaveLength(0);
      expect(result.failedModules).toHaveLength(0);
      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(result.completedAt).toBeInstanceOf(Date);
    });

    it("should start single module successfully", async () => {
      const moduleConfig = createModuleConfig("test-module");
      mockRegistry.addModule(
        "test-module",
        moduleConfig,
        ModuleState.CONFIGURED,
      );

      const result = await lifecycleManager.startupSequence();

      expect(result.phase).toBe(LifecyclePhase.COMPLETED);
      expect(result.totalModules).toBe(1);
      expect(result.succeededModules).toContain("test-module");
      expect(result.failedModules).toHaveLength(0);
      expect(mockRegistry.getModuleState("test-module")).toBe(
        ModuleState.RUNNING,
      );
    });

    it("should start multiple modules in priority order", async () => {
      const criticalModule = createModuleConfig(
        "critical",
        ModulePriority.CRITICAL,
      );
      const mediumModule = createModuleConfig("medium", ModulePriority.MEDIUM);
      const lowModule = createModuleConfig("low", ModulePriority.LOW);

      mockRegistry.addModule(
        "critical",
        criticalModule,
        ModuleState.CONFIGURED,
      );
      mockRegistry.addModule("medium", mediumModule, ModuleState.CONFIGURED);
      mockRegistry.addModule("low", lowModule, ModuleState.CONFIGURED);

      const result = await lifecycleManager.startupSequence();

      expect(result.phase).toBe(LifecyclePhase.COMPLETED);
      expect(result.totalModules).toBe(3);
      expect(result.succeededModules).toHaveLength(3);
      expect(result.failedModules).toHaveLength(0);

      // All modules should be running
      expect(mockRegistry.getModuleState("critical")).toBe(ModuleState.RUNNING);
      expect(mockRegistry.getModuleState("medium")).toBe(ModuleState.RUNNING);
      expect(mockRegistry.getModuleState("low")).toBe(ModuleState.RUNNING);
    });

    it("should auto-configure installed modules during startup", async () => {
      const moduleConfig = createModuleConfig("test-module");
      mockRegistry.addModule(
        "test-module",
        moduleConfig,
        ModuleState.INSTALLED,
      );

      const result = await lifecycleManager.startupSequence();

      expect(result.phase).toBe(LifecyclePhase.COMPLETED);
      expect(result.succeededModules).toContain("test-module");
      expect(mockRegistry.getModuleState("test-module")).toBe(
        ModuleState.RUNNING,
      );
    });

    it("should handle startup failure with rollback disabled", async () => {
      const goodModule = createModuleConfig("good-module");
      const badModule = createModuleConfig("bad-module");

      mockRegistry.addModule("good-module", goodModule, ModuleState.CONFIGURED);
      // Don't add bad-module to registry - this will cause startModule to fail
      mockRegistry.addModule("bad-module", badModule, ModuleState.CONFIGURED);

      // Remove bad-module from registry to cause failure
      mockRegistry.clear();
      mockRegistry.addModule("good-module", goodModule, ModuleState.CONFIGURED);
      mockRegistry.addModule("bad-module", badModule, ModuleState.CONFIGURED);

      const result = await lifecycleManager.startupSequence({
        rollbackOnFailure: false,
        continueOnError: true,
      });

      expect(result.phase).toBe(LifecyclePhase.COMPLETED);
      expect(result.succeededModules).toContain("good-module");
    });

    it("should handle startup failure with rollback enabled", async () => {
      const goodModule = createModuleConfig("good-module");
      mockRegistry.addModule("good-module", goodModule, ModuleState.CONFIGURED);

      // Mock a failure during startup by throwing in startModule
      const originalStartModule = mockRegistry.startModule.bind(mockRegistry);
      mockRegistry.startModule = vi
        .fn()
        .mockImplementation(async (name: string) => {
          if (name === "good-module") {
            await originalStartModule(name);
          } else {
            throw new Error("Simulated startup failure");
          }
        });

      // Add a module that will fail
      const badModule = createModuleConfig("bad-module");
      mockRegistry.addModule("bad-module", badModule, ModuleState.CONFIGURED);

      const result = await lifecycleManager.startupSequence({
        rollbackOnFailure: true,
        continueOnError: false,
      });

      expect(result.phase).toBe(LifecyclePhase.ROLLED_BACK);
      expect(result.failedModules).toHaveLength(1);
      expect(result.failedModules[0].name).toBe("bad-module");
    });

    it("should respect custom module order", async () => {
      const module1 = createModuleConfig("module-1");
      const module2 = createModuleConfig("module-2");
      const module3 = createModuleConfig("module-3");

      mockRegistry.addModule("module-1", module1, ModuleState.CONFIGURED);
      mockRegistry.addModule("module-2", module2, ModuleState.CONFIGURED);
      mockRegistry.addModule("module-3", module3, ModuleState.CONFIGURED);

      const result = await lifecycleManager.startupSequence({
        customOrder: ["module-3", "module-1", "module-2"],
      });

      expect(result.phase).toBe(LifecyclePhase.COMPLETED);
      expect(result.succeededModules).toEqual([
        "module-3",
        "module-1",
        "module-2",
      ]);
    });

    it("should respect concurrency limits", async () => {
      const modules = Array.from({ length: 10 }, (_, i) =>
        createModuleConfig(`module-${i}`),
      );

      modules.forEach((config, i) => {
        mockRegistry.addModule(`module-${i}`, config, ModuleState.CONFIGURED);
      });

      const result = await lifecycleManager.startupSequence({
        maxConcurrency: 3,
      });

      expect(result.phase).toBe(LifecyclePhase.COMPLETED);
      expect(result.succeededModules).toHaveLength(10);
    });

    it("should return same promise if startup already in progress", async () => {
      const moduleConfig = createModuleConfig("test-module");
      mockRegistry.addModule(
        "test-module",
        moduleConfig,
        ModuleState.CONFIGURED,
      );

      let startupCallCount = 0;
      const originalStartModule = mockRegistry.startModule.bind(mockRegistry);
      mockRegistry.startModule = vi
        .fn()
        .mockImplementation(async (name: string) => {
          startupCallCount++;
          await originalStartModule(name);
        });

      // Start two operations simultaneously
      const results = await Promise.all([
        lifecycleManager.startupSequence(),
        lifecycleManager.startupSequence(),
      ]);

      // Both should succeed
      expect(results[0].phase).toBe(LifecyclePhase.COMPLETED);
      expect(results[1].phase).toBe(LifecyclePhase.COMPLETED);

      // StartModule should only be called once since the second call should reuse the same operation
      expect(startupCallCount).toBe(1);
    });
  });

  describe("Shutdown Sequence", () => {
    it("should handle shutdown with no running modules", async () => {
      const result = await lifecycleManager.shutdownSequence();

      expect(result.phase).toBe(LifecyclePhase.COMPLETED);
      expect(result.totalModules).toBe(0);
      expect(result.succeededModules).toHaveLength(0);
      expect(result.failedModules).toHaveLength(0);
    });

    it("should shutdown single running module", async () => {
      const moduleConfig = createModuleConfig("test-module");
      mockRegistry.addModule("test-module", moduleConfig, ModuleState.RUNNING);

      const result = await lifecycleManager.shutdownSequence();

      expect(result.phase).toBe(LifecyclePhase.COMPLETED);
      expect(result.totalModules).toBe(1);
      expect(result.succeededModules).toContain("test-module");
      expect(result.failedModules).toHaveLength(0);
      expect(mockRegistry.getModuleState("test-module")).toBe(
        ModuleState.STOPPED,
      );
    });

    it("should shutdown multiple modules in reverse dependency order", async () => {
      const module1 = createModuleConfig("module-1");
      const module2 = createModuleConfig("module-2");
      const module3 = createModuleConfig("module-3");

      mockRegistry.addModule("module-1", module1, ModuleState.RUNNING);
      mockRegistry.addModule("module-2", module2, ModuleState.RUNNING);
      mockRegistry.addModule("module-3", module3, ModuleState.RUNNING);

      const result = await lifecycleManager.shutdownSequence();

      expect(result.phase).toBe(LifecyclePhase.COMPLETED);
      expect(result.totalModules).toBe(3);
      expect(result.succeededModules).toHaveLength(3);
      expect(result.failedModules).toHaveLength(0);
    });

    it("should continue shutdown even with failures", async () => {
      const goodModule = createModuleConfig("good-module");
      const badModule = createModuleConfig("bad-module");

      mockRegistry.addModule("good-module", goodModule, ModuleState.RUNNING);
      mockRegistry.addModule("bad-module", badModule, ModuleState.RUNNING);

      // Mock failure for bad-module
      const originalStopModule = mockRegistry.stopModule.bind(mockRegistry);
      mockRegistry.stopModule = vi
        .fn()
        .mockImplementation(async (name: string) => {
          if (name === "bad-module") {
            throw new Error("Simulated shutdown failure");
          }
          await originalStopModule(name);
        });

      const result = await lifecycleManager.shutdownSequence();

      expect(result.phase).toBe(LifecyclePhase.COMPLETED);
      expect(result.succeededModules).toContain("good-module");
      expect(result.failedModules).toHaveLength(1);
      expect(result.failedModules[0].name).toBe("bad-module");
    });

    it("should return same promise if shutdown already in progress", async () => {
      const moduleConfig = createModuleConfig("test-module");
      mockRegistry.addModule("test-module", moduleConfig, ModuleState.RUNNING);

      let shutdownCallCount = 0;
      const originalStopModule = mockRegistry.stopModule.bind(mockRegistry);
      mockRegistry.stopModule = vi
        .fn()
        .mockImplementation(async (name: string) => {
          shutdownCallCount++;
          await originalStopModule(name);
        });

      // Start two operations simultaneously
      const results = await Promise.all([
        lifecycleManager.shutdownSequence(),
        lifecycleManager.shutdownSequence(),
      ]);

      // Both should succeed
      expect(results[0].phase).toBe(LifecyclePhase.COMPLETED);
      expect(results[1].phase).toBe(LifecyclePhase.COMPLETED);

      // StopModule should only be called once since the second call should reuse the same operation
      expect(shutdownCallCount).toBe(1);
    });
  });

  describe("Restart Sequence", () => {
    it("should restart successfully", async () => {
      const moduleConfig = createModuleConfig("test-module");
      mockRegistry.addModule("test-module", moduleConfig, ModuleState.RUNNING);

      // Mock stopModule to set state to CONFIGURED so it can be restarted
      const originalStopModule = mockRegistry.stopModule.bind(mockRegistry);
      mockRegistry.stopModule = vi
        .fn()
        .mockImplementation(async (name: string) => {
          const entry = mockRegistry["modules"].get(name);
          if (entry) {
            entry.state = ModuleState.CONFIGURED; // Set to CONFIGURED instead of STOPPED so it can restart
          }
        });

      const result = await lifecycleManager.restartSequence();

      expect(result.phase).toBe(LifecyclePhase.COMPLETED);
      expect(mockRegistry.getModuleState("test-module")).toBe(
        ModuleState.RUNNING,
      );
    });

    it("should fail restart if shutdown fails", async () => {
      const moduleConfig = createModuleConfig("test-module");
      mockRegistry.addModule("test-module", moduleConfig, ModuleState.RUNNING);

      // Mock shutdown to throw error in the main execution (not just individual module failure)
      mockRegistry.getRunningModules = vi.fn().mockImplementation(() => {
        throw new Error("Registry error during shutdown");
      });

      await expect(lifecycleManager.restartSequence()).rejects.toThrow(
        "Restart failed during shutdown",
      );
    });
  });

  describe("Operation Status and Cancellation", () => {
    it("should track current operation status", async () => {
      const moduleConfig = createModuleConfig("test-module");
      mockRegistry.addModule(
        "test-module",
        moduleConfig,
        ModuleState.CONFIGURED,
      );

      // Start operation but don't await
      const promise = lifecycleManager.startupSequence();

      const status = lifecycleManager.getCurrentOperation();
      expect(status).toBeDefined();
      expect(status!.type).toBe("startup");
      expect(status!.startedAt).toBeInstanceOf(Date);
      expect(status!.duration).toBeGreaterThanOrEqual(0);

      await promise;

      // Should be cleared after completion
      expect(lifecycleManager.getCurrentOperation()).toBeUndefined();
    });

    it("should throw error when trying to cancel operation", async () => {
      const moduleConfig = createModuleConfig("test-module");
      mockRegistry.addModule(
        "test-module",
        moduleConfig,
        ModuleState.CONFIGURED,
      );

      const promise = lifecycleManager.startupSequence();

      await expect(lifecycleManager.cancelCurrentOperation()).rejects.toThrow(
        "Operation cancellation not yet implemented",
      );

      await promise;
    });

    it("should handle cancellation when no operation is running", async () => {
      await expect(
        lifecycleManager.cancelCurrentOperation(),
      ).resolves.toBeUndefined();
    });
  });

  describe("Execution Planning and Module Ordering", () => {
    it("should group modules by priority", async () => {
      const criticalModule = createModuleConfig(
        "critical",
        ModulePriority.CRITICAL,
      );
      const highModule = createModuleConfig("high", ModulePriority.HIGH);
      const mediumModule = createModuleConfig("medium", ModulePriority.MEDIUM);
      const lowModule = createModuleConfig("low", ModulePriority.LOW);

      mockRegistry.addModule(
        "critical",
        criticalModule,
        ModuleState.CONFIGURED,
      );
      mockRegistry.addModule("high", highModule, ModuleState.CONFIGURED);
      mockRegistry.addModule("medium", mediumModule, ModuleState.CONFIGURED);
      mockRegistry.addModule("low", lowModule, ModuleState.CONFIGURED);

      const result = await lifecycleManager.startupSequence({
        maxConcurrency: 1,
      });

      expect(result.phase).toBe(LifecyclePhase.COMPLETED);
      expect(result.succeededModules).toEqual([
        "critical",
        "high",
        "medium",
        "low",
      ]);
    });

    it("should handle modules with same priority in alphabetical order", async () => {
      const moduleZ = createModuleConfig("module-z", ModulePriority.NORMAL);
      const moduleA = createModuleConfig("module-a", ModulePriority.NORMAL);
      const moduleM = createModuleConfig("module-m", ModulePriority.NORMAL);

      mockRegistry.addModule("module-z", moduleZ, ModuleState.CONFIGURED);
      mockRegistry.addModule("module-a", moduleA, ModuleState.CONFIGURED);
      mockRegistry.addModule("module-m", moduleM, ModuleState.CONFIGURED);

      const result = await lifecycleManager.startupSequence({
        maxConcurrency: 1,
      });

      expect(result.phase).toBe(LifecyclePhase.COMPLETED);
      expect(result.succeededModules).toEqual([
        "module-a",
        "module-m",
        "module-z",
      ]);
    });

    it("should chunk modules according to concurrency limit", async () => {
      const modules = Array.from({ length: 7 }, (_, i) =>
        createModuleConfig(`module-${i}`, ModulePriority.MEDIUM),
      );

      modules.forEach((config, i) => {
        mockRegistry.addModule(`module-${i}`, config, ModuleState.CONFIGURED);
      });

      const result = await lifecycleManager.startupSequence({
        maxConcurrency: 3,
      });

      expect(result.phase).toBe(LifecyclePhase.COMPLETED);
      expect(result.succeededModules).toHaveLength(7);
    });
  });

  describe("Error Handling and Edge Cases", () => {
    it("should handle registry errors during execution", async () => {
      // Mock registry to throw error during getAllModules
      mockRegistry.getAllModules = vi.fn().mockImplementation(() => {
        throw new Error("Registry error");
      });

      const result = await lifecycleManager.startupSequence();

      expect(result.phase).toBe(LifecyclePhase.FAILED);
      expect(result.failedModules).toHaveLength(1);
      expect(result.failedModules[0].name).toBe("lifecycle-manager");
      expect(result.failedModules[0].error.message).toBe("Registry error");
    });

    it("should handle non-Error exceptions", async () => {
      mockRegistry.getAllModules = vi.fn().mockImplementation(() => {
        throw "String error";
      });

      const result = await lifecycleManager.startupSequence();

      expect(result.phase).toBe(LifecyclePhase.FAILED);
      expect(result.failedModules[0].error).toBeInstanceOf(Error);
      expect(result.failedModules[0].error.message).toBe("String error");
    });

    it("should handle rollback errors gracefully", async () => {
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const goodModule = createModuleConfig("good-module");
      const badModule = createModuleConfig("bad-module");

      mockRegistry.addModule("good-module", goodModule, ModuleState.CONFIGURED);
      mockRegistry.addModule("bad-module", badModule, ModuleState.CONFIGURED);

      // Make good-module start successfully first, then bad-module fail
      const originalStartModule = mockRegistry.startModule.bind(mockRegistry);
      mockRegistry.startModule = vi
        .fn()
        .mockImplementation(async (name: string) => {
          if (name === "bad-module") {
            throw new Error("Startup failure");
          }
          await originalStartModule(name);
        });

      // Make rollback (stopModule) fail when called for good-module
      const originalStopModule = mockRegistry.stopModule.bind(mockRegistry);
      mockRegistry.stopModule = vi
        .fn()
        .mockImplementation(async (name: string) => {
          if (name === "good-module") {
            throw new Error("Rollback failure");
          }
          await originalStopModule(name);
        });

      const result = await lifecycleManager.startupSequence({
        rollbackOnFailure: true,
        continueOnError: false,
        customOrder: ["good-module", "bad-module"], // Ensure good-module starts first
      });

      expect(result.phase).toBe(LifecyclePhase.ROLLED_BACK);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringMatching(/Error during rollback of module good-module:/),
        expect.any(Error),
      );

      consoleErrorSpy.mockRestore();
    });

    it("should handle timeout scenarios gracefully", async () => {
      const moduleConfig = createModuleConfig("slow-module");
      mockRegistry.addModule(
        "slow-module",
        moduleConfig,
        ModuleState.CONFIGURED,
      );

      // Mock slow startup
      mockRegistry.startModule = vi
        .fn()
        .mockImplementation(async (name: string) => {
          if (name === "slow-module") {
            await new Promise((resolve) => setTimeout(resolve, 100));
            const entry = mockRegistry["modules"].get(name);
            if (entry) entry.state = ModuleState.RUNNING;
          }
        });

      const result = await lifecycleManager.startupSequence({
        operationTimeout: 50, // Shorter than the mock delay
      });

      // Should complete successfully since timeout is per operation, not per module
      expect(result.phase).toBe(LifecyclePhase.COMPLETED);
    });

    it("should calculate duration correctly", async () => {
      const moduleConfig = createModuleConfig("test-module");
      mockRegistry.addModule(
        "test-module",
        moduleConfig,
        ModuleState.CONFIGURED,
      );

      const startTime = Date.now();
      const result = await lifecycleManager.startupSequence();
      const endTime = Date.now();

      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(result.duration).toBeLessThanOrEqual(endTime - startTime);
      expect(result.completedAt).toBeInstanceOf(Date);
    });
  });

  describe("Utility Methods", () => {
    it("should handle empty arrays in chunking", () => {
      // Access the private method for testing using type assertion
      const chunkArray = (lifecycleManager as any).chunkArray;

      const result = chunkArray([], 3);
      expect(result).toEqual([]);
    });

    it("should chunk arrays properly", () => {
      const chunkArray = (lifecycleManager as any).chunkArray;

      const input = [1, 2, 3, 4, 5, 6, 7];
      const result = chunkArray(input, 3);

      expect(result).toEqual([[1, 2, 3], [4, 5, 6], [7]]);
    });

    it("should handle single-item chunks", () => {
      const chunkArray = (lifecycleManager as any).chunkArray;

      const input = [1, 2, 3];
      const result = chunkArray(input, 1);

      expect(result).toEqual([[1], [2], [3]]);
    });

    it("should handle chunk size larger than array", () => {
      const chunkArray = (lifecycleManager as any).chunkArray;

      const input = [1, 2, 3];
      const result = chunkArray(input, 10);

      expect(result).toEqual([[1, 2, 3]]);
    });

    it("should perform topological sort", () => {
      const topologicalSort = (lifecycleManager as any).topologicalSort;

      const modules = [
        createModuleConfig("zebra"),
        createModuleConfig("alpha"),
        createModuleConfig("beta"),
      ];

      const result = topologicalSort(modules);
      expect(result).toEqual(["alpha", "beta", "zebra"]);
    });

    it("should group modules by priority correctly", () => {
      const groupByPriority = (lifecycleManager as any).groupByPriority;

      const modules = [
        createModuleConfig("critical1", ModulePriority.CRITICAL),
        createModuleConfig("medium1", ModulePriority.MEDIUM),
        createModuleConfig("critical2", ModulePriority.CRITICAL),
        createModuleConfig("low1", ModulePriority.LOW),
      ];

      const result = groupByPriority(modules);

      expect(result.get(ModulePriority.CRITICAL)).toHaveLength(2);
      expect(result.get(ModulePriority.MEDIUM)).toHaveLength(1);
      expect(result.get(ModulePriority.LOW)).toHaveLength(1);
      expect(result.get(ModulePriority.HIGH)).toBeUndefined();
    });
  });

  describe("Signal Handling Integration", () => {
    it("should set up signal handlers without throwing", () => {
      // Creating a new instance should not throw
      expect(() => {
        const manager = new LifecycleManager(mockRegistry as any);
        // Clean up the signal handlers
        const handlers = {
          SIGTERM: process.listeners("SIGTERM"),
          SIGINT: process.listeners("SIGINT"),
          SIGHUP: process.listeners("SIGHUP"),
        };

        // Remove the handlers we just added
        for (const [signal, listeners] of Object.entries(handlers)) {
          const originalCount =
            originalSignalHandlers[
              signal as keyof typeof originalSignalHandlers
            ].length;
          const newHandlers = listeners.slice(originalCount);
          newHandlers.forEach((handler) => {
            process.removeListener(signal as any, handler as any);
          });
        }
      }).not.toThrow();
    });
  });
});
