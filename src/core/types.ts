/**
 * Core Module System Types
 *
 * This file defines the foundational types and interfaces for the modular platform.
 * All modules must conform to these contracts to ensure SOLID principle compliance
 * and seamless integration with the existing T3 Stack architecture.
 */

import type { AnyTRPCRouter } from "@trpc/server";
import type { NextRequest, NextResponse } from "next/server";

/**
 * Module lifecycle states following State pattern
 */
export enum ModuleState {
  UNINSTALLED = "uninstalled",
  INSTALLED = "installed",
  CONFIGURED = "configured",
  STARTING = "starting",
  RUNNING = "running",
  STOPPING = "stopping",
  FAILED = "failed",
}

/**
 * Module health status for monitoring
 */
export enum HealthStatus {
  HEALTHY = "healthy",
  DEGRADED = "degraded",
  UNHEALTHY = "unhealthy",
  UNKNOWN = "unknown",
}

/**
 * Module priority levels for startup ordering
 */
export enum ModulePriority {
  CRITICAL = 0, // Core system modules (auth, database)
  HIGH = 1, // Important business modules (billing, webhooks)
  MEDIUM = 2, // Standard modules (email, analytics)
  LOW = 3, // Optional modules (marketing, extras)
}

/**
 * Module configuration interface with validation support
 */
export interface ModuleConfig {
  /** Unique module identifier */
  readonly name: string;

  /** Semantic version */
  readonly version: string;

  /** Human-readable description */
  readonly description: string;

  /** Module startup priority */
  readonly priority: ModulePriority;

  /** Other modules this module depends on */
  readonly dependencies: readonly string[];

  /** Permissions required by this module */
  readonly requiredPermissions: readonly string[];

  /** Environment variables this module needs */
  readonly requiredEnvVars: readonly string[];

  /** Module-specific configuration */
  readonly settings: Record<string, unknown>;

  /** Whether module can be hot-reloaded */
  readonly supportsHotReload: boolean;
}

/**
 * Module health check result
 */
export interface HealthCheckResult {
  /** Overall health status */
  readonly status: HealthStatus;

  /** Detailed health information */
  readonly details: {
    readonly uptime: number;
    readonly lastCheck: Date;
    readonly dependencies: ReadonlyArray<{
      readonly name: string;
      readonly status: HealthStatus;
      readonly latency?: number;
    }>;
    readonly metrics?: Record<string, number>;
    readonly errors?: readonly string[];
  };
}

/**
 * Module event types for Observer pattern
 */
export enum ModuleEventType {
  INSTALLING = "module:installing",
  INSTALLED = "module:installed",
  CONFIGURING = "module:configuring",
  CONFIGURED = "module:configured",
  STARTING = "module:starting",
  STARTED = "module:started",
  STOPPING = "module:stopping",
  STOPPED = "module:stopped",
  UNINSTALLING = "module:uninstalling",
  UNINSTALLED = "module:uninstalled",
  HEALTH_CHECK = "module:health_check",
  ERROR = "module:error",
}

/**
 * Module event payload
 */
export interface ModuleEvent {
  readonly type: ModuleEventType;
  readonly moduleName: string;
  readonly timestamp: Date;
  readonly data?: Record<string, unknown>;
  readonly error?: Error;
}

/**
 * Module middleware interface for Chain of Responsibility pattern
 */
export interface ModuleMiddleware {
  readonly name: string;
  readonly priority: number;
  execute(
    request: NextRequest,
    response: NextResponse,
    next: () => Promise<NextResponse>,
  ): Promise<NextResponse>;
}

/**
 * Module event handler interface for Observer pattern
 */
export interface ModuleEventHandler {
  readonly eventType: ModuleEventType;
  readonly priority: number;
  handle(event: ModuleEvent): Promise<void>;
}

/**
 * Module database migration interface
 */
export interface ModuleMigration {
  readonly version: string;
  readonly description: string;
  readonly up: () => Promise<void>;
  readonly down: () => Promise<void>;
}

/**
 * Module performance metrics
 */
export interface ModuleMetrics {
  readonly startupTime: number;
  readonly memoryUsage: number;
  readonly requestCount: number;
  readonly errorCount: number;
  readonly avgResponseTime: number;
  readonly lastRequestTime?: Date;
}

/**
 * Module registry entry
 */
export interface ModuleRegistryEntry {
  readonly config: ModuleConfig;
  state: ModuleState;
  readonly instance?: ModuleInstance;
  metrics: ModuleMetrics;
  lastHealthCheck?: HealthCheckResult;
  readonly registeredAt: Date;
  startedAt?: Date;
  stoppedAt?: Date;
}

/**
 * Module instance interface - what gets created by the factory
 */
export interface ModuleInstance {
  readonly config: ModuleConfig;
  readonly state: ModuleState;

  /**
   * Install the module
   */
  install(): Promise<void>;

  /**
   * Configure the module with runtime settings
   */
  configure(settings: Record<string, unknown>): Promise<void>;

  /**
   * Start the module
   */
  start(): Promise<void>;

  /**
   * Stop the module gracefully
   */
  stop(): Promise<void>;

  /**
   * Uninstall the module
   */
  uninstall(): Promise<void>;

  /**
   * Get tRPC routers provided by this module
   */
  getRouters(): Promise<Record<string, AnyTRPCRouter>>;

  /**
   * Get middleware provided by this module
   */
  getMiddleware(): Promise<readonly ModuleMiddleware[]>;

  /**
   * Get event handlers provided by this module
   */
  getEventHandlers(): Promise<readonly ModuleEventHandler[]>;

  /**
   * Get database migrations provided by this module
   */
  getMigrations(): Promise<readonly ModuleMigration[]>;

  /**
   * Perform health check
   */
  healthCheck(): Promise<HealthCheckResult>;

  /**
   * Get current performance metrics
   */
  getMetrics(): Promise<ModuleMetrics>;

  /**
   * Clean up resources before shutdown
   */
  cleanup(): Promise<void>;
}

/**
 * Error types for module system
 */
export class ModuleError extends Error {
  constructor(
    message: string,
    public readonly moduleName: string,
    public readonly code: string,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = "ModuleError";
  }
}

export class ModuleDependencyError extends ModuleError {
  constructor(moduleName: string, missingDependency: string, cause?: Error) {
    super(
      `Module '${moduleName}' requires dependency '${missingDependency}'`,
      moduleName,
      "DEPENDENCY_ERROR",
      cause,
    );
    this.name = "ModuleDependencyError";
  }
}

export class ModuleConfigurationError extends ModuleError {
  constructor(moduleName: string, configIssue: string, cause?: Error) {
    super(
      `Module '${moduleName}' configuration error: ${configIssue}`,
      moduleName,
      "CONFIGURATION_ERROR",
      cause,
    );
    this.name = "ModuleConfigurationError";
  }
}

export class ModuleLifecycleError extends ModuleError {
  constructor(
    moduleName: string,
    operation: string,
    currentState: ModuleState,
    cause?: Error,
  ) {
    super(
      `Module '${moduleName}' cannot ${operation} from state ${currentState}`,
      moduleName,
      "LIFECYCLE_ERROR",
      cause,
    );
    this.name = "ModuleLifecycleError";
  }
}
