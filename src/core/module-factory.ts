/**
 * Module Factory Implementation
 *
 * This file implements the Factory pattern for creating module instances.
 * The factory handles dependency resolution, validation, and instantiation
 * of modules while maintaining loose coupling between the registry and
 * concrete module implementations.
 */

import type {
  ModuleConfig,
  ModuleInstance,
  ModuleDependencyError,
  ModuleConfigurationError,
  ModuleError,
} from "./types";
import type { ModuleStrategy } from "./module-strategy";

/**
 * Module constructor interface for factory instantiation
 */
export type ModuleConstructor = new (config: ModuleConfig) => ModuleStrategy;

/**
 * Module factory registration entry
 */
interface ModuleFactoryEntry {
  readonly name: string;
  readonly constructor: ModuleConstructor;
  readonly registeredAt: Date;
  readonly version: string;
}

/**
 * Dependency graph node for topological sorting
 */
interface DependencyNode {
  readonly name: string;
  readonly dependencies: readonly string[];
  visited: boolean;
  inStack: boolean;
}

/**
 * Module Factory - implements Factory pattern for module creation
 *
 * The factory is responsible for:
 * - Registering module constructors
 * - Validating module configurations
 * - Resolving dependencies
 * - Creating module instances
 * - Managing module versions
 */
export class ModuleFactory {
  private readonly registeredModules = new Map<string, ModuleFactoryEntry>();
  private readonly instantiatedModules = new Map<string, ModuleInstance>();

  /**
   * Register a module constructor with the factory
   *
   * @param name Unique module name
   * @param constructor Module constructor function
   * @param version Module version
   */
  registerModule(
    name: string,
    constructor: ModuleConstructor,
    version: string,
  ): void {
    if (this.registeredModules.has(name)) {
      throw new ModuleError(
        `Module '${name}' is already registered`,
        name,
        "ALREADY_REGISTERED",
      );
    }

    this.registeredModules.set(name, {
      name,
      constructor,
      version,
      registeredAt: new Date(),
    });
  }

  /**
   * Unregister a module constructor
   *
   * @param name Module name to unregister
   */
  unregisterModule(name: string): void {
    this.registeredModules.delete(name);
    this.instantiatedModules.delete(name);
  }

  /**
   * Check if a module is registered
   *
   * @param name Module name
   * @returns True if registered
   */
  isRegistered(name: string): boolean {
    return this.registeredModules.has(name);
  }

  /**
   * Get all registered module names
   *
   * @returns Array of registered module names
   */
  getRegisteredModules(): readonly string[] {
    return Array.from(this.registeredModules.keys());
  }

  /**
   * Create a module instance with dependency resolution
   *
   * This method:
   * 1. Validates the module configuration
   * 2. Checks that all dependencies are available
   * 3. Resolves dependencies in topological order
   * 4. Creates the module instance
   * 5. Caches the instance for reuse
   *
   * @param config Module configuration
   * @returns Created module instance
   * @throws ModuleDependencyError if dependencies cannot be resolved
   * @throws ModuleConfigurationError if configuration is invalid
   */
  async createModule(config: ModuleConfig): Promise<ModuleInstance> {
    // Check if already instantiated
    if (this.instantiatedModules.has(config.name)) {
      return this.instantiatedModules.get(config.name)!;
    }

    // Validate configuration
    this.validateConfig(config);

    // Check if module is registered
    const factoryEntry = this.registeredModules.get(config.name);
    if (!factoryEntry) {
      throw new ModuleError(
        `Module '${config.name}' is not registered with the factory`,
        config.name,
        "NOT_REGISTERED",
      );
    }

    // Validate version compatibility
    this.validateVersion(config, factoryEntry);

    // Resolve dependencies
    await this.resolveDependencies(config);

    // Create instance
    const instance = new factoryEntry.constructor(config);

    // Cache instance
    this.instantiatedModules.set(config.name, instance);

    return instance;
  }

  /**
   * Create multiple modules with dependency resolution
   *
   * Creates modules in topological order to ensure dependencies
   * are available when needed.
   *
   * @param configs Array of module configurations
   * @returns Map of module name to instance
   */
  async createModules(
    configs: readonly ModuleConfig[],
  ): Promise<Map<string, ModuleInstance>> {
    // Sort configurations by dependencies
    const sortedConfigs = this.topologicalSort(configs);

    const instances = new Map<string, ModuleInstance>();

    for (const config of sortedConfigs) {
      const instance = await this.createModule(config);
      instances.set(config.name, instance);
    }

    return instances;
  }

  /**
   * Get an existing module instance
   *
   * @param name Module name
   * @returns Module instance or undefined if not found
   */
  getInstance(name: string): ModuleInstance | undefined {
    return this.instantiatedModules.get(name);
  }

  /**
   * Remove a module instance from cache
   *
   * @param name Module name
   */
  removeInstance(name: string): void {
    this.instantiatedModules.delete(name);
  }

  /**
   * Clear all cached instances
   */
  clearInstances(): void {
    this.instantiatedModules.clear();
  }

  /**
   * Validate module configuration
   *
   * @param config Module configuration to validate
   * @throws ModuleConfigurationError if configuration is invalid
   */
  private validateConfig(config: ModuleConfig): void {
    const errors: string[] = [];

    // Required fields
    if (!config.name?.trim()) {
      errors.push("Module name is required");
    }

    if (!config.version?.trim()) {
      errors.push("Module version is required");
    }

    if (!config.description?.trim()) {
      errors.push("Module description is required");
    }

    // Version format (semantic versioning)
    if (config.version && !/^\d+\.\d+\.\d+(-[\w.-]+)?$/.test(config.version)) {
      errors.push(
        "Module version must follow semantic versioning (e.g., 1.0.0)",
      );
    }

    // Dependencies validation
    if (config.dependencies.includes(config.name)) {
      errors.push("Module cannot depend on itself");
    }

    // Check for duplicate dependencies
    const uniqueDeps = new Set(config.dependencies);
    if (uniqueDeps.size !== config.dependencies.length) {
      errors.push("Module has duplicate dependencies");
    }

    // Validate settings object
    if (config.settings && typeof config.settings !== "object") {
      errors.push("Module settings must be an object");
    }

    if (errors.length > 0) {
      throw new ModuleConfigurationError(
        config.name || "unknown",
        errors.join(", "),
      );
    }
  }

  /**
   * Validate version compatibility
   *
   * @param config Module configuration
   * @param factoryEntry Factory entry for the module
   * @throws ModuleError if versions are incompatible
   */
  private validateVersion(
    config: ModuleConfig,
    factoryEntry: ModuleFactoryEntry,
  ): void {
    // For now, require exact version match
    // In the future, this could implement semantic version compatibility
    if (config.version !== factoryEntry.version) {
      throw new ModuleError(
        `Module '${config.name}' version mismatch: expected ${factoryEntry.version}, got ${config.version}`,
        config.name,
        "VERSION_MISMATCH",
      );
    }
  }

  /**
   * Resolve module dependencies
   *
   * Checks that all required dependencies are available and can be created.
   *
   * @param config Module configuration
   * @throws ModuleDependencyError if dependencies cannot be resolved
   */
  private async resolveDependencies(config: ModuleConfig): Promise<void> {
    for (const depName of config.dependencies) {
      // Check if dependency is registered
      if (!this.registeredModules.has(depName)) {
        throw new ModuleDependencyError(config.name, depName);
      }

      // Check if dependency is already instantiated
      if (!this.instantiatedModules.has(depName)) {
        throw new ModuleDependencyError(
          config.name,
          `${depName} (not yet instantiated)`,
        );
      }
    }
  }

  /**
   * Perform topological sort of module configurations based on dependencies
   *
   * Uses Kahn's algorithm to detect circular dependencies and determine
   * the correct order for module instantiation.
   *
   * @param configs Module configurations to sort
   * @returns Configurations sorted in dependency order
   * @throws ModuleDependencyError if circular dependencies are detected
   */
  private topologicalSort(
    configs: readonly ModuleConfig[],
  ): readonly ModuleConfig[] {
    // Create dependency graph
    const nodes = new Map<string, DependencyNode>();
    const configMap = new Map<string, ModuleConfig>();

    // Initialize nodes
    for (const config of configs) {
      nodes.set(config.name, {
        name: config.name,
        dependencies: config.dependencies,
        visited: false,
        inStack: false,
      });
      configMap.set(config.name, config);
    }

    // Check for circular dependencies using DFS
    const result: string[] = [];
    const stack: string[] = [];

    const visit = (nodeName: string): void => {
      const node = nodes.get(nodeName);
      if (!node) return;

      if (node.inStack) {
        throw new ModuleDependencyError(
          nodeName,
          `Circular dependency detected: ${stack.join(" -> ")} -> ${nodeName}`,
        );
      }

      if (node.visited) return;

      node.visited = true;
      node.inStack = true;
      stack.push(nodeName);

      // Visit dependencies first
      for (const depName of node.dependencies) {
        visit(depName);
      }

      stack.pop();
      node.inStack = false;
      result.push(nodeName);
    };

    // Visit all nodes
    for (const [nodeName] of nodes) {
      visit(nodeName);
    }

    // Return configurations in dependency order
    return result.map((name) => configMap.get(name)!);
  }

  /**
   * Get factory statistics for monitoring
   */
  getStatistics() {
    return {
      registeredModules: this.registeredModules.size,
      instantiatedModules: this.instantiatedModules.size,
      modules: Array.from(this.registeredModules.values()).map((entry) => ({
        name: entry.name,
        version: entry.version,
        registeredAt: entry.registeredAt,
        instantiated: this.instantiatedModules.has(entry.name),
      })),
    };
  }
}
