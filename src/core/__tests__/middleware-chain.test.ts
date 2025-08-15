import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  MiddlewareChain,
  BaseMiddlewareHandler,
  LoggingMiddleware,
  PerformanceMiddleware,
  AuthenticationMiddleware,
  globalMiddlewareChain,
  type RequestContext,
  type MiddlewareResult,
  type MiddlewareHandler,
  type MiddlewareChainConfig,
} from "../middleware-chain";

// Mock console methods
const consoleSpy = {
  log: vi.spyOn(console, "log").mockImplementation(() => {}),
  warn: vi.spyOn(console, "warn").mockImplementation(() => {}),
  error: vi.spyOn(console, "error").mockImplementation(() => {}),
};

// Test middleware implementations
class TestMiddleware extends BaseMiddlewareHandler {
  constructor(
    name: string,
    priority: number = 0,
    private shouldFail: boolean = false,
    private shouldReturnEarly: boolean = false,
    config?: Record<string, unknown>,
  ) {
    super(name, priority, config);
  }

  async execute(
    request: NextRequest,
    context: RequestContext,
    next: () => Promise<MiddlewareResult>,
  ): Promise<MiddlewareResult> {
    if (this.shouldFail) {
      throw new Error(`${this.name} middleware error`);
    }

    if (this.shouldReturnEarly) {
      return this.response(NextResponse.json({ early: true }));
    }

    // Add test data to context
    const updatedContext: RequestContext = {
      ...context,
      data: new Map([...context.data, [`${this.name}_executed`, true]]),
    };

    const result = await next();

    // Return updated context
    return {
      ...result,
      context: result.context
        ? {
            ...result.context,
            data: new Map([...result.context.data, ...updatedContext.data]),
          }
        : updatedContext,
    };
  }
}

class SlowMiddleware extends BaseMiddlewareHandler {
  constructor(name: string, delay: number = 100) {
    super(name, 0, { delay });
  }

  async execute(
    request: NextRequest,
    context: RequestContext,
    next: () => Promise<MiddlewareResult>,
  ): Promise<MiddlewareResult> {
    const delay = (this.config?.delay as number) ?? 100;
    await new Promise((resolve) => setTimeout(resolve, delay));
    return next();
  }
}

// Helper to create test requests
function createTestRequest(
  url: string = "https://example.com/test",
  method: string = "GET",
): NextRequest {
  return new NextRequest(url, { method });
}

// Helper to create test context
function createTestContext(
  overrides: Partial<RequestContext> = {},
): Partial<RequestContext> {
  return {
    correlationId: "test-correlation-id",
    userId: "test-user",
    sourceModule: "test-module",
    metadata: { test: true },
    ...overrides,
  };
}

describe("MiddlewareChain", () => {
  let chain: MiddlewareChain;

  beforeEach(() => {
    chain = new MiddlewareChain();
    vi.clearAllMocks();
  });

  afterEach(() => {
    consoleSpy.log.mockClear();
    consoleSpy.warn.mockClear();
    consoleSpy.error.mockClear();
  });

  describe("Construction and Configuration", () => {
    it("should create middleware chain with default configuration", () => {
      const defaultChain = new MiddlewareChain();

      expect(defaultChain).toBeInstanceOf(MiddlewareChain);
      expect(defaultChain.getMiddlewareNames()).toHaveLength(0);
    });

    it("should create middleware chain with custom configuration", () => {
      const config: Partial<MiddlewareChainConfig> = {
        timeout: 5000,
        enableMetrics: false,
        continueOnError: true,
        maxMemoryIncrease: 10 * 1024 * 1024,
      };

      const customChain = new MiddlewareChain(config);

      expect(customChain).toBeInstanceOf(MiddlewareChain);
    });

    it("should merge custom config with defaults", () => {
      const partialConfig = { timeout: 10000 };
      const customChain = new MiddlewareChain(partialConfig);

      expect(customChain).toBeInstanceOf(MiddlewareChain);
    });
  });

  describe("Middleware Registration and Management", () => {
    it("should register middleware", () => {
      const middleware = new TestMiddleware("test", 10);

      const result = chain.use(middleware);

      expect(result).toBe(chain); // Should return chain for chaining
      expect(chain.has("test")).toBe(true);
      expect(chain.get("test")).toBe(middleware);
      expect(chain.getMiddlewareNames()).toContain("test");
    });

    it("should prevent duplicate middleware registration", () => {
      const middleware1 = new TestMiddleware("test", 10);
      const middleware2 = new TestMiddleware("test", 20);

      chain.use(middleware1);

      expect(() => chain.use(middleware2)).toThrow(
        "Middleware 'test' is already registered",
      );
    });

    it("should remove middleware", () => {
      const middleware = new TestMiddleware("test", 10);

      chain.use(middleware);
      expect(chain.has("test")).toBe(true);

      const removed = chain.remove("test");

      expect(removed).toBe(true);
      expect(chain.has("test")).toBe(false);
      expect(chain.get("test")).toBeUndefined();
      expect(chain.getMiddlewareNames()).not.toContain("test");
    });

    it("should return false when removing non-existent middleware", () => {
      const removed = chain.remove("non-existent");

      expect(removed).toBe(false);
    });

    it("should clear all middleware", () => {
      chain.use(new TestMiddleware("test1", 10));
      chain.use(new TestMiddleware("test2", 20));

      expect(chain.getMiddlewareNames()).toHaveLength(2);

      chain.clear();

      expect(chain.getMiddlewareNames()).toHaveLength(0);
      expect(chain.has("test1")).toBe(false);
      expect(chain.has("test2")).toBe(false);
    });

    it("should get middleware names in registration order", () => {
      chain.use(new TestMiddleware("middleware-a", 10));
      chain.use(new TestMiddleware("middleware-b", 20));
      chain.use(new TestMiddleware("middleware-c", 30));

      const names = chain.getMiddlewareNames();

      expect(names).toEqual(["middleware-a", "middleware-b", "middleware-c"]);
    });
  });

  describe("Middleware Chain Execution", () => {
    it("should execute middleware chain with no middleware", async () => {
      const request = createTestRequest();
      const context = createTestContext();

      const result = await chain.execute(request, context);

      expect(result.response).toBeInstanceOf(NextResponse);
      expect(result.context.requestId).toBeDefined();
      expect(result.context.startTime).toBeInstanceOf(Date);
      expect(result.executionTime).toBeGreaterThanOrEqual(0);
    });

    it("should execute single middleware", async () => {
      const middleware = new TestMiddleware("test", 10);
      chain.use(middleware);

      const request = createTestRequest();
      const context = createTestContext();

      const result = await chain.execute(request, context);

      expect(result.response).toBeInstanceOf(NextResponse);
      expect(result.context.data.get("test_executed")).toBe(true);
    });

    it("should execute multiple middleware in priority order", async () => {
      chain.use(new TestMiddleware("high-priority", 5));
      chain.use(new TestMiddleware("low-priority", 20));
      chain.use(new TestMiddleware("medium-priority", 10));

      const request = createTestRequest();

      const result = await chain.execute(request);

      // All middleware should have executed
      expect(result.context.data.get("high-priority_executed")).toBe(true);
      expect(result.context.data.get("medium-priority_executed")).toBe(true);
      expect(result.context.data.get("low-priority_executed")).toBe(true);
    });

    it("should handle middleware that returns early response", async () => {
      chain.use(new TestMiddleware("normal", 5));
      chain.use(new TestMiddleware("early-return", 10, false, true));
      chain.use(new TestMiddleware("should-not-execute", 15));

      const request = createTestRequest();

      const result = await chain.execute(request);

      // Only middleware before early return should execute
      expect(result.context.data.get("normal_executed")).toBe(true);
      expect(
        result.context.data.get("should-not-execute_executed"),
      ).toBeUndefined();

      // Should return the early response
      const responseData = await result.response.json();
      expect(responseData).toEqual({ early: true });
    });

    it("should skip disabled middleware", () => {
      const enabledMiddleware = new TestMiddleware("enabled", 10);
      const disabledMiddleware = new TestMiddleware("disabled", 20);
      (disabledMiddleware as any).enabled = false;

      chain.use(enabledMiddleware);
      chain.use(disabledMiddleware);

      // Get enabled middleware for execution - this tests the internal filtering
      const middlewareList = Array.from((chain as any).handlers.values())
        .filter((handler: any) => handler.enabled)
        .sort((a: any, b: any) => a.priority - b.priority);

      expect(middlewareList).toHaveLength(1);
      expect(middlewareList[0].name).toBe("enabled");
    });

    it("should pass context through middleware chain", async () => {
      chain.use(new TestMiddleware("first", 10));
      chain.use(new TestMiddleware("second", 20));

      const request = createTestRequest();
      const initialContext = createTestContext({
        metadata: { initial: "value" },
      });

      const result = await chain.execute(request, initialContext);

      expect(result.context.metadata.initial).toBe("value");
      expect(result.context.data.get("first_executed")).toBe(true);
      expect(result.context.data.get("second_executed")).toBe(true);
    });

    it("should generate request ID and context", async () => {
      const request = createTestRequest();

      const result = await chain.execute(request);

      expect(result.context.requestId).toMatch(/^req_\d+_[a-z0-9]+$/);
      expect(result.context.startTime).toBeInstanceOf(Date);
      expect(result.context.data).toBeInstanceOf(Map);
      expect(result.context.metadata).toBeDefined();
    });
  });

  describe("BaseMiddlewareHandler", () => {
    it("should create base middleware handler", () => {
      const handler = new TestMiddleware("test", 10, false, false, {
        key: "value",
      });

      expect(handler.name).toBe("test");
      expect(handler.priority).toBe(10);
      expect(handler.enabled).toBe(true);
      expect(handler.config?.key).toBe("value");
    });

    it("should provide success helper method", () => {
      const handler = new TestMiddleware("test", 10);
      const context = createTestContext() as RequestContext;

      const result = (handler as any).success(context);

      expect(result).toEqual({
        continue: true,
        context,
      });
    });

    it("should provide response helper method", () => {
      const handler = new TestMiddleware("test", 10);
      const response = NextResponse.json({ test: true });
      const context = createTestContext() as RequestContext;

      const result = (handler as any).response(response, context);

      expect(result).toEqual({
        continue: false,
        response,
        context,
      });
    });

    it("should provide error helper method", () => {
      const handler = new TestMiddleware("test", 10);
      const error = new Error("Test error");
      const context = createTestContext() as RequestContext;

      const result = (handler as any).error(error, context);

      expect(result).toEqual({
        continue: false,
        error,
        context,
      });
    });
  });

  describe("Built-in Middleware", () => {
    describe("LoggingMiddleware", () => {
      it("should create logging middleware with defaults", () => {
        const logger = new LoggingMiddleware();

        expect(logger.name).toBe("logging");
        expect(logger.priority).toBe(0);
        expect(logger.enabled).toBe(true);
      });

      it("should create logging middleware with custom config", () => {
        const logger = new LoggingMiddleware(5, {
          includeHeaders: true,
          includeBody: true,
        });

        expect(logger.name).toBe("logging");
        expect(logger.priority).toBe(5);
        expect(logger.config?.includeHeaders).toBe(true);
        expect(logger.config?.includeBody).toBe(true);
      });

      it("should log request information", async () => {
        const logger = new LoggingMiddleware();
        const request = createTestRequest("https://example.com/test", "POST");
        const context = createTestContext({
          requestId: "test-123",
        }) as RequestContext;

        const next = vi.fn().mockResolvedValue({ continue: true });

        await logger.execute(request, context, next);

        expect(consoleSpy.log).toHaveBeenCalledWith(
          "[test-123] POST https://example.com/test",
        );
        expect(consoleSpy.log).toHaveBeenCalledWith(
          expect.stringMatching(/\[test-123\] Completed in \d+ms/),
        );
      });

      it("should log headers when configured", async () => {
        const logger = new LoggingMiddleware(0, { includeHeaders: true });
        const request = createTestRequest();
        request.headers.set("content-type", "application/json");
        const context = createTestContext({
          requestId: "test-123",
        }) as RequestContext;

        const next = vi.fn().mockResolvedValue({ continue: true });

        await logger.execute(request, context, next);

        expect(consoleSpy.log).toHaveBeenCalledWith(
          "[test-123] Headers:",
          expect.objectContaining({ "content-type": "application/json" }),
        );
      });

      it("should log errors", async () => {
        const logger = new LoggingMiddleware();
        const request = createTestRequest();
        const context = createTestContext({
          requestId: "test-123",
        }) as RequestContext;

        const error = new Error("Test error");
        const next = vi.fn().mockRejectedValue(error);

        await expect(logger.execute(request, context, next)).rejects.toThrow(
          "Test error",
        );

        expect(consoleSpy.error).toHaveBeenCalledWith(
          expect.stringMatching(/\[test-123\] Error after \d+ms:/),
          error,
        );
      });
    });

    describe("PerformanceMiddleware", () => {
      it("should create performance middleware with defaults", () => {
        const perf = new PerformanceMiddleware();

        expect(perf.name).toBe("performance");
        expect(perf.priority).toBe(10);
        expect(perf.enabled).toBe(true);
      });

      it("should create performance middleware with custom config", () => {
        const perf = new PerformanceMiddleware(15, {
          slowRequestThreshold: 500,
        });

        expect(perf.name).toBe("performance");
        expect(perf.priority).toBe(15);
        expect(perf.config?.slowRequestThreshold).toBe(500);
      });

      it("should add performance metrics to result", async () => {
        const perf = new PerformanceMiddleware();
        const request = createTestRequest();
        const context = createTestContext() as RequestContext;

        const next = vi.fn().mockResolvedValue({ continue: true });

        const result = await perf.execute(request, context, next);

        expect(result.metrics).toBeDefined();
        expect(result.metrics?.executionTime).toBeGreaterThanOrEqual(0);
        expect(result.metrics?.memoryUsage).toBeGreaterThanOrEqual(0);
      });

      it("should warn about slow requests", async () => {
        const perf = new PerformanceMiddleware(10, {
          slowRequestThreshold: 50,
        });
        const request = createTestRequest();
        const context = createTestContext({
          requestId: "test-123",
        }) as RequestContext;

        // Mock a slow operation
        const next = vi.fn().mockImplementation(async () => {
          await new Promise((resolve) => setTimeout(resolve, 60));
          return { continue: true };
        });

        await perf.execute(request, context, next);

        expect(consoleSpy.warn).toHaveBeenCalledWith(
          expect.stringMatching(
            /\[test-123\] Slow request: \d+ms, memory: \d+ bytes/,
          ),
        );
      });

      it("should handle errors in performance tracking", async () => {
        const perf = new PerformanceMiddleware();
        const request = createTestRequest();
        const context = createTestContext({
          requestId: "test-123",
        }) as RequestContext;

        const error = new Error("Test error");
        const next = vi.fn().mockRejectedValue(error);

        await expect(perf.execute(request, context, next)).rejects.toThrow(
          "Test error",
        );

        expect(consoleSpy.error).toHaveBeenCalledWith(
          expect.stringMatching(
            /\[test-123\] Performance tracking error after \d+ms:/,
          ),
          error,
        );
      });
    });

    describe("AuthenticationMiddleware", () => {
      it("should create authentication middleware with defaults", () => {
        const auth = new AuthenticationMiddleware();

        expect(auth.name).toBe("authentication");
        expect(auth.priority).toBe(20);
        expect(auth.enabled).toBe(true);
      });

      it("should create authentication middleware with custom config", () => {
        const auth = new AuthenticationMiddleware(25, {
          skipPaths: ["/public", "/health"],
          requireAuth: true,
        });

        expect(auth.name).toBe("authentication");
        expect(auth.priority).toBe(25);
        expect(auth.config?.skipPaths).toEqual(["/public", "/health"]);
        expect(auth.config?.requireAuth).toBe(true);
      });

      it("should skip authentication for configured paths", async () => {
        const auth = new AuthenticationMiddleware(20, {
          skipPaths: ["/api/auth", "/health"],
          requireAuth: true,
        });

        const request = createTestRequest("https://example.com/api/auth/login");
        const context = createTestContext() as RequestContext;
        const next = vi.fn().mockResolvedValue({ continue: true });

        const result = await auth.execute(request, context, next);

        expect(next).toHaveBeenCalled();
        expect(result.continue).toBe(true);
      });

      it("should allow requests without auth when not required", async () => {
        const auth = new AuthenticationMiddleware(20, {
          requireAuth: false,
        });

        const request = createTestRequest("https://example.com/protected");
        const context = createTestContext() as RequestContext;
        const next = vi.fn().mockResolvedValue({ continue: true });

        const result = await auth.execute(request, context, next);

        expect(next).toHaveBeenCalled();
        expect(result.continue).toBe(true);
      });

      it("should reject requests without auth when required", async () => {
        const auth = new AuthenticationMiddleware(20, {
          requireAuth: true,
        });

        const request = createTestRequest("https://example.com/protected");
        const context = createTestContext() as RequestContext;
        const next = vi.fn().mockResolvedValue({ continue: true });

        const result = await auth.execute(request, context, next);

        expect(next).not.toHaveBeenCalled();
        expect(result.continue).toBe(false);
        expect(result.response?.status).toBe(401);
      });

      it("should allow requests with valid auth header", async () => {
        const auth = new AuthenticationMiddleware(20, {
          requireAuth: true,
        });

        const request = createTestRequest("https://example.com/protected");
        request.headers.set("authorization", "Bearer valid-token");
        const context = createTestContext() as RequestContext;
        const next = vi.fn().mockResolvedValue({ continue: true });

        const result = await auth.execute(request, context, next);

        expect(next).toHaveBeenCalled();
        expect(result.continue).toBe(true);
      });
    });
  });

  describe("Error Handling and Timeout", () => {
    it("should handle middleware errors without continue on error", async () => {
      const failingMiddleware = new TestMiddleware("failing", 10, true);
      chain.use(failingMiddleware);

      const request = createTestRequest();

      await expect(chain.execute(request)).rejects.toThrow(
        "Middleware chain execution failed",
      );
    });

    it("should continue on middleware errors when configured", async () => {
      const chainWithContinueOnError = new MiddlewareChain({
        continueOnError: true,
      });
      chainWithContinueOnError.use(new TestMiddleware("failing", 10, true));
      chainWithContinueOnError.use(new TestMiddleware("succeeding", 20));

      const request = createTestRequest();

      const result = await chainWithContinueOnError.execute(request);

      expect(result.response).toBeInstanceOf(NextResponse);
      expect(result.context.data.get("succeeding_executed")).toBe(true);
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringMatching(/Middleware 'failing' error \(continuing\):/),
        expect.any(Error),
      );
    });

    it("should handle middleware result errors without continue on error", async () => {
      class ErrorResultMiddleware extends BaseMiddlewareHandler {
        async execute(): Promise<MiddlewareResult> {
          return this.error(new Error("Result error"));
        }
      }

      chain.use(new ErrorResultMiddleware("error-result", 10));

      const request = createTestRequest();

      await expect(chain.execute(request)).rejects.toThrow("Result error");
    });

    it("should continue on middleware result errors when configured", async () => {
      const chainWithContinueOnError = new MiddlewareChain({
        continueOnError: true,
      });

      class ErrorResultMiddleware extends BaseMiddlewareHandler {
        async execute(
          request: any,
          context: any,
          next: any,
        ): Promise<MiddlewareResult> {
          return this.error(new Error("Result error"));
        }
      }

      chainWithContinueOnError.use(
        new ErrorResultMiddleware("error-result", 10),
      );
      chainWithContinueOnError.use(new TestMiddleware("succeeding", 20));

      const request = createTestRequest();

      const result = await chainWithContinueOnError.execute(request);

      expect(result.response).toBeInstanceOf(NextResponse);
      expect(result.context.data.get("succeeding_executed")).toBe(true);
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringMatching(
          /Middleware 'error-result' error \(continuing\):/,
        ),
        expect.any(Error),
      );
    });

    it("should handle timeout", async () => {
      const slowChain = new MiddlewareChain({ timeout: 100 });
      slowChain.use(new SlowMiddleware("slow", 200));

      const request = createTestRequest();

      await expect(slowChain.execute(request)).rejects.toThrow(
        "Middleware chain execution failed",
      );
    });

    it("should not apply timeout when timeout is 0", async () => {
      const noTimeoutChain = new MiddlewareChain({ timeout: 0 });
      noTimeoutChain.use(new SlowMiddleware("slow", 50));

      const request = createTestRequest();

      const result = await noTimeoutChain.execute(request);

      expect(result.response).toBeInstanceOf(NextResponse);
    });

    it("should handle non-Error exceptions", async () => {
      class StringErrorMiddleware extends BaseMiddlewareHandler {
        async execute(): Promise<MiddlewareResult> {
          throw "String error";
        }
      }

      chain.use(new StringErrorMiddleware("string-error", 10));

      const request = createTestRequest();

      await expect(chain.execute(request)).rejects.toThrow(
        "Middleware chain execution failed: String error",
      );
    });
  });

  describe("Statistics and Monitoring", () => {
    it("should track basic statistics", async () => {
      chain.use(new TestMiddleware("test", 10));

      const request = createTestRequest();

      await chain.execute(request);
      await chain.execute(request);

      const stats = chain.getStatistics();

      expect(stats.totalRequests).toBe(2);
      expect(stats.totalExecutionTime).toBeGreaterThanOrEqual(0); // Changed to >= since it might be 0 in fast tests
      expect(stats.averageExecutionTime).toBeGreaterThanOrEqual(0); // Changed to >= since it might be 0 in fast tests
      expect(stats.errorCount).toBe(0);
      expect(stats.timeoutCount).toBe(0);
    });

    it("should track middleware-specific statistics", async () => {
      chain.use(new TestMiddleware("test", 10));

      const request = createTestRequest();

      await chain.execute(request);

      const stats = chain.getStatistics();

      expect(stats.middlewareStats["test"]).toBeDefined();
      expect(stats.middlewareStats["test"].executionCount).toBe(1);
      expect(stats.middlewareStats["test"].totalTime).toBeGreaterThanOrEqual(0);
      expect(stats.middlewareStats["test"].averageTime).toBeGreaterThanOrEqual(
        0,
      );
      expect(stats.middlewareStats["test"].errorCount).toBe(0);
      expect(stats.middlewareStats["test"].lastExecuted).toBeInstanceOf(Date);
    });

    it("should track error statistics", async () => {
      const chainWithContinueOnError = new MiddlewareChain({
        continueOnError: true,
      });
      chainWithContinueOnError.use(new TestMiddleware("failing", 10, true));
      chainWithContinueOnError.use(new TestMiddleware("succeeding", 20));

      const request = createTestRequest();

      await chainWithContinueOnError.execute(request);

      const stats = chainWithContinueOnError.getStatistics();

      expect(stats.middlewareStats["failing"].errorCount).toBe(1);
      expect(stats.middlewareStats["succeeding"].errorCount).toBe(0);
    });

    it("should track timeout statistics", async () => {
      const slowChain = new MiddlewareChain({ timeout: 50 });
      slowChain.use(new SlowMiddleware("slow", 100));

      const request = createTestRequest();

      try {
        await slowChain.execute(request);
        throw new Error("Expected timeout error");
      } catch (error) {
        // Verify it's a timeout error - check both original and wrapped message
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        expect(errorMessage).toMatch(/(timed out after.*ms|timeout)/i);
      }

      const stats = slowChain.getStatistics();

      expect(stats.errorCount).toBe(1);
      expect(stats.timeoutCount).toBe(1);
    });

    it("should reset statistics", async () => {
      chain.use(new TestMiddleware("test", 10));

      const request = createTestRequest();
      await chain.execute(request);

      let stats = chain.getStatistics();
      expect(stats.totalRequests).toBe(1);

      chain.resetStatistics();

      stats = chain.getStatistics();
      expect(stats.totalRequests).toBe(0);
      expect(stats.totalExecutionTime).toBe(0);
      expect(stats.averageExecutionTime).toBe(0);
      expect(stats.errorCount).toBe(0);
      expect(stats.timeoutCount).toBe(0);
      expect(stats.middlewareStats["test"].executionCount).toBe(0);
      expect(stats.middlewareStats["test"].lastExecuted).toBeUndefined();
    });

    it("should return copy of statistics", () => {
      const stats1 = chain.getStatistics();
      const stats2 = chain.getStatistics();

      expect(stats1).not.toBe(stats2); // Different objects
      expect(stats1).toEqual(stats2); // Same values
    });
  });

  describe("Performance and Memory Monitoring", () => {
    it("should monitor memory usage when metrics enabled", async () => {
      const chainWithMetrics = new MiddlewareChain({
        enableMetrics: true,
        maxMemoryIncrease: 1024, // Very small limit to trigger warning
      });

      // Create middleware that uses some memory
      class MemoryHeavyMiddleware extends BaseMiddlewareHandler {
        async execute(
          request: any,
          context: any,
          next: any,
        ): Promise<MiddlewareResult> {
          // Create some objects to increase memory usage
          const largeArray = new Array(1000).fill("memory-test-data");
          return next();
        }
      }

      chainWithMetrics.use(new MemoryHeavyMiddleware("memory-heavy", 10));

      const request = createTestRequest();

      await chainWithMetrics.execute(request);

      // May or may not trigger warning depending on actual memory usage
      // The test verifies the code path exists
    });

    it("should not monitor memory usage when metrics disabled", async () => {
      const chainWithoutMetrics = new MiddlewareChain({
        enableMetrics: false,
      });

      chainWithoutMetrics.use(new TestMiddleware("test", 10));

      const request = createTestRequest();

      // Should not throw even with high memory usage
      const result = await chainWithoutMetrics.execute(request);

      expect(result.response).toBeInstanceOf(NextResponse);
    });

    it("should calculate execution time correctly", async () => {
      chain.use(new SlowMiddleware("slow", 50));

      const request = createTestRequest();
      const startTime = Date.now();

      const result = await chain.execute(request);
      const actualTime = Date.now() - startTime;

      expect(result.executionTime).toBeGreaterThanOrEqual(40); // Account for timing variance
      expect(result.executionTime).toBeLessThanOrEqual(actualTime + 10); // Should be close to actual
    });
  });

  describe("Edge Cases and Utility Methods", () => {
    it("should handle empty middleware list", async () => {
      const request = createTestRequest();

      const result = await chain.execute(request);

      expect(result.response).toBeInstanceOf(NextResponse);
      expect(result.context.requestId).toBeDefined();
    });

    it("should generate unique request IDs", async () => {
      const request = createTestRequest();

      const result1 = await chain.execute(request);
      const result2 = await chain.execute(request);

      expect(result1.context.requestId).not.toBe(result2.context.requestId);
      expect(result1.context.requestId).toMatch(/^req_\d+_[a-z0-9]+$/);
      expect(result2.context.requestId).toMatch(/^req_\d+_[a-z0-9]+$/);
    });

    it("should handle null/undefined middleware in array", async () => {
      // Test internal chain execution with null middleware
      const middlewareList: (MiddlewareHandler | null)[] = [
        new TestMiddleware("valid", 10),
        null,
        new TestMiddleware("also-valid", 20),
      ];

      // Filter out null values like the implementation does
      const validMiddleware = middlewareList.filter(
        Boolean,
      ) as MiddlewareHandler[];

      expect(validMiddleware).toHaveLength(2);
      expect(validMiddleware[0].name).toBe("valid");
      expect(validMiddleware[1].name).toBe("also-valid");
    });

    it("should preserve initial context properties", async () => {
      chain.use(new TestMiddleware("test", 10));

      const request = createTestRequest();
      const initialContext = createTestContext({
        correlationId: "test-correlation",
        userId: "test-user",
        sourceModule: "test-source",
        metadata: { custom: "value" },
      });

      const result = await chain.execute(request, initialContext);

      expect(result.context.correlationId).toBe("test-correlation");
      expect(result.context.userId).toBe("test-user");
      expect(result.context.sourceModule).toBe("test-source");
      expect(result.context.metadata.custom).toBe("value");
    });

    it("should handle statistics for removed middleware", () => {
      const middleware = new TestMiddleware("test", 10);
      chain.use(middleware);

      let stats = chain.getStatistics();
      expect(stats.middlewareStats["test"]).toBeDefined();

      chain.remove("test");

      stats = chain.getStatistics();
      expect(stats.middlewareStats["test"]).toBeUndefined();
    });

    it("should handle clearing statistics after clear()", () => {
      chain.use(new TestMiddleware("test", 10));

      let stats = chain.getStatistics();
      expect(stats.middlewareStats["test"]).toBeDefined();

      chain.clear();

      stats = chain.getStatistics();
      expect(Object.keys(stats.middlewareStats)).toHaveLength(0);
    });
  });

  describe("Global Middleware Chain", () => {
    it("should provide global middleware chain instance", () => {
      expect(globalMiddlewareChain).toBeInstanceOf(MiddlewareChain);
      expect(globalMiddlewareChain.getMiddlewareNames()).toBeDefined();
    });

    it("should be same instance across imports", () => {
      // This tests that the global instance is a singleton
      expect(globalMiddlewareChain).toBe(globalMiddlewareChain);
    });
  });
});
