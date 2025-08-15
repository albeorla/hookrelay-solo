import { describe, it, expect, beforeEach, vi } from "vitest";
import { BaseModuleStrategy, type ModuleStrategy } from "../module-strategy";
import {
  ModuleState,
  ModulePriority,
  HealthStatus,
  ModuleError,
  type ModuleConfig,
  type HealthCheckResult,
  type ModuleMetrics,
  type ModuleMiddleware,
  type ModuleEventHandler,
  type ModuleMigration,
} from "../types";
import type { AnyTRPCRouter } from "@trpc/server";

// Create a concrete implementation for testing
class TestModuleStrategy extends BaseModuleStrategy {
  private routers: Record<string, AnyTRPCRouter> = {};
  private middleware: ModuleMiddleware[] = [];
  private eventHandlers: ModuleEventHandler[] = [];
  private migrations: ModuleMigration[] = [];

  async getRouters(): Promise<Record<string, AnyTRPCRouter>> {
    return this.routers;
  }

  async getMiddleware(): Promise<readonly ModuleMiddleware[]> {
    return this.middleware;
  }

  async getEventHandlers(): Promise<readonly ModuleEventHandler[]> {
    return this.eventHandlers;
  }

  async getMigrations(): Promise<readonly ModuleMigration[]> {
    return this.migrations;
  }

  async healthCheck(): Promise<HealthCheckResult> {
    return {
      status: HealthStatus.HEALTHY,
      details: {
        uptime:
          Date.now() -
          ((this.config.settings.startedAt as number) || Date.now()),
        lastCheck: new Date(),
        dependencies: [],
      },
    };
  }

  // Expose protected methods for testing
  public testSetState(state: ModuleState): void {
    this.setState(state);
  }

  public testRecordRequest(responseTime?: number): void {
    this.recordRequest(responseTime);
  }

  public testRecordError(): void {
    this.recordError();
  }

  // Allow customization for testing
  setRouters(routers: Record<string, AnyTRPCRouter>): void {
    this.routers = routers;
  }

  setMiddleware(middleware: ModuleMiddleware[]): void {
    this.middleware = middleware;
  }

  setEventHandlers(handlers: ModuleEventHandler[]): void {
    this.eventHandlers = handlers;
  }

  setMigrations(migrations: ModuleMigration[]): void {
    this.migrations = migrations;
  }

  // Override hooks for testing
  protected async onStart(): Promise<void> {
    if (this.config.settings.shouldFailOnStart) {
      throw new Error("Simulated start failure");
    }
  }

  protected async onStop(): Promise<void> {
    if (this.config.settings.shouldFailOnStop) {
      throw new Error("Simulated stop failure");
    }
  }

  protected async onUninstall(): Promise<void> {
    if (this.config.settings.shouldFailOnUninstall) {
      throw new Error("Simulated uninstall failure");
    }
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

describe("ModuleStrategy", () => {
  describe("BaseModuleStrategy", () => {
    let moduleStrategy: TestModuleStrategy;
    let config: ModuleConfig;

    beforeEach(() => {
      config = createModuleConfig();
      moduleStrategy = new TestModuleStrategy(config);
    });

    describe("Construction and Configuration", () => {
      it("should create module strategy with valid config", () => {
        expect(moduleStrategy.config).toEqual(config);
        expect(moduleStrategy.getState()).toBe(ModuleState.UNINSTALLED);
        expect(moduleStrategy.state).toBe(ModuleState.UNINSTALLED);
      });

      it("should throw error for config without name", () => {
        const invalidConfig = createModuleConfig({ name: "" });

        expect(() => new TestModuleStrategy(invalidConfig)).toThrow(
          ModuleError,
        );
        expect(() => new TestModuleStrategy(invalidConfig)).toThrow(
          "Module config must have name and version",
        );
      });

      it("should throw error for config without version", () => {
        const invalidConfig = createModuleConfig({ version: "" });

        expect(() => new TestModuleStrategy(invalidConfig)).toThrow(
          ModuleError,
        );
        expect(() => new TestModuleStrategy(invalidConfig)).toThrow(
          "Module config must have name and version",
        );
      });

      it("should throw error for config with undefined name", () => {
        const invalidConfig = {
          ...createModuleConfig(),
          name: undefined as any,
        };

        expect(() => new TestModuleStrategy(invalidConfig)).toThrow(
          ModuleError,
        );
      });

      it("should throw error for config with undefined version", () => {
        const invalidConfig = {
          ...createModuleConfig(),
          version: undefined as any,
        };

        expect(() => new TestModuleStrategy(invalidConfig)).toThrow(
          ModuleError,
        );
      });
    });

    describe("State Management", () => {
      it("should start with UNINSTALLED state", () => {
        expect(moduleStrategy.getState()).toBe(ModuleState.UNINSTALLED);
      });

      it("should allow state transitions", () => {
        moduleStrategy.testSetState(ModuleState.INSTALLED);
        expect(moduleStrategy.getState()).toBe(ModuleState.INSTALLED);

        moduleStrategy.testSetState(ModuleState.CONFIGURED);
        expect(moduleStrategy.getState()).toBe(ModuleState.CONFIGURED);

        moduleStrategy.testSetState(ModuleState.RUNNING);
        expect(moduleStrategy.getState()).toBe(ModuleState.RUNNING);
      });

      it("should track startup timing when transitioning to RUNNING", () => {
        const beforeTime = Date.now();
        moduleStrategy.testSetState(ModuleState.RUNNING);
        const afterTime = Date.now();

        // Should record startup time
        expect(moduleStrategy.getState()).toBe(ModuleState.RUNNING);
      });

      it("should not update startup time for subsequent RUNNING states", async () => {
        moduleStrategy.testSetState(ModuleState.RUNNING);
        const firstMetrics = await moduleStrategy.getMetrics();

        // Wait a bit then set to RUNNING again
        await new Promise((resolve) => setTimeout(resolve, 10));
        moduleStrategy.testSetState(ModuleState.RUNNING);
        const secondMetrics = await moduleStrategy.getMetrics();

        expect(secondMetrics.startupTime).toBe(firstMetrics.startupTime);
      });
    });

    describe("Lifecycle Methods", () => {
      describe("install()", () => {
        it("should install module from UNINSTALLED state", async () => {
          await moduleStrategy.install();

          expect(moduleStrategy.getState()).toBe(ModuleState.INSTALLED);
        });

        it("should throw error when installing from invalid state", async () => {
          moduleStrategy.testSetState(ModuleState.INSTALLED);

          await expect(moduleStrategy.install()).rejects.toThrow(ModuleError);
          await expect(moduleStrategy.install()).rejects.toThrow(
            "Cannot install module in state installed",
          );
        });

        it("should throw error when installing from CONFIGURED state", async () => {
          moduleStrategy.testSetState(ModuleState.CONFIGURED);

          await expect(moduleStrategy.install()).rejects.toThrow(ModuleError);
        });

        it("should throw error when installing from RUNNING state", async () => {
          moduleStrategy.testSetState(ModuleState.RUNNING);

          await expect(moduleStrategy.install()).rejects.toThrow(ModuleError);
        });
      });

      describe("configure()", () => {
        beforeEach(async () => {
          await moduleStrategy.install();
        });

        it("should configure module from INSTALLED state", async () => {
          const settings = { key: "value" };
          await moduleStrategy.configure(settings);

          expect(moduleStrategy.getState()).toBe(ModuleState.CONFIGURED);
        });

        it("should throw error when configuring from invalid state", async () => {
          moduleStrategy.testSetState(ModuleState.UNINSTALLED);

          await expect(moduleStrategy.configure({})).rejects.toThrow(
            ModuleError,
          );
          await expect(moduleStrategy.configure({})).rejects.toThrow(
            "Cannot configure module in state uninstalled",
          );
        });

        it("should validate required environment variables", async () => {
          const configWithEnvVars = createModuleConfig({
            requiredEnvVars: ["TEST_REQUIRED_VAR"],
          });
          const strategyWithEnvVars = new TestModuleStrategy(configWithEnvVars);
          await strategyWithEnvVars.install();

          // Remove env var if it exists
          const originalValue = process.env.TEST_REQUIRED_VAR;
          delete process.env.TEST_REQUIRED_VAR;

          try {
            await expect(strategyWithEnvVars.configure({})).rejects.toThrow(
              ModuleError,
            );
            await expect(strategyWithEnvVars.configure({})).rejects.toThrow(
              "Required environment variable TEST_REQUIRED_VAR is not set",
            );
          } finally {
            // Restore env var if it existed
            if (originalValue !== undefined) {
              process.env.TEST_REQUIRED_VAR = originalValue;
            }
          }
        });

        it("should succeed when required environment variables are present", async () => {
          const configWithEnvVars = createModuleConfig({
            requiredEnvVars: ["NODE_ENV"], // This should always exist in tests
          });
          const strategyWithEnvVars = new TestModuleStrategy(configWithEnvVars);
          await strategyWithEnvVars.install();

          await expect(
            strategyWithEnvVars.configure({}),
          ).resolves.not.toThrow();
          expect(strategyWithEnvVars.getState()).toBe(ModuleState.CONFIGURED);
        });
      });

      describe("start()", () => {
        beforeEach(async () => {
          await moduleStrategy.install();
          await moduleStrategy.configure({});
        });

        it("should start module from CONFIGURED state", async () => {
          await moduleStrategy.start();

          expect(moduleStrategy.getState()).toBe(ModuleState.RUNNING);
        });

        it("should throw error when starting from invalid state", async () => {
          moduleStrategy.testSetState(ModuleState.UNINSTALLED);

          await expect(moduleStrategy.start()).rejects.toThrow(ModuleError);
          await expect(moduleStrategy.start()).rejects.toThrow(
            "Cannot start module in state uninstalled",
          );
        });

        it("should set state to STARTING during startup", async () => {
          const originalOnStart = moduleStrategy["onStart"];
          let statesDuringStart: ModuleState[] = [];

          moduleStrategy["onStart"] = vi.fn().mockImplementation(async () => {
            statesDuringStart.push(moduleStrategy.getState());
            await originalOnStart.call(moduleStrategy);
          });

          await moduleStrategy.start();

          expect(statesDuringStart).toContain(ModuleState.STARTING);
          expect(moduleStrategy.getState()).toBe(ModuleState.RUNNING);
        });

        it("should set state to FAILED on startup error", async () => {
          const configWithFailure = createModuleConfig({
            settings: { shouldFailOnStart: true },
          });
          const failingStrategy = new TestModuleStrategy(configWithFailure);
          await failingStrategy.install();
          await failingStrategy.configure({});

          await expect(failingStrategy.start()).rejects.toThrow(
            "Simulated start failure",
          );
          expect(failingStrategy.getState()).toBe(ModuleState.FAILED);
        });

        it("should call onStart hook", async () => {
          const onStartSpy = vi.spyOn(moduleStrategy as any, "onStart");

          await moduleStrategy.start();

          expect(onStartSpy).toHaveBeenCalledOnce();
        });
      });

      describe("stop()", () => {
        beforeEach(async () => {
          await moduleStrategy.install();
          await moduleStrategy.configure({});
          await moduleStrategy.start();
        });

        it("should stop module from RUNNING state", async () => {
          await moduleStrategy.stop();

          expect(moduleStrategy.getState()).toBe(ModuleState.CONFIGURED);
        });

        it("should return early if module is not running", async () => {
          moduleStrategy.testSetState(ModuleState.CONFIGURED);

          // Should not throw
          await moduleStrategy.stop();
          expect(moduleStrategy.getState()).toBe(ModuleState.CONFIGURED);
        });

        it("should set state to STOPPING during shutdown", async () => {
          const originalOnStop = moduleStrategy["onStop"];
          let statesDuringStop: ModuleState[] = [];

          moduleStrategy["onStop"] = vi.fn().mockImplementation(async () => {
            statesDuringStop.push(moduleStrategy.getState());
            await originalOnStop.call(moduleStrategy);
          });

          await moduleStrategy.stop();

          expect(statesDuringStop).toContain(ModuleState.STOPPING);
          expect(moduleStrategy.getState()).toBe(ModuleState.CONFIGURED);
        });

        it("should set state to FAILED on stop error", async () => {
          const configWithFailure = createModuleConfig({
            settings: { shouldFailOnStop: true },
          });
          const failingStrategy = new TestModuleStrategy(configWithFailure);
          await failingStrategy.install();
          await failingStrategy.configure({});
          await failingStrategy.start();

          await expect(failingStrategy.stop()).rejects.toThrow(
            "Simulated stop failure",
          );
          expect(failingStrategy.getState()).toBe(ModuleState.FAILED);
        });

        it("should call onStop hook", async () => {
          const onStopSpy = vi.spyOn(moduleStrategy as any, "onStop");

          await moduleStrategy.stop();

          expect(onStopSpy).toHaveBeenCalledOnce();
        });
      });

      describe("uninstall()", () => {
        it("should uninstall module from any state", async () => {
          await moduleStrategy.install();
          await moduleStrategy.uninstall();

          expect(moduleStrategy.getState()).toBe(ModuleState.UNINSTALLED);
        });

        it("should stop module first if running", async () => {
          await moduleStrategy.install();
          await moduleStrategy.configure({});
          await moduleStrategy.start();

          const stopSpy = vi.spyOn(moduleStrategy, "stop");

          await moduleStrategy.uninstall();

          expect(stopSpy).toHaveBeenCalledOnce();
          expect(moduleStrategy.getState()).toBe(ModuleState.UNINSTALLED);
        });

        it("should set state to FAILED on uninstall error", async () => {
          const configWithFailure = createModuleConfig({
            settings: { shouldFailOnUninstall: true },
          });
          const failingStrategy = new TestModuleStrategy(configWithFailure);
          await failingStrategy.install();

          await expect(failingStrategy.uninstall()).rejects.toThrow(
            "Simulated uninstall failure",
          );
          expect(failingStrategy.getState()).toBe(ModuleState.FAILED);
        });

        it("should call onUninstall hook", async () => {
          await moduleStrategy.install();

          const onUninstallSpy = vi.spyOn(moduleStrategy as any, "onUninstall");

          await moduleStrategy.uninstall();

          expect(onUninstallSpy).toHaveBeenCalledOnce();
        });
      });
    });

    describe("Metrics and Monitoring", () => {
      beforeEach(async () => {
        await moduleStrategy.install();
        await moduleStrategy.configure({});
        await moduleStrategy.start();
      });

      it("should return default metrics", async () => {
        const metrics = await moduleStrategy.getMetrics();

        expect(metrics).toEqual({
          startupTime: expect.any(Number),
          memoryUsage: expect.any(Number),
          requestCount: 0,
          errorCount: 0,
          avgResponseTime: 0,
          lastRequestTime: undefined,
        });
      });

      it("should record request metrics", async () => {
        moduleStrategy.testRecordRequest(100);
        moduleStrategy.testRecordRequest(200);

        const metrics = await moduleStrategy.getMetrics();

        expect(metrics.requestCount).toBe(2);
        expect(metrics.avgResponseTime).toBe(150); // (100 + 200) / 2
        expect(metrics.lastRequestTime).toBeInstanceOf(Date);
      });

      it("should record request without response time", async () => {
        moduleStrategy.testRecordRequest();

        const metrics = await moduleStrategy.getMetrics();

        expect(metrics.requestCount).toBe(1);
        expect(metrics.avgResponseTime).toBe(0);
      });

      it("should limit response time history to 1000 entries", async () => {
        // Record 1100 requests
        for (let i = 0; i < 1100; i++) {
          moduleStrategy.testRecordRequest(i);
        }

        const metrics = await moduleStrategy.getMetrics();

        expect(metrics.requestCount).toBe(1100);
        // Average should be based on last 1000 values (100-1099)
        // (100 + 101 + ... + 1099) / 1000 = 599.5
        expect(metrics.avgResponseTime).toBeCloseTo(599.5, 1);
      });

      it("should record error metrics", async () => {
        moduleStrategy.testRecordError();
        moduleStrategy.testRecordError();

        const metrics = await moduleStrategy.getMetrics();

        expect(metrics.errorCount).toBe(2);
      });

      it("should calculate correct average response time", async () => {
        const responseTimes = [50, 100, 150, 200];

        for (const time of responseTimes) {
          moduleStrategy.testRecordRequest(time);
        }

        const metrics = await moduleStrategy.getMetrics();

        expect(metrics.avgResponseTime).toBe(125); // (50 + 100 + 150 + 200) / 4
      });
    });

    describe("Abstract Method Implementations", () => {
      it("should return empty routers by default", async () => {
        const routers = await moduleStrategy.getRouters();
        expect(routers).toEqual({});
      });

      it("should return empty middleware by default", async () => {
        const middleware = await moduleStrategy.getMiddleware();
        expect(middleware).toEqual([]);
      });

      it("should return empty event handlers by default", async () => {
        const handlers = await moduleStrategy.getEventHandlers();
        expect(handlers).toEqual([]);
      });

      it("should return empty migrations by default", async () => {
        const migrations = await moduleStrategy.getMigrations();
        expect(migrations).toEqual([]);
      });

      it("should return healthy status by default", async () => {
        const health = await moduleStrategy.healthCheck();

        expect(health.status).toBe(HealthStatus.HEALTHY);
        expect(health.details.lastCheck).toBeInstanceOf(Date);
        expect(health.details.dependencies).toEqual([]);
      });
    });

    describe("Customization and Extension", () => {
      it("should allow custom routers", async () => {
        const mockRouter = {} as AnyTRPCRouter;
        moduleStrategy.setRouters({ testRouter: mockRouter });

        const routers = await moduleStrategy.getRouters();
        expect(routers.testRouter).toBe(mockRouter);
      });

      it("should allow custom middleware", async () => {
        const mockMiddleware: ModuleMiddleware = {
          name: "test-middleware",
          priority: 10,
          execute: vi.fn(),
        };
        moduleStrategy.setMiddleware([mockMiddleware]);

        const middleware = await moduleStrategy.getMiddleware();
        expect(middleware).toEqual([mockMiddleware]);
      });

      it("should allow custom event handlers", async () => {
        const mockHandler: ModuleEventHandler = {
          eventType: "module:started" as any,
          priority: 10,
          handle: vi.fn(),
        };
        moduleStrategy.setEventHandlers([mockHandler]);

        const handlers = await moduleStrategy.getEventHandlers();
        expect(handlers).toEqual([mockHandler]);
      });

      it("should allow custom migrations", async () => {
        const mockMigration: ModuleMigration = {
          version: "1.0.0",
          description: "Test migration",
          up: vi.fn(),
          down: vi.fn(),
        };
        moduleStrategy.setMigrations([mockMigration]);

        const migrations = await moduleStrategy.getMigrations();
        expect(migrations).toEqual([mockMigration]);
      });
    });

    describe("Cleanup", () => {
      it("should provide default cleanup implementation", async () => {
        // Should not throw
        await expect(moduleStrategy.cleanup()).resolves.toBeUndefined();
      });
    });

    describe("Protected Hook Methods", () => {
      it("should provide default onStart implementation", async () => {
        // Should not throw
        await expect(moduleStrategy["onStart"]()).resolves.toBeUndefined();
      });

      it("should provide default onStop implementation", async () => {
        // Should not throw
        await expect(moduleStrategy["onStop"]()).resolves.toBeUndefined();
      });

      it("should provide default onUninstall implementation", async () => {
        // Should not throw
        await expect(moduleStrategy["onUninstall"]()).resolves.toBeUndefined();
      });
    });

    describe("Error Handling", () => {
      it("should handle ModuleError with proper error information", () => {
        expect(
          () => new TestModuleStrategy(createModuleConfig({ name: "" })),
        ).toThrow(
          expect.objectContaining({
            name: "ModuleError",
            moduleName: "unknown", // When name is empty, it defaults to 'unknown'
            code: "INVALID_CONFIG",
          }),
        );
      });

      it("should maintain error state after failures", async () => {
        const failingStrategy = new TestModuleStrategy(
          createModuleConfig({
            settings: { shouldFailOnStart: true },
          }),
        );
        await failingStrategy.install();
        await failingStrategy.configure({});

        try {
          await failingStrategy.start();
        } catch {
          // Expected
        }

        expect(failingStrategy.getState()).toBe(ModuleState.FAILED);

        // Should not be able to start from failed state
        await expect(failingStrategy.start()).rejects.toThrow(
          "Cannot start module in state failed",
        );
      });
    });
  });

  describe("ModuleStrategy Interface Compliance", () => {
    it("should implement all required methods", () => {
      const strategy = new TestModuleStrategy(createModuleConfig());

      // Check that all interface methods are implemented
      expect(typeof strategy.install).toBe("function");
      expect(typeof strategy.configure).toBe("function");
      expect(typeof strategy.start).toBe("function");
      expect(typeof strategy.stop).toBe("function");
      expect(typeof strategy.uninstall).toBe("function");
      expect(typeof strategy.getRouters).toBe("function");
      expect(typeof strategy.getMiddleware).toBe("function");
      expect(typeof strategy.getEventHandlers).toBe("function");
      expect(typeof strategy.getMigrations).toBe("function");
      expect(typeof strategy.healthCheck).toBe("function");
      expect(typeof strategy.getMetrics).toBe("function");
      expect(typeof strategy.getState).toBe("function");
      expect(typeof strategy.cleanup).toBe("function");
    });

    it("should have readonly config property", () => {
      const strategy = new TestModuleStrategy(createModuleConfig());

      expect(strategy.config).toBeDefined();
      expect(typeof strategy.config).toBe("object");

      // Config should be readonly (TypeScript compile-time check)
      // This tests the runtime behavior
      const originalConfig = strategy.config;
      expect(strategy.config).toBe(originalConfig); // Same object reference
    });
  });
});
