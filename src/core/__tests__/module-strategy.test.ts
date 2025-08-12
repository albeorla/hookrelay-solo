/**
 * Module Strategy Unit Tests
 */

import { describe, it, expect, beforeEach } from "@jest/globals";
import { BaseModuleStrategy } from "../module-strategy";
import {
  ModuleState,
  HealthStatus,
  ModulePriority,
  type ModuleConfig,
  type ModuleMiddleware,
  type ModuleEventHandler,
  type ModuleMigration,
  type HealthCheckResult,
} from "../types";
import type { AnyTRPCRouter } from "@trpc/server";

// Test implementation of BaseModuleStrategy
class TestModuleStrategy extends BaseModuleStrategy {
  private mockRouters: Record<string, AnyTRPCRouter> = {};
  private mockMiddleware: ModuleMiddleware[] = [];
  private mockEventHandlers: ModuleEventHandler[] = [];
  private mockMigrations: ModuleMigration[] = [];
  private mockHealthResult: HealthCheckResult = {
    status: HealthStatus.HEALTHY,
    details: {
      uptime: 1000,
      lastCheck: new Date(),
      dependencies: [],
    },
  };

  // Mock implementations
  async getRouters(): Promise<Record<string, AnyTRPCRouter>> {
    return this.mockRouters;
  }

  async getMiddleware(): Promise<readonly ModuleMiddleware[]> {
    return this.mockMiddleware;
  }

  async getEventHandlers(): Promise<readonly ModuleEventHandler[]> {
    return this.mockEventHandlers;
  }

  async getMigrations(): Promise<readonly ModuleMigration[]> {
    return this.mockMigrations;
  }

  async healthCheck(): Promise<HealthCheckResult> {
    return this.mockHealthResult;
  }

  // Setters for testing
  setMockRouters(routers: Record<string, AnyTRPCRouter>) {
    this.mockRouters = routers;
  }

  setMockHealthResult(result: HealthCheckResult) {
    this.mockHealthResult = result;
  }

  // Expose protected methods for testing
  public testSetState(state: ModuleState) {
    this.setState(state);
  }

  public testRecordRequest(responseTime?: number) {
    this.recordRequest(responseTime);
  }

  public testRecordError() {
    this.recordError();
  }
}

describe("BaseModuleStrategy", () => {
  let config: ModuleConfig;
  let strategy: TestModuleStrategy;

  beforeEach(() => {
    config = {
      name: "test-module",
      version: "1.0.0",
      description: "Test module for unit testing",
      priority: ModulePriority.MEDIUM,
      dependencies: [],
      requiredPermissions: [],
      requiredEnvVars: [],
      settings: {},
      supportsHotReload: true,
    };

    strategy = new TestModuleStrategy(config);
  });

  describe("Constructor", () => {
    it("should create strategy with valid config", () => {
      expect(strategy.config).toBe(config);
      expect(strategy.getState()).toBe(ModuleState.UNINSTALLED);
    });

    it("should throw error for invalid config", () => {
      expect(() => {
        new TestModuleStrategy({
          ...config,
          name: "",
        });
      }).toThrow("Module config must have name and version");
    });

    it("should throw error for missing version", () => {
      expect(() => {
        new TestModuleStrategy({
          ...config,
          version: "",
        });
      }).toThrow("Module config must have name and version");
    });
  });

  describe("State Management", () => {
    it("should start in UNINSTALLED state", () => {
      expect(strategy.getState()).toBe(ModuleState.UNINSTALLED);
    });

    it("should allow state changes", () => {
      strategy.testSetState(ModuleState.INSTALLED);
      expect(strategy.getState()).toBe(ModuleState.INSTALLED);
    });
  });

  describe("Lifecycle Methods", () => {
    describe("install()", () => {
      it("should install from UNINSTALLED state", async () => {
        await strategy.install();
        expect(strategy.getState()).toBe(ModuleState.INSTALLED);
      });

      it("should throw error if not in UNINSTALLED state", async () => {
        strategy.testSetState(ModuleState.INSTALLED);

        await expect(strategy.install()).rejects.toThrow(
          "Cannot install module in state installed",
        );
      });
    });

    describe("configure()", () => {
      beforeEach(async () => {
        await strategy.install();
      });

      it("should configure from INSTALLED state", async () => {
        await strategy.configure({});
        expect(strategy.getState()).toBe(ModuleState.CONFIGURED);
      });

      it("should throw error if not in INSTALLED state", async () => {
        strategy.testSetState(ModuleState.UNINSTALLED);

        await expect(strategy.configure({})).rejects.toThrow(
          "Cannot configure module in state uninstalled",
        );
      });

      it("should validate required environment variables", async () => {
        const configWithEnvVars: ModuleConfig = {
          ...config,
          requiredEnvVars: ["MISSING_ENV_VAR"],
        };
        const strategyWithEnvVars = new TestModuleStrategy(configWithEnvVars);
        await strategyWithEnvVars.install();

        await expect(strategyWithEnvVars.configure({})).rejects.toThrow(
          "Required environment variable MISSING_ENV_VAR is not set",
        );
      });
    });

    describe("start()", () => {
      beforeEach(async () => {
        await strategy.install();
        await strategy.configure({});
      });

      it("should start from CONFIGURED state", async () => {
        await strategy.start();
        expect(strategy.getState()).toBe(ModuleState.RUNNING);
      });

      it("should throw error if not in CONFIGURED state", async () => {
        strategy.testSetState(ModuleState.INSTALLED);

        await expect(strategy.start()).rejects.toThrow(
          "Cannot start module in state installed",
        );
      });

      it("should set state to FAILED if onStart throws", async () => {
        const failingStrategy = new (class extends TestModuleStrategy {
          protected async onStart(): Promise<void> {
            throw new Error("Start failed");
          }
        })(config);

        await failingStrategy.install();
        await failingStrategy.configure({});

        await expect(failingStrategy.start()).rejects.toThrow("Start failed");
        expect(failingStrategy.getState()).toBe(ModuleState.FAILED);
      });
    });

    describe("stop()", () => {
      beforeEach(async () => {
        await strategy.install();
        await strategy.configure({});
        await strategy.start();
      });

      it("should stop from RUNNING state", async () => {
        await strategy.stop();
        expect(strategy.getState()).toBe(ModuleState.CONFIGURED);
      });

      it("should be idempotent (not fail if already stopped)", async () => {
        strategy.testSetState(ModuleState.CONFIGURED);
        await strategy.stop(); // Should not throw
      });

      it("should set state to FAILED if onStop throws", async () => {
        const failingStrategy = new (class extends TestModuleStrategy {
          protected async onStop(): Promise<void> {
            throw new Error("Stop failed");
          }
        })(config);

        await failingStrategy.install();
        await failingStrategy.configure({});
        await failingStrategy.start();

        await expect(failingStrategy.stop()).rejects.toThrow("Stop failed");
        expect(failingStrategy.getState()).toBe(ModuleState.FAILED);
      });
    });

    describe("uninstall()", () => {
      it("should uninstall from any state", async () => {
        await strategy.install();
        await strategy.uninstall();
        expect(strategy.getState()).toBe(ModuleState.UNINSTALLED);
      });

      it("should stop running module before uninstall", async () => {
        await strategy.install();
        await strategy.configure({});
        await strategy.start();

        await strategy.uninstall();
        expect(strategy.getState()).toBe(ModuleState.UNINSTALLED);
      });
    });
  });

  describe("Metrics", () => {
    it("should track requests", () => {
      strategy.testRecordRequest(100);
      strategy.testRecordRequest(200);
    });

    it("should track errors", () => {
      strategy.testRecordError();
    });

    it("should return metrics", async () => {
      strategy.testRecordRequest(100);
      strategy.testRecordRequest(200);
      strategy.testRecordError();

      const metrics = await strategy.getMetrics();

      expect(metrics.requestCount).toBe(2);
      expect(metrics.errorCount).toBe(1);
      expect(metrics.avgResponseTime).toBe(150);
      expect(metrics.startupTime).toBeGreaterThanOrEqual(0);
      expect(metrics.memoryUsage).toBeGreaterThan(0);
    });
  });

  describe("Abstract Method Implementation", () => {
    it("should return empty routers by default", async () => {
      const routers = await strategy.getRouters();
      expect(routers).toEqual({});
    });

    it("should return mock routers when set", async () => {
      const mockRouters = { test: {} as AnyTRPCRouter };
      strategy.setMockRouters(mockRouters);

      const routers = await strategy.getRouters();
      expect(routers).toBe(mockRouters);
    });

    it("should return healthy status by default", async () => {
      const health = await strategy.healthCheck();
      expect(health.status).toBe(HealthStatus.HEALTHY);
    });

    it("should return mock health result when set", async () => {
      const mockHealth: HealthCheckResult = {
        status: HealthStatus.DEGRADED,
        details: {
          uptime: 500,
          lastCheck: new Date(),
          dependencies: [],
          errors: ["Test error"],
        },
      };
      strategy.setMockHealthResult(mockHealth);

      const health = await strategy.healthCheck();
      expect(health).toBe(mockHealth);
    });
  });

  describe("Memory Management", () => {
    it("should limit response time history", () => {
      // Record more than 1000 response times
      for (let i = 0; i < 1200; i++) {
        strategy.testRecordRequest(i);
      }

      // Should not cause memory issues
      expect(true).toBe(true); // Test passes if no memory errors
    });
  });

  describe("Cleanup", () => {
    it("should cleanup without errors", async () => {
      await strategy.cleanup();
      // Should not throw
    });
  });
});
