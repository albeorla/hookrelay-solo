import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  Container,
  ContainerBuilder,
  ServiceLifetime,
  ServiceToken,
  globalContainer,
  Injectable,
  Inject,
} from "../container";

// Test interfaces and classes
interface ITestService {
  getValue(): string;
}

interface IRepository {
  getData(): Promise<string>;
}

interface ILogger {
  log(message: string): void;
}

class TestService implements ITestService {
  constructor(private value: string = "test") {}
  getValue(): string {
    return this.value;
  }
}

class TestRepository implements IRepository {
  async getData(): Promise<string> {
    return "repository-data";
  }
}

class TestLogger implements ILogger {
  private logs: string[] = [];
  log(message: string): void {
    this.logs.push(message);
  }
  getLogs(): string[] {
    return [...this.logs];
  }
}

class ComplexService {
  constructor(
    private repository: IRepository,
    private logger: ILogger,
  ) {}

  async processData(): Promise<string> {
    const data = await this.repository.getData();
    this.logger.log(`Processing: ${data}`);
    return `processed-${data}`;
  }
}

// Service tokens
const SERVICE_TOKENS = {
  TEST_SERVICE: Symbol("TestService") as ServiceToken<ITestService>,
  REPOSITORY: Symbol("Repository") as ServiceToken<IRepository>,
  LOGGER: Symbol("Logger") as ServiceToken<ILogger>,
  COMPLEX_SERVICE: Symbol("ComplexService") as ServiceToken<ComplexService>,
  STRING_SERVICE: "StringService" as ServiceToken<string>,
};

describe("Container", () => {
  let container: Container;

  beforeEach(() => {
    container = new Container();
  });

  afterEach(() => {
    container.clear();
    vi.clearAllMocks();
  });

  describe("Service Registration", () => {
    it("should register a service factory", () => {
      const factory = () => new TestService("factory-test");

      container.register(SERVICE_TOKENS.TEST_SERVICE, factory);

      expect(container.isRegistered(SERVICE_TOKENS.TEST_SERVICE)).toBe(true);
    });

    it("should register a service constructor", () => {
      container.registerConstructor(
        SERVICE_TOKENS.TEST_SERVICE,
        TestService as any,
        [],
        ServiceLifetime.TRANSIENT,
      );

      expect(container.isRegistered(SERVICE_TOKENS.TEST_SERVICE)).toBe(true);
    });

    it("should register a singleton service", () => {
      const factory = () => new TestService("singleton");

      container.registerSingleton(SERVICE_TOKENS.TEST_SERVICE, factory);

      const registration = container.getRegistration(
        SERVICE_TOKENS.TEST_SERVICE,
      );
      expect(registration?.lifetime).toBe(ServiceLifetime.SINGLETON);
    });

    it("should register a transient service", () => {
      const factory = () => new TestService("transient");

      container.registerTransient(SERVICE_TOKENS.TEST_SERVICE, factory);

      const registration = container.getRegistration(
        SERVICE_TOKENS.TEST_SERVICE,
      );
      expect(registration?.lifetime).toBe(ServiceLifetime.TRANSIENT);
    });

    it("should register a scoped service", () => {
      const factory = () => new TestService("scoped");

      container.registerScoped(SERVICE_TOKENS.TEST_SERVICE, factory);

      const registration = container.getRegistration(
        SERVICE_TOKENS.TEST_SERVICE,
      );
      expect(registration?.lifetime).toBe(ServiceLifetime.SCOPED);
    });

    it("should register an instance", () => {
      const instance = new TestService("instance");

      container.registerInstance(SERVICE_TOKENS.TEST_SERVICE, instance);

      expect(container.isRegistered(SERVICE_TOKENS.TEST_SERVICE)).toBe(true);
    });

    it("should throw error when registering duplicate service", () => {
      const factory = () => new TestService();

      container.register(SERVICE_TOKENS.TEST_SERVICE, factory);

      expect(() => {
        container.register(SERVICE_TOKENS.TEST_SERVICE, factory);
      }).toThrow("Service 'Symbol(TestService)' is already registered");
    });

    it("should throw error when registering duplicate constructor", () => {
      container.registerConstructor(
        SERVICE_TOKENS.TEST_SERVICE,
        TestService as any,
      );

      expect(() => {
        container.registerConstructor(
          SERVICE_TOKENS.TEST_SERVICE,
          TestService as any,
        );
      }).toThrow("Service 'Symbol(TestService)' is already registered");
    });

    it("should handle string tokens", () => {
      const factory = () => "string-value";

      container.register(SERVICE_TOKENS.STRING_SERVICE, factory);

      expect(container.isRegistered(SERVICE_TOKENS.STRING_SERVICE)).toBe(true);
    });
  });

  describe("Service Resolution", () => {
    it("should resolve a transient service", async () => {
      let callCount = 0;
      const factory = () => {
        callCount++;
        return new TestService(`call-${callCount}`);
      };

      container.register(
        SERVICE_TOKENS.TEST_SERVICE,
        factory,
        ServiceLifetime.TRANSIENT,
      );

      const instance1 = await container.resolve(SERVICE_TOKENS.TEST_SERVICE);
      const instance2 = await container.resolve(SERVICE_TOKENS.TEST_SERVICE);

      expect(instance1.getValue()).toBe("call-1");
      expect(instance2.getValue()).toBe("call-2");
      expect(instance1).not.toBe(instance2);
    });

    it("should resolve a singleton service", async () => {
      let callCount = 0;
      const factory = () => {
        callCount++;
        return new TestService(`singleton-${callCount}`);
      };

      container.register(
        SERVICE_TOKENS.TEST_SERVICE,
        factory,
        ServiceLifetime.SINGLETON,
      );

      const instance1 = await container.resolve(SERVICE_TOKENS.TEST_SERVICE);
      const instance2 = await container.resolve(SERVICE_TOKENS.TEST_SERVICE);

      expect(instance1.getValue()).toBe("singleton-1");
      expect(instance2.getValue()).toBe("singleton-1");
      expect(instance1).toBe(instance2);
      expect(callCount).toBe(1);
    });

    it("should resolve a scoped service within scope", async () => {
      let callCount = 0;
      const factory = () => {
        callCount++;
        return new TestService(`scoped-${callCount}`);
      };

      container.register(
        SERVICE_TOKENS.TEST_SERVICE,
        factory,
        ServiceLifetime.SCOPED,
      );
      const scope = container.createScope("test-scope");

      const result = await container.withScope(scope, async (c) => {
        const instance1 = await c.resolve(SERVICE_TOKENS.TEST_SERVICE);
        const instance2 = await c.resolve(SERVICE_TOKENS.TEST_SERVICE);

        expect(instance1).toBe(instance2);
        expect(instance1.getValue()).toBe("scoped-1");
        return instance1;
      });

      expect(callCount).toBe(1);
      expect(result.getValue()).toBe("scoped-1");
    });

    it("should throw error when resolving scoped service without scope", async () => {
      const factory = () => new TestService("scoped");

      container.register(
        SERVICE_TOKENS.TEST_SERVICE,
        factory,
        ServiceLifetime.SCOPED,
      );

      await expect(
        container.resolve(SERVICE_TOKENS.TEST_SERVICE),
      ).rejects.toThrow(
        "Cannot resolve scoped service 'Symbol(TestService)' without an active scope",
      );
    });

    it("should resolve constructor with dependencies", async () => {
      container.registerSingleton(SERVICE_TOKENS.REPOSITORY, TestRepository);
      container.registerSingleton(SERVICE_TOKENS.LOGGER, TestLogger);

      container.registerConstructor(
        SERVICE_TOKENS.COMPLEX_SERVICE,
        ComplexService as any,
        [SERVICE_TOKENS.REPOSITORY, SERVICE_TOKENS.LOGGER],
      );

      const service = await container.resolve(SERVICE_TOKENS.COMPLEX_SERVICE);
      const result = await service.processData();

      expect(result).toBe("processed-repository-data");
    });

    it("should try resolve and return undefined for unregistered service", async () => {
      const result = await container.tryResolve(SERVICE_TOKENS.TEST_SERVICE);

      expect(result).toBeUndefined();
    });

    it("should throw error for unregistered service", async () => {
      await expect(
        container.resolve(SERVICE_TOKENS.TEST_SERVICE),
      ).rejects.toThrow("Service 'Symbol(TestService)' is not registered");
    });

    it("should detect circular dependencies", async () => {
      const TOKEN_A = "ServiceA" as ServiceToken<string>;
      const TOKEN_B = "ServiceB" as ServiceToken<string>;

      container.register(TOKEN_A, async (c) => {
        await c.resolve(TOKEN_B);
        return "A";
      });

      container.register(TOKEN_B, async (c) => {
        await c.resolve(TOKEN_A);
        return "B";
      });

      await expect(container.resolve(TOKEN_A)).rejects.toThrow(
        /Circular dependency detected/,
      );
    });

    it("should handle async factory functions", async () => {
      const asyncFactory = async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return new TestService("async");
      };

      container.register(SERVICE_TOKENS.TEST_SERVICE, asyncFactory);

      const instance = await container.resolve(SERVICE_TOKENS.TEST_SERVICE);

      expect(instance.getValue()).toBe("async");
    });
  });

  describe("Service Management", () => {
    it("should unregister a service", () => {
      const factory = () => new TestService();

      container.register(SERVICE_TOKENS.TEST_SERVICE, factory);
      expect(container.isRegistered(SERVICE_TOKENS.TEST_SERVICE)).toBe(true);

      const removed = container.unregister(SERVICE_TOKENS.TEST_SERVICE);

      expect(removed).toBe(true);
      expect(container.isRegistered(SERVICE_TOKENS.TEST_SERVICE)).toBe(false);
    });

    it("should return false when unregistering non-existent service", () => {
      const removed = container.unregister(SERVICE_TOKENS.TEST_SERVICE);

      expect(removed).toBe(false);
    });

    it("should get registration details", () => {
      const factory = () => new TestService();
      const metadata = { version: "1.0.0" };

      container.register(
        SERVICE_TOKENS.TEST_SERVICE,
        factory,
        ServiceLifetime.SINGLETON,
        metadata,
      );

      const registration = container.getRegistration(
        SERVICE_TOKENS.TEST_SERVICE,
      );

      expect(registration).toBeDefined();
      expect(registration?.lifetime).toBe(ServiceLifetime.SINGLETON);
      expect(registration?.metadata).toEqual(metadata);
    });

    it("should get all registered tokens", () => {
      container.register(SERVICE_TOKENS.TEST_SERVICE, () => new TestService());
      container.register(SERVICE_TOKENS.REPOSITORY, () => new TestRepository());

      const tokens = container.getRegisteredTokens();

      expect(tokens).toHaveLength(2);
      expect(tokens).toContain(SERVICE_TOKENS.TEST_SERVICE);
      expect(tokens).toContain(SERVICE_TOKENS.REPOSITORY);
    });

    it("should clear all registrations", () => {
      container.register(SERVICE_TOKENS.TEST_SERVICE, () => new TestService());
      container.registerSingleton(SERVICE_TOKENS.REPOSITORY, TestRepository);

      expect(container.getRegisteredTokens()).toHaveLength(2);

      container.clear();

      expect(container.getRegisteredTokens()).toHaveLength(0);
      expect(container.isRegistered(SERVICE_TOKENS.TEST_SERVICE)).toBe(false);
    });

    it("should get container statistics", () => {
      container.registerSingleton(
        SERVICE_TOKENS.TEST_SERVICE,
        TestService as any,
      );
      container.registerTransient(SERVICE_TOKENS.REPOSITORY, TestRepository);
      container.registerScoped(SERVICE_TOKENS.LOGGER, TestLogger);

      const stats = container.getStatistics();

      expect(stats.totalRegistrations).toBe(3);
      expect(stats.lifetimeBreakdown).toEqual({
        singleton: 1,
        transient: 1,
        scoped: 1,
      });
      expect(stats.resolutionInProgress).toBe(false);
    });
  });

  describe("Scoping", () => {
    it("should create a scope with unique id", () => {
      const scope1 = container.createScope();
      const scope2 = container.createScope();

      expect(scope1.id).toBeDefined();
      expect(scope2.id).toBeDefined();
      expect(scope1.id).not.toBe(scope2.id);
    });

    it("should create a scope with custom id", () => {
      const scope = container.createScope("custom-scope");

      expect(scope.id).toBe("custom-scope");
    });

    it("should execute operation within scope", async () => {
      const factory = () => new TestService("scoped");
      container.register(
        SERVICE_TOKENS.TEST_SERVICE,
        factory,
        ServiceLifetime.SCOPED,
      );

      const scope = container.createScope("test-scope");
      const result = await container.withScope(scope, async (c) => {
        const service = await c.resolve(SERVICE_TOKENS.TEST_SERVICE);
        return service.getValue();
      });

      expect(result).toBe("scoped");
    });

    it("should clean up scoped services after scope execution", async () => {
      const factory = () => new TestService("scoped");
      container.register(
        SERVICE_TOKENS.TEST_SERVICE,
        factory,
        ServiceLifetime.SCOPED,
      );

      const scope = container.createScope("test-scope");

      await container.withScope(scope, async (c) => {
        await c.resolve(SERVICE_TOKENS.TEST_SERVICE);
      });

      // After scope execution, services map should be cleared
      expect(scope.services.size).toBe(0);
    });

    it("should restore previous scope after execution", async () => {
      const factory = () => new TestService("scoped");
      container.register(
        SERVICE_TOKENS.TEST_SERVICE,
        factory,
        ServiceLifetime.SCOPED,
      );

      const outerScope = container.createScope("outer");
      const innerScope = container.createScope("inner");

      const result = await container.withScope(outerScope, async () => {
        return await container.withScope(innerScope, async () => {
          const stats = container.getStatistics();
          return stats.currentScope;
        });
      });

      expect(result).toBe("inner");

      // After nested execution, no scope should be active
      const finalStats = container.getStatistics();
      expect(finalStats.currentScope).toBeUndefined();
    });
  });

  describe("Edge Cases", () => {
    it("should handle unknown service lifetime", async () => {
      const factory = () => new TestService();
      // Manually set an invalid lifetime
      (container as any).registrations.set(SERVICE_TOKENS.TEST_SERVICE, {
        lifetime: "invalid" as ServiceLifetime,
        factory,
      });

      await expect(
        container.resolve(SERVICE_TOKENS.TEST_SERVICE),
      ).rejects.toThrow("Unknown service lifetime: invalid");
    });

    it("should handle factory that returns a promise", async () => {
      const factory = async () => Promise.resolve(new TestService("promise"));

      container.register(SERVICE_TOKENS.TEST_SERVICE, factory);

      const instance = await container.resolve(SERVICE_TOKENS.TEST_SERVICE);

      expect(instance.getValue()).toBe("promise");
    });

    it("should handle constructor with no dependencies", async () => {
      container.registerConstructor(
        SERVICE_TOKENS.TEST_SERVICE,
        TestService as any,
      );

      const instance = await container.resolve(SERVICE_TOKENS.TEST_SERVICE);

      expect(instance.getValue()).toBe("test");
    });

    it("should differentiate between constructor and factory based on prototype", async () => {
      // Function with prototype (constructor)
      const ConstructorFunc = function (this: any) {
        this.value = "constructor";
      } as any;
      ConstructorFunc.prototype = {};

      // Function without prototype (factory)
      const factoryFunc = () => ({ value: "factory" });

      container.registerSingleton(
        "constructor-token" as ServiceToken,
        ConstructorFunc,
      );
      container.registerSingleton("factory-token" as ServiceToken, factoryFunc);

      const constructorResult = await container.resolve(
        "constructor-token" as ServiceToken,
      );
      const factoryResult = await container.resolve(
        "factory-token" as ServiceToken,
      );

      expect((constructorResult as any).value).toBe("constructor");
      expect((factoryResult as any).value).toBe("factory");
    });
  });
});

describe("ContainerBuilder", () => {
  let builder: ContainerBuilder;

  beforeEach(() => {
    builder = new ContainerBuilder();
  });

  it("should build container with registered services", async () => {
    const testService = new TestService("builder");

    builder
      .register(SERVICE_TOKENS.TEST_SERVICE, () => testService)
      .registerInstance(SERVICE_TOKENS.STRING_SERVICE, "builder-string")
      .registerSingleton(SERVICE_TOKENS.REPOSITORY, TestRepository);

    const container = builder.build();

    const service = await container.resolve(SERVICE_TOKENS.TEST_SERVICE);
    const stringService = await container.resolve(
      SERVICE_TOKENS.STRING_SERVICE,
    );
    const repository = await container.resolve(SERVICE_TOKENS.REPOSITORY);

    expect(service).toBe(testService);
    expect(stringService).toBe("builder-string");
    expect(repository).toBeInstanceOf(TestRepository);
  });

  it("should support method chaining", () => {
    const result = builder
      .register(SERVICE_TOKENS.TEST_SERVICE, () => new TestService())
      .registerSingleton(SERVICE_TOKENS.REPOSITORY, TestRepository)
      .registerInstance(SERVICE_TOKENS.STRING_SERVICE, "test");

    expect(result).toBe(builder);
  });
});

describe("Global Container", () => {
  afterEach(() => {
    globalContainer.clear();
  });

  it("should provide a global container instance", () => {
    expect(globalContainer).toBeInstanceOf(Container);
  });

  it("should maintain state across uses", async () => {
    globalContainer.registerInstance(
      SERVICE_TOKENS.STRING_SERVICE,
      "global-test",
    );

    const value = await globalContainer.resolve(SERVICE_TOKENS.STRING_SERVICE);

    expect(value).toBe("global-test");
  });
});

describe("Decorators", () => {
  it("should define injectable metadata", () => {
    @Injectable(SERVICE_TOKENS.TEST_SERVICE)
    class DecoratedService implements ITestService {
      getValue(): string {
        return "decorated";
      }
    }

    const token = Reflect.getMetadata("injectable:token", DecoratedService);

    expect(token).toBe(SERVICE_TOKENS.TEST_SERVICE);
  });

  it("should define inject metadata", () => {
    // Test the Inject decorator functionality by manually calling it
    class ServiceWithDependencies {}

    // Simulate what the decorator would do
    Inject(SERVICE_TOKENS.REPOSITORY)(ServiceWithDependencies, undefined, 0);
    Inject(SERVICE_TOKENS.LOGGER)(ServiceWithDependencies, undefined, 1);

    const tokens = Reflect.getMetadata(
      "inject:tokens",
      ServiceWithDependencies,
    ) as ServiceToken[];

    expect(tokens).toBeDefined();
    expect(tokens[0]).toBe(SERVICE_TOKENS.REPOSITORY);
    expect(tokens[1]).toBe(SERVICE_TOKENS.LOGGER);
  });

  it("should use constructor as default token when no token provided", () => {
    @Injectable()
    class AutoTokenService implements ITestService {
      getValue(): string {
        return "auto-token";
      }
    }

    const token = Reflect.getMetadata("injectable:token", AutoTokenService);

    expect(token).toBe(AutoTokenService);
  });
});
