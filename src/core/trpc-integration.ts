/**
 * tRPC Integration for Module System
 *
 * This file provides integration between the module system and the existing
 * T3 Stack tRPC setup, allowing modules to register their routers and
 * procedures while maintaining type safety.
 */

import type { AnyTRPCRouter } from "@trpc/server";
import type { ModuleEventType, ModuleEvent } from "./types";
import { ModuleRegistry } from "./module-registry";
import { createTRPCRouter } from "~/server/api/trpc";

/**
 * Module Router Integration Service
 *
 * Handles dynamic registration of module routers with the main tRPC router.
 * This service maintains the existing T3 Stack patterns while enabling
 * modules to contribute their own API endpoints.
 */
export class ModuleTRPCIntegration {
  private readonly registry: ModuleRegistry;
  private cachedModuleRouter?: AnyTRPCRouter;
  private lastRegistryHash?: string;

  constructor(registry: ModuleRegistry) {
    this.registry = registry;

    // Listen for module events to invalidate cache
    this.registry.subscribe("module:started" as ModuleEventType, {
      eventType: "module:started" as ModuleEventType,
      priority: 0,
      handle: async (_event: ModuleEvent) => {
        this.invalidateCache();
      },
    });

    this.registry.subscribe("module:stopped" as ModuleEventType, {
      eventType: "module:stopped" as ModuleEventType,
      priority: 0,
      handle: async (_event: ModuleEvent) => {
        this.invalidateCache();
      },
    });
  }

  /**
   * Get combined router for all running modules
   *
   * This method creates a tRPC router that includes all routers from
   * running modules. The result is cached and only regenerated when
   * modules are started or stopped.
   *
   * @returns Combined tRPC router
   */
  async getModuleRouter(): Promise<AnyTRPCRouter> {
    const currentHash = this.getRegistryHash();

    if (this.cachedModuleRouter && this.lastRegistryHash === currentHash) {
      return this.cachedModuleRouter;
    }

    const moduleRouters: Record<string, AnyTRPCRouter> = {};
    const runningModules = this.registry.getRunningModules();

    // Collect routers from all running modules
    for (const [moduleName, entry] of runningModules) {
      if (entry.instance) {
        try {
          const routers = await entry.instance.getRouters();

          // Add each router with module namespace
          for (const [routerName, router] of Object.entries(routers)) {
            const fullName =
              routerName === "default"
                ? moduleName
                : `${moduleName}_${routerName}`;

            moduleRouters[fullName] = router;
          }
        } catch (error) {
          console.error(
            `Error getting routers for module ${moduleName}:`,
            error,
          );
        }
      }
    }

    // Create combined router
    this.cachedModuleRouter = createTRPCRouter(moduleRouters);
    this.lastRegistryHash = currentHash;

    return this.cachedModuleRouter;
  }

  /**
   * Get router for a specific module
   *
   * @param moduleName Name of the module
   * @returns Module's routers or undefined if module not found
   */
  async getModuleRouters(
    moduleName: string,
  ): Promise<Record<string, AnyTRPCRouter> | undefined> {
    const moduleInstance = this.registry.getModule(moduleName);
    if (!moduleInstance) return undefined;

    try {
      return await moduleInstance.getRouters();
    } catch (error) {
      console.error(`Error getting routers for module ${moduleName}:`, error);
      return undefined;
    }
  }

  /**
   * Check if a module has any routers
   *
   * @param moduleName Name of the module
   * @returns True if module has routers
   */
  async hasModuleRouters(moduleName: string): Promise<boolean> {
    const routers = await this.getModuleRouters(moduleName);
    return routers !== undefined && Object.keys(routers).length > 0;
  }

  /**
   * Get list of all available module endpoints
   *
   * Returns a map of module names to their available endpoints.
   * Useful for documentation and debugging.
   *
   * @returns Map of module names to endpoint lists
   */
  async getModuleEndpoints(): Promise<Map<string, string[]>> {
    const endpoints = new Map<string, string[]>();
    const runningModules = this.registry.getRunningModules();

    for (const [moduleName, entry] of runningModules) {
      if (entry.instance) {
        try {
          const routers = await entry.instance.getRouters();
          const moduleEndpoints: string[] = [];

          for (const [routerName] of Object.entries(routers)) {
            // Extract procedure names from router (simplified)
            // In a full implementation, this would introspect the router structure
            const fullName =
              routerName === "default"
                ? moduleName
                : `${moduleName}_${routerName}`;
            moduleEndpoints.push(fullName);
          }

          endpoints.set(moduleName, moduleEndpoints);
        } catch (error) {
          console.error(
            `Error getting endpoints for module ${moduleName}:`,
            error,
          );
          endpoints.set(moduleName, []);
        }
      }
    }

    return endpoints;
  }

  /**
   * Invalidate router cache
   *
   * Forces regeneration of the combined module router on next access.
   * Called automatically when modules start/stop.
   */
  invalidateCache(): void {
    this.cachedModuleRouter = undefined;
    this.lastRegistryHash = undefined;
  }

  /**
   * Get diagnostic information for debugging
   */
  getDiagnostics() {
    return {
      hasCachedRouter: !!this.cachedModuleRouter,
      lastRegistryHash: this.lastRegistryHash,
      registryHash: this.getRegistryHash(),
      runningModuleCount: this.registry.getRunningModules().size,
    };
  }

  // Private helper methods

  private getRegistryHash(): string {
    // Create a simple hash of running modules
    const runningModules = Array.from(
      this.registry.getRunningModules().keys(),
    ).sort();
    return runningModules.join(",");
  }
}

/**
 * Create a pre-configured tRPC integration instance
 *
 * This function creates an integration instance using the singleton
 * module registry. Use this in your application setup.
 *
 * @returns Configured tRPC integration instance
 */
export function createModuleTRPCIntegration(): ModuleTRPCIntegration {
  const registry = ModuleRegistry.getInstance();
  return new ModuleTRPCIntegration(registry);
}

/**
 * Utility function to merge static and dynamic routers
 *
 * This helper function combines the existing static routers with
 * dynamic module routers, maintaining type safety where possible.
 *
 * @param staticRouters Existing static routers
 * @param moduleRouter Dynamic module router
 * @returns Combined router
 */
export function mergeRouters(
  staticRouters: Record<string, AnyTRPCRouter>,
  moduleRouter: AnyTRPCRouter,
): AnyTRPCRouter {
  return createTRPCRouter({
    ...staticRouters,
    modules: moduleRouter,
  });
}

/**
 * Type-safe module router access helper
 *
 * Provides type-safe access to module routers from the client side.
 * This is useful for maintaining IntelliSense and type checking.
 */
export type ModuleRouterAccess<T extends Record<string, AnyTRPCRouter>> = {
  modules: T;
};

/**
 * Router registration helper for modules
 *
 * Utility function to help modules create their router objects
 * in a consistent way.
 */
export function createModuleRouters<T extends Record<string, AnyTRPCRouter>>(
  routers: T,
): T {
  return routers;
}
