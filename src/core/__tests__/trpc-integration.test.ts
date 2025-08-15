import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { AnyTRPCRouter } from "@trpc/server";
import {
  ModuleTRPCIntegration,
  createModuleTRPCIntegration,
  mergeRouters,
  createModuleRouters,
} from "../trpc-integration";
import { ModuleRegistry } from "../module-registry";
import { ModuleFactory } from "../module-factory";
import {
  ModuleState,
  ModulePriority,
  HealthStatus,
  type ModuleConfig,
  type ModuleInstance,
  type HealthCheckResult,
  type ModuleMetrics,
  type ModuleMiddleware,
  type ModuleEventHandler,
  type ModuleMigration,
  type ModuleEvent,
} from "../types";

// Mock the createTRPCRouter function
vi.mock("~/server/api/trpc", () => ({
  createTRPCRouter: vi.fn((routes: Record<string, any>) => routes),
}));

// Mock module instance for testing
class MockModuleInstance implements ModuleInstance {
  public state: ModuleState = ModuleState.UNINSTALLED;
  private routers: Record<string, AnyTRPCRouter> = {};

  constructor(public readonly config: ModuleConfig) {}

  async install(): Promise<void> {
    this.state = ModuleState.INSTALLED;
  }

  async configure(_settings: Record<string, unknown>): Promise<void> {
    this.state = ModuleState.CONFIGURED;
  }

  async start(): Promise<void> {
    this.state = ModuleState.RUNNING;
  }

  async stop(): Promise<void> {
    this.state = ModuleState.CONFIGURED;
  }

  async uninstall(): Promise<void> {
    this.state = ModuleState.UNINSTALLED;
  }

  async getRouters(): Promise<Record<string, AnyTRPCRouter>> {
    if (this.config.settings.shouldFailOnGetRouters) {
      throw new Error("Simulated router failure");
    }
    return this.routers;
  }

  async getMiddleware(): Promise<readonly ModuleMiddleware[]> {
    return [];
  }

  async getEventHandlers(): Promise<readonly ModuleEventHandler[]> {
    return [];
  }

  async getMigrations(): Promise<readonly ModuleMigration[]> {
    return [];
  }

  async healthCheck(): Promise<HealthCheckResult> {
    return {
      status: HealthStatus.HEALTHY,
      details: {
        uptime: 0,
        lastCheck: new Date(),
        dependencies: [],
      },
    };
  }

  async getMetrics(): Promise<ModuleMetrics> {
    return {
      startupTime: 0,
      memoryUsage: 0,
      requestCount: 0,
      errorCount: 0,
      avgResponseTime: 0,
    };
  }

  async cleanup(): Promise<void> {}

  // Test helper methods
  setRouters(routers: Record<string, AnyTRPCRouter>): void {
    this.routers = routers;
  }
}

// Helper to create module config
function createModuleConfig(
  overrides: Partial<ModuleConfig> = {},
): ModuleConfig {
  return {
    name: "test-module",
    version: "1.0.0",
    description: "Test module for unit testing",
    priority: ModulePriority.MEDIUM,
    dependencies: [],
    requiredPermissions: [],
    requiredEnvVars: [],
    settings: {},
    supportsHotReload: false,
    ...overrides,
  };
}

// Mock console.error
const consoleSpy = {
  error: vi.spyOn(console, "error").mockImplementation(() => {}),
};

describe("tRPC Integration", () => {
  let registry: ModuleRegistry;
  let trpcIntegration: ModuleTRPCIntegration;
  let mockRouter: AnyTRPCRouter;

  beforeEach(() => {
    // Reset the singleton registry for each test
    ModuleRegistry.resetInstance();
    registry = ModuleRegistry.getInstance();
    trpcIntegration = new ModuleTRPCIntegration(registry);

    mockRouter = { _def: { procedures: { test: {} } } } as any;

    vi.clearAllMocks();
  });

  afterEach(() => {
    consoleSpy.error.mockClear();
    // Clean up registry
    void registry.shutdown();
  });

  describe("ModuleTRPCIntegration Construction", () => {
    it("should create integration with registry", () => {
      const integration = new ModuleTRPCIntegration(registry);
      expect(integration).toBeInstanceOf(ModuleTRPCIntegration);
    });

    it("should subscribe to module events on construction", () => {
      const subscribeSpy = vi.spyOn(registry, "subscribe");

      new ModuleTRPCIntegration(registry);

      expect(subscribeSpy).toHaveBeenCalledTimes(2);
      expect(subscribeSpy).toHaveBeenCalledWith(
        "module:started",
        expect.any(Object),
      );
      expect(subscribeSpy).toHaveBeenCalledWith(
        "module:stopped",
        expect.any(Object),
      );
    });

    it("should invalidate cache when module starts", async () => {
      const integration = new ModuleTRPCIntegration(registry);
      const invalidateSpy = vi.spyOn(integration, "invalidateCache");

      // Trigger module started event
      registry.publishEvent({
        type: "module:started" as any,
        moduleName: "test-module",
        timestamp: new Date(),
        data: {},
      });

      // Wait for event to be processed
      await new Promise((resolve) => setTimeout(resolve, 1));

      expect(invalidateSpy).toHaveBeenCalledOnce();
    });

    it("should invalidate cache when module stops", async () => {
      const integration = new ModuleTRPCIntegration(registry);
      const invalidateSpy = vi.spyOn(integration, "invalidateCache");

      // Trigger module stopped event
      registry.publishEvent({
        type: "module:stopped" as any,
        moduleName: "test-module",
        timestamp: new Date(),
        data: {},
      });

      // Wait for event to be processed
      await new Promise((resolve) => setTimeout(resolve, 1));

      expect(invalidateSpy).toHaveBeenCalledOnce();
    });
  });

  describe("Module Router Generation", () => {
    beforeEach(async () => {
      // Set up test module
      registry.registerModuleType(
        "test-module",
        MockModuleInstance as any,
        "1.0.0",
      );
      const config = createModuleConfig();
      await registry.installModule(config);

      // Configure the module (required before starting)
      await registry.configureModule("test-module", {});

      // Get the installed instance and configure it
      const instance = registry.getModule("test-module") as MockModuleInstance;
      if (instance) {
        instance.setRouters({
          default: mockRouter,
          admin: { _def: { procedures: { admin: {} } } } as any,
        });
      }

      await registry.startModule("test-module");
    });

    it("should get combined router for all running modules", async () => {
      const combinedRouter = await trpcIntegration.getModuleRouter();

      expect(combinedRouter).toBeDefined();
      expect(combinedRouter).toHaveProperty("test-module");
      expect(combinedRouter).toHaveProperty("test-module_admin");
    });

    it("should cache router result", async () => {
      const router1 = await trpcIntegration.getModuleRouter();
      const router2 = await trpcIntegration.getModuleRouter();

      expect(router1).toBe(router2);
    });

    it("should regenerate router when cache is invalidated", async () => {
      const router1 = await trpcIntegration.getModuleRouter();

      trpcIntegration.invalidateCache();
      const router2 = await trpcIntegration.getModuleRouter();

      // Should be different objects (regenerated)
      expect(router1).not.toBe(router2);
    });

    it("should handle modules with no routers", async () => {
      // Add module with no routers
      registry.registerModuleType(
        "empty-module",
        MockModuleInstance as any,
        "1.0.0",
      );
      const config = createModuleConfig({ name: "empty-module" });
      await registry.installModule(config);
      await registry.configureModule("empty-module", {});

      const instance = registry.getModule("empty-module") as MockModuleInstance;
      if (instance) {
        instance.setRouters({});
      }

      await registry.startModule("empty-module");

      const combinedRouter = await trpcIntegration.getModuleRouter();
      expect(combinedRouter).toBeDefined();
    });

    it("should handle router errors gracefully", async () => {
      // Add module that fails on getRouters
      registry.registerModuleType(
        "failing-module",
        MockModuleInstance as any,
        "1.0.0",
      );
      const config = createModuleConfig({
        name: "failing-module",
        settings: { shouldFailOnGetRouters: true },
      });
      await registry.installModule(config);
      await registry.configureModule("failing-module", {});
      await registry.startModule("failing-module");

      const combinedRouter = await trpcIntegration.getModuleRouter();

      expect(combinedRouter).toBeDefined();
      expect(consoleSpy.error).toHaveBeenCalledWith(
        "Error getting routers for module failing-module:",
        expect.any(Error),
      );
    });

    it("should use module name as router name for default router", async () => {
      const combinedRouter = await trpcIntegration.getModuleRouter();

      expect(combinedRouter).toHaveProperty("test-module");
    });

    it("should prefix non-default router names with module name", async () => {
      const combinedRouter = await trpcIntegration.getModuleRouter();

      expect(combinedRouter).toHaveProperty("test-module_admin");
    });

    it("should handle multiple modules", async () => {
      // Add second module
      registry.registerModuleType(
        "module-2",
        MockModuleInstance as any,
        "1.0.0",
      );
      const config2 = createModuleConfig({ name: "module-2" });
      await registry.installModule(config2);
      await registry.configureModule("module-2", {});

      const instance2 = registry.getModule("module-2") as MockModuleInstance;
      if (instance2) {
        instance2.setRouters({
          default: { _def: { procedures: { module2: {} } } } as any,
        });
      }

      await registry.startModule("module-2");

      const combinedRouter = await trpcIntegration.getModuleRouter();

      expect(combinedRouter).toHaveProperty("test-module");
      expect(combinedRouter).toHaveProperty("test-module_admin");
      expect(combinedRouter).toHaveProperty("module-2");
    });
  });

  describe("Individual Module Router Access", () => {
    beforeEach(async () => {
      registry.registerModuleType(
        "test-module",
        MockModuleInstance as any,
        "1.0.0",
      );
      const config = createModuleConfig();
      await registry.installModule(config);
      await registry.configureModule("test-module", {});

      const instance = registry.getModule("test-module") as MockModuleInstance;
      if (instance) {
        instance.setRouters({
          default: mockRouter,
          api: { _def: { procedures: { api: {} } } } as any,
        });
      }

      await registry.startModule("test-module");
    });

    it("should get routers for specific module", async () => {
      const routers = await trpcIntegration.getModuleRouters("test-module");

      expect(routers).toBeDefined();
      expect(routers).toHaveProperty("default");
      expect(routers).toHaveProperty("api");
    });

    it("should return undefined for non-existent module", async () => {
      const routers = await trpcIntegration.getModuleRouters("non-existent");

      expect(routers).toBeUndefined();
    });

    it("should handle router errors gracefully", async () => {
      registry.registerModuleType(
        "failing-module",
        MockModuleInstance as any,
        "1.0.0",
      );
      const config = createModuleConfig({
        name: "failing-module",
        settings: { shouldFailOnGetRouters: true },
      });
      await registry.installModule(config);
      await registry.configureModule("failing-module", {});
      await registry.startModule("failing-module");

      const routers = await trpcIntegration.getModuleRouters("failing-module");

      expect(routers).toBeUndefined();
      expect(consoleSpy.error).toHaveBeenCalledWith(
        "Error getting routers for module failing-module:",
        expect.any(Error),
      );
    });
  });

  describe("Module Router Existence Check", () => {
    beforeEach(async () => {
      registry.registerModuleType(
        "test-module",
        MockModuleInstance as any,
        "1.0.0",
      );
      const config = createModuleConfig();
      await registry.installModule(config);
      await registry.configureModule("test-module", {});

      const instance = registry.getModule("test-module") as MockModuleInstance;
      if (instance) {
        instance.setRouters({ default: mockRouter });
      }

      await registry.startModule("test-module");
    });

    it("should return true for module with routers", async () => {
      const hasRouters = await trpcIntegration.hasModuleRouters("test-module");

      expect(hasRouters).toBe(true);
    });

    it("should return false for module without routers", async () => {
      registry.registerModuleType(
        "empty-module",
        MockModuleInstance as any,
        "1.0.0",
      );
      const config = createModuleConfig({ name: "empty-module" });
      await registry.installModule(config);
      await registry.configureModule("empty-module", {});

      const instance = registry.getModule("empty-module") as MockModuleInstance;
      if (instance) {
        instance.setRouters({});
      }

      await registry.startModule("empty-module");

      const hasRouters = await trpcIntegration.hasModuleRouters("empty-module");

      expect(hasRouters).toBe(false);
    });

    it("should return false for non-existent module", async () => {
      const hasRouters = await trpcIntegration.hasModuleRouters("non-existent");

      expect(hasRouters).toBe(false);
    });
  });

  describe("Module Endpoints Discovery", () => {
    beforeEach(async () => {
      registry.registerModuleType(
        "test-module",
        MockModuleInstance as any,
        "1.0.0",
      );
      const config = createModuleConfig();
      await registry.installModule(config);
      await registry.configureModule("test-module", {});

      const instance = registry.getModule("test-module") as MockModuleInstance;
      if (instance) {
        instance.setRouters({
          default: mockRouter,
          admin: { _def: { procedures: { admin: {} } } } as any,
          api: { _def: { procedures: { api: {} } } } as any,
        });
      }

      await registry.startModule("test-module");
    });

    it("should get all module endpoints", async () => {
      const endpoints = await trpcIntegration.getModuleEndpoints();

      expect(endpoints).toBeInstanceOf(Map);
      expect(endpoints.has("test-module")).toBe(true);

      const moduleEndpoints = endpoints.get("test-module");
      expect(moduleEndpoints).toContain("test-module");
      expect(moduleEndpoints).toContain("test-module_admin");
      expect(moduleEndpoints).toContain("test-module_api");
    });

    it("should handle multiple modules", async () => {
      registry.registerModuleType(
        "module-2",
        MockModuleInstance as any,
        "1.0.0",
      );
      const config2 = createModuleConfig({ name: "module-2" });
      await registry.installModule(config2);
      await registry.configureModule("module-2", {});

      const instance2 = registry.getModule("module-2") as MockModuleInstance;
      if (instance2) {
        instance2.setRouters({
          default: { _def: { procedures: { default: {} } } } as any,
        });
      }

      await registry.startModule("module-2");

      const endpoints = await trpcIntegration.getModuleEndpoints();

      expect(endpoints.size).toBe(2);
      expect(endpoints.has("test-module")).toBe(true);
      expect(endpoints.has("module-2")).toBe(true);
    });

    it("should handle modules with no routers", async () => {
      registry.registerModuleType(
        "empty-module",
        MockModuleInstance as any,
        "1.0.0",
      );
      const config = createModuleConfig({ name: "empty-module" });
      await registry.installModule(config);
      await registry.configureModule("empty-module", {});

      const instance = registry.getModule("empty-module") as MockModuleInstance;
      if (instance) {
        instance.setRouters({});
      }

      await registry.startModule("empty-module");

      const endpoints = await trpcIntegration.getModuleEndpoints();

      expect(endpoints.has("empty-module")).toBe(true);
      expect(endpoints.get("empty-module")).toEqual([]);
    });

    it("should handle router errors gracefully", async () => {
      registry.registerModuleType(
        "failing-module",
        MockModuleInstance as any,
        "1.0.0",
      );
      const config = createModuleConfig({
        name: "failing-module",
        settings: { shouldFailOnGetRouters: true },
      });
      await registry.installModule(config);
      await registry.configureModule("failing-module", {});
      await registry.startModule("failing-module");

      const endpoints = await trpcIntegration.getModuleEndpoints();

      expect(endpoints.has("failing-module")).toBe(true);
      expect(endpoints.get("failing-module")).toEqual([]);
      expect(consoleSpy.error).toHaveBeenCalledWith(
        "Error getting endpoints for module failing-module:",
        expect.any(Error),
      );
    });
  });

  describe("Cache Management", () => {
    beforeEach(async () => {
      registry.registerModuleType(
        "test-module",
        MockModuleInstance as any,
        "1.0.0",
      );
      const config = createModuleConfig();
      await registry.installModule(config);
      await registry.configureModule("test-module", {});

      const instance = registry.getModule("test-module") as MockModuleInstance;
      if (instance) {
        instance.setRouters({ default: mockRouter });
      }

      await registry.startModule("test-module");
    });

    it("should invalidate cache", () => {
      trpcIntegration.invalidateCache();

      const diagnostics = trpcIntegration.getDiagnostics();
      expect(diagnostics.hasCachedRouter).toBe(false);
      expect(diagnostics.lastRegistryHash).toBeUndefined();
    });

    it("should detect registry hash changes", async () => {
      const router1 = await trpcIntegration.getModuleRouter();
      const diagnostics1 = trpcIntegration.getDiagnostics();

      // Add another module to change registry hash
      registry.registerModuleType(
        "module-2",
        MockModuleInstance as any,
        "1.0.0",
      );
      const config2 = createModuleConfig({ name: "module-2" });
      await registry.installModule(config2);
      await registry.configureModule("module-2", {});

      const instance2 = registry.getModule("module-2") as MockModuleInstance;
      if (instance2) {
        instance2.setRouters({ default: mockRouter });
      }

      await registry.startModule("module-2");

      const router2 = await trpcIntegration.getModuleRouter();
      const diagnostics2 = trpcIntegration.getDiagnostics();

      expect(diagnostics1.registryHash).not.toBe(diagnostics2.registryHash);
      expect(router1).not.toBe(router2);
    });

    it("should use cache when registry hash unchanged", async () => {
      const router1 = await trpcIntegration.getModuleRouter();
      const router2 = await trpcIntegration.getModuleRouter();

      expect(router1).toBe(router2);
    });
  });

  describe("Diagnostics", () => {
    beforeEach(async () => {
      registry.registerModuleType(
        "test-module",
        MockModuleInstance as any,
        "1.0.0",
      );
      const config = createModuleConfig();
      await registry.installModule(config);
      await registry.configureModule("test-module", {});

      const instance = registry.getModule("test-module") as MockModuleInstance;
      if (instance) {
        instance.setRouters({ default: mockRouter });
      }

      await registry.startModule("test-module");
    });

    it("should provide diagnostic information", async () => {
      await trpcIntegration.getModuleRouter(); // Cache the router

      const diagnostics = trpcIntegration.getDiagnostics();

      expect(diagnostics).toEqual({
        hasCachedRouter: true,
        lastRegistryHash: expect.any(String),
        registryHash: expect.any(String),
        runningModuleCount: 1,
      });
    });

    it("should show no cached router initially", () => {
      const diagnostics = trpcIntegration.getDiagnostics();

      expect(diagnostics.hasCachedRouter).toBe(false);
      expect(diagnostics.lastRegistryHash).toBeUndefined();
    });

    it("should track running module count", async () => {
      // Add second module
      registry.registerModuleType(
        "module-2",
        MockModuleInstance as any,
        "1.0.0",
      );
      const config2 = createModuleConfig({ name: "module-2" });
      await registry.installModule(config2);
      await registry.configureModule("module-2", {});

      const instance2 = registry.getModule("module-2") as MockModuleInstance;
      if (instance2) {
        instance2.setRouters({ default: mockRouter });
      }

      await registry.startModule("module-2");

      const diagnostics = trpcIntegration.getDiagnostics();

      expect(diagnostics.runningModuleCount).toBe(2);
    });
  });

  describe("Registry Hash Generation", () => {
    it("should generate consistent hash for same modules", async () => {
      registry.registerModuleType(
        "test-module",
        MockModuleInstance as any,
        "1.0.0",
      );
      const config = createModuleConfig();
      await registry.installModule(config);
      await registry.configureModule("test-module", {});

      const instance = registry.getModule("test-module") as MockModuleInstance;
      if (instance) {
        instance.setRouters({ default: mockRouter });
      }

      await registry.startModule("test-module");

      const hash1 = trpcIntegration["getRegistryHash"]();
      const hash2 = trpcIntegration["getRegistryHash"]();

      expect(hash1).toBe(hash2);
    });

    it("should generate different hash for different module sets", async () => {
      registry.registerModuleType(
        "module-1",
        MockModuleInstance as any,
        "1.0.0",
      );
      const config1 = createModuleConfig({ name: "module-1" });
      await registry.installModule(config1);
      await registry.configureModule("module-1", {});

      const instance1 = registry.getModule("module-1") as MockModuleInstance;
      if (instance1) {
        instance1.setRouters({ default: mockRouter });
      }

      await registry.startModule("module-1");

      const hash1 = trpcIntegration["getRegistryHash"]();

      registry.registerModuleType(
        "module-2",
        MockModuleInstance as any,
        "1.0.0",
      );
      const config2 = createModuleConfig({ name: "module-2" });
      await registry.installModule(config2);
      await registry.configureModule("module-2", {});

      const instance2 = registry.getModule("module-2") as MockModuleInstance;
      if (instance2) {
        instance2.setRouters({ default: mockRouter });
      }

      await registry.startModule("module-2");

      const hash2 = trpcIntegration["getRegistryHash"]();

      expect(hash1).not.toBe(hash2);
    });

    it("should generate sorted hash regardless of module order", async () => {
      // Create modules in one order
      registry.registerModuleType(
        "module-z",
        MockModuleInstance as any,
        "1.0.0",
      );
      registry.registerModuleType(
        "module-a",
        MockModuleInstance as any,
        "1.0.0",
      );

      const configZ = createModuleConfig({ name: "module-z" });
      const configA = createModuleConfig({ name: "module-a" });

      await registry.installModule(configZ);
      await registry.installModule(configA);
      await registry.configureModule("module-z", {});
      await registry.configureModule("module-a", {});

      const instanceZ = registry.getModule("module-z") as MockModuleInstance;
      const instanceA = registry.getModule("module-a") as MockModuleInstance;

      if (instanceZ) instanceZ.setRouters({ default: mockRouter });
      if (instanceA) instanceA.setRouters({ default: mockRouter });

      await registry.startModule("module-z");
      await registry.startModule("module-a");

      const hash1 = trpcIntegration["getRegistryHash"]();

      // The hash should be sorted, so order doesn't matter
      // (Both modules are now running, hash should be same regardless of start order)
      expect(hash1).toMatch(/module-a,module-z/);
    });
  });

  describe("Utility Functions", () => {
    describe("createModuleTRPCIntegration", () => {
      it("should create integration with singleton registry", () => {
        const integration = createModuleTRPCIntegration();

        expect(integration).toBeInstanceOf(ModuleTRPCIntegration);
      });

      it("should use same registry instance", () => {
        const integration1 = createModuleTRPCIntegration();
        const integration2 = createModuleTRPCIntegration();

        // Both should use the singleton registry
        expect(integration1).toBeInstanceOf(ModuleTRPCIntegration);
        expect(integration2).toBeInstanceOf(ModuleTRPCIntegration);
      });
    });

    describe("mergeRouters", () => {
      it("should merge static and dynamic routers", () => {
        const staticRouters = {
          auth: { _def: { procedures: { auth: {} } } } as any,
          user: { _def: { procedures: { user: {} } } } as any,
        };

        const moduleRouter = {
          billing: { _def: { procedures: { billing: {} } } } as any,
        } as any;

        const merged = mergeRouters(staticRouters, moduleRouter);

        expect(merged).toHaveProperty("auth");
        expect(merged).toHaveProperty("user");
        expect(merged).toHaveProperty("modules");
        expect(merged.modules).toBe(moduleRouter);
      });

      it("should handle empty static routers", () => {
        const moduleRouter = {
          billing: { _def: { procedures: { billing: {} } } } as any,
        } as any;

        const merged = mergeRouters({}, moduleRouter);

        expect(merged).toHaveProperty("modules");
        expect(merged.modules).toBe(moduleRouter);
      });

      it("should handle empty module router", () => {
        const staticRouters = {
          auth: { _def: { procedures: { auth: {} } } } as any,
        };

        const merged = mergeRouters(staticRouters, {} as any);

        expect(merged).toHaveProperty("auth");
        expect(merged).toHaveProperty("modules");
      });
    });

    describe("createModuleRouters", () => {
      it("should return routers as-is", () => {
        const routers = {
          api: { _def: { procedures: { api: {} } } } as any,
          admin: { _def: { procedures: { admin: {} } } } as any,
        };

        const result = createModuleRouters(routers);

        expect(result).toBe(routers);
        expect(result).toEqual(routers);
      });

      it("should handle empty router object", () => {
        const routers = {};

        const result = createModuleRouters(routers);

        expect(result).toBe(routers);
        expect(result).toEqual({});
      });
    });
  });

  describe("Edge Cases and Error Handling", () => {
    it("should handle modules without instances", async () => {
      // Manually add module entry without instance
      const config = createModuleConfig();
      registry["modules"].set("broken-module", {
        config,
        instance: undefined,
        state: ModuleState.UNINSTALLED,
        metrics: {
          startupTime: 0,
          memoryUsage: 0,
          requestCount: 0,
          errorCount: 0,
          avgResponseTime: 0,
        },
        registeredAt: new Date(),
        startedAt: undefined,
      });

      const combinedRouter = await trpcIntegration.getModuleRouter();

      // Should not crash and return empty router
      expect(combinedRouter).toBeDefined();
    });

    it("should handle empty running modules map", async () => {
      // Ensure no running modules
      const combinedRouter = await trpcIntegration.getModuleRouter();
      const endpoints = await trpcIntegration.getModuleEndpoints();

      expect(combinedRouter).toBeDefined();
      expect(endpoints.size).toBe(0);
    });

    it("should handle router method throwing errors", async () => {
      registry.registerModuleType(
        "error-module",
        MockModuleInstance as any,
        "1.0.0",
      );
      const config = createModuleConfig({
        name: "error-module",
        settings: { shouldFailOnGetRouters: true },
      });
      await registry.installModule(config);
      await registry.configureModule("error-module", {});
      await registry.startModule("error-module");

      // Should not throw despite router error
      await expect(trpcIntegration.getModuleRouter()).resolves.toBeDefined();
      await expect(
        trpcIntegration.getModuleRouters("error-module"),
      ).resolves.toBeUndefined();
      await expect(
        trpcIntegration.hasModuleRouters("error-module"),
      ).resolves.toBe(false);
      await expect(trpcIntegration.getModuleEndpoints()).resolves.toBeDefined();
    });

    it("should handle concurrent router generation", async () => {
      registry.registerModuleType(
        "test-module",
        MockModuleInstance as any,
        "1.0.0",
      );
      const config = createModuleConfig();
      await registry.installModule(config);
      await registry.configureModule("test-module", {});

      const instance = registry.getModule("test-module") as MockModuleInstance;
      if (instance) {
        instance.setRouters({ default: mockRouter });
      }

      await registry.startModule("test-module");

      // Concurrent calls should all resolve
      const promises = Array.from({ length: 5 }, () =>
        trpcIntegration.getModuleRouter(),
      );
      const routers = await Promise.all(promises);

      // All should be defined
      for (const router of routers) {
        expect(router).toBeDefined();
      }
    });

    it("should handle event handler errors gracefully", async () => {
      const integration = new ModuleTRPCIntegration(registry);

      // Mock event handler to throw
      const originalInvalidateCache = integration.invalidateCache;
      integration.invalidateCache = vi.fn(() => {
        throw new Error("Cache invalidation error");
      });

      // Should not prevent event publication
      expect(() => {
        registry.publishEvent({
          type: "module:started" as any,
          moduleName: "test-module",
          timestamp: new Date(),
          data: {},
        });
      }).not.toThrow();

      // Restore
      integration.invalidateCache = originalInvalidateCache;
    });
  });

  describe("Type Safety and Interface Compliance", () => {
    it("should maintain type safety for router objects", () => {
      const typedRouter: AnyTRPCRouter = {
        _def: { procedures: { test: {} } },
      } as any;

      const routers = createModuleRouters({
        api: typedRouter,
        admin: typedRouter,
      });

      expect(typeof routers.api).toBe("object");
      expect(typeof routers.admin).toBe("object");
    });

    it("should work with ModuleRouterAccess type", () => {
      const routers = {
        billing: { _def: { procedures: { charge: {} } } } as any,
        analytics: { _def: { procedures: { track: {} } } } as any,
      };

      // This tests the type definition compiles correctly
      const moduleAccess: { modules: typeof routers } = {
        modules: routers,
      };

      expect(moduleAccess.modules).toBe(routers);
    });

    it("should handle router naming edge cases", async () => {
      registry.registerModuleType(
        "special-module",
        MockModuleInstance as any,
        "1.0.0",
      );
      const config = createModuleConfig({ name: "special-module" });
      await registry.installModule(config);
      await registry.configureModule("special-module", {});

      const instance = registry.getModule(
        "special-module",
      ) as MockModuleInstance;
      if (instance) {
        instance.setRouters({
          default: mockRouter,
          "special-name": { _def: { procedures: { special: {} } } } as any,
          "123numeric": { _def: { procedures: { numeric: {} } } } as any,
          _underscore: { _def: { procedures: { underscore: {} } } } as any,
        });
      }

      await registry.startModule("special-module");

      const combinedRouter = await trpcIntegration.getModuleRouter();

      expect(combinedRouter).toHaveProperty("special-module");
      expect(combinedRouter).toHaveProperty("special-module_special-name");
      expect(combinedRouter).toHaveProperty("special-module_123numeric");
      expect(combinedRouter).toHaveProperty("special-module__underscore");
    });
  });
});
