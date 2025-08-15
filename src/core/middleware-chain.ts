/**
 * Middleware Chain System
 *
 * This file implements the Chain of Responsibility pattern for request
 * processing middleware. It provides a flexible pipeline for processing
 * requests through multiple handlers in sequence.
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ModuleError } from "./types";

/**
 * Request context interface - carries data through middleware chain
 */
export interface RequestContext {
  /** Unique request ID for tracing */
  readonly requestId: string;

  /** Start time for performance tracking */
  readonly startTime: Date;

  /** Correlation ID for distributed tracing */
  readonly correlationId?: string;

  /** User ID if authenticated */
  readonly userId?: string;

  /** Module that initiated the request */
  readonly sourceModule?: string;

  /** Additional context data */
  readonly data: Map<string, unknown>;

  /** Request metadata */
  readonly metadata: Record<string, unknown>;
}

/**
 * Middleware execution result
 */
export interface MiddlewareResult {
  /** Whether to continue processing */
  readonly continue: boolean;

  /** Optional response to return early */
  readonly response?: NextResponse;

  /** Updated context */
  readonly context?: RequestContext;

  /** Error if middleware failed */
  readonly error?: Error;

  /** Performance metrics */
  readonly metrics?: {
    readonly executionTime: number;
    readonly memoryUsage: number;
  };
}

/**
 * Middleware handler interface
 */
export interface MiddlewareHandler {
  /** Unique middleware name */
  readonly name: string;

  /** Execution priority (lower = higher priority) */
  readonly priority: number;

  /** Whether middleware is enabled */
  readonly enabled: boolean;

  /** Middleware configuration */
  readonly config?: Record<string, unknown>;

  /** Execute middleware */
  execute(
    request: NextRequest,
    context: RequestContext,
    next: () => Promise<MiddlewareResult>,
  ): Promise<MiddlewareResult>;
}

/**
 * Abstract base class for middleware handlers
 */
export abstract class BaseMiddlewareHandler implements MiddlewareHandler {
  public readonly enabled: boolean = true;

  constructor(
    public readonly name: string,
    public readonly priority: number,
    public readonly config?: Record<string, unknown>,
  ) {}

  abstract execute(
    request: NextRequest,
    context: RequestContext,
    next: () => Promise<MiddlewareResult>,
  ): Promise<MiddlewareResult>;

  /**
   * Helper to create success result
   */
  protected success(context?: RequestContext): MiddlewareResult {
    return {
      continue: true,
      context,
    };
  }

  /**
   * Helper to create early response result
   */
  protected response(
    response: NextResponse,
    context?: RequestContext,
  ): MiddlewareResult {
    return {
      continue: false,
      response,
      context,
    };
  }

  /**
   * Helper to create error result
   */
  protected error(error: Error, context?: RequestContext): MiddlewareResult {
    return {
      continue: false,
      error,
      context,
    };
  }
}

/**
 * Middleware chain configuration
 */
export interface MiddlewareChainConfig {
  /** Maximum execution time for entire chain (ms) */
  readonly timeout: number;

  /** Whether to enable performance monitoring */
  readonly enableMetrics: boolean;

  /** Whether to continue on individual middleware errors */
  readonly continueOnError: boolean;

  /** Maximum allowed memory increase during processing */
  readonly maxMemoryIncrease: number;
}

/**
 * Default middleware chain configuration
 */
const DEFAULT_CONFIG: MiddlewareChainConfig = {
  timeout: 30000, // 30 seconds
  enableMetrics: true,
  continueOnError: false,
  maxMemoryIncrease: 50 * 1024 * 1024, // 50 MB
};

/**
 * Middleware chain statistics
 */
export interface MiddlewareChainStatistics {
  totalRequests: number;
  totalExecutionTime: number;
  averageExecutionTime: number;
  errorCount: number;
  timeoutCount: number;
  middlewareStats: Record<
    string,
    {
      executionCount: number;
      totalTime: number;
      averageTime: number;
      errorCount: number;
      lastExecuted?: Date;
    }
  >;
}

/**
 * Middleware chain implementation using Chain of Responsibility pattern
 *
 * Processes requests through a configurable pipeline of middleware handlers.
 * Supports priorities, timeouts, error handling, and performance monitoring.
 */
export class MiddlewareChain {
  private readonly handlers = new Map<string, MiddlewareHandler>();
  private readonly config: MiddlewareChainConfig;
  private readonly statistics: MiddlewareChainStatistics = {
    totalRequests: 0,
    totalExecutionTime: 0,
    averageExecutionTime: 0,
    errorCount: 0,
    timeoutCount: 0,
    middlewareStats: {},
  };

  constructor(config: Partial<MiddlewareChainConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Add middleware to the chain
   */
  use(handler: MiddlewareHandler): this {
    if (this.handlers.has(handler.name)) {
      throw new Error(`Middleware '${handler.name}' is already registered`);
    }

    this.handlers.set(handler.name, handler);

    // Initialize statistics for this middleware
    this.statistics.middlewareStats[handler.name] = {
      executionCount: 0,
      totalTime: 0,
      averageTime: 0,
      errorCount: 0,
    };

    return this;
  }

  /**
   * Remove middleware from the chain
   */
  remove(name: string): boolean {
    const removed = this.handlers.delete(name);
    if (removed) {
      delete this.statistics.middlewareStats[name];
    }
    return removed;
  }

  /**
   * Get middleware by name
   */
  get(name: string): MiddlewareHandler | undefined {
    return this.handlers.get(name);
  }

  /**
   * Check if middleware exists
   */
  has(name: string): boolean {
    return this.handlers.has(name);
  }

  /**
   * Get all registered middleware names
   */
  getMiddlewareNames(): readonly string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Execute the middleware chain
   */
  async execute(
    request: NextRequest,
    initialContext?: Partial<RequestContext>,
  ): Promise<{
    response: NextResponse;
    context: RequestContext;
    executionTime: number;
  }> {
    const startTime = Date.now();
    const initialMemory = this.config.enableMetrics
      ? process.memoryUsage().heapUsed
      : 0;

    // Create request context
    const context: RequestContext = {
      requestId: this.generateRequestId(),
      startTime: new Date(),
      correlationId: initialContext?.correlationId,
      userId: initialContext?.userId,
      sourceModule: initialContext?.sourceModule,
      data: new Map(),
      metadata: initialContext?.metadata ?? {},
      ...initialContext,
    };

    // Get enabled middleware sorted by priority
    const middlewareList = Array.from(this.handlers.values())
      .filter((handler) => handler.enabled)
      .sort((a, b) => a.priority - b.priority);

    this.statistics.totalRequests++;

    try {
      // Execute the chain with timeout
      const result = await this.executeWithTimeout(
        request,
        context,
        middlewareList,
        this.config.timeout,
      );

      const executionTime = Date.now() - startTime;
      this.updateStatistics(executionTime);

      // Check memory usage
      if (this.config.enableMetrics) {
        const memoryIncrease = process.memoryUsage().heapUsed - initialMemory;
        if (memoryIncrease > this.config.maxMemoryIncrease) {
          console.warn(
            `Middleware chain memory increase (${memoryIncrease} bytes) exceeds limit (${this.config.maxMemoryIncrease} bytes)`,
          );
        }
      }

      return {
        response: result.response ?? NextResponse.next(),
        context: result.context ?? context,
        executionTime,
      };
    } catch (error) {
      this.statistics.errorCount++;

      if (
        error instanceof Error &&
        (error.message.includes("timeout") ||
          error.message.includes("timed out"))
      ) {
        this.statistics.timeoutCount++;
      }

      const executionTime = Date.now() - startTime;
      this.updateStatistics(executionTime);

      throw new ModuleError(
        `Middleware chain execution failed: ${error instanceof Error ? error.message : String(error)}`,
        context.sourceModule ?? "unknown",
        "MIDDLEWARE_ERROR",
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Get middleware chain statistics
   */
  getStatistics(): MiddlewareChainStatistics {
    return { ...this.statistics };
  }

  /**
   * Reset statistics
   */
  resetStatistics(): void {
    this.statistics.totalRequests = 0;
    this.statistics.totalExecutionTime = 0;
    this.statistics.averageExecutionTime = 0;
    this.statistics.errorCount = 0;
    this.statistics.timeoutCount = 0;

    for (const stats of Object.values(this.statistics.middlewareStats)) {
      stats.executionCount = 0;
      stats.totalTime = 0;
      stats.averageTime = 0;
      stats.errorCount = 0;
      stats.lastExecuted = undefined;
    }
  }

  /**
   * Clear all middleware
   */
  clear(): void {
    this.handlers.clear();
    this.statistics.middlewareStats = {};
  }

  // Private implementation methods

  private async executeWithTimeout(
    request: NextRequest,
    context: RequestContext,
    middlewareList: MiddlewareHandler[],
    timeoutMs: number,
  ): Promise<MiddlewareResult> {
    const chainPromise = this.executeChain(request, context, middlewareList);

    if (typeof timeoutMs === "number" && timeoutMs > 0) {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Middleware chain timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      });

      return Promise.race([chainPromise, timeoutPromise]);
    }

    return chainPromise;
  }

  private async executeChain(
    request: NextRequest,
    context: RequestContext,
    middlewareList: MiddlewareHandler[],
  ): Promise<MiddlewareResult> {
    let currentContext = context;
    let index = 0;

    const executeNext = async (): Promise<MiddlewareResult> => {
      if (index >= middlewareList.length) {
        // End of chain - return success
        return {
          continue: true,
          context: currentContext,
        };
      }

      const middleware = middlewareList[index++];
      if (!middleware) {
        return {
          continue: true,
          context: currentContext,
        };
      }

      const middlewareStartTime = Date.now();

      try {
        const result = await middleware.execute(
          request,
          currentContext,
          executeNext,
        );

        // Update middleware statistics
        if (this.config.enableMetrics && middleware) {
          const executionTime = Date.now() - middlewareStartTime;
          this.updateMiddlewareStats(middleware.name, executionTime, false);
        }

        // Update context if provided
        if (result.context) {
          currentContext = result.context;
        }

        // Handle middleware result
        if (result.error) {
          if (this.config.continueOnError) {
            console.warn(
              `Middleware '${middleware ? middleware.name : "unknown"}' error (continuing):`,
              result.error,
            );
            return executeNext();
          } else {
            throw result.error;
          }
        }

        if (!result.continue) {
          return result;
        }

        return result;
      } catch (error) {
        // Update error statistics
        if (this.config.enableMetrics && middleware) {
          const executionTime = Date.now() - middlewareStartTime;
          this.updateMiddlewareStats(middleware.name, executionTime, true);
        }

        if (this.config.continueOnError) {
          console.warn(
            `Middleware '${middleware ? middleware.name : "unknown"}' error (continuing):`,
            error,
          );
          return executeNext();
        } else {
          throw error;
        }
      }
    };

    return executeNext();
  }

  private updateStatistics(executionTime: number): void {
    this.statistics.totalExecutionTime += executionTime;
    this.statistics.averageExecutionTime =
      this.statistics.totalExecutionTime / this.statistics.totalRequests;
  }

  private updateMiddlewareStats(
    name: string,
    executionTime: number,
    isError: boolean,
  ): void {
    const stats = this.statistics.middlewareStats[name];
    if (stats) {
      stats.executionCount++;
      stats.totalTime += executionTime;
      stats.averageTime = stats.totalTime / stats.executionCount;
      stats.lastExecuted = new Date();

      if (isError) {
        stats.errorCount++;
      }
    }
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Global middleware chain instance
 */
export const globalMiddlewareChain = new MiddlewareChain();

/**
 * Common middleware implementations
 */

/**
 * Request logging middleware
 */
export class LoggingMiddleware extends BaseMiddlewareHandler {
  constructor(
    priority = 0,
    config?: { includeBody?: boolean; includeHeaders?: boolean },
  ) {
    super("logging", priority, config);
  }

  async execute(
    request: NextRequest,
    context: RequestContext,
    next: () => Promise<MiddlewareResult>,
  ): Promise<MiddlewareResult> {
    const startTime = Date.now();

    console.log(`[${context.requestId}] ${request.method} ${request.url}`);

    if (this.config?.includeHeaders) {
      console.log(
        `[${context.requestId}] Headers:`,
        Object.fromEntries(request.headers),
      );
    }

    try {
      const result = await next();
      const executionTime = Date.now() - startTime;

      console.log(`[${context.requestId}] Completed in ${executionTime}ms`);

      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error(
        `[${context.requestId}] Error after ${executionTime}ms:`,
        error,
      );
      throw error;
    }
  }
}

/**
 * Performance monitoring middleware
 */
export class PerformanceMiddleware extends BaseMiddlewareHandler {
  constructor(priority = 10, config?: { slowRequestThreshold?: number }) {
    super("performance", priority, config);
  }

  async execute(
    request: NextRequest,
    context: RequestContext,
    next: () => Promise<MiddlewareResult>,
  ): Promise<MiddlewareResult> {
    const startTime = Date.now();
    const startMemory = process.memoryUsage().heapUsed;

    try {
      const result = await next();

      const executionTime = Date.now() - startTime;
      const memoryUsed = process.memoryUsage().heapUsed - startMemory;

      const slowThreshold =
        (this.config?.slowRequestThreshold as number) ?? 1000;
      if (typeof slowThreshold === "number" && executionTime > slowThreshold) {
        console.warn(
          `[${context.requestId}] Slow request: ${executionTime}ms, memory: ${memoryUsed} bytes`,
        );
      }

      return {
        ...result,
        metrics: {
          executionTime,
          memoryUsage: memoryUsed,
        },
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error(
        `[${context.requestId}] Performance tracking error after ${executionTime}ms:`,
        error,
      );
      throw error;
    }
  }
}

/**
 * Authentication middleware
 */
export class AuthenticationMiddleware extends BaseMiddlewareHandler {
  constructor(
    priority = 20,
    config?: {
      skipPaths?: string[];
      requireAuth?: boolean;
    },
  ) {
    super("authentication", priority, config);
  }

  async execute(
    request: NextRequest,
    context: RequestContext,
    next: () => Promise<MiddlewareResult>,
  ): Promise<MiddlewareResult> {
    const pathname = request.nextUrl.pathname;

    // Skip authentication for certain paths
    const skipPaths = (this.config?.skipPaths as string[]) ?? [
      "/api/auth",
      "/health",
    ];
    if (
      Array.isArray(skipPaths) &&
      skipPaths.some((path: string) => pathname.startsWith(path))
    ) {
      return next();
    }

    // Check for authentication token
    const authHeader = request.headers.get("authorization");
    if (!authHeader && this.config?.requireAuth) {
      return this.response(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      );
    }

    return next();
  }

  private extractUserId(authHeader: string): string | undefined {
    // Placeholder - implement actual token validation
    return authHeader.replace("Bearer ", "");
  }
}
