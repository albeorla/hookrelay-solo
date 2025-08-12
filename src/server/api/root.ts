import { userRouter } from "~/server/api/routers/user";
import { roleRouter } from "~/server/api/routers/role";
import { permissionRouter } from "~/server/api/routers/permission";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

/**
 * Static routers - manually added routers from /api/routers
 */
const staticRouters = {
  user: userRouter,
  role: roleRouter,
  permission: permissionRouter,
};

/**
 * Create module integration for dynamic router loading
 */
// const moduleIntegration = createModuleTRPCIntegration();

/**
 * This is the primary router for your server.
 *
 * It combines:
 * 1. Static routers (manually added in /api/routers)
 * 2. Dynamic module routers (automatically loaded from running modules)
 */
export const appRouter = createTRPCRouter({
  ...staticRouters,
  // Module routers will be available under the 'modules' namespace
  // Example: trpc.modules.billing.createSubscription.mutate()
  modules: createTRPCRouter({}), // Empty initially, populated by module system
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.user.all();
 *       ^? User[]
 */
export const createCaller = createCallerFactory(appRouter);
