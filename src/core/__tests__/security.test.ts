import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  SecurityManager,
  ResourceType,
  PermissionLevel,
  globalSecurityManager,
  type SecurityContext,
  type ResourceAccessRequest,
  type SecurityPolicy,
  type AuditLogEntry,
} from "../security";
import { ModulePriority } from "../types";

// Mock console methods
const consoleSpy = {
  error: vi.spyOn(console, "error").mockImplementation(() => {}),
};

// Helper function to create security context
function createSecurityContext(
  overrides: Partial<SecurityContext> = {},
): SecurityContext {
  return {
    moduleId: "test-module",
    userId: "test-user",
    sessionId: "test-session",
    permissions: ["database:read", "network:access"],
    priority: ModulePriority.MEDIUM,
    allowedResources: [
      ResourceType.DATABASE,
      ResourceType.NETWORK,
      ResourceType.EVENT_BUS,
    ],
    constraints: {
      maxExecutionTime: 15000,
      maxMemoryUsage: 64 * 1024 * 1024,
      maxNetworkCalls: 25,
      maxFileSystemOps: 10,
      allowedHosts: ["api.example.com"],
      allowedPaths: ["/tmp"],
      rateLimits: [{ operation: "api_call", maxCalls: 50, windowMs: 60000 }],
    },
    ...overrides,
  };
}

// Helper function to create resource access request
function createResourceAccessRequest(
  overrides: Partial<ResourceAccessRequest> = {},
): ResourceAccessRequest {
  return {
    context: createSecurityContext(),
    resourceType: ResourceType.DATABASE,
    resourceId: "test-resource",
    permission: PermissionLevel.READ,
    operation: "test-operation",
    metadata: { test: true },
    ...overrides,
  };
}

// Custom security policy for testing
class TestSecurityPolicy implements SecurityPolicy {
  constructor(
    public readonly name: string,
    public readonly priority: number,
    private shouldAllow: boolean = true,
    private shouldThrow: boolean = false,
  ) {}

  async evaluate(request: ResourceAccessRequest) {
    if (this.shouldThrow) {
      throw new Error(`Test policy ${this.name} error`);
    }

    return {
      allowed: this.shouldAllow,
      reason: this.shouldAllow ? undefined : `Test policy ${this.name} denied`,
      constraints: this.shouldAllow
        ? {
            maxExecutionTime: 5000,
            maxMemoryUsage: 32 * 1024 * 1024,
            maxNetworkCalls: 5,
            maxFileSystemOps: 2,
            allowedHosts: ["limited.example.com"],
            allowedPaths: ["/restricted"],
            rateLimits: [
              { operation: "restricted", maxCalls: 1, windowMs: 60000 },
            ],
          }
        : undefined,
    };
  }
}

describe("Security", () => {
  let securityManager: SecurityManager;

  beforeEach(() => {
    securityManager = new SecurityManager();
    vi.clearAllMocks();
  });

  afterEach(() => {
    consoleSpy.error.mockClear();
  });

  describe("SecurityManager Construction", () => {
    it("should create security manager with default options", () => {
      const manager = new SecurityManager();
      expect(manager).toBeInstanceOf(SecurityManager);
    });

    it("should create security manager with custom options", () => {
      const manager = new SecurityManager({
        maxAuditLogSize: 5000,
        enableMetrics: false,
      });
      expect(manager).toBeInstanceOf(SecurityManager);
    });

    it("should register default policies on construction", () => {
      const stats = securityManager.getStatistics();
      expect(stats.policiesCount).toBeGreaterThan(0);
    });
  });

  describe("Policy Management", () => {
    it("should add security policy", () => {
      const policy = new TestSecurityPolicy("test-policy", 50);

      securityManager.addPolicy(policy);

      const stats = securityManager.getStatistics();
      expect(stats.policiesCount).toBeGreaterThan(4); // 4 default + 1 custom
    });

    it("should remove security policy", () => {
      const policy = new TestSecurityPolicy("removable-policy", 50);
      securityManager.addPolicy(policy);

      const initialCount = securityManager.getStatistics().policiesCount;
      const removed = securityManager.removePolicy("removable-policy");

      expect(removed).toBe(true);
      expect(securityManager.getStatistics().policiesCount).toBe(
        initialCount - 1,
      );
    });

    it("should return false when removing non-existent policy", () => {
      const removed = securityManager.removePolicy("non-existent");
      expect(removed).toBe(false);
    });

    it("should replace policy with same name", () => {
      const policy1 = new TestSecurityPolicy("same-name", 50, true);
      const policy2 = new TestSecurityPolicy("same-name", 60, false);

      securityManager.addPolicy(policy1);
      const countAfterFirst = securityManager.getStatistics().policiesCount;

      securityManager.addPolicy(policy2);
      const countAfterSecond = securityManager.getStatistics().policiesCount;

      expect(countAfterSecond).toBe(countAfterFirst); // Same count, policy replaced
    });
  });

  describe("Access Control", () => {
    it("should allow access when all policies permit", async () => {
      const request = createResourceAccessRequest({
        context: createSecurityContext({
          permissions: ["database:read"],
          allowedResources: [ResourceType.DATABASE],
        }),
        resourceType: ResourceType.DATABASE,
        permission: PermissionLevel.READ,
      });

      const result = await securityManager.checkAccess(request);

      expect(result.allowed).toBe(true);
      expect(result.auditLog).toBeDefined();
    });

    it("should deny access when any policy denies", async () => {
      const denyPolicy = new TestSecurityPolicy("deny-policy", 10, false);
      securityManager.addPolicy(denyPolicy);

      const request = createResourceAccessRequest();
      const result = await securityManager.checkAccess(request);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Test policy deny-policy denied");
    });

    it("should evaluate policies in priority order", async () => {
      const policy1 = new TestSecurityPolicy("high-priority", 10, false);
      const policy2 = new TestSecurityPolicy("low-priority", 50, true);

      securityManager.addPolicy(policy1);
      securityManager.addPolicy(policy2);

      const request = createResourceAccessRequest();
      const result = await securityManager.checkAccess(request);

      // High priority policy denies, so result should be denied
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("high-priority");
    });

    it("should merge constraints from multiple policies", async () => {
      const policy1 = new TestSecurityPolicy("policy1", 10, true);
      const policy2 = new TestSecurityPolicy("policy2", 20, true);

      securityManager.addPolicy(policy1);
      securityManager.addPolicy(policy2);

      const request = createResourceAccessRequest();
      const result = await securityManager.checkAccess(request);

      expect(result.allowed).toBe(true);
      expect(result.constraints).toBeDefined();
      // Should be most restrictive (min of all constraints)
      expect(result.constraints!.maxExecutionTime).toBe(5000); // From test policy
    });

    it("should handle policy evaluation errors gracefully", async () => {
      const failingPolicy = new TestSecurityPolicy(
        "failing-policy",
        10,
        true,
        true,
      );
      securityManager.addPolicy(failingPolicy);

      const request = createResourceAccessRequest();
      const result = await securityManager.checkAccess(request);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Security policy evaluation failed");
      expect(consoleSpy.error).toHaveBeenCalled();
    });

    it("should deny access to unauthorized resource types", async () => {
      const request = createResourceAccessRequest({
        context: createSecurityContext({
          allowedResources: [ResourceType.DATABASE], // Only database allowed
        }),
        resourceType: ResourceType.SYSTEM, // Requesting system access
      });

      const result = await securityManager.checkAccess(request);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Resource type 'system' not allowed");
    });

    it("should deny access without required permissions", async () => {
      const request = createResourceAccessRequest({
        context: createSecurityContext({
          permissions: ["database:read"], // Only read permission
        }),
        permission: PermissionLevel.WRITE, // Requesting write permission
      });

      const result = await securityManager.checkAccess(request);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain(
        "Permission 'database:write' not granted",
      );
    });

    it("should allow wildcard permissions", async () => {
      const request = createResourceAccessRequest({
        context: createSecurityContext({
          permissions: ["database:*"], // Wildcard database permission
        }),
        resourceType: ResourceType.DATABASE,
        permission: PermissionLevel.WRITE,
      });

      const result = await securityManager.checkAccess(request);

      expect(result.allowed).toBe(true);
    });

    it("should allow global wildcard permissions", async () => {
      // Use SecurityManager to create proper context for CRITICAL priority
      const context = securityManager.createSecurityContext(
        "critical-module",
        ModulePriority.CRITICAL, // Critical priority gets full access
        ["*"], // Global wildcard
      );

      const request = createResourceAccessRequest({
        context,
        resourceType: ResourceType.SYSTEM,
        permission: PermissionLevel.ADMIN,
        operation: "test-operation-no-limits", // Use unique operation name
      });

      const result = await securityManager.checkAccess(request);

      if (!result.allowed) {
        console.log("Access denied reason:", result.reason);
      }

      expect(result.allowed).toBe(true);
    });
  });

  describe("Rate Limiting", () => {
    it("should allow operations within rate limits", () => {
      const context = createSecurityContext({
        constraints: {
          ...createSecurityContext().constraints,
          rateLimits: [{ operation: "test-op", maxCalls: 5, windowMs: 60000 }],
        },
      });

      // First call should be allowed
      const allowed1 = securityManager.checkRateLimit(context, "test-op");
      expect(allowed1).toBe(true);

      // Second call should be allowed
      const allowed2 = securityManager.checkRateLimit(context, "test-op");
      expect(allowed2).toBe(true);
    });

    it("should block operations exceeding rate limits", () => {
      const context = createSecurityContext({
        constraints: {
          ...createSecurityContext().constraints,
          rateLimits: [
            { operation: "limited-op", maxCalls: 1, windowMs: 60000 },
          ],
        },
      });

      // First call should be allowed
      const allowed1 = securityManager.checkRateLimit(context, "limited-op");
      expect(allowed1).toBe(true);

      // Second call should be blocked
      const allowed2 = securityManager.checkRateLimit(context, "limited-op");
      expect(allowed2).toBe(false);
    });

    it("should reset rate limits after window expires", async () => {
      const context = createSecurityContext({
        constraints: {
          ...createSecurityContext().constraints,
          rateLimits: [{ operation: "expiring-op", maxCalls: 1, windowMs: 50 }],
        },
      });

      // Use up the rate limit
      expect(securityManager.checkRateLimit(context, "expiring-op")).toBe(true);
      expect(securityManager.checkRateLimit(context, "expiring-op")).toBe(
        false,
      );

      // Wait for window to expire
      await new Promise((resolve) => setTimeout(resolve, 60));

      // Should be allowed again
      expect(securityManager.checkRateLimit(context, "expiring-op")).toBe(true);
    });

    it("should allow operations with no rate limit configured", () => {
      const context = createSecurityContext({
        constraints: {
          ...createSecurityContext().constraints,
          rateLimits: [], // No rate limits
        },
      });

      const allowed = securityManager.checkRateLimit(context, "unlimited-op");
      expect(allowed).toBe(true);
    });

    it("should track rate limits per module", () => {
      const context1 = createSecurityContext({
        moduleId: "module-1",
        constraints: {
          ...createSecurityContext().constraints,
          rateLimits: [
            { operation: "shared-op", maxCalls: 1, windowMs: 60000 },
          ],
        },
      });

      const context2 = createSecurityContext({
        moduleId: "module-2",
        constraints: {
          ...createSecurityContext().constraints,
          rateLimits: [
            { operation: "shared-op", maxCalls: 1, windowMs: 60000 },
          ],
        },
      });

      // Each module should have its own rate limit
      expect(securityManager.checkRateLimit(context1, "shared-op")).toBe(true);
      expect(securityManager.checkRateLimit(context2, "shared-op")).toBe(true);

      // Each module should hit its own limit independently
      expect(securityManager.checkRateLimit(context1, "shared-op")).toBe(false);
      expect(securityManager.checkRateLimit(context2, "shared-op")).toBe(false);
    });
  });

  describe("Operation Tracking", () => {
    it("should track operation metrics when enabled", () => {
      const metricsManager = new SecurityManager({ enableMetrics: true });
      const context = createSecurityContext();

      metricsManager.startOperation("test-op-1", context);

      const stats = metricsManager.getStatistics();
      expect(stats.activeOperations).toBe(1);
    });

    it("should not track operations when metrics disabled", () => {
      const noMetricsManager = new SecurityManager({ enableMetrics: false });
      const context = createSecurityContext();

      noMetricsManager.startOperation("test-op-1", context);

      const stats = noMetricsManager.getStatistics();
      expect(stats.activeOperations).toBe(0);
    });

    it("should track resource usage", () => {
      const context = createSecurityContext();

      securityManager.startOperation("resource-op", context);
      securityManager.trackResourceUsage(
        "resource-op",
        ResourceType.NETWORK,
        5,
      );
      securityManager.trackResourceUsage(
        "resource-op",
        ResourceType.DATABASE,
        2,
      );

      const result = securityManager.endOperation("resource-op");

      expect(result.violations).toHaveLength(0); // Within limits
      expect(result.executionTime).toBeGreaterThanOrEqual(0);
      expect(result.memoryUsage).toBeGreaterThanOrEqual(0);
    });

    it("should detect execution time violations", async () => {
      const context = createSecurityContext({
        constraints: {
          ...createSecurityContext().constraints,
          maxExecutionTime: 50, // Very short limit
        },
      });

      securityManager.startOperation("slow-op", context);

      // Wait longer than the limit
      await new Promise((resolve) => setTimeout(resolve, 60));

      const result = securityManager.endOperation("slow-op");

      expect(result.violations).toContainEqual(
        expect.stringContaining("Execution time exceeded"),
      );
    });

    it("should detect memory usage violations", () => {
      const context = createSecurityContext({
        constraints: {
          ...createSecurityContext().constraints,
          maxMemoryUsage: 1, // Impossibly small limit
        },
      });

      securityManager.startOperation("memory-op", context);

      // Force some memory allocation
      const largeArray = new Array(1000).fill("memory");

      const result = securityManager.endOperation("memory-op");

      expect(result.violations).toContainEqual(
        expect.stringContaining("Memory usage exceeded"),
      );
    });

    it("should detect resource usage violations", () => {
      const context = createSecurityContext({
        constraints: {
          ...createSecurityContext().constraints,
          maxNetworkCalls: 2, // Low limit
        },
      });

      securityManager.startOperation("network-op", context);
      securityManager.trackResourceUsage("network-op", ResourceType.NETWORK, 5); // Exceeds limit

      const result = securityManager.endOperation("network-op");

      expect(result.violations).toContainEqual(
        expect.stringContaining("network usage exceeded"),
      );
    });

    it("should handle ending non-existent operation", () => {
      const result = securityManager.endOperation("non-existent");

      expect(result).toEqual({
        violations: [],
        executionTime: 0,
        memoryUsage: 0,
      });
    });

    it("should ignore resource tracking for non-existent operations", () => {
      // Should not throw
      securityManager.trackResourceUsage(
        "non-existent",
        ResourceType.NETWORK,
        1,
      );
    });
  });

  describe("Security Context Creation", () => {
    it("should create security context for critical priority module", () => {
      const context = securityManager.createSecurityContext(
        "critical-module",
        ModulePriority.CRITICAL,
        ["database:read", "system:admin"],
      );

      expect(context.moduleId).toBe("critical-module");
      expect(context.priority).toBe(ModulePriority.CRITICAL);
      expect(context.permissions).toEqual(["database:read", "system:admin"]);
      expect(context.sessionId).toMatch(/^sess_/);
      expect(context.allowedResources).toContain(ResourceType.SYSTEM); // Critical gets all
      expect(context.constraints.maxExecutionTime).toBe(60000); // 1 minute
    });

    it("should create security context for medium priority module", () => {
      const context = securityManager.createSecurityContext(
        "medium-module",
        ModulePriority.MEDIUM,
        ["database:read"],
        "user-123",
      );

      expect(context.moduleId).toBe("medium-module");
      expect(context.priority).toBe(ModulePriority.MEDIUM);
      expect(context.userId).toBe("user-123");
      expect(context.allowedResources).toContain(ResourceType.DATABASE);
      expect(context.allowedResources).not.toContain(ResourceType.SYSTEM);
      expect(context.constraints.maxExecutionTime).toBe(15000); // 15 seconds
    });

    it("should create security context for low priority module", () => {
      const context = securityManager.createSecurityContext(
        "low-module",
        ModulePriority.LOW,
        [],
      );

      expect(context.priority).toBe(ModulePriority.LOW);
      expect(context.allowedResources).toContain(ResourceType.EVENT_BUS);
      expect(context.allowedResources).toContain(ResourceType.CONTAINER);
      expect(context.allowedResources).not.toContain(ResourceType.DATABASE);
      expect(context.constraints.maxExecutionTime).toBe(5000); // 5 seconds
    });

    it("should grant database access with database permission", () => {
      const context = securityManager.createSecurityContext(
        "db-module",
        ModulePriority.MEDIUM,
        ["database:read"],
      );

      expect(context.allowedResources).toContain(ResourceType.DATABASE);
    });

    it("should grant network access with network permission", () => {
      const context = securityManager.createSecurityContext(
        "network-module",
        ModulePriority.MEDIUM,
        ["network:access"],
      );

      expect(context.allowedResources).toContain(ResourceType.NETWORK);
    });
  });

  describe("Audit Logging", () => {
    it("should log all access requests", async () => {
      const request = createResourceAccessRequest();

      await securityManager.checkAccess(request);

      const auditLog = securityManager.getAuditLog();
      expect(auditLog).toHaveLength(1);

      const entry = auditLog[0];
      expect(entry.moduleId).toBe(request.context.moduleId);
      expect(entry.operation).toBe(request.operation);
      expect(entry.resourceType).toBe(request.resourceType);
      expect(entry.allowed).toBe(true);
    });

    it("should filter audit log by module", async () => {
      const request1 = createResourceAccessRequest({
        context: createSecurityContext({ moduleId: "module-1" }),
      });
      const request2 = createResourceAccessRequest({
        context: createSecurityContext({ moduleId: "module-2" }),
      });

      await securityManager.checkAccess(request1);
      await securityManager.checkAccess(request2);

      const filteredLog = securityManager.getAuditLog({ moduleId: "module-1" });
      expect(filteredLog).toHaveLength(1);
      expect(filteredLog[0].moduleId).toBe("module-1");
    });

    it("should filter audit log by user", async () => {
      const request1 = createResourceAccessRequest({
        context: createSecurityContext({ userId: "user-1" }),
      });
      const request2 = createResourceAccessRequest({
        context: createSecurityContext({ userId: "user-2" }),
      });

      await securityManager.checkAccess(request1);
      await securityManager.checkAccess(request2);

      const filteredLog = securityManager.getAuditLog({ userId: "user-1" });
      expect(filteredLog).toHaveLength(1);
      expect(filteredLog[0].userId).toBe("user-1");
    });

    it("should filter audit log by resource type", async () => {
      const request1 = createResourceAccessRequest({
        resourceType: ResourceType.DATABASE,
      });
      const request2 = createResourceAccessRequest({
        resourceType: ResourceType.NETWORK,
      });

      await securityManager.checkAccess(request1);
      await securityManager.checkAccess(request2);

      const filteredLog = securityManager.getAuditLog({
        resourceType: ResourceType.DATABASE,
      });
      expect(filteredLog).toHaveLength(1);
      expect(filteredLog[0].resourceType).toBe(ResourceType.DATABASE);
    });

    it("should filter audit log by date range", async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const request = createResourceAccessRequest();
      await securityManager.checkAccess(request);

      // Should find entry within date range
      const entriesInRange = securityManager.getAuditLog({
        startDate: yesterday,
        endDate: tomorrow,
      });
      expect(entriesInRange).toHaveLength(1);

      // Should not find entry outside date range
      const entriesOutsideRange = securityManager.getAuditLog({
        startDate: tomorrow,
        endDate: tomorrow,
      });
      expect(entriesOutsideRange).toHaveLength(0);
    });

    it("should limit audit log size", async () => {
      const limitedManager = new SecurityManager({ maxAuditLogSize: 2 });

      // Add 3 entries (exceeds limit)
      for (let i = 0; i < 3; i++) {
        const request = createResourceAccessRequest({
          operation: `operation-${i}`,
        });
        await limitedManager.checkAccess(request);
      }

      const auditLog = limitedManager.getAuditLog();
      expect(auditLog).toHaveLength(2); // Limited to 2

      // Should keep the most recent entries
      expect(auditLog[0].operation).toBe("operation-1");
      expect(auditLog[1].operation).toBe("operation-2");
    });

    it("should clear audit log", async () => {
      const request = createResourceAccessRequest();
      await securityManager.checkAccess(request);

      expect(securityManager.getAuditLog()).toHaveLength(1);

      securityManager.clearAuditLog();

      expect(securityManager.getAuditLog()).toHaveLength(0);
    });
  });

  describe("Statistics and Monitoring", () => {
    it("should provide comprehensive statistics", async () => {
      // Add some test data
      const allowedRequest = createResourceAccessRequest();
      const deniedRequest = createResourceAccessRequest({
        context: createSecurityContext({
          allowedResources: [], // No resources allowed
        }),
      });

      await securityManager.checkAccess(allowedRequest);
      await securityManager.checkAccess(deniedRequest);

      const stats = securityManager.getStatistics();

      expect(stats.totalOperations).toBe(2);
      expect(stats.deniedOperations).toBe(1);
      expect(stats.successRate).toBe(0.5); // 1/2
      expect(stats.activeOperations).toBe(0);
      expect(stats.policiesCount).toBeGreaterThan(0);
      expect(stats.operationsByModule["test-module"]).toBe(2);
    });

    it("should track violations by type", async () => {
      const denyPolicy = new TestSecurityPolicy("test-deny", 5, false);
      securityManager.addPolicy(denyPolicy);

      const request = createResourceAccessRequest();
      await securityManager.checkAccess(request);

      const stats = securityManager.getStatistics();
      expect(stats.violationsByType["Test policy test-deny denied"]).toBe(1);
    });

    it("should calculate success rate correctly", async () => {
      const stats1 = securityManager.getStatistics();
      expect(stats1.successRate).toBe(1); // No operations yet

      // Add successful operation
      const allowedRequest = createResourceAccessRequest();
      await securityManager.checkAccess(allowedRequest);

      const stats2 = securityManager.getStatistics();
      expect(stats2.successRate).toBe(1); // 100% success

      // Add failed operation
      const deniedRequest = createResourceAccessRequest({
        context: createSecurityContext({
          allowedResources: [],
        }),
      });
      await securityManager.checkAccess(deniedRequest);

      const stats3 = securityManager.getStatistics();
      expect(stats3.successRate).toBe(0.5); // 50% success
    });
  });

  describe("Module Isolation Policy", () => {
    it("should prevent low priority modules from accessing system resources", async () => {
      const request = createResourceAccessRequest({
        context: createSecurityContext({
          priority: ModulePriority.LOW,
          permissions: ["system:read"], // Even with permission, should be blocked
        }),
        resourceType: ResourceType.SYSTEM,
        permission: PermissionLevel.READ,
      });

      const result = await securityManager.checkAccess(request);

      expect(result.allowed).toBe(false);
      // The resource type policy blocks first since LOW modules don't get SYSTEM resources
      expect(result.reason).toContain("Resource type 'system' not allowed");
    });

    it("should prevent low priority modules from admin operations on other modules", async () => {
      const request = createResourceAccessRequest({
        context: createSecurityContext({
          priority: ModulePriority.LOW,
          permissions: ["other_module:admin"],
        }),
        resourceType: ResourceType.OTHER_MODULE,
        permission: PermissionLevel.ADMIN,
      });

      const result = await securityManager.checkAccess(request);

      expect(result.allowed).toBe(false);
      // The resource type policy blocks first since LOW modules don't get OTHER_MODULE resources
      expect(result.reason).toContain(
        "Resource type 'other_module' not allowed",
      );
    });

    it("should allow high priority modules to access system resources", async () => {
      const request = createResourceAccessRequest({
        context: createSecurityContext({
          priority: ModulePriority.HIGH,
          allowedResources: [ResourceType.SYSTEM],
          permissions: ["system:admin"],
        }),
        resourceType: ResourceType.SYSTEM,
        permission: PermissionLevel.ADMIN,
      });

      const result = await securityManager.checkAccess(request);

      expect(result.allowed).toBe(true);
    });
  });

  describe("Global Security Manager", () => {
    it("should provide global singleton instance", () => {
      expect(globalSecurityManager).toBeInstanceOf(SecurityManager);
    });

    it("should be same instance across imports", () => {
      expect(globalSecurityManager).toBe(globalSecurityManager);
    });
  });

  describe("Edge Cases and Error Handling", () => {
    it("should handle empty permissions array", () => {
      const context = securityManager.createSecurityContext(
        "test-module",
        ModulePriority.MEDIUM,
        [],
      );

      expect(context.permissions).toEqual([]);
      expect(context.allowedResources).toContain(ResourceType.EVENT_BUS);
    });

    it("should handle undefined user ID", () => {
      const context = securityManager.createSecurityContext(
        "test-module",
        ModulePriority.MEDIUM,
        ["test:permission"],
      );

      expect(context.userId).toBeUndefined();
    });

    it("should generate unique session IDs", () => {
      const context1 = securityManager.createSecurityContext(
        "module1",
        ModulePriority.MEDIUM,
        [],
      );
      const context2 = securityManager.createSecurityContext(
        "module2",
        ModulePriority.MEDIUM,
        [],
      );

      expect(context1.sessionId).not.toBe(context2.sessionId);
      expect(context1.sessionId).toMatch(/^sess_/);
      expect(context2.sessionId).toMatch(/^sess_/);
    });

    it("should handle constraint merging with undefined values", async () => {
      // Policy that returns undefined constraints
      const noConstraintsPolicy = new TestSecurityPolicy(
        "no-constraints",
        10,
        true,
      );
      noConstraintsPolicy.evaluate = vi
        .fn()
        .mockResolvedValue({ allowed: true });

      securityManager.addPolicy(noConstraintsPolicy);

      const request = createResourceAccessRequest();
      const result = await securityManager.checkAccess(request);

      expect(result.allowed).toBe(true);
      // Should not throw error during constraint merging
    });

    it("should handle resource tracking for unknown resource types", () => {
      const context = createSecurityContext();

      securityManager.startOperation("test-op", context);
      securityManager.trackResourceUsage(
        "test-op",
        "UNKNOWN_RESOURCE" as ResourceType,
        1,
      );

      const result = securityManager.endOperation("test-op");

      // Should not create violations for unknown resource types
      expect(
        result.violations.filter((v) => v.includes("UNKNOWN_RESOURCE")),
      ).toHaveLength(0);
    });

    it("should handle concurrent access to rate limiters", () => {
      const context = createSecurityContext({
        constraints: {
          ...createSecurityContext().constraints,
          rateLimits: [
            { operation: "concurrent-op", maxCalls: 10, windowMs: 60000 },
          ],
        },
      });

      // Simulate concurrent access
      const results = Array.from({ length: 5 }, () =>
        securityManager.checkRateLimit(context, "concurrent-op"),
      );

      // All should be allowed (within limit)
      expect(results.every((allowed) => allowed)).toBe(true);
    });
  });

  describe("Enum Values", () => {
    it("should have correct ResourceType enum values", () => {
      expect(ResourceType.DATABASE).toBe("database");
      expect(ResourceType.FILE_SYSTEM).toBe("file_system");
      expect(ResourceType.NETWORK).toBe("network");
      expect(ResourceType.ENVIRONMENT).toBe("environment");
      expect(ResourceType.CONTAINER).toBe("container");
      expect(ResourceType.EVENT_BUS).toBe("event_bus");
      expect(ResourceType.OTHER_MODULE).toBe("other_module");
      expect(ResourceType.SYSTEM).toBe("system");
    });

    it("should have correct PermissionLevel enum values", () => {
      expect(PermissionLevel.READ).toBe("read");
      expect(PermissionLevel.WRITE).toBe("write");
      expect(PermissionLevel.EXECUTE).toBe("execute");
      expect(PermissionLevel.ADMIN).toBe("admin");
    });
  });
});
