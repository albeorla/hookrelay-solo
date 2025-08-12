/**
 * Core Types Unit Tests
 */

import { describe, it, expect } from "@jest/globals";
import {
  ModuleState,
  HealthStatus,
  ModulePriority,
  ModuleError,
  ModuleDependencyError,
  ModuleConfigurationError,
  ModuleLifecycleError,
} from "../types";

describe("Core Types", () => {
  describe("ModuleState Enum", () => {
    it("should have all expected states", () => {
      expect(ModuleState.UNINSTALLED).toBe("uninstalled");
      expect(ModuleState.INSTALLED).toBe("installed");
      expect(ModuleState.CONFIGURED).toBe("configured");
      expect(ModuleState.STARTING).toBe("starting");
      expect(ModuleState.RUNNING).toBe("running");
      expect(ModuleState.STOPPING).toBe("stopping");
      expect(ModuleState.FAILED).toBe("failed");
    });
  });

  describe("HealthStatus Enum", () => {
    it("should have all expected statuses", () => {
      expect(HealthStatus.HEALTHY).toBe("healthy");
      expect(HealthStatus.DEGRADED).toBe("degraded");
      expect(HealthStatus.UNHEALTHY).toBe("unhealthy");
      expect(HealthStatus.UNKNOWN).toBe("unknown");
    });
  });

  describe("ModulePriority Enum", () => {
    it("should have correct priority ordering", () => {
      expect(ModulePriority.CRITICAL).toBe(0);
      expect(ModulePriority.HIGH).toBe(1);
      expect(ModulePriority.MEDIUM).toBe(2);
      expect(ModulePriority.LOW).toBe(3);
    });

    it("should order priorities correctly", () => {
      expect(ModulePriority.CRITICAL < ModulePriority.HIGH).toBe(true);
      expect(ModulePriority.HIGH < ModulePriority.MEDIUM).toBe(true);
      expect(ModulePriority.MEDIUM < ModulePriority.LOW).toBe(true);
    });
  });

  describe("ModuleError", () => {
    it("should create error with all properties", () => {
      const error = new ModuleError("Test error", "test-module", "TEST_CODE");

      expect(error.message).toBe("Test error");
      expect(error.moduleName).toBe("test-module");
      expect(error.code).toBe("TEST_CODE");
      expect(error.name).toBe("ModuleError");
      expect(error).toBeInstanceOf(Error);
    });

    it("should create error with cause", () => {
      const cause = new Error("Original error");
      const error = new ModuleError(
        "Test error",
        "test-module",
        "TEST_CODE",
        cause,
      );

      expect(error.cause).toBe(cause);
    });
  });

  describe("ModuleDependencyError", () => {
    it("should create dependency error with correct message", () => {
      const error = new ModuleDependencyError("test-module", "missing-dep");

      expect(error.message).toBe(
        "Module 'test-module' requires dependency 'missing-dep'",
      );
      expect(error.moduleName).toBe("test-module");
      expect(error.code).toBe("DEPENDENCY_ERROR");
      expect(error.name).toBe("ModuleDependencyError");
    });
  });

  describe("ModuleConfigurationError", () => {
    it("should create configuration error with correct message", () => {
      const error = new ModuleConfigurationError(
        "test-module",
        "invalid setting",
      );

      expect(error.message).toBe(
        "Module 'test-module' configuration error: invalid setting",
      );
      expect(error.moduleName).toBe("test-module");
      expect(error.code).toBe("CONFIGURATION_ERROR");
      expect(error.name).toBe("ModuleConfigurationError");
    });
  });

  describe("ModuleLifecycleError", () => {
    it("should create lifecycle error with correct message", () => {
      const error = new ModuleLifecycleError(
        "test-module",
        "start",
        ModuleState.UNINSTALLED,
      );

      expect(error.message).toBe(
        "Module 'test-module' cannot start from state uninstalled",
      );
      expect(error.moduleName).toBe("test-module");
      expect(error.code).toBe("LIFECYCLE_ERROR");
      expect(error.name).toBe("ModuleLifecycleError");
    });
  });
});
