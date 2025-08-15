/**
 * Dependency Injection Container
 *
 * This file implements the Inversion of Control (IoC) container pattern
 * following the Dependency Inversion Principle from SOLID. It provides
 * type-safe dependency registration and resolution for modules.
 */

import "reflect-metadata";

/**
 * Service lifetime management modes
 */
export enum ServiceLifetime {
  /** Single instance shared across the application */
  SINGLETON = "singleton",
  /** New instance created for each resolution */
  TRANSIENT = "transient",
  /** Single instance per module scope */
  SCOPED = "scoped",
}

/**
 * Service registration token - string or symbol for type safety
 */
export type ServiceToken<T = unknown> =
  | string
  | symbol
  | (new (...args: unknown[]) => T);

/**
 * Service factory function signature
 */
export type ServiceFactory<T> = (container: Container) => T | Promise<T>;

/**
 * Service constructor signature
 */
export type ServiceConstructor<T> = new (...args: unknown[]) => T;

/**
 * Service registration options
 */
export interface ServiceRegistration<T = unknown> {
  /** Service lifetime */
  readonly lifetime: ServiceLifetime;

  /** Factory function or constructor */
  readonly factory: ServiceFactory<T> | ServiceConstructor<T>;

  /** Dependencies to inject (for constructor injection) */
  readonly dependencies?: readonly ServiceToken[];

  /** Registration metadata */
  readonly metadata?: Record<string, unknown>;
}

/**
 * Container scope for scoped services
 */
export interface ContainerScope {
  readonly id: string;
  readonly parent?: ContainerScope;
  readonly services: Map<ServiceToken, unknown>;
}

/**
 * Dependency injection container implementation
 *
 * Provides IoC container functionality following the SOLID principle
 * of Dependency Inversion. Supports singleton, transient, and scoped
 * service lifetimes with circular dependency detection.
 */
export class Container {
  private readonly registrations = new Map<ServiceToken, ServiceRegistration>();
  private readonly singletons = new Map<ServiceToken, unknown>();
  private readonly resolutionStack = new Set<ServiceToken>();
  private currentScope?: ContainerScope;

  /**
   * Register a service factory
   */
  register<T>(
    token: ServiceToken<T>,
    factory: ServiceFactory<T>,
    lifetime: ServiceLifetime = ServiceLifetime.TRANSIENT,
    metadata?: Record<string, unknown>,
  ): this {
    if (this.registrations.has(token)) {
      throw new Error(`Service '${String(token)}' is already registered`);
    }

    this.registrations.set(token, {
      lifetime,
      factory,
      metadata: metadata ?? {},
    });

    return this;
  }

  /**
   * Register a service constructor
   */
  registerConstructor<T>(
    token: ServiceToken<T>,
    constructor: ServiceConstructor<T>,
    dependencies: readonly ServiceToken[] = [],
    lifetime: ServiceLifetime = ServiceLifetime.TRANSIENT,
    metadata?: Record<string, unknown>,
  ): this {
    if (this.registrations.has(token)) {
      throw new Error(`Service '${String(token)}' is already registered`);
    }

    this.registrations.set(token, {
      lifetime,
      factory: constructor,
      dependencies,
      metadata: metadata ?? {},
    });

    return this;
  }

  /**
   * Register a singleton service
   */
  registerSingleton<T>(
    token: ServiceToken<T>,
    factory: ServiceFactory<T> | ServiceConstructor<T>,
    dependencies?: readonly ServiceToken[],
    metadata?: Record<string, unknown>,
  ): this {
    if (typeof factory === "function" && factory.prototype) {
      return this.registerConstructor(
        token,
        factory as ServiceConstructor<T>,
        dependencies ?? [],
        ServiceLifetime.SINGLETON,
        metadata,
      );
    } else {
      return this.register(
        token,
        factory as ServiceFactory<T>,
        ServiceLifetime.SINGLETON,
        metadata,
      );
    }
  }

  /**
   * Register a transient service
   */
  registerTransient<T>(
    token: ServiceToken<T>,
    factory: ServiceFactory<T> | ServiceConstructor<T>,
    dependencies?: readonly ServiceToken[],
    metadata?: Record<string, unknown>,
  ): this {
    if (typeof factory === "function" && factory.prototype) {
      return this.registerConstructor(
        token,
        factory as ServiceConstructor<T>,
        dependencies ?? [],
        ServiceLifetime.TRANSIENT,
        metadata,
      );
    } else {
      return this.register(
        token,
        factory as ServiceFactory<T>,
        ServiceLifetime.TRANSIENT,
        metadata,
      );
    }
  }

  /**
   * Register a scoped service
   */
  registerScoped<T>(
    token: ServiceToken<T>,
    factory: ServiceFactory<T> | ServiceConstructor<T>,
    dependencies?: readonly ServiceToken[],
    metadata?: Record<string, unknown>,
  ): this {
    if (typeof factory === "function" && factory.prototype) {
      return this.registerConstructor(
        token,
        factory as ServiceConstructor<T>,
        dependencies ?? [],
        ServiceLifetime.SCOPED,
        metadata,
      );
    } else {
      return this.register(
        token,
        factory as ServiceFactory<T>,
        ServiceLifetime.SCOPED,
        metadata,
      );
    }
  }

  /**
   * Register an instance as singleton
   */
  registerInstance<T>(token: ServiceToken<T>, instance: T): this {
    this.singletons.set(token, instance);
    this.registrations.set(token, {
      lifetime: ServiceLifetime.SINGLETON,
      factory: () => instance,
      metadata: { isInstance: true },
    });
    return this;
  }

  /**
   * Resolve a service by token
   */
  async resolve<T>(token: ServiceToken<T>): Promise<T> {
    // Check for circular dependencies
    if (this.resolutionStack.has(token)) {
      const cycle = Array.from(this.resolutionStack).concat(String(token));
      throw new Error(`Circular dependency detected: ${cycle.join(" -> ")}`);
    }

    this.resolutionStack.add(token);

    try {
      const registration = this.registrations.get(token);
      if (!registration) {
        throw new Error(`Service '${String(token)}' is not registered`);
      }

      switch (registration.lifetime) {
        case ServiceLifetime.SINGLETON:
          return (await this.resolveSingleton(token, registration)) as T;

        case ServiceLifetime.SCOPED:
          return (await this.resolveScoped(token, registration)) as T;

        case ServiceLifetime.TRANSIENT:
          return (await this.resolveTransient(registration)) as T;

        default:
          throw new Error(
            `Unknown service lifetime: ${String(registration.lifetime)}`,
          );
      }
    } finally {
      this.resolutionStack.delete(token);
    }
  }

  /**
   * Try to resolve a service, returning undefined if not found
   */
  async tryResolve<T>(token: ServiceToken<T>): Promise<T | undefined> {
    try {
      return await this.resolve(token);
    } catch {
      return undefined;
    }
  }

  /**
   * Check if a service is registered
   */
  isRegistered<T>(token: ServiceToken<T>): boolean {
    return this.registrations.has(token);
  }

  /**
   * Unregister a service
   */
  unregister<T>(token: ServiceToken<T>): boolean {
    const removed = this.registrations.delete(token);
    this.singletons.delete(token);
    return removed;
  }

  /**
   * Create a new scope
   */
  createScope(id = `scope-${Date.now()}-${Math.random()}`): ContainerScope {
    const scope: ContainerScope = {
      id,
      parent: this.currentScope,
      services: new Map(),
    };
    return scope;
  }

  /**
   * Execute function within a scope
   */
  async withScope<T>(
    scope: ContainerScope,
    operation: (container: Container) => Promise<T>,
  ): Promise<T> {
    const previousScope = this.currentScope;
    this.currentScope = scope;

    try {
      return await operation(this);
    } finally {
      this.currentScope = previousScope;
      // Clean up scoped services
      scope.services.clear();
    }
  }

  /**
   * Get registration metadata
   */
  getRegistration<T>(
    token: ServiceToken<T>,
  ): ServiceRegistration<T> | undefined {
    return this.registrations.get(token) as ServiceRegistration<T> | undefined;
  }

  /**
   * Get all registered service tokens
   */
  getRegisteredTokens(): readonly ServiceToken[] {
    return Array.from(this.registrations.keys());
  }

  /**
   * Clear all registrations
   */
  clear(): void {
    this.registrations.clear();
    this.singletons.clear();
    this.resolutionStack.clear();
    this.currentScope = undefined;
  }

  /**
   * Get container statistics
   */
  getStatistics() {
    const lifetimes = new Map<ServiceLifetime, number>();

    for (const registration of this.registrations.values()) {
      const count = lifetimes.get(registration.lifetime) ?? 0;
      lifetimes.set(registration.lifetime, count + 1);
    }

    return {
      totalRegistrations: this.registrations.size,
      singletonInstances: this.singletons.size,
      lifetimeBreakdown: Object.fromEntries(lifetimes),
      currentScope: this.currentScope?.id,
      resolutionInProgress: this.resolutionStack.size > 0,
    };
  }

  // Private implementation methods

  private async resolveSingleton<T>(
    token: ServiceToken<T>,
    registration: ServiceRegistration<T>,
  ): Promise<T> {
    if (this.singletons.has(token)) {
      return this.singletons.get(token) as T;
    }

    const instance = await this.createInstance(registration);
    this.singletons.set(token, instance);
    return instance;
  }

  private async resolveScoped<T>(
    token: ServiceToken<T>,
    registration: ServiceRegistration<T>,
  ): Promise<T> {
    if (!this.currentScope) {
      throw new Error(
        `Cannot resolve scoped service '${String(token)}' without an active scope`,
      );
    }

    if (this.currentScope.services.has(token)) {
      return this.currentScope.services.get(token) as T;
    }

    const instance = await this.createInstance(registration);
    this.currentScope.services.set(token, instance);
    return instance;
  }

  private async resolveTransient<T>(
    registration: ServiceRegistration<T>,
  ): Promise<T> {
    return await this.createInstance(registration);
  }

  private async createInstance<T>(
    registration: ServiceRegistration<T>,
  ): Promise<T> {
    const { factory, dependencies = [] } = registration;

    if (typeof factory === "function" && factory.prototype) {
      // Constructor injection
      const Constructor = factory as ServiceConstructor<T>;
      const resolvedDependencies = await Promise.all(
        dependencies.map((dep) => this.resolve(dep)),
      );
      return new Constructor(...resolvedDependencies);
    } else {
      // Factory function
      const factoryFn = factory as ServiceFactory<T>;
      return await factoryFn(this);
    }
  }
}

/**
 * Default global container instance
 */
export const globalContainer = new Container();

/**
 * Container builder for fluent API
 */
export class ContainerBuilder {
  private container = new Container();

  /**
   * Register a service with the builder
   */
  register<T>(
    token: ServiceToken<T>,
    factory: ServiceFactory<T>,
    lifetime: ServiceLifetime = ServiceLifetime.TRANSIENT,
  ): this {
    this.container.register(token, factory, lifetime);
    return this;
  }

  /**
   * Register a singleton with the builder
   */
  registerSingleton<T>(
    token: ServiceToken<T>,
    factory: ServiceFactory<T> | ServiceConstructor<T>,
    dependencies?: readonly ServiceToken[],
  ): this {
    this.container.registerSingleton(token, factory, dependencies);
    return this;
  }

  /**
   * Register an instance with the builder
   */
  registerInstance<T>(token: ServiceToken<T>, instance: T): this {
    this.container.registerInstance(token, instance);
    return this;
  }

  /**
   * Build and return the container
   */
  build(): Container {
    return this.container;
  }
}

/**
 * Decorator for injectable services (experimental)
 */
export function Injectable<T>(token?: ServiceToken<T>) {
  return function <U extends new (...args: unknown[]) => T>(constructor: U) {
    const serviceToken = token ?? constructor;
    // Store metadata for reflection-based registration
    Reflect.defineMetadata("injectable:token", serviceToken, constructor);
    return constructor;
  };
}

/**
 * Decorator for injecting dependencies (experimental)
 */
export function Inject<T>(token: ServiceToken<T>) {
  return function (
    target: object,
    _propertyKey: string | symbol | undefined,
    parameterIndex: number,
  ) {
    const existingTokens = (Reflect.getMetadata("inject:tokens", target) ??
      []) as ServiceToken[];
    existingTokens[parameterIndex] = token;
    Reflect.defineMetadata("inject:tokens", existingTokens, target);
  };
}
