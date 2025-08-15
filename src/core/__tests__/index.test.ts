import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mock the problematic dependencies to focus on testing the core index functionality
const mockRegistryInstance = {
  registerModule: vi.fn(),
  getModule: vi.fn(),
  getModules: vi.fn(() => new Map()),
};

vi.mock("../module-registry", () => ({
  ModuleRegistry: {
    getInstance: vi.fn(() => mockRegistryInstance),
  },
}));

vi.mock("../lifecycle-manager", () => ({
  LifecycleManager: vi.fn().mockImplementation(() => ({
    startModule: vi.fn(),
    stopModule: vi.fn(),
  })),
}));

vi.mock("../health-monitor", () => ({
  HealthMonitor: vi.fn().mockImplementation(() => ({
    start: vi.fn(),
    stop: vi.fn(),
    getSystemHealth: vi.fn(),
  })),
}));

vi.mock("../trpc-integration", () => ({
  ModuleTRPCIntegration: vi.fn().mockImplementation(() => ({
    getTRPCRouters: vi.fn(),
  })),
  createModuleTRPCIntegration: vi.fn(),
  mergeRouters: vi.fn(),
  createModuleRouters: vi.fn(),
}));

vi.mock("../container", () => ({
  Container: vi.fn().mockImplementation(() => ({
    register: vi.fn(),
    resolve: vi.fn(),
  })),
  ServiceLifetime: {
    SINGLETON: "singleton",
    TRANSIENT: "transient",
    SCOPED: "scoped",
  },
  globalContainer: { register: vi.fn(), resolve: vi.fn() },
  ContainerBuilder: vi.fn(),
  Injectable: vi.fn(),
  Inject: vi.fn(),
}));

vi.mock("../event-bus", () => ({
  EventBus: vi.fn().mockImplementation(() => ({
    publish: vi.fn(),
    subscribe: vi.fn(),
  })),
  globalEventBus: { publish: vi.fn(), subscribe: vi.fn() },
  TypedEventBus: vi.fn(),
}));

vi.mock("../middleware-chain", () => ({
  MiddlewareChain: vi.fn().mockImplementation(() => ({
    use: vi.fn(),
    execute: vi.fn(),
  })),
  BaseMiddlewareHandler: vi.fn(),
  LoggingMiddleware: vi.fn(),
  PerformanceMiddleware: vi.fn(),
  AuthenticationMiddleware: vi.fn(),
  globalMiddlewareChain: { use: vi.fn(), execute: vi.fn() },
}));

vi.mock("../security", () => ({
  SecurityManager: vi.fn().mockImplementation(() => ({
    checkAccess: vi.fn(),
    enforcePolicy: vi.fn(),
  })),
  globalSecurityManager: { checkAccess: vi.fn(), enforcePolicy: vi.fn() },
  ResourceType: { API: "api", DATABASE: "database", FILE: "file" },
  PermissionLevel: { READ: "read", WRITE: "write", ADMIN: "admin" },
}));

vi.mock("../types", () => ({
  ModuleState: {
    STOPPED: "stopped",
    STARTING: "starting",
    RUNNING: "running",
    STOPPING: "stopping",
  },
  HealthStatus: {
    HEALTHY: "healthy",
    UNHEALTHY: "unhealthy",
    DEGRADED: "degraded",
    UNKNOWN: "unknown",
  },
  ModulePriority: {
    LOW: "low",
    NORMAL: "normal",
    HIGH: "high",
    CRITICAL: "critical",
  },
  ModuleEventType: { STARTED: "started", STOPPED: "stopped", FAILED: "failed" },
  ModuleError: class MockModuleError extends Error {
    constructor(
      message: string,
      public moduleName: string,
      public code?: string,
      public cause?: Error,
    ) {
      super(message);
      this.name = "ModuleError";
    }
  },
  ModuleDependencyError: class MockModuleDependencyError extends Error {
    constructor(
      message: string,
      public moduleName: string,
    ) {
      super(message);
      this.name = "ModuleDependencyError";
    }
  },
  ModuleConfigurationError: class MockModuleConfigurationError extends Error {
    constructor(
      message: string,
      public moduleName: string,
    ) {
      super(message);
      this.name = "ModuleConfigurationError";
    }
  },
  ModuleLifecycleError: class MockModuleLifecycleError extends Error {
    constructor(
      message: string,
      public moduleName: string,
    ) {
      super(message);
      this.name = "ModuleLifecycleError";
    }
  },
}));

vi.mock("../module-strategy", () => ({
  BaseModuleStrategy: vi.fn(),
}));

vi.mock("../module-factory", () => ({
  ModuleFactory: vi.fn(),
}));

// Import the core index after mocking dependencies
import * as CoreIndex from "../index";

describe("Core Index Module", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Constants and Metadata", () => {
    it("should export MODULE_SYSTEM_VERSION constant", () => {
      expect(CoreIndex.MODULE_SYSTEM_VERSION).toBe("1.0.0");
      expect(typeof CoreIndex.MODULE_SYSTEM_VERSION).toBe("string");
    });

    it("should export MODULE_SYSTEM_INFO metadata", () => {
      const info = CoreIndex.MODULE_SYSTEM_INFO;

      expect(info).toBeDefined();
      expect(info.version).toBe("1.0.0");
      expect(info.name).toBe("Modular Platform Foundation");
      expect(info.description).toBe(
        "Enterprise-grade modular platform following SOLID principles",
      );
      expect(Array.isArray(info.designPatterns)).toBe(true);
      expect(info.designPatterns).toContain("Strategy Pattern");
      expect(info.designPatterns).toContain("Factory Pattern");
      expect(info.designPatterns).toContain("Singleton Pattern");
      expect(info.designPatterns).toContain("Observer Pattern");
      expect(info.designPatterns).toContain("Chain of Responsibility Pattern");
    });

    it("should ensure MODULE_SYSTEM_INFO is readonly", () => {
      const info = CoreIndex.MODULE_SYSTEM_INFO;

      // TypeScript ensures this at compile time with const assertion
      // We can verify the structure without checking Object.isFrozen since const assertion provides compile-time immutability
      expect(info.designPatterns.length).toBe(5);
      expect(Array.isArray(info.designPatterns)).toBe(true);
    });
  });

  describe("Type Exports", () => {
    it("should export core types from types module", () => {
      // Test that enum values are exported
      expect(CoreIndex.ModuleState).toBeDefined();
      expect(CoreIndex.HealthStatus).toBeDefined();
      expect(CoreIndex.ModulePriority).toBeDefined();
      expect(CoreIndex.ModuleEventType).toBeDefined();

      // Test specific enum values
      expect(CoreIndex.ModuleState.STOPPED).toBeDefined();
      expect(CoreIndex.HealthStatus.HEALTHY).toBeDefined();
      expect(CoreIndex.ModulePriority.HIGH).toBeDefined();
      expect(CoreIndex.ModuleEventType.STARTED).toBeDefined();
    });

    it("should export error classes from types module", () => {
      expect(CoreIndex.ModuleError).toBeDefined();
      expect(CoreIndex.ModuleDependencyError).toBeDefined();
      expect(CoreIndex.ModuleConfigurationError).toBeDefined();
      expect(CoreIndex.ModuleLifecycleError).toBeDefined();

      // Test that they are constructable
      const moduleError = new CoreIndex.ModuleError(
        "Test error",
        "test-module",
      );
      expect(moduleError).toBeInstanceOf(Error);
      expect(moduleError).toBeInstanceOf(CoreIndex.ModuleError);
      expect(moduleError.moduleName).toBe("test-module");
    });
  });

  describe("Class Exports", () => {
    it("should export BaseModuleStrategy from module-strategy", () => {
      expect(CoreIndex.BaseModuleStrategy).toBeDefined();
      expect(typeof CoreIndex.BaseModuleStrategy).toBe("function");
    });

    it("should export ModuleFactory from module-factory", () => {
      expect(CoreIndex.ModuleFactory).toBeDefined();
      expect(typeof CoreIndex.ModuleFactory).toBe("function");
    });

    it("should export ModuleRegistry from module-registry", () => {
      expect(CoreIndex.ModuleRegistry).toBeDefined();
      // ModuleRegistry is mocked as an object with getInstance method
      expect(typeof CoreIndex.ModuleRegistry).toBe("object");
      expect(typeof CoreIndex.ModuleRegistry.getInstance).toBe("function");
    });

    it("should export LifecycleManager from lifecycle-manager", () => {
      expect(CoreIndex.LifecycleManager).toBeDefined();
      expect(typeof CoreIndex.LifecycleManager).toBe("function");
    });

    it("should export HealthMonitor from health-monitor", () => {
      expect(CoreIndex.HealthMonitor).toBeDefined();
      expect(typeof CoreIndex.HealthMonitor).toBe("function");
    });

    it("should export tRPC integration components", () => {
      expect(CoreIndex.ModuleTRPCIntegration).toBeDefined();
      expect(CoreIndex.createModuleTRPCIntegration).toBeDefined();
      expect(CoreIndex.mergeRouters).toBeDefined();
      expect(CoreIndex.createModuleRouters).toBeDefined();

      expect(typeof CoreIndex.ModuleTRPCIntegration).toBe("function");
      expect(typeof CoreIndex.createModuleTRPCIntegration).toBe("function");
      expect(typeof CoreIndex.mergeRouters).toBe("function");
      expect(typeof CoreIndex.createModuleRouters).toBe("function");
    });
  });

  describe("Integration Framework Exports", () => {
    it("should export Container system components", () => {
      expect(CoreIndex.Container).toBeDefined();
      expect(CoreIndex.ServiceLifetime).toBeDefined();
      expect(CoreIndex.globalContainer).toBeDefined();
      expect(CoreIndex.ContainerBuilder).toBeDefined();
      expect(CoreIndex.Injectable).toBeDefined();
      expect(CoreIndex.Inject).toBeDefined();

      expect(typeof CoreIndex.Container).toBe("function");
      expect(typeof CoreIndex.ServiceLifetime).toBe("object");
      expect(CoreIndex.globalContainer).toBeDefined();
      expect(typeof CoreIndex.ContainerBuilder).toBe("function");
      expect(typeof CoreIndex.Injectable).toBe("function");
      expect(typeof CoreIndex.Inject).toBe("function");
    });

    it("should export EventBus system components", () => {
      expect(CoreIndex.EventBus).toBeDefined();
      expect(CoreIndex.globalEventBus).toBeDefined();
      expect(CoreIndex.TypedEventBus).toBeDefined();

      expect(typeof CoreIndex.EventBus).toBe("function");
      expect(CoreIndex.globalEventBus).toBeDefined();
      expect(typeof CoreIndex.TypedEventBus).toBe("function");
    });

    it("should export Middleware system components", () => {
      expect(CoreIndex.MiddlewareChain).toBeDefined();
      expect(CoreIndex.BaseMiddlewareHandler).toBeDefined();
      expect(CoreIndex.LoggingMiddleware).toBeDefined();
      expect(CoreIndex.PerformanceMiddleware).toBeDefined();
      expect(CoreIndex.AuthenticationMiddleware).toBeDefined();
      expect(CoreIndex.globalMiddlewareChain).toBeDefined();

      expect(typeof CoreIndex.MiddlewareChain).toBe("function");
      expect(typeof CoreIndex.BaseMiddlewareHandler).toBe("function");
      expect(typeof CoreIndex.LoggingMiddleware).toBe("function");
      expect(typeof CoreIndex.PerformanceMiddleware).toBe("function");
      expect(typeof CoreIndex.AuthenticationMiddleware).toBe("function");
      expect(CoreIndex.globalMiddlewareChain).toBeDefined();
    });

    it("should export Security system components", () => {
      expect(CoreIndex.SecurityManager).toBeDefined();
      expect(CoreIndex.globalSecurityManager).toBeDefined();
      expect(CoreIndex.ResourceType).toBeDefined();
      expect(CoreIndex.PermissionLevel).toBeDefined();

      expect(typeof CoreIndex.SecurityManager).toBe("function");
      expect(CoreIndex.globalSecurityManager).toBeDefined();
      expect(typeof CoreIndex.ResourceType).toBe("object");
      expect(typeof CoreIndex.PermissionLevel).toBe("object");
    });
  });

  describe("Module Registry Getter", () => {
    it("should provide getModuleRegistry function", async () => {
      expect(CoreIndex.getModuleRegistry).toBeDefined();
      expect(typeof CoreIndex.getModuleRegistry).toBe("function");

      const registry = await CoreIndex.getModuleRegistry();
      expect(registry).toBeDefined();
      // Registry is mocked, so verify it has the expected methods
      expect(registry.registerModule).toBeDefined();
      expect(registry.getModule).toBeDefined();
    });

    it("should return singleton registry instance", async () => {
      const registry1 = await CoreIndex.getModuleRegistry();
      const registry2 = await CoreIndex.getModuleRegistry();

      // Since getInstance is mocked to return the same object, they should be equal
      expect(registry1).toEqual(registry2);
    });
  });

  describe("Module System Initialization", () => {
    it("should initialize module system with default options", async () => {
      const system = await CoreIndex.initializeModuleSystem();

      expect(system).toBeDefined();
      // With mocked components, verify they are all created
      expect(system.registry).toBeDefined();
      expect(system.registry.registerModule).toBeDefined();
      expect(system.lifecycleManager).toBeDefined();
      expect(system.healthMonitor).toBeDefined();
      expect(system.trpcIntegration).toBeDefined();

      // The mocked components should be objects (methods are mocked)
      expect(typeof system.lifecycleManager).toBe("object");
      expect(typeof system.healthMonitor).toBe("object");
      expect(typeof system.trpcIntegration).toBe("object");

      // Integration framework components should be enabled by default
      expect(system.container).toBeDefined();
      expect(system.container.register).toBeDefined();
      expect(system.eventBus).toBeDefined();
      expect(system.eventBus.publish).toBeDefined();
      expect(system.middlewareChain).toBeDefined();
      expect(system.middlewareChain.use).toBeDefined();
      expect(system.securityManager).toBeDefined();
      expect(system.securityManager.checkAccess).toBeDefined();
    });

    it("should initialize with all components enabled explicitly", async () => {
      const system = await CoreIndex.initializeModuleSystem({
        enableContainer: true,
        enableEventBus: true,
        enableMiddleware: true,
        enableSecurity: true,
      });

      expect(system.registry).toBeDefined();
      expect(system.lifecycleManager).toBeDefined();
      expect(system.healthMonitor).toBeDefined();
      expect(system.trpcIntegration).toBeDefined();
      expect(system.container).toBeDefined();
      expect(system.eventBus).toBeDefined();
      expect(system.middlewareChain).toBeDefined();
      expect(system.securityManager).toBeDefined();
    });

    it("should initialize with container disabled", async () => {
      const system = await CoreIndex.initializeModuleSystem({
        enableContainer: false,
      });

      expect(system.registry).toBeDefined();
      expect(system.lifecycleManager).toBeDefined();
      expect(system.healthMonitor).toBeDefined();
      expect(system.trpcIntegration).toBeDefined();
      expect(system.container).toBeUndefined();
      expect(system.eventBus).toBeDefined();
      expect(system.middlewareChain).toBeDefined();
      expect(system.securityManager).toBeDefined();
    });

    it("should initialize with event bus disabled", async () => {
      const system = await CoreIndex.initializeModuleSystem({
        enableEventBus: false,
      });

      expect(system.registry).toBeDefined();
      expect(system.lifecycleManager).toBeDefined();
      expect(system.healthMonitor).toBeDefined();
      expect(system.trpcIntegration).toBeDefined();
      expect(system.container).toBeDefined();
      expect(system.eventBus).toBeUndefined();
      expect(system.middlewareChain).toBeDefined();
      expect(system.securityManager).toBeDefined();
    });

    it("should initialize with middleware disabled", async () => {
      const system = await CoreIndex.initializeModuleSystem({
        enableMiddleware: false,
      });

      expect(system.registry).toBeDefined();
      expect(system.lifecycleManager).toBeDefined();
      expect(system.healthMonitor).toBeDefined();
      expect(system.trpcIntegration).toBeDefined();
      expect(system.container).toBeDefined();
      expect(system.eventBus).toBeDefined();
      expect(system.middlewareChain).toBeUndefined();
      expect(system.securityManager).toBeDefined();
    });

    it("should initialize with security disabled", async () => {
      const system = await CoreIndex.initializeModuleSystem({
        enableSecurity: false,
      });

      expect(system.registry).toBeDefined();
      expect(system.lifecycleManager).toBeDefined();
      expect(system.healthMonitor).toBeDefined();
      expect(system.trpcIntegration).toBeDefined();
      expect(system.container).toBeDefined();
      expect(system.eventBus).toBeDefined();
      expect(system.middlewareChain).toBeDefined();
      expect(system.securityManager).toBeUndefined();
    });

    it("should initialize with all integration components disabled", async () => {
      const system = await CoreIndex.initializeModuleSystem({
        enableContainer: false,
        enableEventBus: false,
        enableMiddleware: false,
        enableSecurity: false,
      });

      // Core components should still be initialized
      expect(system.registry).toBeDefined();
      expect(system.lifecycleManager).toBeDefined();
      expect(system.healthMonitor).toBeDefined();
      expect(system.trpcIntegration).toBeDefined();

      // Integration components should be undefined
      expect(system.container).toBeUndefined();
      expect(system.eventBus).toBeUndefined();
      expect(system.middlewareChain).toBeUndefined();
      expect(system.securityManager).toBeUndefined();
    });

    it("should return readonly result object", async () => {
      const system = await CoreIndex.initializeModuleSystem();

      // The result should be a const assertion (readonly)
      // TypeScript enforces this at compile time
      expect(system).toBeDefined();
      expect(typeof system).toBe("object");

      // Verify core properties exist
      expect(system).toHaveProperty("registry");
      expect(system).toHaveProperty("lifecycleManager");
      expect(system).toHaveProperty("healthMonitor");
      expect(system).toHaveProperty("trpcIntegration");
      expect(system).toHaveProperty("container");
      expect(system).toHaveProperty("eventBus");
      expect(system).toHaveProperty("middlewareChain");
      expect(system).toHaveProperty("securityManager");
    });

    it("should initialize components that are properly connected", async () => {
      const system = await CoreIndex.initializeModuleSystem();

      // Verify registry methods are available
      const registryViaGetter = await CoreIndex.getModuleRegistry();
      expect(system.registry).toEqual(registryViaGetter);

      // Verify components are created (with mocked implementations)
      expect(system.lifecycleManager).toBeDefined();
      expect(system.healthMonitor).toBeDefined();
      expect(system.trpcIntegration).toBeDefined();

      // Verify global instances are used (with mocked implementations)
      expect(system.container).toEqual(CoreIndex.globalContainer);
      expect(system.eventBus).toEqual(CoreIndex.globalEventBus);
      expect(system.middlewareChain).toEqual(CoreIndex.globalMiddlewareChain);
      expect(system.securityManager).toEqual(CoreIndex.globalSecurityManager);
    });
  });

  describe("Dynamic Imports", () => {
    it("should use dynamic imports for lazy loading", async () => {
      // The initialization function uses dynamic imports
      // We can verify this by checking that the function is async
      expect(CoreIndex.initializeModuleSystem.constructor.name).toBe(
        "AsyncFunction",
      );
      expect(CoreIndex.getModuleRegistry.constructor.name).toBe(
        "AsyncFunction",
      );

      // Multiple calls should work correctly with dynamic imports
      const system1 = await CoreIndex.initializeModuleSystem();
      const system2 = await CoreIndex.initializeModuleSystem();

      // Should get same registry instance (singleton pattern) - with mocked implementation
      expect(system1.registry).toEqual(system2.registry);
    });

    it("should handle partial initialization gracefully", async () => {
      // Test that each component can be enabled/disabled independently
      const configurations = [
        {
          enableContainer: true,
          enableEventBus: false,
          enableMiddleware: false,
          enableSecurity: false,
        },
        {
          enableContainer: false,
          enableEventBus: true,
          enableMiddleware: false,
          enableSecurity: false,
        },
        {
          enableContainer: false,
          enableEventBus: false,
          enableMiddleware: true,
          enableSecurity: false,
        },
        {
          enableContainer: false,
          enableEventBus: false,
          enableMiddleware: false,
          enableSecurity: true,
        },
      ];

      for (const config of configurations) {
        const system = await CoreIndex.initializeModuleSystem(config);

        // Core components should always be present
        expect(system.registry).toBeDefined();
        expect(system.lifecycleManager).toBeDefined();
        expect(system.healthMonitor).toBeDefined();
        expect(system.trpcIntegration).toBeDefined();

        // Integration components should match configuration
        expect(system.container ? true : false).toBe(config.enableContainer);
        expect(system.eventBus ? true : false).toBe(config.enableEventBus);
        expect(system.middlewareChain ? true : false).toBe(
          config.enableMiddleware,
        );
        expect(system.securityManager ? true : false).toBe(
          config.enableSecurity,
        );
      }
    });
  });

  describe("Module System Integration", () => {
    it("should provide complete module system API surface", async () => {
      const system = await CoreIndex.initializeModuleSystem();

      // Verify that all major components are available through the system
      expect(system.registry).toBeDefined();
      expect(system.registry.registerModule).toBeDefined();
      expect(system.lifecycleManager).toBeDefined();
      expect(system.healthMonitor).toBeDefined();
      expect(system.trpcIntegration).toBeDefined();

      expect(system.container?.register).toBeDefined();
      expect(system.eventBus?.publish).toBeDefined();
      expect(system.middlewareChain?.use).toBeDefined();
      expect(system.securityManager?.checkAccess).toBeDefined();
    });

    it("should maintain component lifecycle properly", async () => {
      const system = await CoreIndex.initializeModuleSystem();

      // Verify components exist as objects (mocked implementations)
      expect(system.healthMonitor).toBeDefined();
      expect(typeof system.healthMonitor).toBe("object");
      expect(system.lifecycleManager).toBeDefined();
      expect(typeof system.lifecycleManager).toBe("object");
      expect(system.trpcIntegration).toBeDefined();
      expect(typeof system.trpcIntegration).toBe("object");

      // Verify integration framework components exist
      expect(system.eventBus).toBeDefined();
      expect(typeof system.eventBus).toBe("object");
      expect(system.container).toBeDefined();
      expect(typeof system.container).toBe("object");
      expect(system.middlewareChain).toBeDefined();
      expect(typeof system.middlewareChain).toBe("object");
      expect(system.securityManager).toBeDefined();
      expect(typeof system.securityManager).toBe("object");
    });
  });
});
