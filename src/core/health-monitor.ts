/**
 * Module Health Monitor
 *
 * This file implements comprehensive health monitoring for all modules
 * in the system, providing real-time status, performance metrics,
 * and alerting capabilities.
 */

import { HealthStatus, ModuleState, ModuleEventType } from "./types";
import type { HealthCheckResult } from "./types";
import { type ModuleRegistry } from "./module-registry";
import { EventEmitter } from "events";

/**
 * Health check configuration
 */
export interface HealthCheckConfig {
  /** How often to perform health checks (ms) */
  readonly interval: number;

  /** Timeout for individual health checks (ms) */
  readonly timeout: number;

  /** Number of consecutive failures before marking unhealthy */
  readonly failureThreshold: number;

  /** Number of consecutive successes before marking healthy */
  readonly successThreshold: number;

  /** Whether to enable detailed performance monitoring */
  readonly enableMetrics: boolean;

  /** Health check history size */
  readonly historySize: number;
}

/**
 * Default health check configuration
 */
const DEFAULT_HEALTH_CONFIG: HealthCheckConfig = {
  interval: 30000, // 30 seconds
  timeout: 5000, // 5 seconds
  failureThreshold: 3,
  successThreshold: 2,
  enableMetrics: true,
  historySize: 100,
};

/**
 * Health status change event
 */
export interface HealthStatusChangeEvent {
  readonly moduleName: string;
  readonly previousStatus: HealthStatus;
  readonly currentStatus: HealthStatus;
  readonly timestamp: Date;
  readonly consecutiveFailures: number;
  readonly consecutiveSuccesses: number;
}

/**
 * Health check history entry
 */
export interface HealthCheckHistoryEntry {
  readonly timestamp: Date;
  readonly status: HealthStatus;
  readonly duration: number;
  readonly result: HealthCheckResult;
  readonly error?: Error;
}

/**
 * Module health summary
 */
export interface ModuleHealthSummary {
  readonly name: string;
  readonly currentStatus: HealthStatus;
  readonly lastCheck: Date | undefined;
  readonly consecutiveFailures: number;
  readonly consecutiveSuccesses: number;
  readonly uptime: number;
  readonly avgResponseTime: number;
  readonly errorRate: number;
  readonly history: readonly HealthCheckHistoryEntry[];
}

/**
 * System health summary
 */
export interface SystemHealthSummary {
  readonly overallStatus: HealthStatus;
  readonly totalModules: number;
  readonly healthyModules: number;
  readonly unhealthyModules: number;
  readonly degradedModules: number;
  readonly lastUpdate: Date;
  readonly modules: readonly ModuleHealthSummary[];
}

/**
 * Health alert severity
 */
export enum AlertSeverity {
  INFO = "info",
  WARNING = "warning",
  ERROR = "error",
  CRITICAL = "critical",
}

/**
 * Health alert
 */
export interface HealthAlert {
  readonly id: string;
  readonly severity: AlertSeverity;
  readonly moduleName: string;
  readonly message: string;
  readonly timestamp: Date;
  readonly data?: Record<string, unknown>;
  readonly acknowledged: boolean;
}

/**
 * Health Monitor - monitors all module health status
 */
export class HealthMonitor extends EventEmitter {
  private readonly registry: ModuleRegistry;
  private readonly config: HealthCheckConfig;
  private readonly moduleHealth = new Map<
    string,
    {
      status: HealthStatus;
      consecutiveFailures: number;
      consecutiveSuccesses: number;
      lastCheck?: Date;
      history: HealthCheckHistoryEntry[];
      startTime: Date;
    }
  >();

  private readonly alerts = new Map<string, HealthAlert>();
  private healthCheckInterval?: NodeJS.Timeout;
  private metricsInterval?: NodeJS.Timeout;
  private isRunning = false;

  constructor(
    registry: ModuleRegistry,
    config: Partial<HealthCheckConfig> = {},
  ) {
    super();
    this.registry = registry;
    this.config = { ...DEFAULT_HEALTH_CONFIG, ...config };

    // Set up event listeners
    this.setupEventListeners();
  }

  /**
   * Start health monitoring
   */
  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;

    // Initialize health status for all modules
    this.initializeModuleHealth();

    // Start periodic health checks
    this.healthCheckInterval = setInterval(
      () => void this.performHealthChecks(),
      this.config.interval,
    );

    // Start metrics collection if enabled
    if (this.config.enableMetrics) {
      this.metricsInterval = setInterval(
        () => void this.collectMetrics(),
        Math.min(this.config.interval / 2, 15000), // Half interval or 15s max
      );
    }

    this.emit("started");
  }

  /**
   * Stop health monitoring
   */
  stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }

    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = undefined;
    }

    this.emit("stopped");
  }

  /**
   * Get current system health summary
   */
  getSystemHealth(): SystemHealthSummary {
    const modules = Array.from(this.moduleHealth.entries()).map(
      ([name, health]) => this.getModuleHealthSummary(name, health),
    );

    const healthyCount = modules.filter(
      (m) => m.currentStatus === HealthStatus.HEALTHY,
    ).length;
    const unhealthyCount = modules.filter(
      (m) => m.currentStatus === HealthStatus.UNHEALTHY,
    ).length;
    const degradedCount = modules.filter(
      (m) => m.currentStatus === HealthStatus.DEGRADED,
    ).length;

    // Determine overall status
    let overallStatus: HealthStatus;
    if (unhealthyCount > 0) {
      overallStatus = HealthStatus.UNHEALTHY;
    } else if (degradedCount > 0) {
      overallStatus = HealthStatus.DEGRADED;
    } else if (healthyCount > 0) {
      overallStatus = HealthStatus.HEALTHY;
    } else {
      overallStatus = HealthStatus.UNKNOWN;
    }

    return {
      overallStatus,
      totalModules: modules.length,
      healthyModules: healthyCount,
      unhealthyModules: unhealthyCount,
      degradedModules: degradedCount,
      lastUpdate: new Date(),
      modules,
    };
  }

  /**
   * Get health summary for a specific module
   */
  getModuleHealth(name: string): ModuleHealthSummary | undefined {
    const health = this.moduleHealth.get(name);
    if (!health) return undefined;

    return this.getModuleHealthSummary(name, health);
  }

  /**
   * Get all active alerts
   */
  getActiveAlerts(): readonly HealthAlert[] {
    return Array.from(this.alerts.values())
      .filter((alert) => !alert.acknowledged)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert) return false;

    const acknowledgedAlert: HealthAlert = {
      ...alert,
      acknowledged: true,
    };

    this.alerts.set(alertId, acknowledgedAlert);
    this.emit("alertAcknowledged", acknowledgedAlert);
    return true;
  }

  /**
   * Clear all acknowledged alerts older than specified time
   */
  clearOldAlerts(olderThanMs: number = 24 * 60 * 60 * 1000): number {
    const cutoffTime = Date.now() - olderThanMs;
    let cleared = 0;

    for (const [id, alert] of this.alerts) {
      if (alert.acknowledged && alert.timestamp.getTime() < cutoffTime) {
        this.alerts.delete(id);
        cleared++;
      }
    }

    return cleared;
  }

  /**
   * Force a health check for a specific module
   */
  async checkModuleHealth(
    name: string,
  ): Promise<HealthCheckResult | undefined> {
    const moduleInstance = this.registry.getModule(name);
    const state = this.registry.getModuleState(name);

    if (!moduleInstance || state !== ModuleState.RUNNING) {
      return undefined;
    }

    return this.performSingleHealthCheck(name, moduleInstance);
  }

  /**
   * Force health checks for all running modules
   */
  async performHealthChecks(): Promise<void> {
    const runningModules = this.registry.getRunningModules();
    const checks: Promise<void>[] = [];

    for (const [name, entry] of runningModules) {
      if (entry.instance) {
        checks.push(
          this.performSingleHealthCheck(name, entry.instance)
            .then(() => {
              /* Convert to void */
            })
            .catch((error) => {
              console.error(`Health check failed for module ${name}:`, error);
            }),
        );
      }
    }

    await Promise.all(checks);
    this.emit("healthCheckCompleted");
  }

  // Private methods

  private setupEventListeners(): void {
    // Listen for module lifecycle events
    this.registry.subscribe(ModuleEventType.STARTED, {
      eventType: ModuleEventType.STARTED,
      priority: 100,
      handle: async (event) => {
        void this.initializeModuleHealthStatus(event.moduleName);
      },
    });

    this.registry.subscribe(ModuleEventType.STOPPED, {
      eventType: ModuleEventType.STOPPED,
      priority: 100,
      handle: async (event) => {
        void this.removeModuleHealthStatus(event.moduleName);
      },
    });
  }

  private initializeModuleHealth(): void {
    const runningModules = this.registry.getRunningModules();

    for (const [name] of runningModules) {
      void this.initializeModuleHealthStatus(name);
    }
  }

  private initializeModuleHealthStatus(name: string): void {
    if (!this.moduleHealth.has(name)) {
      this.moduleHealth.set(name, {
        status: HealthStatus.UNKNOWN,
        consecutiveFailures: 0,
        consecutiveSuccesses: 0,
        history: [],
        startTime: new Date(),
      });
    }
  }

  private removeModuleHealthStatus(name: string): void {
    this.moduleHealth.delete(name);

    // Clear alerts for this module
    for (const [alertId, alert] of this.alerts) {
      if (alert.moduleName === name) {
        this.alerts.delete(alertId);
      }
    }
  }

  private async performSingleHealthCheck(
    name: string,
    instance: { healthCheck(): Promise<HealthCheckResult> },
  ): Promise<HealthCheckResult> {
    const startTime = Date.now();
    let result: HealthCheckResult;
    let error: Error | undefined;

    try {
      // Perform health check with timeout
      result = await this.withTimeout(
        instance.healthCheck(),
        this.config.timeout,
        `Health check for ${name}`,
      );
    } catch (err) {
      error = err instanceof Error ? err : new Error(String(err));
      result = {
        status: HealthStatus.UNHEALTHY,
        details: {
          uptime: 0,
          lastCheck: new Date(),
          dependencies: [],
          errors: [error.message],
        },
      };
    }

    const duration = Date.now() - startTime;
    const health = this.moduleHealth.get(name);

    if (health) {
      const historyEntry: HealthCheckHistoryEntry = {
        timestamp: new Date(),
        status: result.status,
        duration,
        result,
        error,
      };

      // Update history
      health.history.push(historyEntry);
      if (health.history.length > this.config.historySize) {
        health.history.shift();
      }

      // Update counters based on result
      const previousStatus = health.status;
      if (result.status === HealthStatus.HEALTHY) {
        health.consecutiveSuccesses++;
        health.consecutiveFailures = 0;
      } else {
        health.consecutiveFailures++;
        health.consecutiveSuccesses = 0;
      }

      // Determine new status based on thresholds
      let newStatus = result.status;
      if (health.consecutiveFailures >= this.config.failureThreshold) {
        newStatus = HealthStatus.UNHEALTHY;
      } else if (health.consecutiveSuccesses >= this.config.successThreshold) {
        newStatus = HealthStatus.HEALTHY;
      }

      // Update status and check for changes
      if (health.status !== newStatus) {
        health.status = newStatus;

        const statusChangeEvent: HealthStatusChangeEvent = {
          moduleName: name,
          previousStatus,
          currentStatus: newStatus,
          timestamp: new Date(),
          consecutiveFailures: health.consecutiveFailures,
          consecutiveSuccesses: health.consecutiveSuccesses,
        };

        this.emit("statusChanged", statusChangeEvent);

        // Generate alerts for status changes
        this.generateStatusChangeAlert(statusChangeEvent);
      }

      health.lastCheck = new Date();
    }

    return result;
  }

  private async collectMetrics(): Promise<void> {
    const runningModules = this.registry.getRunningModules();

    for (const [name, entry] of runningModules) {
      if (entry.instance) {
        try {
          const metrics = await entry.instance.getMetrics();
          this.emit("metricsCollected", { moduleName: name, metrics });
        } catch (error) {
          console.error(`Error collecting metrics for module ${name}:`, error);
        }
      }
    }
  }

  private generateStatusChangeAlert(event: HealthStatusChangeEvent): void {
    let severity: AlertSeverity;
    let message: string;

    switch (event.currentStatus) {
      case HealthStatus.UNHEALTHY:
        severity = AlertSeverity.ERROR;
        message = `Module '${event.moduleName}' became unhealthy after ${event.consecutiveFailures} consecutive failures`;
        break;

      case HealthStatus.DEGRADED:
        severity = AlertSeverity.WARNING;
        message = `Module '${event.moduleName}' is degraded`;
        break;

      case HealthStatus.HEALTHY:
        if (event.previousStatus === HealthStatus.UNHEALTHY) {
          severity = AlertSeverity.INFO;
          message = `Module '${event.moduleName}' recovered and is now healthy`;
        } else {
          return; // Don't alert for normal healthy status
        }
        break;

      default:
        return;
    }

    const alert: HealthAlert = {
      id: `${event.moduleName}_${event.timestamp.getTime()}`,
      severity,
      moduleName: event.moduleName,
      message,
      timestamp: event.timestamp,
      data: {
        previousStatus: event.previousStatus,
        currentStatus: event.currentStatus,
        consecutiveFailures: event.consecutiveFailures,
        consecutiveSuccesses: event.consecutiveSuccesses,
      },
      acknowledged: false,
    };

    this.alerts.set(alert.id, alert);
    this.emit("alert", alert);
  }

  private getModuleHealthSummary(
    name: string,
    health: {
      status: HealthStatus;
      consecutiveFailures: number;
      consecutiveSuccesses: number;
      lastCheck?: Date;
      history: HealthCheckHistoryEntry[];
      startTime: Date;
    },
  ): ModuleHealthSummary {
    const uptime = Date.now() - health.startTime.getTime();
    const recentHistory = health.history.slice(-10); // Last 10 checks
    const avgResponseTime =
      recentHistory.length > 0
        ? recentHistory.reduce((sum, entry) => sum + entry.duration, 0) /
          recentHistory.length
        : 0;

    const errorCount = recentHistory.filter(
      (entry) => entry.status === HealthStatus.UNHEALTHY,
    ).length;
    const errorRate =
      recentHistory.length > 0 ? errorCount / recentHistory.length : 0;

    return {
      name,
      currentStatus: health.status,
      lastCheck: health.lastCheck,
      consecutiveFailures: health.consecutiveFailures,
      consecutiveSuccesses: health.consecutiveSuccesses,
      uptime,
      avgResponseTime,
      errorRate,
      history: [...health.history], // Return copy
    };
  }

  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    operation: string,
  ): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`${operation} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]);
  }
}
