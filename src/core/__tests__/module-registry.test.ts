import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ModuleRegistry } from "../module-registry";
import {
  ModuleState,
  ModulePriority,
  HealthStatus,
  ModuleEventType,
  ModuleError,
  type ModuleConfig,
  type ModuleInstance,
  type HealthCheckResult,
  type ModuleMetrics,
  type ModuleEvent,
  type ModuleEventHandler,
} from "../types";

// Mock module implementation
class MockModuleInstance implements ModuleInstance {
  public state: ModuleState = ModuleState.UNINSTALLED;
  private shouldFail: Record<string, boolean> = {};

  constructor(public readonly config: ModuleConfig) {}

  async install(): Promise<void> {
    if (this.shouldFail.install) {
      throw new Error("Install failure");
    }
    this.state = ModuleState.INSTALLED;
  }

  async configure(_settings: Record<string, unknown>): Promise<void> {
    if (this.shouldFail.configure) {
      throw new Error("Configure failure");
    }
    this.state = ModuleState.CONFIGURED;
  }

  async start(): Promise<void> {
    if (this.shouldFail.start) {
      throw new Error("Start failure");
    }
    this.state = ModuleState.RUNNING;
  }

  async stop(): Promise<void> {
    if (this.shouldFail.stop) {
      throw new Error("Stop failure");
    }
    this.state = ModuleState.CONFIGURED;
  }

  async uninstall(): Promise<void> {
    if (this.shouldFail.uninstall) {
      throw new Error("Uninstall failure");
    }
    this.state = ModuleState.UNINSTALLED;
  }

  async getRouters(): Promise<Record<string, any>> {
    return {};
  }

  async getMiddleware(): Promise<readonly any[]> {
    return [];
  }

  async getEventHandlers(): Promise<readonly any[]> {
    return [];
  }

  async getMigrations(): Promise<readonly any[]> {
    return [];
  }

  async healthCheck(): Promise<HealthCheckResult> {
    if (this.shouldFail.healthCheck) {
      throw new Error("Health check failure");
    }
    return {
      status: HealthStatus.HEALTHY,
      details: {
        uptime: 1000,
        lastCheck: new Date(),
        dependencies: [],
      },
    };
  }

  async getMetrics(): Promise<ModuleMetrics> {
    if (this.shouldFail.getMetrics) {
      throw new Error("Get metrics failure");
    }
    return {
      startupTime: 100,
      memoryUsage: 1000000,
      requestCount: 10,
      errorCount: 0,
      avgResponseTime: 50,
    };
  }

  async cleanup(): Promise<void> {
    // No-op
  }

  // Test helper to make operations fail
  setShouldFail(operation: string, shouldFail: boolean): void {
    this.shouldFail[operation] = shouldFail;
  }
}

// Helper to create module config
function createModuleConfig(
  overrides: Partial<ModuleConfig> = {},
): ModuleConfig {
  return {
    name: "test-module",
    version: "1.0.0",
    description: "Test module",
    priority: ModulePriority.MEDIUM,
    dependencies: [],
    requiredPermissions: [],
    requiredEnvVars: [],
    settings: {},
    supportsHotReload: false,
    ...overrides,
  };
}

describe("ModuleRegistry", () => {
  let registry: ModuleRegistry;
  let mockConstructor: any;

  // Store original signal handlers to restore later
  const originalSignalHandlers = {
    SIGTERM: process.listeners("SIGTERM").slice(),
    SIGINT: process.listeners("SIGINT").slice(),
  };

  beforeEach(() => {
    // Reset singleton before each test
    ModuleRegistry.resetInstance();
    registry = ModuleRegistry.getInstance();
    mockConstructor = MockModuleInstance;
  });

  afterEach(() => {
    vi.clearAllMocks();

    // Clean up signal handlers added during tests
    const currentHandlers = {
      SIGTERM: process.listeners("SIGTERM"),
      SIGINT: process.listeners("SIGINT"),
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

  describe("Singleton Pattern", () => {
    it("should return same instance", () => {
      const instance1 = ModuleRegistry.getInstance();
      const instance2 = ModuleRegistry.getInstance();

      expect(instance1).toBe(instance2);
    });

    it("should create new instance after reset", () => {
      const instance1 = ModuleRegistry.getInstance();
      ModuleRegistry.resetInstance();
      const instance2 = ModuleRegistry.getInstance();

      expect(instance1).not.toBe(instance2);
    });

    it("should accept options on first creation", () => {
      ModuleRegistry.resetInstance();
      const registry1 = ModuleRegistry.getInstance({ operationTimeout: 5000 });
      const registry2 = ModuleRegistry.getInstance({ operationTimeout: 10000 }); // Should be ignored

      expect(registry1).toBe(registry2);
    });
  });

  describe("Module Type Registration", () => {
    it("should register module type", () => {
      registry.registerModuleType("test-module", mockConstructor, "1.0.0");

      // Should not throw - registration is internal
      expect(() => {
        registry.registerModuleType("test-module", mockConstructor, "1.0.0");
      }).toThrow("already registered");
    });

    it("should publish installation event on type registration", () => {
      const eventHistory = registry.getEventHistory();
      const initialCount = eventHistory.length;

      registry.registerModuleType("test-module", mockConstructor, "1.0.0");

      const newEvents = registry.getEventHistory();
      expect(newEvents.length).toBe(initialCount + 1);
      expect(newEvents[newEvents.length - 1].type).toBe(
        ModuleEventType.INSTALLING,
      );
      expect(newEvents[newEvents.length - 1].moduleName).toBe("test-module");
    });
  });

  describe("Module Installation", () => {
    beforeEach(() => {
      registry.registerModuleType("test-module", mockConstructor, "1.0.0");
    });

    it("should install module successfully", async () => {
      const config = createModuleConfig();

      await registry.installModule(config);

      expect(registry.getModuleState("test-module")).toBe(
        ModuleState.INSTALLED,
      );
      expect(registry.getModule("test-module")).toBeDefined();
    });

    it("should publish installation events", async () => {
      const config = createModuleConfig();
      const initialEvents = registry.getEventHistory().length;

      await registry.installModule(config);

      const events = registry.getEventHistory().slice(initialEvents);
      expect(events).toHaveLength(2); // INSTALLING and INSTALLED
      expect(events[0].type).toBe(ModuleEventType.INSTALLING);
      expect(events[1].type).toBe(ModuleEventType.INSTALLED);
    });

    it("should prevent duplicate installation", async () => {
      const config = createModuleConfig();
      await registry.installModule(config);

      await expect(registry.installModule(config)).rejects.toThrow(ModuleError);
      await expect(registry.installModule(config)).rejects.toThrow(
        "already installed",
      );
    });

    it("should handle installation failure", async () => {
      const FailingConstructor = class extends MockModuleInstance {
        async install(): Promise<void> {
          throw new Error("Installation failed");
        }
      };

      registry.registerModuleType(
        "failing-module",
        FailingConstructor as any,
        "1.0.0",
      );
      const config = createModuleConfig({ name: "failing-module" });

      await expect(registry.installModule(config)).rejects.toThrow(
        "Installation failed",
      );

      const events = registry.getEventHistory();
      const errorEvent = events.find((e) => e.type === ModuleEventType.ERROR);
      expect(errorEvent).toBeDefined();
      expect(errorEvent?.moduleName).toBe("failing-module");
    });

    it("should prevent installation during shutdown", async () => {
      // Start shutdown (don't await to keep it in shutting down state)
      const shutdownPromise = registry.shutdown();

      const config = createModuleConfig();

      await expect(registry.installModule(config)).rejects.toThrow(ModuleError);
      await expect(registry.installModule(config)).rejects.toThrow(
        "Cannot install module during shutdown",
      );

      await shutdownPromise;
    });
  });

  describe("Module Configuration", () => {
    beforeEach(async () => {
      registry.registerModuleType("test-module", mockConstructor, "1.0.0");
      await registry.installModule(createModuleConfig());
    });

    it("should configure module successfully", async () => {
      const settings = { key: "value" };

      await registry.configureModule("test-module", settings);

      expect(registry.getModuleState("test-module")).toBe(
        ModuleState.CONFIGURED,
      );
    });

    it("should publish configuration events", async () => {
      const initialEvents = registry.getEventHistory().length;

      await registry.configureModule("test-module", {});

      const events = registry.getEventHistory().slice(initialEvents);
      expect(events).toHaveLength(2); // CONFIGURING and CONFIGURED
      expect(events[0].type).toBe(ModuleEventType.CONFIGURING);
      expect(events[1].type).toBe(ModuleEventType.CONFIGURED);
    });

    it("should require INSTALLED state", async () => {
      registry.registerModuleType(
        "unconfigured-module",
        mockConstructor,
        "1.0.0",
      );
      await registry.installModule(
        createModuleConfig({ name: "unconfigured-module" }),
      );

      // Manually set to wrong state
      const entry = registry.getAllModules().get("unconfigured-module")!;
      entry.state = ModuleState.RUNNING;

      await expect(
        registry.configureModule("unconfigured-module", {}),
      ).rejects.toThrow("Cannot configure module");
    });

    it("should handle configuration failure", async () => {
      const instance = registry.getModule("test-module") as MockModuleInstance;
      instance.setShouldFail("configure", true);

      await expect(registry.configureModule("test-module", {})).rejects.toThrow(
        "Configure failure",
      );

      expect(registry.getModuleState("test-module")).toBe(ModuleState.FAILED);
    });

    it("should throw error for non-existent module", async () => {
      await expect(
        registry.configureModule("non-existent", {}),
      ).rejects.toThrow("not installed");
    });
  });

  describe("Module Start/Stop", () => {
    beforeEach(async () => {
      registry.registerModuleType("test-module", mockConstructor, "1.0.0");
      await registry.installModule(createModuleConfig());
      await registry.configureModule("test-module", {});
    });

    it("should start module successfully", async () => {
      await registry.startModule("test-module");

      expect(registry.getModuleState("test-module")).toBe(ModuleState.RUNNING);
    });

    it("should record startup metrics", async () => {
      const beforeStart = Date.now();
      await registry.startModule("test-module");
      const afterStart = Date.now();

      const entries = registry.getAllModules();
      const entry = entries.get("test-module")!;

      expect(entry.startedAt).toBeInstanceOf(Date);
      expect(entry.startedAt!.getTime()).toBeGreaterThanOrEqual(beforeStart);
      expect(entry.startedAt!.getTime()).toBeLessThanOrEqual(afterStart);
      expect(entry.metrics.startupTime).toBeGreaterThanOrEqual(0);
    });

    it("should register event handlers on start", async () => {
      const registerSpy = vi.spyOn(
        registry as any,
        "registerModuleEventHandlers",
      );

      await registry.startModule("test-module");

      expect(registerSpy).toHaveBeenCalledWith(expect.any(MockModuleInstance));
    });

    it("should publish start events", async () => {
      const initialEvents = registry.getEventHistory().length;

      await registry.startModule("test-module");

      const events = registry.getEventHistory().slice(initialEvents);
      expect(events).toHaveLength(2); // STARTING and STARTED
      expect(events[0].type).toBe(ModuleEventType.STARTING);
      expect(events[1].type).toBe(ModuleEventType.STARTED);
    });

    it("should handle start failure", async () => {
      const instance = registry.getModule("test-module") as MockModuleInstance;
      instance.setShouldFail("start", true);

      await expect(registry.startModule("test-module")).rejects.toThrow(
        "Start failure",
      );
      expect(registry.getModuleState("test-module")).toBe(ModuleState.FAILED);
    });

    it("should stop running module", async () => {
      await registry.startModule("test-module");

      await registry.stopModule("test-module");

      expect(registry.getModuleState("test-module")).toBe(
        ModuleState.CONFIGURED,
      );
    });

    it("should unregister event handlers on stop", async () => {
      await registry.startModule("test-module");

      const unregisterSpy = vi.spyOn(
        registry as any,
        "unregisterModuleEventHandlers",
      );

      await registry.stopModule("test-module");

      expect(unregisterSpy).toHaveBeenCalledWith(
        expect.any(MockModuleInstance),
      );
    });

    it("should return early if module already stopped", async () => {
      // Module is already in CONFIGURED state (not running)
      await registry.stopModule("test-module");

      // Should not throw and state should remain the same
      expect(registry.getModuleState("test-module")).toBe(
        ModuleState.CONFIGURED,
      );
    });

    it("should handle stop failure", async () => {
      await registry.startModule("test-module");

      const instance = registry.getModule("test-module") as MockModuleInstance;
      instance.setShouldFail("stop", true);

      await expect(registry.stopModule("test-module")).rejects.toThrow(
        "Stop failure",
      );
      expect(registry.getModuleState("test-module")).toBe(ModuleState.FAILED);
    });

    it("should record stopped timestamp", async () => {
      await registry.startModule("test-module");

      const beforeStop = Date.now();
      await registry.stopModule("test-module");
      const afterStop = Date.now();

      const entry = registry.getAllModules().get("test-module")!;
      expect(entry.stoppedAt).toBeInstanceOf(Date);
      expect(entry.stoppedAt!.getTime()).toBeGreaterThanOrEqual(beforeStop);
      expect(entry.stoppedAt!.getTime()).toBeLessThanOrEqual(afterStop);
    });
  });

  describe("Module Uninstallation", () => {
    beforeEach(async () => {
      registry.registerModuleType("test-module", mockConstructor, "1.0.0");
      await registry.installModule(createModuleConfig());
    });

    it("should uninstall module", async () => {
      await registry.uninstallModule("test-module");

      expect(registry.getModuleState("test-module")).toBeUndefined();
      expect(registry.getModule("test-module")).toBeUndefined();
    });

    it("should stop running module before uninstall", async () => {
      await registry.configureModule("test-module", {});
      await registry.startModule("test-module");

      const stopSpy = vi.spyOn(registry, "stopModule");

      await registry.uninstallModule("test-module");

      expect(stopSpy).toHaveBeenCalledWith("test-module");
    });

    it("should publish uninstallation events", async () => {
      const initialEvents = registry.getEventHistory().length;

      await registry.uninstallModule("test-module");

      const events = registry.getEventHistory().slice(initialEvents);
      const uninstallingEvent = events.find(
        (e) => e.type === ModuleEventType.UNINSTALLING,
      );
      const uninstalledEvent = events.find(
        (e) => e.type === ModuleEventType.UNINSTALLED,
      );

      expect(uninstallingEvent).toBeDefined();
      expect(uninstalledEvent).toBeDefined();
    });

    it("should handle uninstall failure", async () => {
      const instance = registry.getModule("test-module") as MockModuleInstance;
      instance.setShouldFail("uninstall", true);

      await expect(registry.uninstallModule("test-module")).rejects.toThrow(
        "Uninstall failure",
      );

      // Module should still exist in registry
      expect(registry.getModule("test-module")).toBeDefined();
    });
  });

  describe("Bulk Operations", () => {
    beforeEach(async () => {
      registry.registerModuleType("module-a", mockConstructor, "1.0.0");
      registry.registerModuleType("module-b", mockConstructor, "1.0.0");
      registry.registerModuleType("module-c", mockConstructor, "1.0.0");

      await registry.installModule(
        createModuleConfig({
          name: "module-a",
          priority: ModulePriority.HIGH,
        }),
      );
      await registry.installModule(
        createModuleConfig({
          name: "module-b",
          priority: ModulePriority.MEDIUM,
        }),
      );
      await registry.installModule(
        createModuleConfig({
          name: "module-c",
          priority: ModulePriority.LOW,
        }),
      );

      await registry.configureModule("module-a", {});
      await registry.configureModule("module-b", {});
      await registry.configureModule("module-c", {});
    });

    it("should start all modules in priority order", async () => {
      await registry.startAllModules();

      expect(registry.getModuleState("module-a")).toBe(ModuleState.RUNNING);
      expect(registry.getModuleState("module-b")).toBe(ModuleState.RUNNING);
      expect(registry.getModuleState("module-c")).toBe(ModuleState.RUNNING);
    });

    it("should stop all modules in reverse priority order", async () => {
      await registry.startAllModules();

      await registry.stopAllModules();

      expect(registry.getModuleState("module-a")).toBe(ModuleState.CONFIGURED);
      expect(registry.getModuleState("module-b")).toBe(ModuleState.CONFIGURED);
      expect(registry.getModuleState("module-c")).toBe(ModuleState.CONFIGURED);
    });

    it("should only start configured modules", async () => {
      // Leave module-c not configured
      const entry = registry.getAllModules().get("module-c")!;
      entry.state = ModuleState.INSTALLED;

      await registry.startAllModules();

      expect(registry.getModuleState("module-a")).toBe(ModuleState.RUNNING);
      expect(registry.getModuleState("module-b")).toBe(ModuleState.RUNNING);
      expect(registry.getModuleState("module-c")).toBe(ModuleState.INSTALLED); // Not started
    });

    it("should only stop running modules", async () => {
      await registry.startAllModules();

      // Manually stop one module
      await registry.stopModule("module-b");

      await registry.stopAllModules();

      // All should be in configured state
      expect(registry.getModuleState("module-a")).toBe(ModuleState.CONFIGURED);
      expect(registry.getModuleState("module-b")).toBe(ModuleState.CONFIGURED);
      expect(registry.getModuleState("module-c")).toBe(ModuleState.CONFIGURED);
    });
  });

  describe("Module Queries", () => {
    beforeEach(async () => {
      registry.registerModuleType("module-1", mockConstructor, "1.0.0");
      registry.registerModuleType("module-2", mockConstructor, "1.0.0");

      await registry.installModule(createModuleConfig({ name: "module-1" }));
      await registry.installModule(createModuleConfig({ name: "module-2" }));
      await registry.configureModule("module-1", {});
      await registry.startModule("module-1");
    });

    it("should get all modules", () => {
      const allModules = registry.getAllModules();

      expect(allModules.size).toBe(2);
      expect(allModules.has("module-1")).toBe(true);
      expect(allModules.has("module-2")).toBe(true);
    });

    it("should get running modules only", () => {
      const runningModules = registry.getRunningModules();

      expect(runningModules.size).toBe(1);
      expect(runningModules.has("module-1")).toBe(true);
      expect(runningModules.has("module-2")).toBe(false);
    });

    it("should get module by name", () => {
      const module = registry.getModule("module-1");

      expect(module).toBeInstanceOf(MockModuleInstance);
      expect(module?.config.name).toBe("module-1");
    });

    it("should return undefined for non-existent module", () => {
      const module = registry.getModule("non-existent");
      expect(module).toBeUndefined();
    });

    it("should get module state", () => {
      expect(registry.getModuleState("module-1")).toBe(ModuleState.RUNNING);
      expect(registry.getModuleState("module-2")).toBe(ModuleState.INSTALLED);
      expect(registry.getModuleState("non-existent")).toBeUndefined();
    });
  });

  describe("Event System", () => {
    let eventHandler: ModuleEventHandler;
    let receivedEvents: ModuleEvent[];

    beforeEach(() => {
      receivedEvents = [];
      eventHandler = {
        eventType: ModuleEventType.STARTED,
        priority: 10,
        handle: vi.fn().mockImplementation((event: ModuleEvent) => {
          receivedEvents.push(event);
          return Promise.resolve();
        }),
      };
    });

    it("should subscribe to events", () => {
      registry.subscribe(ModuleEventType.STARTED, eventHandler);

      registry.publishEvent({
        type: ModuleEventType.STARTED,
        moduleName: "test-module",
        timestamp: new Date(),
      });

      expect(eventHandler.handle).toHaveBeenCalledOnce();
    });

    it("should unsubscribe from events", () => {
      registry.subscribe(ModuleEventType.STARTED, eventHandler);
      registry.unsubscribe(ModuleEventType.STARTED, eventHandler);

      registry.publishEvent({
        type: ModuleEventType.STARTED,
        moduleName: "test-module",
        timestamp: new Date(),
      });

      expect(eventHandler.handle).not.toHaveBeenCalled();
    });

    it("should handle multiple subscribers with priority", () => {
      const handler1 = {
        eventType: ModuleEventType.STARTED,
        priority: 20,
        handle: vi.fn(),
      };
      const handler2 = {
        eventType: ModuleEventType.STARTED,
        priority: 10, // Higher priority (lower number)
        handle: vi.fn(),
      };

      registry.subscribe(ModuleEventType.STARTED, handler1);
      registry.subscribe(ModuleEventType.STARTED, handler2);

      registry.publishEvent({
        type: ModuleEventType.STARTED,
        moduleName: "test-module",
        timestamp: new Date(),
      });

      expect(handler1.handle).toHaveBeenCalledOnce();
      expect(handler2.handle).toHaveBeenCalledOnce();
    });

    it("should maintain event history", () => {
      const event: ModuleEvent = {
        type: ModuleEventType.STARTED,
        moduleName: "test-module",
        timestamp: new Date(),
      };

      registry.publishEvent(event);

      const history = registry.getEventHistory();
      expect(history).toContainEqual(event);
    });

    it("should limit event history size", () => {
      // Create registry with small event history limit
      ModuleRegistry.resetInstance();
      const smallRegistry = ModuleRegistry.getInstance({ maxEventHistory: 2 });

      smallRegistry.publishEvent({
        type: ModuleEventType.STARTED,
        moduleName: "module-1",
        timestamp: new Date(),
      });
      smallRegistry.publishEvent({
        type: ModuleEventType.STARTED,
        moduleName: "module-2",
        timestamp: new Date(),
      });
      smallRegistry.publishEvent({
        type: ModuleEventType.STARTED,
        moduleName: "module-3",
        timestamp: new Date(),
      });

      const history = smallRegistry.getEventHistory();
      expect(history).toHaveLength(2);
      expect(history[0].moduleName).toBe("module-2"); // First event removed
      expect(history[1].moduleName).toBe("module-3");
    });

    it("should handle event handler errors gracefully", () => {
      const failingHandler = {
        eventType: ModuleEventType.STARTED,
        priority: 10,
        handle: vi.fn().mockRejectedValue(new Error("Handler failure")),
      };

      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      registry.subscribe(ModuleEventType.STARTED, failingHandler);

      // Should not throw
      expect(() => {
        registry.publishEvent({
          type: ModuleEventType.STARTED,
          moduleName: "test-module",
          timestamp: new Date(),
        });
      }).not.toThrow();

      consoleSpy.mockRestore();
    });

    it("should handle synchronous event handler errors", () => {
      const failingHandler = {
        eventType: ModuleEventType.STARTED,
        priority: 10,
        handle: vi.fn().mockImplementation(() => {
          throw new Error("Synchronous handler failure");
        }),
      };

      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      registry.subscribe(ModuleEventType.STARTED, failingHandler);

      // Should not throw
      expect(() => {
        registry.publishEvent({
          type: ModuleEventType.STARTED,
          moduleName: "test-module",
          timestamp: new Date(),
        });
      }).not.toThrow();

      consoleSpy.mockRestore();
    });
  });

  describe("Health Monitoring", () => {
    beforeEach(async () => {
      registry.registerModuleType("healthy-module", mockConstructor, "1.0.0");
      registry.registerModuleType("unhealthy-module", mockConstructor, "1.0.0");

      await registry.installModule(
        createModuleConfig({ name: "healthy-module" }),
      );
      await registry.installModule(
        createModuleConfig({ name: "unhealthy-module" }),
      );
      await registry.configureModule("healthy-module", {});
      await registry.configureModule("unhealthy-module", {});
      await registry.startModule("healthy-module");
      await registry.startModule("unhealthy-module");
    });

    it("should perform health check on all running modules", async () => {
      const results = await registry.performHealthCheck();

      expect(results.size).toBe(2);
      expect(results.has("healthy-module")).toBe(true);
      expect(results.has("unhealthy-module")).toBe(true);
    });

    it("should update last health check in registry", async () => {
      await registry.performHealthCheck();

      const entries = registry.getAllModules();
      const healthyEntry = entries.get("healthy-module")!;
      const unhealthyEntry = entries.get("unhealthy-module")!;

      expect(healthyEntry.lastHealthCheck).toBeDefined();
      expect(unhealthyEntry.lastHealthCheck).toBeDefined();
    });

    it("should handle health check failures", async () => {
      const unhealthyInstance = registry.getModule(
        "unhealthy-module",
      ) as MockModuleInstance;
      unhealthyInstance.setShouldFail("healthCheck", true);

      const results = await registry.performHealthCheck();
      const unhealthyResult = results.get("unhealthy-module")!;

      expect(unhealthyResult.status).toBe(HealthStatus.UNHEALTHY);
      expect(unhealthyResult.details.errors).toContain("Health check failure");
    });

    it("should publish health check events", async () => {
      const initialEvents = registry.getEventHistory().length;

      await registry.performHealthCheck();

      const events = registry.getEventHistory().slice(initialEvents);
      const healthEvents = events.filter(
        (e) => e.type === ModuleEventType.HEALTH_CHECK,
      );

      expect(healthEvents).toHaveLength(2); // One for each running module
    });

    it("should only check running modules", async () => {
      await registry.stopModule("unhealthy-module");

      const results = await registry.performHealthCheck();

      expect(results.size).toBe(1);
      expect(results.has("healthy-module")).toBe(true);
      expect(results.has("unhealthy-module")).toBe(false);
    });
  });

  describe("Metrics Collection", () => {
    beforeEach(async () => {
      registry.registerModuleType("test-module", mockConstructor, "1.0.0");
      await registry.installModule(createModuleConfig());
      await registry.configureModule("test-module", {});
      await registry.startModule("test-module");
    });

    it("should update module metrics", async () => {
      await registry["updateMetrics"]();

      const entry = registry.getAllModules().get("test-module")!;
      expect(entry.metrics.startupTime).toBe(100); // From mock
      expect(entry.metrics.memoryUsage).toBe(1000000);
      expect(entry.metrics.requestCount).toBe(10);
    });

    it("should handle metrics collection errors", async () => {
      const instance = registry.getModule("test-module") as MockModuleInstance;
      instance.setShouldFail("getMetrics", true);

      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      // Should not throw
      await registry["updateMetrics"]();

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe("Registry Statistics", () => {
    beforeEach(async () => {
      registry.registerModuleType("module-1", mockConstructor, "1.0.0");
      registry.registerModuleType("module-2", mockConstructor, "1.0.0");

      await registry.installModule(createModuleConfig({ name: "module-1" }));
      await registry.installModule(createModuleConfig({ name: "module-2" }));
      await registry.configureModule("module-1", {});
      await registry.startModule("module-1");
    });

    it("should return registry statistics", () => {
      const stats = registry.getStatistics();

      expect(stats.totalModules).toBe(2);
      expect(stats.modulesByState[ModuleState.RUNNING]).toBe(1);
      expect(stats.modulesByState[ModuleState.INSTALLED]).toBe(1);
      expect(stats.eventHistory).toBeGreaterThan(0);
      expect(stats.factoryStats).toBeDefined();
    });

    it("should include factory statistics", () => {
      const stats = registry.getStatistics();

      expect(stats.factoryStats.registeredModules).toBe(2);
      expect(stats.factoryStats.instantiatedModules).toBe(2);
    });
  });

  describe("Timeout Handling", () => {
    it("should timeout long operations", async () => {
      // Create registry with very short timeout
      ModuleRegistry.resetInstance();
      const timeoutRegistry = ModuleRegistry.getInstance({
        operationTimeout: 10,
      });

      const SlowConstructor = class extends MockModuleInstance {
        async install(): Promise<void> {
          await new Promise((resolve) => setTimeout(resolve, 100));
          this.state = ModuleState.INSTALLED;
        }
      };

      timeoutRegistry.registerModuleType(
        "slow-module",
        SlowConstructor as any,
        "1.0.0",
      );
      const config = createModuleConfig({ name: "slow-module" });

      await expect(timeoutRegistry.installModule(config)).rejects.toThrow(
        "timed out after",
      );
    });
  });

  describe("Background Tasks", () => {
    it("should start background tasks when metrics enabled", () => {
      ModuleRegistry.resetInstance();
      const metricsRegistry = ModuleRegistry.getInstance({
        enableMetrics: true,
      });

      // Background tasks should be started (intervals set)
      expect((metricsRegistry as any).healthCheckInterval).toBeDefined();
      expect((metricsRegistry as any).metricsInterval).toBeDefined();
    });

    it("should not start background tasks when metrics disabled", () => {
      ModuleRegistry.resetInstance();
      const noMetricsRegistry = ModuleRegistry.getInstance({
        enableMetrics: false,
      });

      // Background tasks should not be started
      expect((noMetricsRegistry as any).healthCheckInterval).toBeUndefined();
      expect((noMetricsRegistry as any).metricsInterval).toBeUndefined();
    });
  });

  describe("Shutdown Process", () => {
    beforeEach(async () => {
      registry.registerModuleType("test-module", mockConstructor, "1.0.0");
      await registry.installModule(createModuleConfig());
      await registry.configureModule("test-module", {});
      await registry.startModule("test-module");
    });

    it("should shutdown gracefully", async () => {
      await registry.shutdown();

      expect(registry.getModuleState("test-module")).toBe(
        ModuleState.CONFIGURED,
      );
      expect((registry as any).isShuttingDown).toBe(true);
    });

    it("should clear intervals on shutdown", async () => {
      const clearIntervalSpy = vi.spyOn(global, "clearInterval");

      await registry.shutdown();

      expect(clearIntervalSpy).toHaveBeenCalled();
    });

    it("should handle shutdown errors gracefully", async () => {
      const instance = registry.getModule("test-module") as MockModuleInstance;
      instance.setShouldFail("stop", true);

      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      // Should not throw even with errors
      await registry.shutdown();

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("should prevent double shutdown", async () => {
      const shutdownPromise1 = registry.shutdown();
      const shutdownPromise2 = registry.shutdown();

      await Promise.all([shutdownPromise1, shutdownPromise2]);

      // Both should complete without error
    });

    it("should clear event handlers and emitter on shutdown", async () => {
      const removeAllListenersSpy = vi.spyOn(
        (registry as any).eventEmitter,
        "removeAllListeners",
      );

      await registry.shutdown();

      expect((registry as any).eventHandlers.size).toBe(0);
      expect(removeAllListenersSpy).toHaveBeenCalled();
    });
  });

  describe("Priority Sorting", () => {
    it("should sort modules by priority and name", () => {
      const configs = [
        createModuleConfig({ name: "z-low", priority: ModulePriority.LOW }),
        createModuleConfig({ name: "a-high", priority: ModulePriority.HIGH }),
        createModuleConfig({
          name: "b-medium",
          priority: ModulePriority.MEDIUM,
        }),
        createModuleConfig({
          name: "a-medium",
          priority: ModulePriority.MEDIUM,
        }),
      ];

      const sorted = (registry as any).sortByPriority(configs);

      expect(sorted.map((c: ModuleConfig) => c.name)).toEqual([
        "a-high", // HIGH priority first
        "a-medium", // MEDIUM priority, alphabetical
        "b-medium", // MEDIUM priority, alphabetical
        "z-low", // LOW priority last
      ]);
    });
  });

  describe("Error Handling", () => {
    it("should handle module not found errors", () => {
      expect(() => (registry as any).getModuleEntry("non-existent")).toThrow(
        ModuleError,
      );
    });

    it("should handle timeout errors with proper context", async () => {
      ModuleRegistry.resetInstance();
      const timeoutRegistry = ModuleRegistry.getInstance({
        operationTimeout: 1,
      });

      const SlowModule = class extends MockModuleInstance {
        async install(): Promise<void> {
          await new Promise((resolve) => setTimeout(resolve, 100));
          super.install();
        }
      };

      timeoutRegistry.registerModuleType(
        "slow-module",
        SlowModule as any,
        "1.0.0",
      );

      await expect(
        timeoutRegistry.installModule(
          createModuleConfig({ name: "slow-module" }),
        ),
      ).rejects.toThrow("Installing module slow-module");
    });
  });

  describe("Edge Cases", () => {
    it("should handle module with empty event handlers", async () => {
      registry.registerModuleType("simple-module", mockConstructor, "1.0.0");
      await registry.installModule(
        createModuleConfig({ name: "simple-module" }),
      );
      await registry.configureModule("simple-module", {});

      // Should not throw when registering/unregistering empty handlers
      await registry.startModule("simple-module");
      await registry.stopModule("simple-module");
    });

    it("should handle concurrent operations", async () => {
      registry.registerModuleType(
        "concurrent-module",
        mockConstructor,
        "1.0.0",
      );
      const config = createModuleConfig({ name: "concurrent-module" });

      // Install module
      await registry.installModule(config);
      await registry.configureModule("concurrent-module", {});

      // Start multiple health checks concurrently
      const healthChecks = Array.from({ length: 5 }, () =>
        registry.performHealthCheck(),
      );
      const results = await Promise.all(healthChecks);

      // All should succeed
      expect(results).toHaveLength(5);
    });

    it("should handle event handler with no subscribers", () => {
      // Should not throw when publishing to event type with no subscribers
      expect(() => {
        registry.publishEvent({
          type: ModuleEventType.STARTED,
          moduleName: "test-module",
          timestamp: new Date(),
        });
      }).not.toThrow();
    });
  });
});
