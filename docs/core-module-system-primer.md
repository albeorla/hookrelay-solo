# Core Module System Primer

The `src/core` folder implements an enterprise-grade **modular platform foundation** that transforms the T3 Stack application into a composable startup platform. It follows SOLID principles and GoF Design Patterns to enable seamless addition of business modules like billing, email, analytics, etc.

## Architecture Overview

The system implements several key design patterns:

**🏗️ Strategy Pattern** - Each module implements `ModuleStrategy` interface  
**🏭 Factory Pattern** - `ModuleFactory` creates module instances  
**🔄 Singleton Pattern** - `ModuleRegistry` manages all modules centrally  
**👁️ Observer Pattern** - `EventBus` enables inter-module communication  
**🔗 Chain of Responsibility** - `MiddlewareChain` processes requests  
**💉 Dependency Injection** - `Container` manages service dependencies  

## Core Components

### Module Registry (`module-registry.ts`)
- **Central hub** managing all module lifecycle (install → configure → start → stop → uninstall)
- **Singleton instance** coordinates module dependencies and startup order
- **Event publishing** broadcasts module state changes
- **Health monitoring** tracks module performance and availability

### Module Strategy (`module-strategy.ts`)  
- **Interface contract** all modules must implement
- **Base class** provides common lifecycle management
- **Abstract methods** enforce implementation of routers, middleware, migrations

### Integration Framework
- **Container** (`container.ts`): Dependency injection with singleton/transient/scoped lifetimes
- **Event Bus** (`event-bus.ts`): Type-safe async pub/sub for loose coupling  
- **Middleware Chain** (`middleware-chain.ts`): Request processing pipeline
- **Security Manager** (`security.ts`): Authorization and rate limiting

## Integration with T3 Stack

The module system seamlessly integrates with the existing T3 architecture:

### 1. **tRPC Integration** (`trpc-integration.ts`)
- Modules expose `getRouters()` returning tRPC router objects
- Routes automatically mounted in main application router
- Type safety preserved across module boundaries

### 2. **Database Integration**
- Modules provide migrations through `getMigrations()`
- Prisma schema extensions managed per module
- Transaction support across module boundaries

### 3. **Next.js Middleware**
- Modules expose middleware via `getMiddleware()`  
- Executed in priority order during request processing
- Access to Next.js request/response objects

### 4. **Authentication & RBAC**
- Modules declare required permissions in config
- Existing NextAuth.js session available in module context
- Role-based access control enforced per module

## Module Lifecycle

```typescript
// 1. Register module type
registry.registerModuleType("billing", BillingModule, "1.0.0");

// 2. Install module
await registry.installModule(billingConfig);

// 3. Configure with settings  
await registry.configureModule("billing", billingSettings);

// 4. Start module
await registry.startModule("billing");

// Module is now running and integrated
```

## Example Module Structure

```typescript
export class BillingModule extends BaseModuleStrategy {
  async getRouters() {
    return {
      billing: billingRouter, // Auto-mounted at /api/trpc/billing
    };
  }

  async getMiddleware() {
    return [subscriptionCheckMiddleware];
  }

  async getEventHandlers() {
    return [
      {
        eventType: "user.created",
        handler: async (event) => {
          // Create billing profile for new user
        },
      },
    ];
  }
}
```

## Key Benefits

1. **Incremental Expansion**: Add modules (billing, email, analytics) without touching core code
2. **SOLID Compliance**: Clean separation of concerns, dependency inversion  
3. **Type Safety**: Full TypeScript support across module boundaries
4. **Loose Coupling**: Event-driven communication between modules
5. **Enterprise Ready**: Health monitoring, metrics, graceful shutdown
6. **T3 Native**: Leverages existing tRPC, Prisma, NextAuth.js infrastructure

This creates a **composable startup platform** where teams can rapidly bootstrap enterprise-grade SaaS applications by selecting and configuring the modules they need, rather than rebuilding common infrastructure.

## File Structure Overview

```
src/core/
├── types.ts                 # Core type definitions and interfaces
├── module-registry.ts       # Singleton registry for module management  
├── module-strategy.ts       # Strategy pattern interface and base class
├── module-factory.ts        # Factory pattern for module creation
├── lifecycle-manager.ts     # Module lifecycle coordination
├── health-monitor.ts        # Health checking and monitoring
├── trpc-integration.ts      # tRPC router integration
├── container.ts             # Dependency injection container
├── event-bus.ts             # Observer pattern event system
├── middleware-chain.ts      # Chain of responsibility middleware
├── security.ts              # Security boundaries and access control
└── index.ts                 # Main exports and initialization
```

## Integration Points

### With Existing T3 Stack
- **`src/server/api/root.ts`**: Module routers merged into main tRPC router
- **`src/app/api/auth/[...nextauth]/route.ts`**: Module permissions integrated with NextAuth
- **`prisma/schema.prisma`**: Module migrations extend database schema
- **`src/middleware.ts`**: Module middleware added to Next.js request pipeline

### With Future Modules  
- **`src/modules/billing/`**: Stripe integration with subscription management
- **`src/modules/email/`**: Transactional email with template system
- **`src/modules/analytics/`**: Event tracking with privacy compliance
- **`src/modules/storage/`**: File upload with multiple provider support

The core system provides the foundation for these future modules while maintaining loose coupling and high cohesion.