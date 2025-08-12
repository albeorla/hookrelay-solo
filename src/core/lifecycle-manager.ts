/**
 * Module Lifecycle Manager
 *
 * This file implements lifecycle management for modules, coordinating
 * complex startup and shutdown sequences while respecting dependencies
 * and handling failures gracefully.
 */

import { ModuleState, ModulePriority } from "./types";
import type { ModuleConfig } from "./types";
import { type ModuleRegistry } from "./module-registry";

/**
 * Lifecycle operation phases
 */
export enum LifecyclePhase {
  PLANNING = "planning",
  EXECUTING = "executing",
  COMPLETED = "completed",
  FAILED = "failed",
  ROLLED_BACK = "rolled_back",
}

/**
 * Lifecycle operation result
 */
export interface LifecycleResult {
  phase: LifecyclePhase;
  readonly startedAt: Date;
  completedAt?: Date;
  totalModules: number;
  readonly succeededModules: string[];
  readonly failedModules: Array<{
    name: string;
    error: Error;
  }>;
  duration?: number;
}

/**
 * Lifecycle operation options
 */
export interface LifecycleOptions {
  /** Timeout for each module operation (ms) */
  readonly operationTimeout: number;

  /** Whether to rollback on failure */
  readonly rollbackOnFailure: boolean;

  /** Maximum concurrent operations */
  readonly maxConcurrency: number;

  /** Whether to continue on individual module failures */
  readonly continueOnError: boolean;

  /** Custom module order (overrides dependency/priority order) */
  readonly customOrder?: readonly string[];
}

/**
 * Default lifecycle options
 */
const DEFAULT_LIFECYCLE_OPTIONS: LifecycleOptions = {
  operationTimeout: 30000, // 30 seconds
  rollbackOnFailure: true,
  maxConcurrency: 5,
  continueOnError: false,
  customOrder: undefined,
};

/**
 * Module Lifecycle Manager
 *
 * Coordinates complex module lifecycle operations:
 * - Dependency-aware startup sequences
 * - Graceful shutdown with rollback support
 * - Parallel execution with concurrency limits
 * - Error handling and recovery
 * - Progress monitoring and reporting
 */
export class LifecycleManager {
  private readonly registry: ModuleRegistry;
  private currentOperation?: {
    type: "startup" | "shutdown";
    promise: Promise<LifecycleResult>;
    startedAt: Date;
  };

  constructor(registry: ModuleRegistry) {
    this.registry = registry;

    // Listen for process signals
    process.on("SIGTERM", () => void this.gracefulShutdown());
    process.on("SIGINT", () => void this.gracefulShutdown());
    process.on("SIGHUP", () => void this.gracefulRestart());
  }

  /**
   * Start all modules in the correct order
   *
   * This method:
   * 1. Analyzes module dependencies and priorities
   * 2. Creates an optimal startup sequence
   * 3. Executes startup in phases with controlled concurrency
   * 4. Handles failures with optional rollback
   *
   * @param options Lifecycle operation options
   * @returns Promise resolving to operation result
   */
  async startupSequence(
    options: Partial<LifecycleOptions> = {},
  ): Promise<LifecycleResult> {
    if (this.currentOperation?.type === "startup") {
      return this.currentOperation.promise;
    }

    const opts = { ...DEFAULT_LIFECYCLE_OPTIONS, ...options };
    const startedAt = new Date();

    const promise = this.executeStartupSequence(opts, startedAt);
    this.currentOperation = { type: "startup", promise, startedAt };

    try {
      const result = await promise;
      this.currentOperation = undefined;
      return result;
    } catch (error) {
      this.currentOperation = undefined;
      throw error;
    }
  }

  /**
   * Shutdown all modules in reverse dependency order
   *
   * @param options Lifecycle operation options
   * @returns Promise resolving to operation result
   */
  async shutdownSequence(
    options: Partial<LifecycleOptions> = {},
  ): Promise<LifecycleResult> {
    if (this.currentOperation?.type === "shutdown") {
      return this.currentOperation.promise;
    }

    const opts = { ...DEFAULT_LIFECYCLE_OPTIONS, ...options };
    const startedAt = new Date();

    const promise = this.executeShutdownSequence(opts, startedAt);
    this.currentOperation = { type: "shutdown", promise, startedAt };

    try {
      const result = await promise;
      this.currentOperation = undefined;
      return result;
    } catch (error) {
      this.currentOperation = undefined;
      throw error;
    }
  }

  /**
   * Restart all modules (shutdown then startup)
   *
   * @param options Lifecycle operation options
   * @returns Promise resolving to operation result
   */
  async restartSequence(
    options: Partial<LifecycleOptions> = {},
  ): Promise<LifecycleResult> {
    const shutdownResult = await this.shutdownSequence(options);

    if (shutdownResult.phase === LifecyclePhase.FAILED) {
      throw new Error(
        `Restart failed during shutdown: ${shutdownResult.failedModules
          .map((f) => f.name)
          .join(", ")}`,
      );
    }

    return this.startupSequence(options);
  }

  /**
   * Get current operation status
   */
  getCurrentOperation() {
    return this.currentOperation
      ? {
          type: this.currentOperation.type,
          startedAt: this.currentOperation.startedAt,
          duration: Date.now() - this.currentOperation.startedAt.getTime(),
        }
      : undefined;
  }

  /**
   * Cancel current operation (if possible)
   */
  async cancelCurrentOperation(): Promise<void> {
    if (!this.currentOperation) return;

    // For now, we can't cancel operations once started
    // In the future, this could implement cancellation tokens
    throw new Error("Operation cancellation not yet implemented");
  }

  // Private implementation methods

  private async executeStartupSequence(
    options: LifecycleOptions,
    startedAt: Date,
  ): Promise<LifecycleResult> {
    const result: LifecycleResult = {
      phase: LifecyclePhase.PLANNING,
      startedAt,
      totalModules: 0,
      succeededModules: [],
      failedModules: [],
    };

    try {
      // Get all modules that need to be started
      const allModules = this.registry.getAllModules();
      const modulesToStart = Array.from(allModules.values())
        .filter(
          (entry) =>
            entry.state === ModuleState.CONFIGURED ||
            entry.state === ModuleState.INSTALLED,
        )
        .map((entry) => entry.config);

      result.totalModules = modulesToStart.length;

      if (modulesToStart.length === 0) {
        return {
          ...result,
          phase: LifecyclePhase.COMPLETED,
          completedAt: new Date(),
          duration: Date.now() - startedAt.getTime(),
        };
      }

      // Plan execution order
      const executionPlan = this.planStartupExecution(modulesToStart, options);
      result.phase = LifecyclePhase.EXECUTING;

      // Execute in phases
      for (const phase of executionPlan) {
        await this.executePhase(phase, "start", options, result);

        // Check if we should stop due to failures
        if (result.failedModules.length > 0 && !options.continueOnError) {
          result.phase = LifecyclePhase.FAILED;

          if (options.rollbackOnFailure) {
            await this.rollbackStartup(result.succeededModules, options);
            result.phase = LifecyclePhase.ROLLED_BACK;
          }

          break;
        }
      }

      if (result.phase === LifecyclePhase.EXECUTING) {
        result.phase = LifecyclePhase.COMPLETED;
      }
    } catch (error) {
      result.phase = LifecyclePhase.FAILED;
      result.failedModules.push({
        name: "lifecycle-manager",
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }

    result.completedAt = new Date();
    result.duration = result.completedAt.getTime() - startedAt.getTime();

    return result;
  }

  private async executeShutdownSequence(
    options: LifecycleOptions,
    startedAt: Date,
  ): Promise<LifecycleResult> {
    const result: LifecycleResult = {
      phase: LifecyclePhase.PLANNING,
      startedAt,
      totalModules: 0,
      succeededModules: [],
      failedModules: [],
    };

    try {
      // Get all running modules
      const runningModules = Array.from(
        this.registry.getRunningModules().values(),
      ).map((entry) => entry.config);

      result.totalModules = runningModules.length;

      if (runningModules.length === 0) {
        return {
          ...result,
          phase: LifecyclePhase.COMPLETED,
          completedAt: new Date(),
          duration: Date.now() - startedAt.getTime(),
        };
      }

      // Plan execution order (reverse of startup)
      const executionPlan = this.planShutdownExecution(runningModules, options);
      result.phase = LifecyclePhase.EXECUTING;

      // Execute in phases
      for (const phase of executionPlan) {
        await this.executePhase(phase, "stop", options, result);

        // Continue even on errors during shutdown to clean up as much as possible
      }

      result.phase = LifecyclePhase.COMPLETED;
    } catch (error) {
      result.phase = LifecyclePhase.FAILED;
      result.failedModules.push({
        name: "lifecycle-manager",
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }

    result.completedAt = new Date();
    result.duration = result.completedAt.getTime() - startedAt.getTime();

    return result;
  }

  private planStartupExecution(
    modules: readonly ModuleConfig[],
    options: LifecycleOptions,
  ): string[][] {
    if (options.customOrder) {
      // Use custom order, split into phases by concurrency limit
      return this.chunkArray(options.customOrder, options.maxConcurrency);
    }

    // Group by priority and handle dependencies
    const phases: string[][] = [];
    const priorityGroups = this.groupByPriority(modules);

    for (const priority of [
      ModulePriority.CRITICAL,
      ModulePriority.HIGH,
      ModulePriority.MEDIUM,
      ModulePriority.LOW,
    ]) {
      const modulesInPriority = priorityGroups.get(priority) ?? [];
      if (modulesInPriority.length > 0) {
        // Sort within priority group by dependencies
        const sorted = this.topologicalSort(modulesInPriority);
        const chunks = this.chunkArray(sorted, options.maxConcurrency);
        phases.push(...chunks);
      }
    }

    return phases;
  }

  private planShutdownExecution(
    modules: readonly ModuleConfig[],
    options: LifecycleOptions,
  ): string[][] {
    // Reverse of startup order
    const startupPlan = this.planStartupExecution(modules, options);
    const reversedPlan = [...startupPlan].reverse();
    return reversedPlan.map((phase) => [...phase].reverse());
  }

  private async executePhase(
    moduleNames: readonly string[],
    operation: "start" | "stop",
    options: LifecycleOptions,
    result: LifecycleResult,
  ): Promise<void> {
    const operations = moduleNames.map(async (name) => {
      try {
        if (operation === "start") {
          // Ensure module is configured first
          const state = this.registry.getModuleState(name);
          if (state === ModuleState.INSTALLED) {
            await this.registry.configureModule(name, {});
          }
          await this.registry.startModule(name);
        } else {
          await this.registry.stopModule(name);
        }

        result.succeededModules.push(name);
      } catch (error) {
        result.failedModules.push({
          name,
          error: error instanceof Error ? error : new Error(String(error)),
        });
      }
    });

    // Wait for all operations in this phase
    await Promise.all(operations);
  }

  private async rollbackStartup(
    succeededModules: readonly string[],
    _options: LifecycleOptions,
  ): Promise<void> {
    // Stop modules in reverse order
    const rollbackOrder = [...succeededModules].reverse();

    for (const name of rollbackOrder) {
      try {
        await this.registry.stopModule(name);
      } catch (error) {
        // Log but continue rollback
        console.error(`Error during rollback of module ${name}:`, error);
      }
    }
  }

  private groupByPriority(
    modules: readonly ModuleConfig[],
  ): Map<ModulePriority, ModuleConfig[]> {
    const groups = new Map<ModulePriority, ModuleConfig[]>();

    for (const moduleConfig of modules) {
      const existing = groups.get(moduleConfig.priority) ?? [];
      existing.push(moduleConfig);
      groups.set(moduleConfig.priority, existing);
    }

    return groups;
  }

  private topologicalSort(modules: readonly ModuleConfig[]): readonly string[] {
    // Simple topological sort by name for now
    // In a full implementation, this would handle dependencies properly
    return modules.map((m) => m.name).sort((a, b) => a.localeCompare(b));
  }

  private chunkArray<T>(array: readonly T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  private async gracefulShutdown(): Promise<void> {
    console.log("Received shutdown signal, performing graceful shutdown...");
    try {
      await this.shutdownSequence({
        continueOnError: true,
        rollbackOnFailure: false,
      });
      process.exit(0);
    } catch (error) {
      console.error("Error during graceful shutdown:", error);
      process.exit(1);
    }
  }

  private async gracefulRestart(): Promise<void> {
    console.log("Received restart signal, performing graceful restart...");
    try {
      await this.restartSequence();
      console.log("Graceful restart completed");
    } catch (error) {
      console.error("Error during graceful restart:", error);
    }
  }
}
