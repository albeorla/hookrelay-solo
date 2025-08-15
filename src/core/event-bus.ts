/**
 * Event Bus System
 *
 * This file implements the Observer pattern for inter-module communication.
 * It provides a type-safe, async event system that enables loose coupling
 * between modules following the SOLID principles.
 */

import { EventEmitter } from "events";
import { ModuleError } from "./types";

/**
 * Event handler function signature
 */
export type EventHandler<T = unknown> = (
  event: EventPayload<T>,
) => Promise<void> | void;

/**
 * Event subscription options
 */
export interface SubscriptionOptions {
  /** Handler priority (lower = higher priority) */
  readonly priority?: number;

  /** Whether handler can be called concurrently */
  readonly concurrent?: boolean;

  /** Maximum execution time before timeout (ms) */
  readonly timeout?: number;

  /** Whether to retry on failure */
  readonly retry?: boolean;

  /** Number of retry attempts */
  readonly maxRetries?: number;

  /** Delay between retries (ms) */
  readonly retryDelay?: number;
}

/**
 * Event payload interface
 */
export interface EventPayload<T = unknown> {
  /** Event name/type */
  readonly type: string;

  /** Event data */
  readonly data: T;

  /** Timestamp when event was published */
  readonly timestamp: Date;

  /** Unique event ID */
  readonly id: string;

  /** Source module that published the event */
  readonly source?: string;

  /** Correlation ID for event tracing */
  readonly correlationId?: string;

  /** Event metadata */
  readonly metadata?: Record<string, unknown>;
}

/**
 * Event subscription details
 */
export interface EventSubscription {
  readonly id: string;
  readonly eventType: string;
  readonly handler: EventHandler;
  readonly options: Required<SubscriptionOptions>;
  readonly createdAt: Date;
  statistics: {
    executionCount: number;
    errorCount: number;
    totalExecutionTime: number;
    avgExecutionTime: number;
    lastExecuted?: Date;
    lastError?: Error;
  };
}

/**
 * Event bus statistics
 */
export interface EventBusStatistics {
  totalEvents: number;
  totalSubscriptions: number;
  eventTypes: Record<string, number>;
  subscriptionsByType: Record<string, number>;
  averageHandlersPerEvent: number;
  totalErrors: number;
  totalExecutionTime: number;
}

/**
 * Event middleware for processing events before handlers
 */
export interface EventMiddleware {
  readonly name: string;
  readonly priority: number;

  process<T>(event: EventPayload<T>, next: () => Promise<void>): Promise<void>;
}

/**
 * Event bus implementation using Observer pattern
 *
 * Provides a centralized, type-safe event system for inter-module
 * communication. Supports priorities, timeouts, retries, and middleware.
 */
export class EventBus extends EventEmitter {
  private readonly subscriptions = new Map<
    string,
    Map<string, EventSubscription>
  >();
  private readonly middleware: EventMiddleware[] = [];
  private readonly eventHistory: EventPayload[] = [];
  private readonly statistics: EventBusStatistics = {
    totalEvents: 0,
    totalSubscriptions: 0,
    eventTypes: {},
    subscriptionsByType: {},
    averageHandlersPerEvent: 0,
    totalErrors: 0,
    totalExecutionTime: 0,
  };

  private readonly maxHistorySize: number;
  private readonly defaultTimeout: number;
  private readonly enableMetrics: boolean;

  constructor(
    options: {
      maxHistorySize?: number;
      defaultTimeout?: number;
      enableMetrics?: boolean;
      maxListeners?: number;
    } = {},
  ) {
    super();

    this.maxHistorySize = options.maxHistorySize ?? 1000;
    this.defaultTimeout = options.defaultTimeout ?? 30000; // 30 seconds
    this.enableMetrics = options.enableMetrics ?? true;

    // Increase max listeners for high-throughput scenarios
    this.setMaxListeners(options.maxListeners ?? 100);
  }

  /**
   * Subscribe to an event type
   */
  subscribe<T = unknown>(
    eventType: string,
    handler: EventHandler<T>,
    options: SubscriptionOptions = {},
  ): string {
    if (!eventType || typeof handler !== "function") {
      throw new Error("Event type and handler are required");
    }

    const subscriptionId = this.generateId();
    const subscription: EventSubscription = {
      id: subscriptionId,
      eventType,
      handler: handler as EventHandler,
      options: {
        priority: options.priority ?? 100,
        concurrent: options.concurrent ?? true,
        timeout: options.timeout ?? this.defaultTimeout,
        retry: options.retry ?? false,
        maxRetries: options.maxRetries ?? 3,
        retryDelay: options.retryDelay ?? 1000,
      },
      createdAt: new Date(),
      statistics: {
        executionCount: 0,
        errorCount: 0,
        totalExecutionTime: 0,
        avgExecutionTime: 0,
      },
    };

    // Create subscription map for event type if it doesn't exist
    if (!this.subscriptions.has(eventType)) {
      this.subscriptions.set(eventType, new Map());
    }

    const subscriptionMap = this.subscriptions.get(eventType);
    if (subscriptionMap) {
      subscriptionMap.set(subscriptionId, subscription);
    }

    // Update statistics
    this.statistics.totalSubscriptions++;
    this.statistics.subscriptionsByType[eventType] =
      (this.statistics.subscriptionsByType[eventType] ?? 0) + 1;

    // Emit subscription event for monitoring
    super.emit("subscription:added", { eventType, subscriptionId, options });

    return subscriptionId;
  }

  /**
   * Unsubscribe from an event
   */
  unsubscribe(subscriptionId: string): boolean {
    for (const [eventType, subscriptionMap] of this.subscriptions) {
      const subscription = subscriptionMap.get(subscriptionId);
      if (subscription) {
        subscriptionMap.delete(subscriptionId);

        // Clean up empty event type maps
        if (subscriptionMap.size === 0) {
          this.subscriptions.delete(eventType);
        }

        // Update statistics
        this.statistics.totalSubscriptions--;
        const currentCount =
          this.statistics.subscriptionsByType[eventType] ?? 0;
        this.statistics.subscriptionsByType[eventType] = currentCount - 1;
        if (this.statistics.subscriptionsByType[eventType] <= 0) {
          delete this.statistics.subscriptionsByType[eventType];
        }

        // Emit unsubscription event
        super.emit("subscription:removed", { eventType, subscriptionId });

        return true;
      }
    }
    return false;
  }

  /**
   * Publish an event to all subscribers
   */
  async publish<T = unknown>(
    eventType: string,
    data: T,
    options: {
      source?: string;
      correlationId?: string;
      metadata?: Record<string, unknown>;
    } = {},
  ): Promise<void> {
    if (!eventType) {
      throw new Error("Event type is required");
    }

    const event: EventPayload<T> = {
      type: eventType,
      data,
      timestamp: new Date(),
      id: this.generateId(),
      source: options.source,
      correlationId: options.correlationId,
      metadata: options.metadata,
    };

    // Add to history
    this.addToHistory(event);

    // Update statistics
    this.statistics.totalEvents++;
    this.statistics.eventTypes[eventType] =
      (this.statistics.eventTypes[eventType] ?? 0) + 1;

    // Emit Node.js event for backward compatibility
    super.emit(eventType, event);

    const subscriptions = this.subscriptions.get(eventType);
    if (!subscriptions || subscriptions.size === 0) {
      return;
    }

    try {
      // Process through middleware first
      await this.processMiddleware(event);

      // Execute handlers
      await this.executeHandlers(event, Array.from(subscriptions.values()));
    } catch (error) {
      this.statistics.totalErrors++;
      super.emit("error", {
        type: "publish",
        eventType,
        eventId: event.id,
        error: error instanceof Error ? error : new Error(String(error)),
      });
      throw error;
    }
  }

  /**
   * Publish and wait for all handlers to complete
   */
  async publishAndWait<T = unknown>(
    eventType: string,
    data: T,
    options: {
      source?: string;
      correlationId?: string;
      metadata?: Record<string, unknown>;
      timeout?: number;
    } = {},
  ): Promise<void> {
    const timeoutMs = options.timeout ?? this.defaultTimeout;
    const publishPromise = this.publish(eventType, data, options);

    if (timeoutMs > 0) {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(
            new Error(`Event '${eventType}' timed out after ${timeoutMs}ms`),
          );
        }, timeoutMs);
      });

      await Promise.race([publishPromise, timeoutPromise]);
    } else {
      await publishPromise;
    }
  }

  /**
   * Add middleware to process events
   */
  addMiddleware(middleware: EventMiddleware): void {
    this.middleware.push(middleware);
    // Sort by priority (lower = higher priority)
    this.middleware.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Remove middleware
   */
  removeMiddleware(name: string): boolean {
    const index = this.middleware.findIndex((m) => m.name === name);
    if (index >= 0) {
      this.middleware.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Get all subscriptions for an event type
   */
  getSubscriptions(eventType: string): readonly EventSubscription[] {
    const subscriptions = this.subscriptions.get(eventType);
    return subscriptions ? Array.from(subscriptions.values()) : [];
  }

  /**
   * Get subscription by ID
   */
  getSubscription(subscriptionId: string): EventSubscription | undefined {
    for (const subscriptionMap of this.subscriptions.values()) {
      const subscription = subscriptionMap.get(subscriptionId);
      if (subscription) {
        return subscription;
      }
    }
    return undefined;
  }

  /**
   * Get all registered event types
   */
  getEventTypes(): readonly string[] {
    return Array.from(this.subscriptions.keys());
  }

  /**
   * Get event history
   */
  getHistory(eventType?: string): readonly EventPayload[] {
    if (eventType) {
      return this.eventHistory.filter((event) => event.type === eventType);
    }
    return [...this.eventHistory];
  }

  /**
   * Get event bus statistics
   */
  getStatistics(): EventBusStatistics {
    // Calculate average handlers per event
    const totalHandlers = Object.values(
      this.statistics.subscriptionsByType,
    ).reduce((sum, count) => sum + count, 0);
    const eventTypeCount = Object.keys(this.statistics.eventTypes).length;

    return {
      ...this.statistics,
      averageHandlersPerEvent:
        eventTypeCount > 0 ? totalHandlers / eventTypeCount : 0,
    };
  }

  /**
   * Clear event history
   */
  clearHistory(): void {
    this.eventHistory.length = 0;
  }

  /**
   * Clear all subscriptions
   */
  clearSubscriptions(): void {
    this.subscriptions.clear();
    this.statistics.totalSubscriptions = 0;
    this.statistics.subscriptionsByType = {};
    super.emit("subscriptions:cleared");
  }

  /**
   * Shutdown the event bus
   */
  async shutdown(): Promise<void> {
    this.clearSubscriptions();
    this.middleware.length = 0;
    this.clearHistory();
    this.removeAllListeners();
  }

  // Private implementation methods

  private generateId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private addToHistory(event: EventPayload): void {
    this.eventHistory.push(event);

    // Trim history if it exceeds max size
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.splice(
        0,
        this.eventHistory.length - this.maxHistorySize,
      );
    }
  }

  private async processMiddleware<T>(event: EventPayload<T>): Promise<void> {
    let index = 0;

    const next = async (): Promise<void> => {
      if (index < this.middleware.length) {
        const middleware = this.middleware[index++];
        if (middleware) {
          await middleware.process(event, next);
        }
      }
    };

    await next();
  }

  private async executeHandlers(
    event: EventPayload,
    subscriptions: EventSubscription[],
  ): Promise<void> {
    // Sort by priority (lower = higher priority)
    const sortedSubscriptions = subscriptions.sort(
      (a, b) => a.options.priority - b.options.priority,
    );

    // Group by concurrent/sequential execution
    const concurrentHandlers: EventSubscription[] = [];
    const sequentialHandlers: EventSubscription[] = [];

    for (const subscription of sortedSubscriptions) {
      if (subscription.options.concurrent) {
        concurrentHandlers.push(subscription);
      } else {
        sequentialHandlers.push(subscription);
      }
    }

    // Execute concurrent handlers in parallel
    const concurrentPromises = concurrentHandlers.map((subscription) =>
      this.executeHandler(event, subscription),
    );

    // Execute sequential handlers one by one
    const sequentialPromise = sequentialHandlers.reduce(
      (promise, subscription) =>
        promise.then(() => this.executeHandler(event, subscription)),
      Promise.resolve(),
    );

    // Wait for all handlers to complete
    await Promise.all([...concurrentPromises, sequentialPromise]);
  }

  private async executeHandler(
    event: EventPayload,
    subscription: EventSubscription,
  ): Promise<void> {
    const startTime = Date.now();
    let attempt = 0;
    let lastError: Error | undefined;

    const maxAttempts = subscription.options.retry
      ? subscription.options.maxRetries + 1
      : 1;

    while (attempt < maxAttempts) {
      try {
        // Apply timeout
        const handlerPromise = Promise.resolve(subscription.handler(event));

        if (subscription.options.timeout > 0) {
          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => {
              reject(
                new Error(
                  `Handler for '${event.type}' timed out after ${subscription.options.timeout}ms`,
                ),
              );
            }, subscription.options.timeout);
          });

          await Promise.race([handlerPromise, timeoutPromise]);
        } else {
          await handlerPromise;
        }

        // Success - update statistics
        const executionTime = Date.now() - startTime;
        subscription.statistics.executionCount++;
        subscription.statistics.totalExecutionTime += executionTime;
        subscription.statistics.avgExecutionTime =
          subscription.statistics.totalExecutionTime /
          subscription.statistics.executionCount;
        subscription.statistics.lastExecuted = new Date();

        if (this.enableMetrics) {
          this.statistics.totalExecutionTime += executionTime;
        }

        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        attempt++;

        subscription.statistics.errorCount++;
        subscription.statistics.lastError = lastError;

        if (attempt < maxAttempts) {
          // Wait before retry
          await new Promise((resolve) =>
            setTimeout(resolve, subscription.options.retryDelay),
          );
        }
      }
    }

    // All attempts failed
    if (lastError) {
      super.emit("handler:error", {
        eventType: event.type,
        eventId: event.id,
        subscriptionId: subscription.id,
        error: lastError,
        attempts: attempt,
      });

      throw new ModuleError(
        `Handler failed after ${attempt} attempts: ${lastError.message}`,
        event.source ?? "unknown",
        "HANDLER_ERROR",
        lastError,
      );
    }
  }
}

/**
 * Default global event bus instance
 */
export const globalEventBus = new EventBus();

/**
 * Type-safe event bus wrapper with predefined event types
 */
export class TypedEventBus<TEvents extends Record<string, unknown>> {
  constructor(private eventBus: EventBus = globalEventBus) {}

  subscribe<K extends keyof TEvents>(
    eventType: K,
    handler: EventHandler<TEvents[K]>,
    options?: SubscriptionOptions,
  ): string {
    return this.eventBus.subscribe(String(eventType), handler, options);
  }

  async publish<K extends keyof TEvents>(
    eventType: K,
    data: TEvents[K],
    options?: {
      source?: string;
      correlationId?: string;
      metadata?: Record<string, unknown>;
    },
  ): Promise<void> {
    return this.eventBus.publish(String(eventType), data, options);
  }

  unsubscribe(subscriptionId: string): boolean {
    return this.eventBus.unsubscribe(subscriptionId);
  }

  getStatistics(): EventBusStatistics {
    return this.eventBus.getStatistics();
  }
}
