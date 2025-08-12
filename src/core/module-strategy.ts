/**
 * Module Strategy Interface
 *
 * This file implements the Strategy pattern for module implementations.
 * All modules must implement the ModuleStrategy interface to ensure
 * consistent behavior and integration with the platform.
 */

import { ModuleState, ModuleError } from "./types";
import type {
  ModuleConfig,
  ModuleInstance,
  HealthCheckResult,
  ModuleMetrics,
  ModuleMiddleware,
  ModuleEventHandler,
  ModuleMigration,
} from "./types";
import type { AnyTRPCRouter } from "@trpc/server";

/**
 * Core Strategy interface that all modules must implement
 *
 * This interface defines the contract for module implementations following
 * the Strategy pattern from GoF Design Patterns. Each module is a strategy
 * for providing specific business functionality.
 */
export interface ModuleStrategy {
  /**
   * Module configuration - immutable after creation
   */
  readonly config: ModuleConfig;

  /**
   * Install the module
   *
   * This method is called once when the module is first added to the system.
   * Use this for one-time setup like creating database tables, registering
   * external services, or initializing persistent resources.
   *
   * @throws ModuleError if installation fails
   */
  install(): Promise<void>;

  /**
   * Configure the module with runtime settings
   *
   * This method is called after installation and whenever configuration
   * changes. Use this to validate settings, connect to external services,
   * and prepare the module for operation.
   *
   * @param settings Runtime configuration settings
   * @throws ModuleConfigurationError if configuration is invalid
   */
  configure(settings: Record<string, unknown>): Promise<void>;

  /**
   * Start the module
   *
   * This method is called to activate the module and make it operational.
   * After this completes successfully, the module should be ready to handle
   * requests and provide its services.
   *
   * @throws ModuleError if startup fails
   */
  start(): Promise<void>;

  /**
   * Stop the module gracefully
   *
   * This method is called to deactivate the module. It should stop processing
   * new requests while completing existing operations, then clean up resources.
   * The module should be able to restart after stopping.
   *
   * @throws ModuleError if shutdown fails
   */
  stop(): Promise<void>;

  /**
   * Uninstall the module completely
   *
   * This method is called to remove the module from the system permanently.
   * Use this to clean up databases, deregister services, and remove all
   * traces of the module.
   *
   * @throws ModuleError if uninstallation fails
   */
  uninstall(): Promise<void>;

  /**
   * Get tRPC routers provided by this module
   *
   * Returns a map of router names to AnyTRPCRouter instances. These routers
   * will be automatically mounted in the main application router.
   *
   * @returns Promise resolving to router map
   */
  getRouters(): Promise<Record<string, AnyTRPCRouter>>;

  /**
   * Get middleware provided by this module
   *
   * Returns middleware functions that will be added to the request processing
   * chain. Middleware is executed in priority order (lower numbers first).
   *
   * @returns Promise resolving to middleware array
   */
  getMiddleware(): Promise<readonly ModuleMiddleware[]>;

  /**
   * Get event handlers provided by this module
   *
   * Returns event handlers that will be registered with the event bus.
   * Handlers are called when matching events are published.
   *
   * @returns Promise resolving to event handler array
   */
  getEventHandlers(): Promise<readonly ModuleEventHandler[]>;

  /**
   * Get database migrations provided by this module
   *
   * Returns migration objects that define database schema changes.
   * Migrations are applied in version order during system updates.
   *
   * @returns Promise resolving to migration array
   */
  getMigrations(): Promise<readonly ModuleMigration[]>;

  /**
   * Perform module health check
   *
   * Checks the health of this module and its dependencies. This is called
   * periodically by the health monitor and on-demand for diagnostics.
   *
   * @returns Promise resolving to health check result
   */
  healthCheck(): Promise<HealthCheckResult>;

  /**
   * Get current performance metrics
   *
   * Returns performance and usage metrics for monitoring and optimization.
   * This is called periodically by the metrics collector.
   *
   * @returns Promise resolving to metrics object
   */
  getMetrics(): Promise<ModuleMetrics>;

  /**
   * Get current module state
   *
   * @returns Current lifecycle state
   */
  getState(): ModuleState;

  /**
   * Clean up resources before shutdown
   *
   * Called before the module is stopped or uninstalled. Use this to
   * close connections, save state, and release resources gracefully.
   *
   * @returns Promise that resolves when cleanup is complete
   */
  cleanup(): Promise<void>;
}

/**
 * Abstract base class for module implementations
 *
 * Provides common functionality and enforces the Strategy pattern.
 * Modules can extend this class to get default implementations and
 * lifecycle management.
 */
export abstract class BaseModuleStrategy
  implements ModuleStrategy, ModuleInstance
{
  private _state: ModuleState = ModuleState.UNINSTALLED;

  get state(): ModuleState {
    return this._state;
  }
  private _startupTime = 0;
  private _requestCount = 0;
  private _errorCount = 0;
  private _responseTimes: number[] = [];
  private _installedAt?: Date;
  private _startedAt?: Date;

  constructor(public readonly config: ModuleConfig) {
    if (!config.name || !config.version) {
      throw new ModuleError(
        "Module config must have name and version",
        config.name || "unknown",
        "INVALID_CONFIG",
      );
    }
  }

  /**
   * Get current module state
   */
  getState(): ModuleState {
    return this._state;
  }

  /**
   * Set module state (protected method for subclasses)
   */
  protected setState(state: ModuleState): void {
    // const previousState = this._state;
    this._state = state;

    // Track timing for metrics
    if (state === ModuleState.RUNNING && !this._startedAt) {
      this._startedAt = new Date();
      this._startupTime =
        Date.now() - (this._installedAt?.getTime() ?? Date.now());
    }
  }

  /**
   * Record a request for metrics
   */
  protected recordRequest(responseTime?: number): void {
    this._requestCount++;
    if (responseTime !== undefined) {
      this._responseTimes.push(responseTime);
      // Keep only last 1000 response times for memory efficiency
      if (this._responseTimes.length > 1000) {
        this._responseTimes = this._responseTimes.slice(-1000);
      }
    }
  }

  /**
   * Record an error for metrics
   */
  protected recordError(): void {
    this._errorCount++;
  }

  /**
   * Default implementation of install
   */
  async install(): Promise<void> {
    if (this._state !== ModuleState.UNINSTALLED) {
      throw new ModuleError(
        `Cannot install module in state ${this._state}`,
        this.config.name,
        "INVALID_STATE",
      );
    }

    this.setState(ModuleState.INSTALLED);
    this._installedAt = new Date();
  }

  /**
   * Default implementation of configure
   */
  async configure(_settings: Record<string, unknown>): Promise<void> {
    if (this._state !== ModuleState.INSTALLED) {
      throw new ModuleError(
        `Cannot configure module in state ${this._state}`,
        this.config.name,
        "INVALID_STATE",
      );
    }

    // Validate required environment variables
    for (const envVar of this.config.requiredEnvVars) {
      if (!process.env[envVar]) {
        throw new ModuleError(
          `Required environment variable ${envVar} is not set`,
          this.config.name,
          "MISSING_ENV_VAR",
        );
      }
    }

    this.setState(ModuleState.CONFIGURED);
  }

  /**
   * Default implementation of start
   */
  async start(): Promise<void> {
    if (this._state !== ModuleState.CONFIGURED) {
      throw new ModuleError(
        `Cannot start module in state ${this._state}`,
        this.config.name,
        "INVALID_STATE",
      );
    }

    this.setState(ModuleState.STARTING);
    try {
      await this.onStart();
      this.setState(ModuleState.RUNNING);
    } catch (error) {
      this.setState(ModuleState.FAILED);
      throw error;
    }
  }

  /**
   * Default implementation of stop
   */
  async stop(): Promise<void> {
    if (this._state !== ModuleState.RUNNING) {
      return; // Already stopped or never started
    }

    this.setState(ModuleState.STOPPING);
    try {
      await this.onStop();
      this.setState(ModuleState.CONFIGURED);
    } catch (error) {
      this.setState(ModuleState.FAILED);
      throw error;
    }
  }

  /**
   * Default implementation of uninstall
   */
  async uninstall(): Promise<void> {
    // Stop first if running
    if (this._state === ModuleState.RUNNING) {
      await this.stop();
    }

    try {
      await this.onUninstall();
      this.setState(ModuleState.UNINSTALLED);
    } catch (error) {
      this.setState(ModuleState.FAILED);
      throw error;
    }
  }

  /**
   * Default implementation of getMetrics
   */
  async getMetrics(): Promise<ModuleMetrics> {
    const avgResponseTime =
      this._responseTimes.length > 0
        ? this._responseTimes.reduce((a, b) => a + b, 0) /
          this._responseTimes.length
        : 0;

    return {
      startupTime: this._startupTime,
      memoryUsage: process.memoryUsage().heapUsed,
      requestCount: this._requestCount,
      errorCount: this._errorCount,
      avgResponseTime,
      lastRequestTime: this._responseTimes.length > 0 ? new Date() : undefined,
    };
  }

  /**
   * Default implementation of cleanup
   */
  async cleanup(): Promise<void> {
    // Override in subclasses for custom cleanup
  }

  // Abstract methods that subclasses must implement
  abstract getRouters(): Promise<Record<string, AnyTRPCRouter>>;
  abstract getMiddleware(): Promise<readonly ModuleMiddleware[]>;
  abstract getEventHandlers(): Promise<readonly ModuleEventHandler[]>;
  abstract getMigrations(): Promise<readonly ModuleMigration[]>;
  abstract healthCheck(): Promise<HealthCheckResult>;

  // Protected hooks for subclasses to override
  protected async onStart(): Promise<void> {
    // Override in subclasses
  }

  protected async onStop(): Promise<void> {
    // Override in subclasses
  }

  protected async onUninstall(): Promise<void> {
    // Override in subclasses
  }
}
