/**
 * Module Registry Implementation
 *
 * This file implements the Singleton pattern for the central module registry.
 * The registry is the single source of truth for all modules in the system,
 * managing their lifecycle, health, and inter-module communication.
 */

import {
  ModuleState,
  ModuleEventType,
  ModuleError,
  HealthStatus,
} from "./types";
import type {
  ModuleConfig,
  ModuleInstance,
  ModuleRegistryEntry,
  ModuleEvent,
  ModuleEventHandler,
  HealthCheckResult,
} from "./types";
import { ModuleFactory, type ModuleConstructor } from "./module-factory";
import { EventEmitter } from "events";

/**
 * Module Registry Options
 */
interface ModuleRegistryOptions {
  /** Maximum time to wait for module operations (ms) */
  readonly operationTimeout: number;

  /** Health check interval (ms) */
  readonly healthCheckInterval: number;

  /** Enable performance monitoring */
  readonly enableMetrics: boolean;

  /** Maximum number of events to keep in history */
  readonly maxEventHistory: number;
}

/**
 * Default registry options
 */
const DEFAULT_OPTIONS: ModuleRegistryOptions = {
  operationTimeout: 30000, // 30 seconds
  healthCheckInterval: 60000, // 1 minute
  enableMetrics: true,
  maxEventHistory: 1000,
};

/**
 * Module Registry - Singleton pattern implementation
 *
 * The registry provides:
 * - Central module management
 * - Lifecycle coordination
 * - Event bus for inter-module communication
 * - Health monitoring
 * - Performance metrics collection
 */
export class ModuleRegistry {
  private static instance: ModuleRegistry | undefined;

  private readonly options: ModuleRegistryOptions;
  private readonly factory = new ModuleFactory();
  private readonly modules = new Map<string, ModuleRegistryEntry>();
  private readonly eventEmitter = new EventEmitter();
  private readonly eventHistory: ModuleEvent[] = [];
  private readonly eventHandlers = new Map<
    ModuleEventType,
    Set<ModuleEventHandler>
  >();

  private healthCheckInterval?: NodeJS.Timeout;
  private metricsInterval?: NodeJS.Timeout;
  private isShuttingDown = false;

  /**
   * Private constructor for Singleton pattern
   */
  private constructor(options: Partial<ModuleRegistryOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };

    // Set up event emitter limits
    this.eventEmitter.setMaxListeners(100);

    // Start background tasks if enabled
    if (this.options.enableMetrics) {
      this.startBackgroundTasks();
    }

    // Handle process shutdown
    process.on("SIGTERM", () => void this.shutdown());
    process.on("SIGINT", () => void this.shutdown());
  }

  /**
   * Get or create the singleton instance
   */
  static getInstance(options?: Partial<ModuleRegistryOptions>): ModuleRegistry {
    ModuleRegistry.instance ??= new ModuleRegistry(options);
    return ModuleRegistry.instance;
  }

  /**
   * Reset the singleton (for testing only)
   */
  static resetInstance(): void {
    if (ModuleRegistry.instance) {
      void ModuleRegistry.instance.shutdown();
      ModuleRegistry.instance = undefined;
    }
  }

  /**
   * Register a module constructor with the factory
   */
  registerModuleType(
    name: string,
    constructor: ModuleConstructor,
    version: string,
  ): void {
    this.factory.registerModule(name, constructor, version);
    this.publishEvent({
      type: ModuleEventType.INSTALLING,
      moduleName: name,
      timestamp: new Date(),
      data: { version },
    });
  }

  /**
   * Install and register a module
   *
   * @param config Module configuration
   * @throws ModuleError if installation fails
   */
  async installModule(config: ModuleConfig): Promise<void> {
    if (this.isShuttingDown) {
      throw new ModuleError(
        "Cannot install module during shutdown",
        config.name,
        "SHUTTING_DOWN",
      );
    }

    if (this.modules.has(config.name)) {
      throw new ModuleError(
        `Module '${config.name}' is already installed`,
        config.name,
        "ALREADY_INSTALLED",
      );
    }

    this.publishEvent({
      type: ModuleEventType.INSTALLING,
      moduleName: config.name,
      timestamp: new Date(),
      data: { config },
    });

    try {
      // Create module instance
      const instance = await this.factory.createModule(config);

      // Create registry entry
      const entry: ModuleRegistryEntry = {
        config,
        state: ModuleState.UNINSTALLED,
        instance,
        metrics: {
          startupTime: 0,
          memoryUsage: 0,
          requestCount: 0,
          errorCount: 0,
          avgResponseTime: 0,
        },
        registeredAt: new Date(),
      };

      // Install the module
      await this.withTimeout(
        instance.install(),
        this.options.operationTimeout,
        `Installing module ${config.name}`,
      );

      entry.state = ModuleState.INSTALLED;
      this.modules.set(config.name, entry);

      this.publishEvent({
        type: ModuleEventType.INSTALLED,
        moduleName: config.name,
        timestamp: new Date(),
        data: { config },
      });
    } catch (error) {
      this.publishEvent({
        type: ModuleEventType.ERROR,
        moduleName: config.name,
        timestamp: new Date(),
        error: error instanceof Error ? error : new Error(String(error)),
      });
      throw error;
    }
  }

  /**
   * Configure a module
   */
  async configureModule(
    name: string,
    settings: Record<string, unknown>,
  ): Promise<void> {
    const entry = this.getModuleEntry(name);

    if (entry.state !== ModuleState.INSTALLED) {
      throw new ModuleError(
        `Cannot configure module '${name}' in state ${entry.state}`,
        name,
        "INVALID_STATE",
      );
    }

    this.publishEvent({
      type: ModuleEventType.CONFIGURING,
      moduleName: name,
      timestamp: new Date(),
      data: { settings },
    });

    try {
      await this.withTimeout(
        entry.instance!.configure(settings),
        this.options.operationTimeout,
        `Configuring module ${name}`,
      );

      entry.state = ModuleState.CONFIGURED;

      this.publishEvent({
        type: ModuleEventType.CONFIGURED,
        moduleName: name,
        timestamp: new Date(),
        data: { settings },
      });
    } catch (error) {
      entry.state = ModuleState.FAILED;
      this.publishEvent({
        type: ModuleEventType.ERROR,
        moduleName: name,
        timestamp: new Date(),
        error: error instanceof Error ? error : new Error(String(error)),
      });
      throw error;
    }
  }

  /**
   * Start a module
   */
  async startModule(name: string): Promise<void> {
    const entry = this.getModuleEntry(name);

    if (entry.state !== ModuleState.CONFIGURED) {
      throw new ModuleError(
        `Cannot start module '${name}' in state ${entry.state}`,
        name,
        "INVALID_STATE",
      );
    }

    this.publishEvent({
      type: ModuleEventType.STARTING,
      moduleName: name,
      timestamp: new Date(),
    });

    try {
      const startTime = Date.now();

      await this.withTimeout(
        entry.instance!.start(),
        this.options.operationTimeout,
        `Starting module ${name}`,
      );

      entry.state = ModuleState.RUNNING;
      entry.startedAt = new Date();
      entry.metrics.startupTime = Date.now() - startTime;

      // Register event handlers
      await this.registerModuleEventHandlers(entry.instance!);

      this.publishEvent({
        type: ModuleEventType.STARTED,
        moduleName: name,
        timestamp: new Date(),
        data: { startupTime: entry.metrics.startupTime },
      });
    } catch (error) {
      entry.state = ModuleState.FAILED;
      this.publishEvent({
        type: ModuleEventType.ERROR,
        moduleName: name,
        timestamp: new Date(),
        error: error instanceof Error ? error : new Error(String(error)),
      });
      throw error;
    }
  }

  /**
   * Stop a module
   */
  async stopModule(name: string): Promise<void> {
    const entry = this.getModuleEntry(name);

    if (entry.state !== ModuleState.RUNNING) {
      return; // Already stopped
    }

    this.publishEvent({
      type: ModuleEventType.STOPPING,
      moduleName: name,
      timestamp: new Date(),
    });

    try {
      // Unregister event handlers
      await this.unregisterModuleEventHandlers(entry.instance!);

      await this.withTimeout(
        entry.instance!.stop(),
        this.options.operationTimeout,
        `Stopping module ${name}`,
      );

      entry.state = ModuleState.CONFIGURED;
      entry.stoppedAt = new Date();

      this.publishEvent({
        type: ModuleEventType.STOPPED,
        moduleName: name,
        timestamp: new Date(),
      });
    } catch (error) {
      entry.state = ModuleState.FAILED;
      this.publishEvent({
        type: ModuleEventType.ERROR,
        moduleName: name,
        timestamp: new Date(),
        error: error instanceof Error ? error : new Error(String(error)),
      });
      throw error;
    }
  }

  /**
   * Uninstall a module
   */
  async uninstallModule(name: string): Promise<void> {
    const entry = this.getModuleEntry(name);

    // Stop first if running
    if (entry.state === ModuleState.RUNNING) {
      await this.stopModule(name);
    }

    this.publishEvent({
      type: ModuleEventType.UNINSTALLING,
      moduleName: name,
      timestamp: new Date(),
    });

    try {
      await this.withTimeout(
        entry.instance!.uninstall(),
        this.options.operationTimeout,
        `Uninstalling module ${name}`,
      );

      this.modules.delete(name);
      this.factory.removeInstance(name);

      this.publishEvent({
        type: ModuleEventType.UNINSTALLED,
        moduleName: name,
        timestamp: new Date(),
      });
    } catch (error) {
      this.publishEvent({
        type: ModuleEventType.ERROR,
        moduleName: name,
        timestamp: new Date(),
        error: error instanceof Error ? error : new Error(String(error)),
      });
      throw error;
    }
  }

  /**
   * Start all modules in dependency order
   */
  async startAllModules(): Promise<void> {
    const configs = Array.from(this.modules.values()).map(
      (entry) => entry.config,
    );
    const sortedConfigs = this.sortByPriority(configs);

    for (const config of sortedConfigs) {
      if (this.modules.get(config.name)?.state === ModuleState.CONFIGURED) {
        await this.startModule(config.name);
      }
    }
  }

  /**
   * Stop all modules in reverse dependency order
   */
  async stopAllModules(): Promise<void> {
    const configs = Array.from(this.modules.values()).map(
      (entry) => entry.config,
    );
    const sortedConfigs = [...this.sortByPriority(configs)].reverse();

    for (const config of sortedConfigs) {
      if (this.modules.get(config.name)?.state === ModuleState.RUNNING) {
        await this.stopModule(config.name);
      }
    }
  }

  /**
   * Get module by name
   */
  getModule(name: string): ModuleInstance | undefined {
    return this.modules.get(name)?.instance;
  }

  /**
   * Get module state
   */
  getModuleState(name: string): ModuleState | undefined {
    return this.modules.get(name)?.state;
  }

  /**
   * Get all modules
   */
  getAllModules(): ReadonlyMap<string, ModuleRegistryEntry> {
    return new Map(this.modules);
  }

  /**
   * Get running modules
   */
  getRunningModules(): ReadonlyMap<string, ModuleRegistryEntry> {
    const running = new Map<string, ModuleRegistryEntry>();
    for (const [name, entry] of this.modules) {
      if (entry.state === ModuleState.RUNNING) {
        running.set(name, entry);
      }
    }
    return running;
  }

  /**
   * Subscribe to module events
   */
  subscribe(eventType: ModuleEventType, handler: ModuleEventHandler): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, new Set());
    }
    this.eventHandlers.get(eventType)!.add(handler);
  }

  /**
   * Unsubscribe from module events
   */
  unsubscribe(eventType: ModuleEventType, handler: ModuleEventHandler): void {
    this.eventHandlers.get(eventType)?.delete(handler);
  }

  /**
   * Publish an event to all subscribers
   */
  publishEvent(event: ModuleEvent): void {
    // Add to history
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.options.maxEventHistory) {
      this.eventHistory.shift();
    }

    // Emit to Node.js EventEmitter (for backward compatibility)
    this.eventEmitter.emit(event.type, event);

    // Call registered handlers
    const handlers = this.eventHandlers.get(event.type);
    if (handlers) {
      // Sort handlers by priority (lower numbers first)
      const sortedHandlers = Array.from(handlers).sort(
        (a, b) => a.priority - b.priority,
      );

      for (const handler of sortedHandlers) {
        try {
          handler.handle(event).catch((error) => {
            console.error(`Error in event handler for ${event.type}:`, error);
          });
        } catch (error) {
          console.error(
            `Synchronous error in event handler for ${event.type}:`,
            error,
          );
        }
      }
    }
  }

  /**
   * Get event history
   */
  getEventHistory(): readonly ModuleEvent[] {
    return [...this.eventHistory];
  }

  /**
   * Get registry statistics
   */
  getStatistics() {
    const modulesByState = new Map<ModuleState, number>();
    for (const entry of this.modules.values()) {
      const count = modulesByState.get(entry.state) ?? 0;
      modulesByState.set(entry.state, count + 1);
    }

    return {
      totalModules: this.modules.size,
      modulesByState: Object.fromEntries(modulesByState),
      eventHandlers: this.eventHandlers.size,
      eventHistory: this.eventHistory.length,
      factoryStats: this.factory.getStatistics(),
    };
  }

  /**
   * Perform health check on all modules
   */
  async performHealthCheck(): Promise<Map<string, HealthCheckResult>> {
    const results = new Map<string, HealthCheckResult>();

    for (const [name, entry] of this.modules) {
      if (entry.state === ModuleState.RUNNING && entry.instance) {
        try {
          const healthResult = await entry.instance.healthCheck();
          results.set(name, healthResult);
          entry.lastHealthCheck = healthResult;

          this.publishEvent({
            type: ModuleEventType.HEALTH_CHECK,
            moduleName: name,
            timestamp: new Date(),
            data: { health: healthResult },
          });
        } catch (error) {
          const errorResult: HealthCheckResult = {
            status: HealthStatus.UNHEALTHY,
            details: {
              uptime: 0,
              lastCheck: new Date(),
              dependencies: [],
              errors: [error instanceof Error ? error.message : String(error)],
            },
          };
          results.set(name, errorResult);
          entry.lastHealthCheck = errorResult;
        }
      }
    }

    return results;
  }

  /**
   * Shutdown the registry and all modules
   */
  async shutdown(): Promise<void> {
    if (this.isShuttingDown) return;

    this.isShuttingDown = true;

    // Stop background tasks
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }

    try {
      // Stop all modules
      await this.stopAllModules();

      // Clean up factory
      this.factory.clearInstances();

      // Clear event handlers
      this.eventHandlers.clear();
      this.eventEmitter.removeAllListeners();
    } catch (error) {
      console.error("Error during registry shutdown:", error);
    }
  }

  // Private helper methods

  private getModuleEntry(name: string): ModuleRegistryEntry {
    const entry = this.modules.get(name);
    if (!entry) {
      throw new ModuleError(
        `Module '${name}' is not installed`,
        name,
        "NOT_INSTALLED",
      );
    }
    return entry;
  }

  private async withTimeout<T>(
    operation: Promise<T>,
    timeoutMs: number,
    operationName: string,
  ): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(
          new Error(
            `Operation '${operationName}' timed out after ${timeoutMs}ms`,
          ),
        );
      }, timeoutMs);
    });

    return Promise.race([operation, timeoutPromise]);
  }

  private sortByPriority(
    configs: readonly ModuleConfig[],
  ): readonly ModuleConfig[] {
    return [...configs].sort((a, b) => {
      // Sort by priority first (lower number = higher priority)
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }

      // Then by name for deterministic ordering
      return a.name.localeCompare(b.name);
    });
  }

  private async registerModuleEventHandlers(
    instance: ModuleInstance,
  ): Promise<void> {
    const handlers = await instance.getEventHandlers();
    for (const handler of handlers) {
      this.subscribe(handler.eventType, handler);
    }
  }

  private async unregisterModuleEventHandlers(
    instance: ModuleInstance,
  ): Promise<void> {
    const handlers = await instance.getEventHandlers();
    for (const handler of handlers) {
      this.unsubscribe(handler.eventType, handler);
    }
  }

  private startBackgroundTasks(): void {
    // Health check interval
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck().catch((error) => {
        console.error("Error during scheduled health check:", error);
      });
    }, this.options.healthCheckInterval);

    // Metrics collection interval
    this.metricsInterval = setInterval(() => {
      this.updateMetrics().catch((error) => {
        console.error("Error during metrics update:", error);
      });
    }, 30000); // Every 30 seconds
  }

  private async updateMetrics(): Promise<void> {
    for (const [name, entry] of this.modules) {
      if (entry.state === ModuleState.RUNNING && entry.instance) {
        try {
          const metrics = await entry.instance.getMetrics();
          entry.metrics = metrics;
        } catch (error) {
          console.error(`Error getting metrics for module ${name}:`, error);
        }
      }
    }
  }
}
