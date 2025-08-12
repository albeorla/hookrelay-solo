/**
 * Module Factory Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { ModuleFactory } from "../module-factory";
import { BaseModuleStrategy } from "../module-strategy";
import {
  HealthStatus,
  ModulePriority,
  type ModuleConfig,
  type HealthCheckResult,
} from "../types";

// Test module implementation
class TestModule extends BaseModuleStrategy {
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
        uptime: 1000,
        lastCheck: new Date(),
        dependencies: [],
      },
    };
  }
}

describe("ModuleFactory", () => {
  let factory: ModuleFactory;
  let testConfig: ModuleConfig;

  beforeEach(() => {
    factory = new ModuleFactory();
    testConfig = {
      name: "test-module",
      version: "1.0.0",
      description: "Test module",
      priority: ModulePriority.MEDIUM,
      dependencies: [],
      requiredPermissions: [],
      requiredEnvVars: [],
      settings: {},
      supportsHotReload: true,
    };
  });

  afterEach(() => {
    // Clean up factory state
    const registeredModules = factory.getRegisteredModules();
    for (const moduleName of registeredModules) {
      factory.unregisterModule(moduleName);
    }
  });

  describe("Module Registration", () => {
    it("should register a module constructor", () => {
      factory.registerModule("test-module", TestModule, "1.0.0");

      expect(factory.isRegistered("test-module")).toBe(true);
      expect(factory.getRegisteredModules()).toContain("test-module");
    });

    it("should throw error when registering duplicate module", () => {
      factory.registerModule("test-module", TestModule, "1.0.0");

      expect(() => {
        factory.registerModule("test-module", TestModule, "1.0.0");
      }).toThrow("Module 'test-module' is already registered");
    });

    it("should unregister module", () => {
      factory.registerModule("test-module", TestModule, "1.0.0");
      factory.unregisterModule("test-module");

      expect(factory.isRegistered("test-module")).toBe(false);
    });

    it("should return empty array when no modules registered", () => {
      expect(factory.getRegisteredModules()).toEqual([]);
    });
  });

  describe("Module Creation", () => {
    beforeEach(() => {
      factory.registerModule("test-module", TestModule, "1.0.0");
    });

    it("should create module instance", async () => {
      const instance = await factory.createModule(testConfig);

      expect(instance).toBeInstanceOf(TestModule);
      expect(instance.config).toBe(testConfig);
    });

    it("should cache created instances", async () => {
      const instance1 = await factory.createModule(testConfig);
      const instance2 = await factory.createModule(testConfig);

      expect(instance1).toBe(instance2);
    });

    it("should return cached instance via getInstance", async () => {
      const instance = await factory.createModule(testConfig);
      const cached = factory.getInstance("test-module");

      expect(cached).toBe(instance);
    });

    it("should throw error for unregistered module", async () => {
      factory.unregisterModule("test-module");

      await expect(factory.createModule(testConfig)).rejects.toThrow(
        "Module 'test-module' is not registered with the factory",
      );
    });

    it("should throw error for version mismatch", async () => {
      const configWithWrongVersion = {
        ...testConfig,
        version: "2.0.0",
      };

      await expect(
        factory.createModule(configWithWrongVersion),
      ).rejects.toThrow(
        "Module 'test-module' version mismatch: expected 1.0.0, got 2.0.0",
      );
    });
  });

  describe("Configuration Validation", () => {
    beforeEach(() => {
      factory.registerModule("test-module", TestModule, "1.0.0");
    });

    it("should validate required fields", async () => {
      const invalidConfig = {
        ...testConfig,
        name: "",
      };

      await expect(factory.createModule(invalidConfig)).rejects.toThrow(
        "Module name is required",
      );
    });

    it("should validate semantic versioning", async () => {
      factory.registerModule("invalid-version", TestModule, "invalid");
      const invalidConfig = {
        ...testConfig,
        name: "invalid-version",
        version: "invalid",
      };

      await expect(factory.createModule(invalidConfig)).rejects.toThrow(
        "Module version must follow semantic versioning",
      );
    });

    it("should prevent self-dependency", async () => {
      const selfDepConfig = {
        ...testConfig,
        dependencies: ["test-module"],
      };

      await expect(factory.createModule(selfDepConfig)).rejects.toThrow(
        "Module cannot depend on itself",
      );
    });

    it("should prevent duplicate dependencies", async () => {
      const dupDepConfig = {
        ...testConfig,
        dependencies: ["dep1", "dep1"],
      };

      await expect(factory.createModule(dupDepConfig)).rejects.toThrow(
        "Module has duplicate dependencies",
      );
    });

    it("should validate settings object", async () => {
      const invalidSettingsConfig = {
        ...testConfig,
        settings: "not an object" as unknown as Record<string, unknown>,
      };

      await expect(factory.createModule(invalidSettingsConfig)).rejects.toThrow(
        "Module settings must be an object",
      );
    });
  });

  describe("Dependency Resolution", () => {
    beforeEach(() => {
      factory.registerModule("module-a", TestModule, "1.0.0");
      factory.registerModule("module-b", TestModule, "1.0.0");
    });

    it("should resolve dependencies", async () => {
      // Create dependency first
      await factory.createModule({
        ...testConfig,
        name: "module-a",
      });

      // Create module with dependency
      const moduleWithDep = await factory.createModule({
        ...testConfig,
        name: "module-b",
        dependencies: ["module-a"],
      });

      expect(moduleWithDep).toBeInstanceOf(TestModule);
    });

    it("should throw error for missing dependency", async () => {
      const configWithMissingDep = {
        ...testConfig,
        dependencies: ["missing-module"],
      };

      await expect(factory.createModule(configWithMissingDep)).rejects.toThrow(
        "Module 'test-module' requires dependency 'missing-module'",
      );
    });

    it("should throw error for uninstantiated dependency", async () => {
      const configWithUninstantiatedDep = {
        ...testConfig,
        dependencies: ["module-a"],
      };

      await expect(
        factory.createModule(configWithUninstantiatedDep),
      ).rejects.toThrow(
        "Module 'test-module' requires dependency 'module-a (not yet instantiated)'",
      );
    });
  });

  describe("Batch Creation", () => {
    beforeEach(() => {
      factory.registerModule("module-a", TestModule, "1.0.0");
      factory.registerModule("module-b", TestModule, "1.0.0");
      factory.registerModule("module-c", TestModule, "1.0.0");
    });

    it("should create multiple modules", async () => {
      const configs = [
        { ...testConfig, name: "module-a" },
        { ...testConfig, name: "module-b" },
        { ...testConfig, name: "module-c" },
      ];

      const instances = await factory.createModules(configs);

      expect(instances.size).toBe(3);
      expect(instances.has("module-a")).toBe(true);
      expect(instances.has("module-b")).toBe(true);
      expect(instances.has("module-c")).toBe(true);
    });

    it("should handle dependencies in batch creation", async () => {
      const configs = [
        { ...testConfig, name: "module-a" },
        { ...testConfig, name: "module-b", dependencies: ["module-a"] },
        { ...testConfig, name: "module-c", dependencies: ["module-b"] },
      ];

      const instances = await factory.createModules(configs);

      expect(instances.size).toBe(3);
      // All modules should be created despite dependencies
    });

    it("should detect circular dependencies", async () => {
      const configs = [
        { ...testConfig, name: "module-a", dependencies: ["module-b"] },
        { ...testConfig, name: "module-b", dependencies: ["module-a"] },
      ];

      await expect(factory.createModules(configs)).rejects.toThrow(
        "Circular dependency detected",
      );
    });
  });

  describe("Instance Management", () => {
    beforeEach(() => {
      factory.registerModule("test-module", TestModule, "1.0.0");
    });

    it("should remove instance from cache", async () => {
      await factory.createModule(testConfig);
      factory.removeInstance("test-module");

      expect(factory.getInstance("test-module")).toBeUndefined();
    });

    it("should clear all instances", async () => {
      factory.registerModule("module-2", TestModule, "1.0.0");

      await factory.createModule(testConfig);
      await factory.createModule({ ...testConfig, name: "module-2" });

      factory.clearInstances();

      expect(factory.getInstance("test-module")).toBeUndefined();
      expect(factory.getInstance("module-2")).toBeUndefined();
    });
  });

  describe("Statistics", () => {
    it("should return empty statistics initially", () => {
      const stats = factory.getStatistics();

      expect(stats.registeredModules).toBe(0);
      expect(stats.instantiatedModules).toBe(0);
      expect(stats.modules).toEqual([]);
    });

    it("should return correct statistics after registration", async () => {
      factory.registerModule("test-module", TestModule, "1.0.0");
      await factory.createModule(testConfig);

      const stats = factory.getStatistics();

      expect(stats.registeredModules).toBe(1);
      expect(stats.instantiatedModules).toBe(1);
      expect(stats.modules).toHaveLength(1);
      expect(stats.modules[0]?.name).toBe("test-module");
      expect(stats.modules[0]?.instantiated).toBe(true);
    });
  });
});
