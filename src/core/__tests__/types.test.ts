import { describe, it, expect } from "vitest";
import {
  ModuleState,
  HealthStatus,
  ModulePriority,
  ModuleEventType,
  ModuleError,
  ModuleDependencyError,
  ModuleConfigurationError,
  ModuleLifecycleError,
  type ModuleConfig,
  type HealthCheckResult,
  type ModuleEvent,
  type ModuleMiddleware,
  type ModuleEventHandler,
  type ModuleMigration,
  type ModuleMetrics,
  type ModuleRegistryEntry,
  type ModuleInstance,
} from "../types";
import type { AnyTRPCRouter } from "@trpc/server";
import type { NextRequest, NextResponse } from "next/server";

describe("Core Module System Types", () => {
  describe("Enums", () => {
    describe("ModuleState", () => {
      it("should have correct enum values", () => {
        expect(ModuleState.UNINSTALLED).toBe("uninstalled");
        expect(ModuleState.INSTALLED).toBe("installed");
        expect(ModuleState.CONFIGURED).toBe("configured");
        expect(ModuleState.STARTING).toBe("starting");
        expect(ModuleState.RUNNING).toBe("running");
        expect(ModuleState.STOPPING).toBe("stopping");
        expect(ModuleState.FAILED).toBe("failed");
      });

      it("should have all expected states", () => {
        const expectedStates = [
          "uninstalled",
          "installed",
          "configured",
          "starting",
          "running",
          "stopping",
          "failed",
        ];

        const actualStates = Object.values(ModuleState);
        expect(actualStates).toEqual(expectedStates);
      });

      it("should be usable in switch statements", () => {
        const testState = ModuleState.RUNNING;
        let result = "";

        switch (testState) {
          case ModuleState.UNINSTALLED:
            result = "not installed";
            break;
          case ModuleState.RUNNING:
            result = "currently running";
            break;
          default:
            result = "other state";
        }

        expect(result).toBe("currently running");
      });

      it("should preserve enum order for state progression", () => {
        // Test that state progression makes logical sense
        const states = Object.values(ModuleState);
        const expectedOrder = [
          "uninstalled",
          "installed",
          "configured",
          "starting",
          "running",
          "stopping",
          "failed",
        ];

        expect(states).toEqual(expectedOrder);
      });
    });

    describe("HealthStatus", () => {
      it("should have correct enum values", () => {
        expect(HealthStatus.HEALTHY).toBe("healthy");
        expect(HealthStatus.DEGRADED).toBe("degraded");
        expect(HealthStatus.UNHEALTHY).toBe("unhealthy");
        expect(HealthStatus.UNKNOWN).toBe("unknown");
      });

      it("should have all expected health states", () => {
        const expectedStates = ["healthy", "degraded", "unhealthy", "unknown"];
        const actualStates = Object.values(HealthStatus);
        expect(actualStates).toEqual(expectedStates);
      });

      it("should be usable for health check logic", () => {
        const checkHealth = (status: HealthStatus): boolean => {
          return (
            status === HealthStatus.HEALTHY || status === HealthStatus.DEGRADED
          );
        };

        expect(checkHealth(HealthStatus.HEALTHY)).toBe(true);
        expect(checkHealth(HealthStatus.DEGRADED)).toBe(true);
        expect(checkHealth(HealthStatus.UNHEALTHY)).toBe(false);
        expect(checkHealth(HealthStatus.UNKNOWN)).toBe(false);
      });
    });

    describe("ModulePriority", () => {
      it("should have correct numeric values for ordering", () => {
        expect(ModulePriority.CRITICAL).toBe(0);
        expect(ModulePriority.HIGH).toBe(1);
        expect(ModulePriority.MEDIUM).toBe(2);
        expect(ModulePriority.LOW).toBe(3);
      });

      it("should allow numeric comparison for startup ordering", () => {
        expect(ModulePriority.CRITICAL < ModulePriority.HIGH).toBe(true);
        expect(ModulePriority.HIGH < ModulePriority.MEDIUM).toBe(true);
        expect(ModulePriority.MEDIUM < ModulePriority.LOW).toBe(true);
      });

      it("should be usable for sorting modules", () => {
        const modules = [
          { name: "analytics", priority: ModulePriority.MEDIUM },
          { name: "auth", priority: ModulePriority.CRITICAL },
          { name: "billing", priority: ModulePriority.HIGH },
          { name: "marketing", priority: ModulePriority.LOW },
        ];

        const sorted = modules.sort((a, b) => a.priority - b.priority);

        expect(sorted[0].name).toBe("auth"); // CRITICAL = 0
        expect(sorted[1].name).toBe("billing"); // HIGH = 1
        expect(sorted[2].name).toBe("analytics"); // MEDIUM = 2
        expect(sorted[3].name).toBe("marketing"); // LOW = 3
      });

      it("should have meaningful priority levels", () => {
        // Critical modules should start first
        expect(ModulePriority.CRITICAL).toBe(0);
        // Low priority modules should start last
        expect(ModulePriority.LOW).toBe(3);
        // Should have 4 total priority levels (enum has both keys and values)
        const numericValues = Object.values(ModulePriority).filter(
          (v) => typeof v === "number",
        );
        expect(numericValues).toHaveLength(4);
      });
    });

    describe("ModuleEventType", () => {
      it("should have correct event type values", () => {
        expect(ModuleEventType.INSTALLING).toBe("module:installing");
        expect(ModuleEventType.INSTALLED).toBe("module:installed");
        expect(ModuleEventType.CONFIGURING).toBe("module:configuring");
        expect(ModuleEventType.CONFIGURED).toBe("module:configured");
        expect(ModuleEventType.STARTING).toBe("module:starting");
        expect(ModuleEventType.STARTED).toBe("module:started");
        expect(ModuleEventType.STOPPING).toBe("module:stopping");
        expect(ModuleEventType.STOPPED).toBe("module:stopped");
        expect(ModuleEventType.UNINSTALLING).toBe("module:uninstalling");
        expect(ModuleEventType.UNINSTALLED).toBe("module:uninstalled");
        expect(ModuleEventType.HEALTH_CHECK).toBe("module:health_check");
        expect(ModuleEventType.ERROR).toBe("module:error");
      });

      it("should have all expected event types", () => {
        const expectedEvents = [
          "module:installing",
          "module:installed",
          "module:configuring",
          "module:configured",
          "module:starting",
          "module:started",
          "module:stopping",
          "module:stopped",
          "module:uninstalling",
          "module:uninstalled",
          "module:health_check",
          "module:error",
        ];

        const actualEvents = Object.values(ModuleEventType);
        expect(actualEvents).toEqual(expectedEvents);
      });

      it("should be usable for event filtering", () => {
        const isLifecycleEvent = (eventType: ModuleEventType): boolean => {
          return [
            ModuleEventType.INSTALLING,
            ModuleEventType.INSTALLED,
            ModuleEventType.STARTING,
            ModuleEventType.STARTED,
            ModuleEventType.STOPPING,
            ModuleEventType.STOPPED,
          ].includes(eventType);
        };

        expect(isLifecycleEvent(ModuleEventType.STARTING)).toBe(true);
        expect(isLifecycleEvent(ModuleEventType.HEALTH_CHECK)).toBe(false);
        expect(isLifecycleEvent(ModuleEventType.ERROR)).toBe(false);
      });

      it("should follow consistent naming pattern", () => {
        const eventTypes = Object.values(ModuleEventType);

        // All should start with 'module:'
        for (const eventType of eventTypes) {
          expect(eventType).toMatch(/^module:/);
        }

        // Should use underscores for multi-word events
        expect(ModuleEventType.HEALTH_CHECK).toBe("module:health_check");
      });
    });
  });

  describe("Interface Type Definitions", () => {
    describe("ModuleConfig", () => {
      it("should accept valid module configuration", () => {
        const config: ModuleConfig = {
          name: "test-module",
          version: "1.0.0",
          description: "A test module",
          priority: ModulePriority.MEDIUM,
          dependencies: ["auth-module"],
          requiredPermissions: ["database:read"],
          requiredEnvVars: ["API_KEY"],
          settings: { debug: true },
          supportsHotReload: false,
        };

        expect(config.name).toBe("test-module");
        expect(config.version).toBe("1.0.0");
        expect(config.priority).toBe(ModulePriority.MEDIUM);
        expect(config.dependencies).toContain("auth-module");
        expect(config.settings.debug).toBe(true);
      });

      it("should handle empty arrays and objects", () => {
        const config: ModuleConfig = {
          name: "minimal-module",
          version: "1.0.0",
          description: "Minimal configuration",
          priority: ModulePriority.LOW,
          dependencies: [],
          requiredPermissions: [],
          requiredEnvVars: [],
          settings: {},
          supportsHotReload: true,
        };

        expect(config.dependencies).toHaveLength(0);
        expect(config.requiredPermissions).toHaveLength(0);
        expect(config.requiredEnvVars).toHaveLength(0);
        expect(Object.keys(config.settings)).toHaveLength(0);
      });

      it("should enforce readonly properties at compile time", () => {
        const config: ModuleConfig = {
          name: "readonly-test",
          version: "1.0.0",
          description: "Testing readonly",
          priority: ModulePriority.HIGH,
          dependencies: ["dep1", "dep2"],
          requiredPermissions: ["perm1"],
          requiredEnvVars: ["ENV1"],
          settings: { key: "value" },
          supportsHotReload: false,
        };

        // TypeScript should prevent these assignments
        // config.name = 'changed' // Should be compile error
        // config.dependencies.push('new-dep') // Should be compile error

        expect(config.name).toBe("readonly-test");
        expect(config.dependencies).toHaveLength(2);
      });
    });

    describe("HealthCheckResult", () => {
      it("should accept valid health check result", () => {
        const healthResult: HealthCheckResult = {
          status: HealthStatus.HEALTHY,
          details: {
            uptime: 123456,
            lastCheck: new Date(),
            dependencies: [
              { name: "database", status: HealthStatus.HEALTHY, latency: 50 },
              { name: "redis", status: HealthStatus.DEGRADED },
            ],
            metrics: { cpuUsage: 0.25, memoryUsage: 0.6 },
            errors: [],
          },
        };

        expect(healthResult.status).toBe(HealthStatus.HEALTHY);
        expect(healthResult.details.dependencies).toHaveLength(2);
        expect(healthResult.details.dependencies[0].latency).toBe(50);
        expect(healthResult.details.metrics?.cpuUsage).toBe(0.25);
      });

      it("should handle minimal health check result", () => {
        const healthResult: HealthCheckResult = {
          status: HealthStatus.UNKNOWN,
          details: {
            uptime: 0,
            lastCheck: new Date(),
            dependencies: [],
          },
        };

        expect(healthResult.status).toBe(HealthStatus.UNKNOWN);
        expect(healthResult.details.dependencies).toHaveLength(0);
        expect(healthResult.details.metrics).toBeUndefined();
        expect(healthResult.details.errors).toBeUndefined();
      });

      it("should handle health check with errors", () => {
        const healthResult: HealthCheckResult = {
          status: HealthStatus.UNHEALTHY,
          details: {
            uptime: 12345,
            lastCheck: new Date(),
            dependencies: [],
            errors: ["Database connection failed", "Cache unavailable"],
          },
        };

        expect(healthResult.status).toBe(HealthStatus.UNHEALTHY);
        expect(healthResult.details.errors).toHaveLength(2);
        expect(healthResult.details.errors?.[0]).toBe(
          "Database connection failed",
        );
      });
    });

    describe("ModuleEvent", () => {
      it("should accept valid module event", () => {
        const event: ModuleEvent = {
          type: ModuleEventType.STARTED,
          moduleName: "test-module",
          timestamp: new Date(),
          data: { version: "1.0.0", startTime: 123 },
        };

        expect(event.type).toBe(ModuleEventType.STARTED);
        expect(event.moduleName).toBe("test-module");
        expect(event.data?.version).toBe("1.0.0");
        expect(event.error).toBeUndefined();
      });

      it("should handle error events", () => {
        const error = new Error("Module startup failed");
        const event: ModuleEvent = {
          type: ModuleEventType.ERROR,
          moduleName: "failing-module",
          timestamp: new Date(),
          error,
        };

        expect(event.type).toBe(ModuleEventType.ERROR);
        expect(event.error).toBe(error);
        expect(event.data).toBeUndefined();
      });

      it("should handle minimal event", () => {
        const event: ModuleEvent = {
          type: ModuleEventType.HEALTH_CHECK,
          moduleName: "health-module",
          timestamp: new Date(),
        };

        expect(event.type).toBe(ModuleEventType.HEALTH_CHECK);
        expect(event.data).toBeUndefined();
        expect(event.error).toBeUndefined();
      });
    });

    describe("ModuleMiddleware", () => {
      it("should define middleware interface correctly", async () => {
        const mockRequest = {} as NextRequest;
        const mockResponse = {} as NextResponse;
        const mockNext = async () => mockResponse;

        const middleware: ModuleMiddleware = {
          name: "test-middleware",
          priority: 10,
          execute: async (req, res, next) => {
            expect(req).toBe(mockRequest);
            expect(res).toBe(mockResponse);
            return next();
          },
        };

        expect(middleware.name).toBe("test-middleware");
        expect(middleware.priority).toBe(10);
        expect(typeof middleware.execute).toBe("function");

        const result = await middleware.execute(
          mockRequest,
          mockResponse,
          mockNext,
        );
        expect(result).toBe(mockResponse);
      });

      it("should be sortable by priority", () => {
        const middlewares: ModuleMiddleware[] = [
          {
            name: "low",
            priority: 100,
            execute: async () => ({}) as NextResponse,
          },
          {
            name: "high",
            priority: 10,
            execute: async () => ({}) as NextResponse,
          },
          {
            name: "medium",
            priority: 50,
            execute: async () => ({}) as NextResponse,
          },
        ];

        const sorted = middlewares.sort((a, b) => a.priority - b.priority);

        expect(sorted[0].name).toBe("high");
        expect(sorted[1].name).toBe("medium");
        expect(sorted[2].name).toBe("low");
      });
    });

    describe("ModuleEventHandler", () => {
      it("should define event handler interface correctly", async () => {
        const testEvent: ModuleEvent = {
          type: ModuleEventType.STARTED,
          moduleName: "test-module",
          timestamp: new Date(),
        };

        let handledEvent: ModuleEvent | null = null;

        const handler: ModuleEventHandler = {
          eventType: ModuleEventType.STARTED,
          priority: 5,
          handle: async (event) => {
            handledEvent = event;
          },
        };

        expect(handler.eventType).toBe(ModuleEventType.STARTED);
        expect(handler.priority).toBe(5);
        expect(typeof handler.handle).toBe("function");

        await handler.handle(testEvent);
        expect(handledEvent).toBe(testEvent);
      });

      it("should be sortable by priority", () => {
        const handlers: ModuleEventHandler[] = [
          {
            eventType: ModuleEventType.STARTED,
            priority: 100,
            handle: async () => {},
          },
          {
            eventType: ModuleEventType.STARTED,
            priority: 1,
            handle: async () => {},
          },
          {
            eventType: ModuleEventType.STARTED,
            priority: 50,
            handle: async () => {},
          },
        ];

        const sorted = handlers.sort((a, b) => a.priority - b.priority);

        expect(sorted[0].priority).toBe(1);
        expect(sorted[1].priority).toBe(50);
        expect(sorted[2].priority).toBe(100);
      });
    });

    describe("ModuleMigration", () => {
      it("should define migration interface correctly", async () => {
        let upCalled = false;
        let downCalled = false;

        const migration: ModuleMigration = {
          version: "1.2.0",
          description: "Add user preferences table",
          up: async () => {
            upCalled = true;
          },
          down: async () => {
            downCalled = true;
          },
        };

        expect(migration.version).toBe("1.2.0");
        expect(migration.description).toBe("Add user preferences table");
        expect(typeof migration.up).toBe("function");
        expect(typeof migration.down).toBe("function");

        await migration.up();
        expect(upCalled).toBe(true);

        await migration.down();
        expect(downCalled).toBe(true);
      });

      it("should be sortable by version", () => {
        const migrations: ModuleMigration[] = [
          {
            version: "1.2.0",
            description: "Second",
            up: async () => {},
            down: async () => {},
          },
          {
            version: "1.0.0",
            description: "First",
            up: async () => {},
            down: async () => {},
          },
          {
            version: "1.1.0",
            description: "Middle",
            up: async () => {},
            down: async () => {},
          },
        ];

        // Simple lexicographic sort for demo (real implementation would use semver)
        const sorted = migrations.sort((a, b) =>
          a.version.localeCompare(b.version),
        );

        expect(sorted[0].version).toBe("1.0.0");
        expect(sorted[1].version).toBe("1.1.0");
        expect(sorted[2].version).toBe("1.2.0");
      });
    });

    describe("ModuleMetrics", () => {
      it("should accept valid metrics", () => {
        const metrics: ModuleMetrics = {
          startupTime: 1500,
          memoryUsage: 64 * 1024 * 1024, // 64MB
          requestCount: 1234,
          errorCount: 5,
          avgResponseTime: 125.5,
          lastRequestTime: new Date(),
        };

        expect(metrics.startupTime).toBe(1500);
        expect(metrics.memoryUsage).toBe(64 * 1024 * 1024);
        expect(metrics.requestCount).toBe(1234);
        expect(metrics.errorCount).toBe(5);
        expect(metrics.avgResponseTime).toBe(125.5);
        expect(metrics.lastRequestTime).toBeInstanceOf(Date);
      });

      it("should handle metrics without optional fields", () => {
        const metrics: ModuleMetrics = {
          startupTime: 500,
          memoryUsage: 32 * 1024 * 1024,
          requestCount: 0,
          errorCount: 0,
          avgResponseTime: 0,
        };

        expect(metrics.lastRequestTime).toBeUndefined();
      });
    });

    describe("ModuleRegistryEntry", () => {
      it("should accept valid registry entry", () => {
        const config: ModuleConfig = {
          name: "test-module",
          version: "1.0.0",
          description: "Test",
          priority: ModulePriority.MEDIUM,
          dependencies: [],
          requiredPermissions: [],
          requiredEnvVars: [],
          settings: {},
          supportsHotReload: false,
        };

        const mockInstance = {} as ModuleInstance;
        const now = new Date();

        const entry: ModuleRegistryEntry = {
          config,
          state: ModuleState.RUNNING,
          instance: mockInstance,
          metrics: {
            startupTime: 1000,
            memoryUsage: 1024,
            requestCount: 10,
            errorCount: 0,
            avgResponseTime: 50,
          },
          lastHealthCheck: {
            status: HealthStatus.HEALTHY,
            details: {
              uptime: 60000,
              lastCheck: now,
              dependencies: [],
            },
          },
          registeredAt: now,
          startedAt: now,
        };

        expect(entry.config).toBe(config);
        expect(entry.state).toBe(ModuleState.RUNNING);
        expect(entry.instance).toBe(mockInstance);
        expect(entry.registeredAt).toBe(now);
        expect(entry.startedAt).toBe(now);
        expect(entry.stoppedAt).toBeUndefined();
      });

      it("should handle minimal registry entry", () => {
        const config: ModuleConfig = {
          name: "minimal-module",
          version: "1.0.0",
          description: "Minimal",
          priority: ModulePriority.LOW,
          dependencies: [],
          requiredPermissions: [],
          requiredEnvVars: [],
          settings: {},
          supportsHotReload: false,
        };

        const entry: ModuleRegistryEntry = {
          config,
          state: ModuleState.UNINSTALLED,
          metrics: {
            startupTime: 0,
            memoryUsage: 0,
            requestCount: 0,
            errorCount: 0,
            avgResponseTime: 0,
          },
          registeredAt: new Date(),
        };

        expect(entry.instance).toBeUndefined();
        expect(entry.lastHealthCheck).toBeUndefined();
        expect(entry.startedAt).toBeUndefined();
        expect(entry.stoppedAt).toBeUndefined();
      });
    });

    describe("ModuleInstance", () => {
      it("should define complete module instance interface", () => {
        // This test verifies that a class implementing ModuleInstance
        // has all required methods with correct signatures

        class TestModuleInstance implements ModuleInstance {
          config: ModuleConfig;
          state: ModuleState = ModuleState.UNINSTALLED;

          constructor(config: ModuleConfig) {
            this.config = config;
          }

          async install(): Promise<void> {}
          async configure(_settings: Record<string, unknown>): Promise<void> {}
          async start(): Promise<void> {}
          async stop(): Promise<void> {}
          async uninstall(): Promise<void> {}
          async getRouters(): Promise<Record<string, AnyTRPCRouter>> {
            return {};
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
        }

        const config: ModuleConfig = {
          name: "test-implementation",
          version: "1.0.0",
          description: "Test implementation",
          priority: ModulePriority.MEDIUM,
          dependencies: [],
          requiredPermissions: [],
          requiredEnvVars: [],
          settings: {},
          supportsHotReload: false,
        };

        const instance = new TestModuleInstance(config);

        expect(instance).toBeInstanceOf(TestModuleInstance);
        expect(instance.config).toBe(config);
        expect(instance.state).toBe(ModuleState.UNINSTALLED);

        // Verify all methods exist and are functions
        expect(typeof instance.install).toBe("function");
        expect(typeof instance.configure).toBe("function");
        expect(typeof instance.start).toBe("function");
        expect(typeof instance.stop).toBe("function");
        expect(typeof instance.uninstall).toBe("function");
        expect(typeof instance.getRouters).toBe("function");
        expect(typeof instance.getMiddleware).toBe("function");
        expect(typeof instance.getEventHandlers).toBe("function");
        expect(typeof instance.getMigrations).toBe("function");
        expect(typeof instance.healthCheck).toBe("function");
        expect(typeof instance.getMetrics).toBe("function");
        expect(typeof instance.cleanup).toBe("function");
      });
    });
  });

  describe("Error Classes", () => {
    describe("ModuleError", () => {
      it("should create module error with all properties", () => {
        const cause = new Error("Root cause");
        const error = new ModuleError(
          "Something went wrong",
          "test-module",
          "TEST_ERROR",
          cause,
        );

        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(ModuleError);
        expect(error.name).toBe("ModuleError");
        expect(error.message).toBe("Something went wrong");
        expect(error.moduleName).toBe("test-module");
        expect(error.code).toBe("TEST_ERROR");
        expect(error.cause).toBe(cause);
      });

      it("should create module error without cause", () => {
        const error = new ModuleError(
          "Error without cause",
          "test-module",
          "NO_CAUSE_ERROR",
        );

        expect(error.name).toBe("ModuleError");
        expect(error.message).toBe("Error without cause");
        expect(error.moduleName).toBe("test-module");
        expect(error.code).toBe("NO_CAUSE_ERROR");
        expect(error.cause).toBeUndefined();
      });

      it("should be throwable and catchable", () => {
        const throwError = () => {
          throw new ModuleError("Test error", "test-module", "THROW_TEST");
        };

        expect(throwError).toThrow(ModuleError);
        expect(throwError).toThrow("Test error");

        try {
          throwError();
        } catch (error) {
          expect(error).toBeInstanceOf(ModuleError);
          expect((error as ModuleError).moduleName).toBe("test-module");
          expect((error as ModuleError).code).toBe("THROW_TEST");
        }
      });

      it("should have correct prototype chain", () => {
        const error = new ModuleError("Test", "test-module", "TEST");

        expect(error instanceof Error).toBe(true);
        expect(error instanceof ModuleError).toBe(true);
        expect(Object.getPrototypeOf(error)).toBe(ModuleError.prototype);
        expect(Object.getPrototypeOf(ModuleError.prototype)).toBe(
          Error.prototype,
        );
      });
    });

    describe("ModuleDependencyError", () => {
      it("should create dependency error with formatted message", () => {
        const error = new ModuleDependencyError(
          "billing-module",
          "auth-module",
        );

        expect(error).toBeInstanceOf(ModuleError);
        expect(error).toBeInstanceOf(ModuleDependencyError);
        expect(error.name).toBe("ModuleDependencyError");
        expect(error.message).toBe(
          "Module 'billing-module' requires dependency 'auth-module'",
        );
        expect(error.moduleName).toBe("billing-module");
        expect(error.code).toBe("DEPENDENCY_ERROR");
        expect(error.cause).toBeUndefined();
      });

      it("should create dependency error with cause", () => {
        const cause = new Error("Module not found");
        const error = new ModuleDependencyError(
          "test-module",
          "missing-module",
          cause,
        );

        expect(error.message).toBe(
          "Module 'test-module' requires dependency 'missing-module'",
        );
        expect(error.cause).toBe(cause);
      });

      it("should be instanceof both ModuleError and ModuleDependencyError", () => {
        const error = new ModuleDependencyError("test", "dep");

        expect(error instanceof Error).toBe(true);
        expect(error instanceof ModuleError).toBe(true);
        expect(error instanceof ModuleDependencyError).toBe(true);
      });
    });

    describe("ModuleConfigurationError", () => {
      it("should create configuration error with formatted message", () => {
        const error = new ModuleConfigurationError(
          "config-module",
          "invalid version format",
        );

        expect(error).toBeInstanceOf(ModuleError);
        expect(error).toBeInstanceOf(ModuleConfigurationError);
        expect(error.name).toBe("ModuleConfigurationError");
        expect(error.message).toBe(
          "Module 'config-module' configuration error: invalid version format",
        );
        expect(error.moduleName).toBe("config-module");
        expect(error.code).toBe("CONFIGURATION_ERROR");
      });

      it("should create configuration error with cause", () => {
        const cause = new Error("JSON parse error");
        const error = new ModuleConfigurationError(
          "test-module",
          "malformed JSON",
          cause,
        );

        expect(error.message).toBe(
          "Module 'test-module' configuration error: malformed JSON",
        );
        expect(error.cause).toBe(cause);
      });

      it("should be instanceof both ModuleError and ModuleConfigurationError", () => {
        const error = new ModuleConfigurationError("test", "config issue");

        expect(error instanceof Error).toBe(true);
        expect(error instanceof ModuleError).toBe(true);
        expect(error instanceof ModuleConfigurationError).toBe(true);
      });
    });

    describe("ModuleLifecycleError", () => {
      it("should create lifecycle error with formatted message", () => {
        const error = new ModuleLifecycleError(
          "lifecycle-module",
          "start",
          ModuleState.FAILED,
        );

        expect(error).toBeInstanceOf(ModuleError);
        expect(error).toBeInstanceOf(ModuleLifecycleError);
        expect(error.name).toBe("ModuleLifecycleError");
        expect(error.message).toBe(
          "Module 'lifecycle-module' cannot start from state failed",
        );
        expect(error.moduleName).toBe("lifecycle-module");
        expect(error.code).toBe("LIFECYCLE_ERROR");
      });

      it("should create lifecycle error with cause", () => {
        const cause = new Error("Resource busy");
        const error = new ModuleLifecycleError(
          "test-module",
          "stop",
          ModuleState.STARTING,
          cause,
        );

        expect(error.message).toBe(
          "Module 'test-module' cannot stop from state starting",
        );
        expect(error.cause).toBe(cause);
      });

      it("should work with different states and operations", () => {
        const installError = new ModuleLifecycleError(
          "test",
          "install",
          ModuleState.RUNNING,
        );
        const configError = new ModuleLifecycleError(
          "test",
          "configure",
          ModuleState.UNINSTALLED,
        );

        expect(installError.message).toContain(
          "cannot install from state running",
        );
        expect(configError.message).toContain(
          "cannot configure from state uninstalled",
        );
      });

      it("should be instanceof both ModuleError and ModuleLifecycleError", () => {
        const error = new ModuleLifecycleError(
          "test",
          "start",
          ModuleState.FAILED,
        );

        expect(error instanceof Error).toBe(true);
        expect(error instanceof ModuleError).toBe(true);
        expect(error instanceof ModuleLifecycleError).toBe(true);
      });
    });

    describe("Error Hierarchy", () => {
      it("should maintain proper error hierarchy", () => {
        const moduleError = new ModuleError("base", "module", "BASE");
        const depError = new ModuleDependencyError("module", "dep");
        const configError = new ModuleConfigurationError("module", "config");
        const lifecycleError = new ModuleLifecycleError(
          "module",
          "start",
          ModuleState.FAILED,
        );

        // All should be instances of Error
        expect(moduleError instanceof Error).toBe(true);
        expect(depError instanceof Error).toBe(true);
        expect(configError instanceof Error).toBe(true);
        expect(lifecycleError instanceof Error).toBe(true);

        // All should be instances of ModuleError
        expect(moduleError instanceof ModuleError).toBe(true);
        expect(depError instanceof ModuleError).toBe(true);
        expect(configError instanceof ModuleError).toBe(true);
        expect(lifecycleError instanceof ModuleError).toBe(true);

        // Specific error types should only be instances of their specific type
        expect(depError instanceof ModuleDependencyError).toBe(true);
        expect(depError instanceof ModuleConfigurationError).toBe(false);
        expect(depError instanceof ModuleLifecycleError).toBe(false);

        expect(configError instanceof ModuleDependencyError).toBe(false);
        expect(configError instanceof ModuleConfigurationError).toBe(true);
        expect(configError instanceof ModuleLifecycleError).toBe(false);

        expect(lifecycleError instanceof ModuleDependencyError).toBe(false);
        expect(lifecycleError instanceof ModuleConfigurationError).toBe(false);
        expect(lifecycleError instanceof ModuleLifecycleError).toBe(true);
      });

      it("should be catchable as generic ModuleError", () => {
        const errors = [
          new ModuleDependencyError("test", "dep"),
          new ModuleConfigurationError("test", "config"),
          new ModuleLifecycleError("test", "start", ModuleState.FAILED),
        ];

        for (const error of errors) {
          try {
            throw error;
          } catch (e) {
            expect(e instanceof ModuleError).toBe(true);
            expect((e as ModuleError).moduleName).toBe("test");
            expect((e as ModuleError).code).toBeTruthy();
          }
        }
      });
    });
  });

  describe("Type Compatibility and Integration", () => {
    it("should work with external type dependencies", () => {
      // Test that our types work with imported types
      const router: AnyTRPCRouter = {} as any;
      const middleware: ModuleMiddleware = {
        name: "external-test",
        priority: 1,
        execute: async (_req: NextRequest, _res: NextResponse, next) => next(),
      };

      expect(typeof router).toBe("object");
      expect(typeof middleware.execute).toBe("function");
    });

    it("should maintain type safety with complex nested structures", () => {
      const complexConfig: ModuleConfig = {
        name: "complex-module",
        version: "2.1.0",
        description: "Complex configuration test",
        priority: ModulePriority.HIGH,
        dependencies: ["auth", "database", "cache"],
        requiredPermissions: ["admin:read", "admin:write", "user:*"],
        requiredEnvVars: ["DATABASE_URL", "REDIS_URL", "JWT_SECRET"],
        settings: {
          database: {
            poolSize: 10,
            timeout: 5000,
            ssl: true,
          },
          cache: {
            ttl: 3600,
            maxSize: "100MB",
          },
          features: {
            analytics: true,
            notifications: false,
            beta: {
              newFeature: true,
              experimentalApi: false,
            },
          },
        },
        supportsHotReload: true,
      };

      expect(complexConfig.dependencies).toHaveLength(3);
      expect(complexConfig.settings.database).toBeDefined();
      expect(typeof complexConfig.settings.features).toBe("object");
    });

    it("should support generic type parameters correctly", () => {
      // Test that readonly arrays work correctly
      const permissions: readonly string[] = ["read", "write"];
      const dependencies: readonly string[] = ["module-a", "module-b"];

      const config: ModuleConfig = {
        name: "generic-test",
        version: "1.0.0",
        description: "Generic type test",
        priority: ModulePriority.MEDIUM,
        dependencies,
        requiredPermissions: permissions,
        requiredEnvVars: [],
        settings: {},
        supportsHotReload: false,
      };

      expect(config.dependencies).toBe(dependencies);
      expect(config.requiredPermissions).toBe(permissions);
    });
  });

  describe("Enum Interoperability", () => {
    it("should work with Object.values and Object.keys", () => {
      expect(Object.values(ModuleState)).toHaveLength(7);
      expect(Object.values(HealthStatus)).toHaveLength(4);
      // ModulePriority is numeric enum, so Object.values includes both keys and values
      expect(Object.values(ModulePriority)).toHaveLength(8); // 4 keys + 4 numeric values
      expect(Object.values(ModuleEventType)).toHaveLength(12);

      expect(Object.keys(ModuleState)).toContain("RUNNING");
      expect(Object.keys(HealthStatus)).toContain("HEALTHY");
      expect(Object.keys(ModulePriority)).toContain("CRITICAL");
      expect(Object.keys(ModuleEventType)).toContain("STARTED");
    });

    it("should support enum iteration", () => {
      const states: ModuleState[] = [];
      for (const state of Object.values(ModuleState)) {
        states.push(state);
      }

      expect(states).toHaveLength(7);
      expect(states).toContain(ModuleState.RUNNING);
      expect(states).toContain(ModuleState.FAILED);
    });

    it("should support reverse lookup for numeric enums", () => {
      // ModulePriority is numeric enum, should support reverse lookup
      expect(ModulePriority[0]).toBe("CRITICAL");
      expect(ModulePriority[1]).toBe("HIGH");
      expect(ModulePriority[2]).toBe("MEDIUM");
      expect(ModulePriority[3]).toBe("LOW");
    });

    it("should be JSON serializable", () => {
      const data = {
        state: ModuleState.RUNNING,
        priority: ModulePriority.HIGH,
        health: HealthStatus.HEALTHY,
        event: ModuleEventType.STARTED,
      };

      const json = JSON.stringify(data);
      const parsed = JSON.parse(json);

      expect(parsed.state).toBe("running");
      expect(parsed.priority).toBe(1);
      expect(parsed.health).toBe("healthy");
      expect(parsed.event).toBe("module:started");
    });
  });
});
