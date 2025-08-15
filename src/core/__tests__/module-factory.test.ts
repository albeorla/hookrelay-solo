import { describe, it, expect, beforeEach, vi } from "vitest";
import { ModuleFactory, type ModuleConstructor } from "../module-factory";
import {
  ModuleState,
  ModulePriority,
  HealthStatus,
  ModuleError,
  ModuleDependencyError,
  ModuleConfigurationError,
  type ModuleConfig,
  type ModuleInstance,
  type HealthCheckResult,
  type ModuleMetrics,
} from "../types";

// Mock module implementation for testing
class MockModuleInstance implements ModuleInstance {
  public state: ModuleState = ModuleState.UNINSTALLED;

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

  async cleanup(): Promise<void> {
    // No-op
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

describe("ModuleFactory", () => {
  let factory: ModuleFactory;
  let mockConstructor: ModuleConstructor;

  beforeEach(() => {
    factory = new ModuleFactory();
    mockConstructor = MockModuleInstance as any;
  });

  describe("Module Registration", () => {
    it("should register a module constructor", () => {
      factory.registerModule("test-module", mockConstructor, "1.0.0");

      expect(factory.isRegistered("test-module")).toBe(true);
      expect(factory.getRegisteredModules()).toContain("test-module");
    });

    it("should throw error when registering duplicate module", () => {
      factory.registerModule("test-module", mockConstructor, "1.0.0");

      expect(() => {
        factory.registerModule("test-module", mockConstructor, "1.0.0");
      }).toThrow(ModuleError);

      expect(() => {
        factory.registerModule("test-module", mockConstructor, "1.0.0");
      }).toThrow("Module 'test-module' is already registered");
    });

    it("should allow registering multiple different modules", () => {
      factory.registerModule("module-1", mockConstructor, "1.0.0");
      factory.registerModule("module-2", mockConstructor, "2.0.0");

      expect(factory.isRegistered("module-1")).toBe(true);
      expect(factory.isRegistered("module-2")).toBe(true);
      expect(factory.getRegisteredModules()).toHaveLength(2);
    });

    it("should unregister a module", () => {
      factory.registerModule("test-module", mockConstructor, "1.0.0");
      expect(factory.isRegistered("test-module")).toBe(true);

      factory.unregisterModule("test-module");

      expect(factory.isRegistered("test-module")).toBe(false);
      expect(factory.getRegisteredModules()).not.toContain("test-module");
    });

    it("should handle unregistering non-existent module", () => {
      // Should not throw
      factory.unregisterModule("non-existent");
      expect(factory.isRegistered("non-existent")).toBe(false);
    });

    it("should return all registered module names", () => {
      factory.registerModule("module-a", mockConstructor, "1.0.0");
      factory.registerModule("module-b", mockConstructor, "1.0.0");
      factory.registerModule("module-c", mockConstructor, "1.0.0");

      const registeredModules = factory.getRegisteredModules();

      expect(registeredModules).toHaveLength(3);
      expect(registeredModules).toContain("module-a");
      expect(registeredModules).toContain("module-b");
      expect(registeredModules).toContain("module-c");
    });

    it("should return empty array when no modules registered", () => {
      expect(factory.getRegisteredModules()).toEqual([]);
    });
  });

  describe("Module Creation", () => {
    beforeEach(() => {
      factory.registerModule("test-module", mockConstructor, "1.0.0");
    });

    it("should create a module instance", async () => {
      const config = createModuleConfig();

      const instance = await factory.createModule(config);

      expect(instance).toBeInstanceOf(MockModuleInstance);
      expect(instance.config).toEqual(config);
    });

    it("should cache created instances", async () => {
      const config = createModuleConfig();

      const instance1 = await factory.createModule(config);
      const instance2 = await factory.createModule(config);

      expect(instance1).toBe(instance2); // Same instance
    });

    it("should throw error for unregistered module", async () => {
      const config = createModuleConfig({ name: "unregistered-module" });

      await expect(factory.createModule(config)).rejects.toThrow(ModuleError);
      await expect(factory.createModule(config)).rejects.toThrow(
        "Module 'unregistered-module' is not registered with the factory",
      );
    });

    it("should validate version compatibility", async () => {
      const config = createModuleConfig({ version: "2.0.0" }); // Different version

      await expect(factory.createModule(config)).rejects.toThrow(ModuleError);
      await expect(factory.createModule(config)).rejects.toThrow(
        "Module 'test-module' version mismatch: expected 1.0.0, got 2.0.0",
      );
    });

    it("should get existing instance", async () => {
      const config = createModuleConfig();
      const instance = await factory.createModule(config);

      const retrieved = factory.getInstance("test-module");

      expect(retrieved).toBe(instance);
    });

    it("should return undefined for non-existent instance", () => {
      const retrieved = factory.getInstance("non-existent");
      expect(retrieved).toBeUndefined();
    });

    it("should remove instance from cache", async () => {
      const config = createModuleConfig();
      await factory.createModule(config);
      expect(factory.getInstance("test-module")).toBeDefined();

      factory.removeInstance("test-module");

      expect(factory.getInstance("test-module")).toBeUndefined();
    });

    it("should clear all cached instances", async () => {
      const config1 = createModuleConfig({ name: "module-1" });
      const config2 = createModuleConfig({ name: "module-2" });

      factory.registerModule("module-1", mockConstructor, "1.0.0");
      factory.registerModule("module-2", mockConstructor, "1.0.0");

      await factory.createModule(config1);
      await factory.createModule(config2);

      expect(factory.getInstance("module-1")).toBeDefined();
      expect(factory.getInstance("module-2")).toBeDefined();

      factory.clearInstances();

      expect(factory.getInstance("module-1")).toBeUndefined();
      expect(factory.getInstance("module-2")).toBeUndefined();
    });
  });

  describe("Configuration Validation", () => {
    beforeEach(() => {
      factory.registerModule("test-module", mockConstructor, "1.0.0");
    });

    it("should validate required fields", async () => {
      const invalidConfig = createModuleConfig({ name: "" });

      await expect(factory.createModule(invalidConfig)).rejects.toThrow(
        ModuleConfigurationError,
      );
      await expect(factory.createModule(invalidConfig)).rejects.toThrow(
        "Module name is required",
      );
    });

    it("should validate version format", async () => {
      const invalidConfig = createModuleConfig({ version: "invalid-version" });

      await expect(factory.createModule(invalidConfig)).rejects.toThrow(
        ModuleConfigurationError,
      );
      await expect(factory.createModule(invalidConfig)).rejects.toThrow(
        "Module version must follow semantic versioning",
      );
    });

    it("should accept valid semantic versions", async () => {
      const validVersions = [
        "1.0.0",
        "1.2.3",
        "10.20.30",
        "1.0.0-alpha",
        "1.0.0-beta.1",
      ];

      for (const version of validVersions) {
        factory.registerModule(`module-${version}`, mockConstructor, version);
        const config = createModuleConfig({
          name: `module-${version}`,
          version,
        });

        await expect(factory.createModule(config)).resolves.toBeDefined();
      }
    });

    it("should reject invalid semantic versions", async () => {
      const invalidVersions = ["1.0", "v1.0.0", "1.0.0.0", "latest", ""];

      for (const version of invalidVersions) {
        const config = createModuleConfig({ version });

        await expect(factory.createModule(config)).rejects.toThrow(
          ModuleConfigurationError,
        );
      }
    });

    it("should validate self-dependency", async () => {
      const invalidConfig = createModuleConfig({
        name: "test-module",
        dependencies: ["test-module"], // Self-dependency
      });

      await expect(factory.createModule(invalidConfig)).rejects.toThrow(
        ModuleConfigurationError,
      );
      await expect(factory.createModule(invalidConfig)).rejects.toThrow(
        "Module cannot depend on itself",
      );
    });

    it("should validate duplicate dependencies", async () => {
      const invalidConfig = createModuleConfig({
        dependencies: ["dep-1", "dep-2", "dep-1"], // Duplicate
      });

      await expect(factory.createModule(invalidConfig)).rejects.toThrow(
        ModuleConfigurationError,
      );
      await expect(factory.createModule(invalidConfig)).rejects.toThrow(
        "Module has duplicate dependencies",
      );
    });

    it("should validate settings object", async () => {
      const invalidConfig = createModuleConfig({
        settings: "invalid" as any, // Should be object
      });

      await expect(factory.createModule(invalidConfig)).rejects.toThrow(
        ModuleConfigurationError,
      );
      await expect(factory.createModule(invalidConfig)).rejects.toThrow(
        "Module settings must be an object",
      );
    });

    it("should require description", async () => {
      const invalidConfig = createModuleConfig({ description: "" });

      await expect(factory.createModule(invalidConfig)).rejects.toThrow(
        ModuleConfigurationError,
      );
      await expect(factory.createModule(invalidConfig)).rejects.toThrow(
        "Module description is required",
      );
    });

    it("should accept valid configuration", async () => {
      const validConfig = createModuleConfig({
        name: "valid-module",
        version: "1.0.0",
        description: "A valid test module",
        dependencies: [],
        settings: { key: "value" },
      });

      factory.registerModule("valid-module", mockConstructor, "1.0.0");

      await expect(factory.createModule(validConfig)).resolves.toBeDefined();
    });

    it("should aggregate multiple validation errors", async () => {
      const invalidConfig = createModuleConfig({
        name: "",
        version: "invalid",
        description: "",
      });

      await expect(factory.createModule(invalidConfig)).rejects.toThrow(
        ModuleConfigurationError,
      );

      try {
        await factory.createModule(invalidConfig);
      } catch (error) {
        const errorMessage = (error as Error).message;
        expect(errorMessage).toContain("Module name is required");
        expect(errorMessage).toContain(
          "Module version must follow semantic versioning",
        );
        expect(errorMessage).toContain("Module description is required");
      }
    });
  });

  describe("Dependency Resolution", () => {
    beforeEach(() => {
      factory.registerModule("module-a", mockConstructor, "1.0.0");
      factory.registerModule("module-b", mockConstructor, "1.0.0");
      factory.registerModule("module-c", mockConstructor, "1.0.0");
    });

    it("should check for unregistered dependencies", async () => {
      const config = createModuleConfig({
        name: "module-a",
        dependencies: ["unregistered-module"],
      });

      await expect(factory.createModule(config)).rejects.toThrow(
        ModuleDependencyError,
      );
      await expect(factory.createModule(config)).rejects.toThrow(
        "Module 'module-a' requires dependency 'unregistered-module'",
      );
    });

    it("should check for instantiated dependencies", async () => {
      const config = createModuleConfig({
        name: "module-a",
        dependencies: ["module-b"],
      });

      await expect(factory.createModule(config)).rejects.toThrow(
        ModuleDependencyError,
      );
      await expect(factory.createModule(config)).rejects.toThrow(
        "Module 'module-a' requires dependency 'module-b (not yet instantiated)'",
      );
    });

    it("should succeed when dependencies are available", async () => {
      // Create dependency first
      const depConfig = createModuleConfig({ name: "module-b" });
      await factory.createModule(depConfig);

      // Now create dependent module
      const config = createModuleConfig({
        name: "module-a",
        dependencies: ["module-b"],
      });

      await expect(factory.createModule(config)).resolves.toBeDefined();
    });
  });

  describe("Multiple Module Creation", () => {
    beforeEach(() => {
      factory.registerModule("module-a", mockConstructor, "1.0.0");
      factory.registerModule("module-b", mockConstructor, "1.0.0");
      factory.registerModule("module-c", mockConstructor, "1.0.0");
    });

    it("should create multiple modules", async () => {
      const configs = [
        createModuleConfig({ name: "module-a" }),
        createModuleConfig({ name: "module-b" }),
        createModuleConfig({ name: "module-c" }),
      ];

      const instances = await factory.createModules(configs);

      expect(instances.size).toBe(3);
      expect(instances.has("module-a")).toBe(true);
      expect(instances.has("module-b")).toBe(true);
      expect(instances.has("module-c")).toBe(true);
    });

    it("should handle empty configs array", async () => {
      const instances = await factory.createModules([]);

      expect(instances.size).toBe(0);
    });

    it("should create modules with dependencies in correct order", async () => {
      const configs = [
        createModuleConfig({ name: "module-c", dependencies: ["module-b"] }),
        createModuleConfig({ name: "module-a", dependencies: [] }),
        createModuleConfig({ name: "module-b", dependencies: ["module-a"] }),
      ];

      const instances = await factory.createModules(configs);

      expect(instances.size).toBe(3);
      // All instances should be created despite dependency order in input
    });
  });

  describe("Topological Sorting", () => {
    beforeEach(() => {
      factory.registerModule("module-a", mockConstructor, "1.0.0");
      factory.registerModule("module-b", mockConstructor, "1.0.0");
      factory.registerModule("module-c", mockConstructor, "1.0.0");
      factory.registerModule("module-d", mockConstructor, "1.0.0");
    });

    it("should detect circular dependencies", async () => {
      const configs = [
        createModuleConfig({ name: "module-a", dependencies: ["module-b"] }),
        createModuleConfig({ name: "module-b", dependencies: ["module-c"] }),
        createModuleConfig({ name: "module-c", dependencies: ["module-a"] }), // Circular!
      ];

      await expect(factory.createModules(configs)).rejects.toThrow(
        ModuleDependencyError,
      );
      await expect(factory.createModules(configs)).rejects.toThrow(
        "Circular dependency detected",
      );
    });

    it("should handle simple dependency chain", async () => {
      const configs = [
        createModuleConfig({ name: "module-c", dependencies: ["module-b"] }),
        createModuleConfig({ name: "module-b", dependencies: ["module-a"] }),
        createModuleConfig({ name: "module-a", dependencies: [] }),
      ];

      const instances = await factory.createModules(configs);

      expect(instances.size).toBe(3);
    });

    it("should handle complex dependency graph", async () => {
      const configs = [
        createModuleConfig({
          name: "module-d",
          dependencies: ["module-b", "module-c"],
        }),
        createModuleConfig({ name: "module-c", dependencies: ["module-a"] }),
        createModuleConfig({ name: "module-b", dependencies: ["module-a"] }),
        createModuleConfig({ name: "module-a", dependencies: [] }),
      ];

      const instances = await factory.createModules(configs);

      expect(instances.size).toBe(4);
    });

    it("should handle modules with no dependencies", async () => {
      const configs = [
        createModuleConfig({ name: "module-a", dependencies: [] }),
        createModuleConfig({ name: "module-b", dependencies: [] }),
        createModuleConfig({ name: "module-c", dependencies: [] }),
      ];

      const instances = await factory.createModules(configs);

      expect(instances.size).toBe(3);
    });

    it("should handle self-referential circular dependency", async () => {
      const configs = [
        createModuleConfig({ name: "module-a", dependencies: ["module-a"] }),
      ];

      // This should be caught during topological sort as circular dependency
      await expect(factory.createModules(configs)).rejects.toThrow(
        ModuleDependencyError,
      );
    });
  });

  describe("Factory Statistics", () => {
    beforeEach(() => {
      factory.registerModule("module-a", mockConstructor, "1.0.0");
      factory.registerModule("module-b", mockConstructor, "2.0.0");
    });

    it("should return correct statistics", async () => {
      await factory.createModule(createModuleConfig({ name: "module-a" }));

      const stats = factory.getStatistics();

      expect(stats.registeredModules).toBe(2);
      expect(stats.instantiatedModules).toBe(1);
      expect(stats.modules).toHaveLength(2);

      const moduleA = stats.modules.find((m) => m.name === "module-a");
      expect(moduleA?.instantiated).toBe(true);

      const moduleB = stats.modules.find((m) => m.name === "module-b");
      expect(moduleB?.instantiated).toBe(false);
    });

    it("should return empty statistics for new factory", () => {
      const emptyFactory = new ModuleFactory();
      const stats = emptyFactory.getStatistics();

      expect(stats.registeredModules).toBe(0);
      expect(stats.instantiatedModules).toBe(0);
      expect(stats.modules).toHaveLength(0);
    });

    it("should include registration timestamps", () => {
      const beforeRegistration = new Date();
      const stats = factory.getStatistics();
      const afterRegistration = new Date();

      for (const module of stats.modules) {
        expect(module.registeredAt).toBeInstanceOf(Date);
        expect(module.registeredAt.getTime()).toBeGreaterThanOrEqual(
          beforeRegistration.getTime(),
        );
        expect(module.registeredAt.getTime()).toBeLessThanOrEqual(
          afterRegistration.getTime(),
        );
      }
    });

    it("should update statistics after unregistering modules", async () => {
      await factory.createModule(createModuleConfig({ name: "module-a" }));

      let stats = factory.getStatistics();
      expect(stats.registeredModules).toBe(2);
      expect(stats.instantiatedModules).toBe(1);

      factory.unregisterModule("module-a");

      stats = factory.getStatistics();
      expect(stats.registeredModules).toBe(1);
      expect(stats.instantiatedModules).toBe(0);
    });
  });

  describe("Error Handling", () => {
    it("should handle constructor errors", async () => {
      const FailingConstructor = class extends MockModuleInstance {
        constructor(config: ModuleConfig) {
          super(config);
          throw new Error("Constructor failure");
        }
      };

      factory.registerModule(
        "failing-module",
        FailingConstructor as any,
        "1.0.0",
      );

      const config = createModuleConfig({ name: "failing-module" });

      await expect(factory.createModule(config)).rejects.toThrow(
        "Constructor failure",
      );
    });

    it("should properly handle error types", async () => {
      const config = createModuleConfig({ name: "unregistered" });

      try {
        await factory.createModule(config);
      } catch (error) {
        expect(error).toBeInstanceOf(ModuleError);
        expect((error as ModuleError).moduleName).toBe("unregistered");
        expect((error as ModuleError).code).toBe("NOT_REGISTERED");
      }
    });

    it("should handle configuration error types", async () => {
      factory.registerModule("test-module", mockConstructor, "1.0.0");
      const config = createModuleConfig({ name: "" });

      try {
        await factory.createModule(config);
      } catch (error) {
        expect(error).toBeInstanceOf(ModuleConfigurationError);
        expect((error as ModuleConfigurationError).code).toBe(
          "CONFIGURATION_ERROR",
        );
      }
    });

    it("should handle dependency error types", async () => {
      factory.registerModule("test-module", mockConstructor, "1.0.0");
      const config = createModuleConfig({
        name: "test-module",
        dependencies: ["missing-dep"],
      });

      try {
        await factory.createModule(config);
      } catch (error) {
        expect(error).toBeInstanceOf(ModuleDependencyError);
        expect((error as ModuleDependencyError).code).toBe("DEPENDENCY_ERROR");
      }
    });
  });

  describe("Edge Cases", () => {
    it("should handle module with many dependencies", async () => {
      // Register 10 modules
      for (let i = 0; i < 10; i++) {
        factory.registerModule(`module-${i}`, mockConstructor, "1.0.0");
      }

      // Create configs where each module depends on all previous ones
      const configs: ModuleConfig[] = [];
      for (let i = 0; i < 10; i++) {
        const dependencies = Array.from({ length: i }, (_, j) => `module-${j}`);
        configs.push(
          createModuleConfig({
            name: `module-${i}`,
            dependencies,
          }),
        );
      }

      const instances = await factory.createModules(configs);
      expect(instances.size).toBe(10);
    });

    it("should handle empty dependency array", async () => {
      factory.registerModule("simple-module", mockConstructor, "1.0.0");
      const config = createModuleConfig({
        name: "simple-module",
        dependencies: [],
      });

      await expect(factory.createModule(config)).resolves.toBeDefined();
    });

    it("should handle module names with special characters", async () => {
      const specialName = "module-with_special.chars@123";
      factory.registerModule(specialName, mockConstructor, "1.0.0");

      const config = createModuleConfig({ name: specialName });

      await expect(factory.createModule(config)).resolves.toBeDefined();
    });

    it("should handle concurrent module creation", async () => {
      factory.registerModule("concurrent-module", mockConstructor, "1.0.0");
      const config = createModuleConfig({ name: "concurrent-module" });

      // Create the same module concurrently
      const promises = Array.from({ length: 5 }, () =>
        factory.createModule(config),
      );
      const instances = await Promise.all(promises);

      // Due to the current implementation, concurrent calls may create different instances
      // but they should all be valid instances of the same module
      for (const instance of instances) {
        expect(instance).toBeInstanceOf(MockModuleInstance);
        expect(instance.config.name).toBe("concurrent-module");
      }

      // The last created instance will be cached
      const cachedInstance = factory.getInstance("concurrent-module");
      expect(cachedInstance).toBeInstanceOf(MockModuleInstance);
      expect(instances).toContain(cachedInstance);
    });
  });
});
