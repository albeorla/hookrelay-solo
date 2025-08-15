/**
 * Security Boundaries and Module Isolation
 *
 * This file implements security mechanisms for module isolation,
 * permission checking, and resource access control following
 * the principle of least privilege.
 */

import { ModulePriority } from "./types";

/**
 * Security context for operations
 */
export interface SecurityContext {
  /** Module making the request */
  readonly moduleId: string;

  /** User ID if applicable */
  readonly userId?: string;

  /** Session ID for tracking */
  readonly sessionId?: string;

  /** Request permissions */
  readonly permissions: readonly string[];

  /** Module priority level */
  readonly priority: ModulePriority;

  /** Allowed resource types */
  readonly allowedResources: readonly ResourceType[];

  /** Security constraints */
  readonly constraints: SecurityConstraints;
}

/**
 * Security constraints for operations
 */
export interface SecurityConstraints {
  /** Maximum execution time (ms) */
  readonly maxExecutionTime: number;

  /** Maximum memory usage (bytes) */
  readonly maxMemoryUsage: number;

  /** Maximum network calls */
  readonly maxNetworkCalls: number;

  /** Maximum file system operations */
  readonly maxFileSystemOps: number;

  /** Allowed network hosts */
  readonly allowedHosts: readonly string[];

  /** Allowed file system paths */
  readonly allowedPaths: readonly string[];

  /** Rate limiting rules */
  readonly rateLimits: RateLimitRule[];
}

/**
 * Rate limiting rule
 */
export interface RateLimitRule {
  readonly operation: string;
  readonly maxCalls: number;
  readonly windowMs: number;
}

/**
 * Resource types that modules can access
 */
export enum ResourceType {
  DATABASE = "database",
  FILE_SYSTEM = "file_system",
  NETWORK = "network",
  ENVIRONMENT = "environment",
  CONTAINER = "container",
  EVENT_BUS = "event_bus",
  OTHER_MODULE = "other_module",
  SYSTEM = "system",
}

/**
 * Permission levels for module operations
 */
export enum PermissionLevel {
  READ = "read",
  WRITE = "write",
  EXECUTE = "execute",
  ADMIN = "admin",
}

/**
 * Resource access request
 */
export interface ResourceAccessRequest {
  readonly context: SecurityContext;
  readonly resourceType: ResourceType;
  readonly resourceId: string;
  readonly permission: PermissionLevel;
  readonly operation: string;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Resource access result
 */
export interface ResourceAccessResult {
  readonly allowed: boolean;
  readonly reason?: string;
  readonly constraints?: SecurityConstraints;
  readonly auditLog?: AuditLogEntry;
}

/**
 * Audit log entry
 */
export interface AuditLogEntry {
  readonly timestamp: Date;
  readonly moduleId: string;
  readonly userId?: string;
  readonly operation: string;
  readonly resourceType: ResourceType;
  readonly resourceId: string;
  readonly permission: PermissionLevel;
  readonly allowed: boolean;
  readonly reason?: string;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Security policy interface
 */
export interface SecurityPolicy {
  readonly name: string;
  readonly priority: number;

  /**
   * Check if operation is allowed
   */
  evaluate(request: ResourceAccessRequest): Promise<ResourceAccessResult>;
}

/**
 * Default security constraints by module priority
 */
const DEFAULT_CONSTRAINTS: Record<ModulePriority, SecurityConstraints> = {
  [ModulePriority.CRITICAL]: {
    maxExecutionTime: 60000, // 1 minute
    maxMemoryUsage: 256 * 1024 * 1024, // 256 MB
    maxNetworkCalls: 100,
    maxFileSystemOps: 50,
    allowedHosts: ["*"],
    allowedPaths: ["*"],
    rateLimits: [],
  },
  [ModulePriority.HIGH]: {
    maxExecutionTime: 30000, // 30 seconds
    maxMemoryUsage: 128 * 1024 * 1024, // 128 MB
    maxNetworkCalls: 50,
    maxFileSystemOps: 25,
    allowedHosts: ["api.stripe.com", "hooks.slack.com", "*.amazonaws.com"],
    allowedPaths: ["/tmp", "/var/log"],
    rateLimits: [{ operation: "api_call", maxCalls: 100, windowMs: 60000 }],
  },
  [ModulePriority.MEDIUM]: {
    maxExecutionTime: 15000, // 15 seconds
    maxMemoryUsage: 64 * 1024 * 1024, // 64 MB
    maxNetworkCalls: 25,
    maxFileSystemOps: 10,
    allowedHosts: ["api.sendgrid.com", "*.mailgun.org"],
    allowedPaths: ["/tmp"],
    rateLimits: [
      { operation: "api_call", maxCalls: 50, windowMs: 60000 },
      { operation: "email_send", maxCalls: 10, windowMs: 60000 },
    ],
  },
  [ModulePriority.LOW]: {
    maxExecutionTime: 5000, // 5 seconds
    maxMemoryUsage: 32 * 1024 * 1024, // 32 MB
    maxNetworkCalls: 10,
    maxFileSystemOps: 5,
    allowedHosts: [],
    allowedPaths: [],
    rateLimits: [{ operation: "api_call", maxCalls: 10, windowMs: 60000 }],
  },
};

/**
 * Security manager implementation
 *
 * Provides centralized security enforcement for module operations.
 * Implements access control, resource isolation, and audit logging.
 */
export class SecurityManager {
  private readonly policies = new Map<string, SecurityPolicy>();
  private readonly auditLog: AuditLogEntry[] = [];
  private readonly rateLimiters = new Map<
    string,
    Map<string, { count: number; resetTime: number }>
  >();
  private readonly activeOperations = new Map<
    string,
    {
      context: SecurityContext;
      startTime: Date;
      memoryStart: number;
      resourceUsage: Map<ResourceType, number>;
    }
  >();

  private readonly maxAuditLogSize: number;
  private readonly enableMetrics: boolean;

  constructor(
    options: {
      maxAuditLogSize?: number;
      enableMetrics?: boolean;
    } = {},
  ) {
    this.maxAuditLogSize = options.maxAuditLogSize ?? 10000;
    this.enableMetrics = options.enableMetrics ?? true;

    // Register default policies
    this.registerDefaultPolicies();
  }

  /**
   * Add a security policy
   */
  addPolicy(policy: SecurityPolicy): void {
    this.policies.set(policy.name, policy);
  }

  /**
   * Remove a security policy
   */
  removePolicy(name: string): boolean {
    return this.policies.delete(name);
  }

  /**
   * Check if operation is allowed
   */
  async checkAccess(
    request: ResourceAccessRequest,
  ): Promise<ResourceAccessResult> {
    // Get applicable policies sorted by priority
    const policies = Array.from(this.policies.values()).sort(
      (a, b) => a.priority - b.priority,
    );

    let finalResult: ResourceAccessResult = { allowed: true };

    // Evaluate each policy
    for (const policy of policies) {
      try {
        const result = await policy.evaluate(request);

        // If any policy denies access, deny the request
        if (!result.allowed) {
          finalResult = result;
          break;
        }

        // Merge constraints from all policies
        if (result.constraints) {
          finalResult = {
            ...finalResult,
            constraints: this.mergeConstraints(
              finalResult.constraints,
              result.constraints,
            ),
          };
        }
      } catch (error) {
        console.error(
          `Error evaluating security policy '${policy.name}':`,
          error,
        );
        // Fail-safe: deny access on policy evaluation error
        finalResult = {
          allowed: false,
          reason: `Security policy evaluation failed: ${policy.name}`,
        };
        break;
      }
    }

    // Create audit log entry
    const auditEntry: AuditLogEntry = {
      timestamp: new Date(),
      moduleId: request.context.moduleId,
      userId: request.context.userId,
      operation: request.operation,
      resourceType: request.resourceType,
      resourceId: request.resourceId,
      permission: request.permission,
      allowed: finalResult.allowed,
      reason: finalResult.reason,
      metadata: request.metadata,
    };

    this.addAuditLogEntry(auditEntry);
    finalResult = {
      ...finalResult,
      auditLog: auditEntry,
    };

    return finalResult;
  }

  /**
   * Start tracking an operation
   */
  startOperation(operationId: string, context: SecurityContext): void {
    if (this.enableMetrics) {
      this.activeOperations.set(operationId, {
        context,
        startTime: new Date(),
        memoryStart: process.memoryUsage().heapUsed,
        resourceUsage: new Map(),
      });
    }
  }

  /**
   * Track resource usage for an operation
   */
  trackResourceUsage(
    operationId: string,
    resourceType: ResourceType,
    count = 1,
  ): void {
    const operation = this.activeOperations.get(operationId);
    if (operation) {
      const current = operation.resourceUsage.get(resourceType) ?? 0;
      operation.resourceUsage.set(resourceType, current + count);
    }
  }

  /**
   * End operation tracking and validate constraints
   */
  endOperation(operationId: string): {
    violations: string[];
    executionTime: number;
    memoryUsage: number;
  } {
    const operation = this.activeOperations.get(operationId);
    if (!operation) {
      return { violations: [], executionTime: 0, memoryUsage: 0 };
    }

    const executionTime = Date.now() - operation.startTime.getTime();
    const memoryUsage = process.memoryUsage().heapUsed - operation.memoryStart;
    const violations: string[] = [];

    // Check constraint violations
    const constraints = operation.context.constraints;

    if (executionTime > constraints.maxExecutionTime) {
      violations.push(
        `Execution time exceeded: ${executionTime}ms > ${constraints.maxExecutionTime}ms`,
      );
    }

    if (memoryUsage > constraints.maxMemoryUsage) {
      violations.push(
        `Memory usage exceeded: ${memoryUsage} bytes > ${constraints.maxMemoryUsage} bytes`,
      );
    }

    // Check resource usage limits
    for (const [resourceType, usage] of operation.resourceUsage) {
      const limit = this.getResourceLimit(resourceType, constraints);
      if (limit && usage > limit) {
        violations.push(`${resourceType} usage exceeded: ${usage} > ${limit}`);
      }
    }

    // Clean up
    this.activeOperations.delete(operationId);

    return { violations, executionTime, memoryUsage };
  }

  /**
   * Check rate limits for an operation
   */
  checkRateLimit(context: SecurityContext, operation: string): boolean {
    const rule = context.constraints.rateLimits.find(
      (r) => r.operation === operation,
    );

    if (!rule) {
      return true; // No rate limit configured
    }

    const now = Date.now();
    const moduleRateLimits =
      this.rateLimiters.get(context.moduleId) ??
      new Map<string, { count: number; resetTime: number }>();
    const operationData = moduleRateLimits.get(operation) ?? {
      count: 0,
      resetTime: now + rule.windowMs,
    };

    // Check if window has expired
    if (now >= operationData.resetTime) {
      const newData = {
        count: 1,
        resetTime: now + rule.windowMs,
      };
      moduleRateLimits.set(operation, newData);
      this.rateLimiters.set(context.moduleId, moduleRateLimits);
      return newData.count <= rule.maxCalls;
    } else {
      const newData = {
        count: operationData.count + 1,
        resetTime: operationData.resetTime,
      };
      moduleRateLimits.set(operation, newData);
      this.rateLimiters.set(context.moduleId, moduleRateLimits);
      return newData.count <= rule.maxCalls;
    }
  }

  /**
   * Create security context for a module
   */
  createSecurityContext(
    moduleId: string,
    priority: ModulePriority,
    permissions: readonly string[],
    userId?: string,
  ): SecurityContext {
    return {
      moduleId,
      userId,
      sessionId: this.generateSessionId(),
      permissions,
      priority,
      allowedResources: this.getAllowedResources(priority, permissions),
      constraints: DEFAULT_CONSTRAINTS[priority],
    };
  }

  /**
   * Get audit log entries
   */
  getAuditLog(filter?: {
    moduleId?: string;
    userId?: string;
    resourceType?: ResourceType;
    startDate?: Date;
    endDate?: Date;
  }): readonly AuditLogEntry[] {
    let entries = [...this.auditLog];

    if (filter) {
      entries = entries.filter((entry) => {
        if (filter.moduleId && entry.moduleId !== filter.moduleId) return false;
        if (filter.userId && entry.userId !== filter.userId) return false;
        if (filter.resourceType && entry.resourceType !== filter.resourceType)
          return false;
        if (filter.startDate && entry.timestamp < filter.startDate)
          return false;
        if (filter.endDate && entry.timestamp > filter.endDate) return false;
        return true;
      });
    }

    return entries;
  }

  /**
   * Clear audit log
   */
  clearAuditLog(): void {
    this.auditLog.length = 0;
  }

  /**
   * Get security statistics
   */
  getStatistics() {
    const totalEntries = this.auditLog.length;
    const deniedOperations = this.auditLog.filter(
      (entry) => !entry.allowed,
    ).length;
    const operationsByModule = new Map<string, number>();
    const violationsByType = new Map<string, number>();

    for (const entry of this.auditLog) {
      operationsByModule.set(
        entry.moduleId,
        (operationsByModule.get(entry.moduleId) ?? 0) + 1,
      );

      if (!entry.allowed && entry.reason) {
        violationsByType.set(
          entry.reason,
          (violationsByType.get(entry.reason) ?? 0) + 1,
        );
      }
    }

    return {
      totalOperations: totalEntries,
      deniedOperations,
      successRate:
        totalEntries > 0 ? (totalEntries - deniedOperations) / totalEntries : 1,
      activeOperations: this.activeOperations.size,
      policiesCount: this.policies.size,
      operationsByModule: Object.fromEntries(operationsByModule),
      violationsByType: Object.fromEntries(violationsByType),
    };
  }

  // Private implementation methods

  private registerDefaultPolicies(): void {
    // Resource type policy
    this.addPolicy(new ResourceTypePolicy());

    // Permission policy
    this.addPolicy(new PermissionPolicy());

    // Rate limiting policy
    this.addPolicy(new RateLimitPolicy(this));

    // Module isolation policy
    this.addPolicy(new ModuleIsolationPolicy());
  }

  private getAllowedResources(
    priority: ModulePriority,
    permissions: readonly string[],
  ): readonly ResourceType[] {
    const allowedResources: ResourceType[] = [];

    // Critical and high priority modules get broader access
    if (priority <= ModulePriority.HIGH) {
      allowedResources.push(...Object.values(ResourceType));
    } else {
      // Limited access for medium and low priority modules
      allowedResources.push(ResourceType.EVENT_BUS, ResourceType.CONTAINER);

      if (permissions.includes("database:read")) {
        allowedResources.push(ResourceType.DATABASE);
      }

      if (permissions.includes("network:access")) {
        allowedResources.push(ResourceType.NETWORK);
      }
    }

    return allowedResources;
  }

  private getResourceLimit(
    resourceType: ResourceType,
    constraints: SecurityConstraints,
  ): number | undefined {
    switch (resourceType) {
      case ResourceType.NETWORK:
        return constraints.maxNetworkCalls;
      case ResourceType.FILE_SYSTEM:
        return constraints.maxFileSystemOps;
      default:
        return undefined;
    }
  }

  private mergeConstraints(
    existing?: SecurityConstraints,
    additional?: SecurityConstraints,
  ): SecurityConstraints {
    if (!existing) return additional!;
    if (!additional) return existing;

    return {
      maxExecutionTime: Math.min(
        existing.maxExecutionTime,
        additional.maxExecutionTime,
      ),
      maxMemoryUsage: Math.min(
        existing.maxMemoryUsage,
        additional.maxMemoryUsage,
      ),
      maxNetworkCalls: Math.min(
        existing.maxNetworkCalls,
        additional.maxNetworkCalls,
      ),
      maxFileSystemOps: Math.min(
        existing.maxFileSystemOps,
        additional.maxFileSystemOps,
      ),
      allowedHosts: existing.allowedHosts.filter((host) =>
        additional.allowedHosts.includes(host),
      ),
      allowedPaths: existing.allowedPaths.filter((path) =>
        additional.allowedPaths.includes(path),
      ),
      rateLimits: [...existing.rateLimits, ...additional.rateLimits],
    };
  }

  private addAuditLogEntry(entry: AuditLogEntry): void {
    this.auditLog.push(entry);

    // Trim log if it exceeds max size
    if (this.auditLog.length > this.maxAuditLogSize) {
      this.auditLog.splice(0, this.auditLog.length - this.maxAuditLogSize);
    }
  }

  private generateSessionId(): string {
    return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Default security policies
 */

class ResourceTypePolicy implements SecurityPolicy {
  readonly name = "resource-type";
  readonly priority = 10;

  async evaluate(
    request: ResourceAccessRequest,
  ): Promise<ResourceAccessResult> {
    const allowed = request.context.allowedResources.includes(
      request.resourceType,
    );

    return {
      allowed,
      reason: allowed
        ? undefined
        : `Resource type '${request.resourceType}' not allowed for module`,
    };
  }
}

class PermissionPolicy implements SecurityPolicy {
  readonly name = "permission";
  readonly priority = 20;

  async evaluate(
    request: ResourceAccessRequest,
  ): Promise<ResourceAccessResult> {
    const requiredPermission = `${request.resourceType}:${request.permission}`;
    const allowed =
      request.context.permissions.includes(requiredPermission) ||
      request.context.permissions.includes(`${request.resourceType}:*`) ||
      request.context.permissions.includes("*");

    return {
      allowed,
      reason: allowed
        ? undefined
        : `Permission '${requiredPermission}' not granted`,
    };
  }
}

class RateLimitPolicy implements SecurityPolicy {
  readonly name = "rate-limit";
  readonly priority = 30;

  constructor(private securityManager: SecurityManager) {}

  async evaluate(
    request: ResourceAccessRequest,
  ): Promise<ResourceAccessResult> {
    const allowed = this.securityManager.checkRateLimit(
      request.context,
      request.operation,
    );

    return {
      allowed,
      reason: allowed
        ? undefined
        : `Rate limit exceeded for operation '${request.operation}'`,
    };
  }
}

class ModuleIsolationPolicy implements SecurityPolicy {
  readonly name = "module-isolation";
  readonly priority = 40;

  async evaluate(
    request: ResourceAccessRequest,
  ): Promise<ResourceAccessResult> {
    // Prevent low priority modules from accessing high priority resources
    if (request.context.priority > ModulePriority.HIGH) {
      if (
        request.resourceType === ResourceType.SYSTEM ||
        (request.resourceType === ResourceType.OTHER_MODULE &&
          request.permission === PermissionLevel.ADMIN)
      ) {
        return {
          allowed: false,
          reason:
            "Low priority modules cannot access system resources or admin operations",
        };
      }
    }

    return { allowed: true };
  }
}

/**
 * Global security manager instance
 */
export const globalSecurityManager = new SecurityManager();
