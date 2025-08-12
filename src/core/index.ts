/**
 * Core Module System Exports
 *
 * This file exports all the core module system components for use
 * throughout the application. It serves as the main entry point
 * for the module system.
 */

// Core types and interfaces
export type {
  ModuleConfig,
  ModuleInstance,
  ModuleRegistryEntry,
  ModuleEvent,
  ModuleEventHandler,
  ModuleMiddleware,
  ModuleMigration,
  ModuleMetrics,
  HealthCheckResult,
} from "./types";

export {
  ModuleState,
  HealthStatus,
  ModulePriority,
  ModuleEventType,
  ModuleError,
  ModuleDependencyError,
  ModuleConfigurationError,
  ModuleLifecycleError,
} from "./types";

// Core strategy pattern
export type { ModuleStrategy } from "./module-strategy";
export { BaseModuleStrategy } from "./module-strategy";

// Factory pattern
export { ModuleFactory } from "./module-factory";
export type { ModuleConstructor } from "./module-factory";

// Registry singleton
export { ModuleRegistry } from "./module-registry";

// Lifecycle management
export { LifecycleManager } from "./lifecycle-manager";
export type {
  LifecyclePhase,
  LifecycleResult,
  LifecycleOptions,
} from "./lifecycle-manager";

// Health monitoring
export { HealthMonitor } from "./health-monitor";
export type {
  HealthCheckConfig,
  HealthStatusChangeEvent,
  HealthCheckHistoryEntry,
  ModuleHealthSummary,
  SystemHealthSummary,
  AlertSeverity,
  HealthAlert,
} from "./health-monitor";

// tRPC integration
export {
  ModuleTRPCIntegration,
  createModuleTRPCIntegration,
  mergeRouters,
  createModuleRouters,
} from "./trpc-integration";
export type { ModuleRouterAccess } from "./trpc-integration";

/**
 * Initialize the core module system
 *
 * This function sets up the module system with default configuration.
 * Call this during application startup to initialize the registry,
 * lifecycle manager, and health monitor.
 *
 * @returns Object containing initialized components
 */
export async function initializeModuleSystem() {
  const { ModuleRegistry } = await import("./module-registry");
  const { LifecycleManager } = await import("./lifecycle-manager");
  const { HealthMonitor } = await import("./health-monitor");
  const { ModuleTRPCIntegration } = await import("./trpc-integration");

  const registry = ModuleRegistry.getInstance();
  const lifecycleManager = new LifecycleManager(registry);
  const healthMonitor = new HealthMonitor(registry);
  const trpcIntegration = new ModuleTRPCIntegration(registry);

  return {
    registry,
    lifecycleManager,
    healthMonitor,
    trpcIntegration,
  } as const;
}

/**
 * Get the singleton module registry instance
 *
 * Convenience function to access the registry without importing
 * the class directly.
 */
export async function getModuleRegistry() {
  const { ModuleRegistry } = await import("./module-registry");
  return ModuleRegistry.getInstance();
}

/**
 * Module system version
 */
export const MODULE_SYSTEM_VERSION = "1.0.0";

/**
 * Module system metadata
 */
export const MODULE_SYSTEM_INFO = {
  version: MODULE_SYSTEM_VERSION,
  name: "Modular Platform Foundation",
  description: "Enterprise-grade modular platform following SOLID principles",
  designPatterns: [
    "Strategy Pattern",
    "Factory Pattern",
    "Singleton Pattern",
    "Observer Pattern",
    "Chain of Responsibility Pattern",
  ],
} as const;
