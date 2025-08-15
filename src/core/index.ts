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

// Integration Framework - Story 2 Components

// Dependency Injection Container
export {
  Container,
  ServiceLifetime,
  globalContainer,
  ContainerBuilder,
  Injectable,
  Inject,
} from "./container";
export type {
  ServiceToken,
  ServiceFactory,
  ServiceConstructor,
  ServiceRegistration,
  ContainerScope,
} from "./container";

// Event Bus System
export { EventBus, globalEventBus, TypedEventBus } from "./event-bus";
export type {
  EventHandler,
  EventPayload,
  EventSubscription,
  SubscriptionOptions,
  EventBusStatistics,
  EventMiddleware,
} from "./event-bus";

// Middleware Chain System
export {
  MiddlewareChain,
  BaseMiddlewareHandler,
  LoggingMiddleware,
  PerformanceMiddleware,
  AuthenticationMiddleware,
  globalMiddlewareChain,
} from "./middleware-chain";
export type {
  RequestContext,
  MiddlewareResult,
  MiddlewareHandler,
  MiddlewareChainConfig,
  MiddlewareChainStatistics,
} from "./middleware-chain";

// Security Boundaries
export {
  SecurityManager,
  globalSecurityManager,
  ResourceType,
  PermissionLevel,
} from "./security";
export type {
  SecurityContext,
  SecurityConstraints,
  RateLimitRule,
  ResourceAccessRequest,
  ResourceAccessResult,
  AuditLogEntry,
  SecurityPolicy,
} from "./security";

/**
 * Initialize the core module system with integration framework
 *
 * This function sets up the complete module system including the new
 * integration framework components (Story 2). Call this during
 * application startup to initialize all module system components.
 *
 * @returns Object containing all initialized components
 */
export async function initializeModuleSystem(
  options: {
    enableContainer?: boolean;
    enableEventBus?: boolean;
    enableMiddleware?: boolean;
    enableSecurity?: boolean;
  } = {},
) {
  const {
    enableContainer = true,
    enableEventBus = true,
    enableMiddleware = true,
    enableSecurity = true,
  } = options;

  // Core module system
  const { ModuleRegistry } = await import("./module-registry");
  const { LifecycleManager } = await import("./lifecycle-manager");
  const { HealthMonitor } = await import("./health-monitor");
  const { ModuleTRPCIntegration } = await import("./trpc-integration");

  const registry = ModuleRegistry.getInstance();
  const lifecycleManager = new LifecycleManager(registry);
  const healthMonitor = new HealthMonitor(registry);
  const trpcIntegration = new ModuleTRPCIntegration(registry);

  // Integration framework components
  let container, eventBus, middlewareChain, securityManager;

  if (enableContainer) {
    const { globalContainer } = await import("./container");
    container = globalContainer;
  }

  if (enableEventBus) {
    const { globalEventBus } = await import("./event-bus");
    eventBus = globalEventBus;
  }

  if (enableMiddleware) {
    const { globalMiddlewareChain } = await import("./middleware-chain");
    middlewareChain = globalMiddlewareChain;
  }

  if (enableSecurity) {
    const { globalSecurityManager } = await import("./security");
    securityManager = globalSecurityManager;
  }

  return {
    // Core components
    registry,
    lifecycleManager,
    healthMonitor,
    trpcIntegration,
    // Integration framework
    container,
    eventBus,
    middlewareChain,
    securityManager,
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
