import { z } from "zod";
import { adminProcedure, createTRPCRouter } from "~/server/api/trpc";

export const permissionRouter = createTRPCRouter({
  // Get all permissions
  getAll: adminProcedure.query(async ({ ctx }) => {
    return ctx.db.permission.findMany({
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });
  }),

  // Permissions are immutable via app UI; modified only via seeding
  // Expose only read operations in this router
  getById: adminProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const permission = await ctx.db.permission.findUnique({
        where: { id: input.id },
        include: {
          roles: {
            include: {
              role: true,
            },
          },
        },
      });

      if (!permission) {
        throw new Error("Permission not found");
      }

      return permission;
    }),

  // Get permissions for a specific role
  getByRole: adminProcedure
    .input(z.object({ roleId: z.string() }))
    .query(async ({ ctx, input }) => {
      const rolePermissions = await ctx.db.rolePermission.findMany({
        where: { roleId: input.roleId },
        include: {
          permission: true,
        },
      });

      return rolePermissions.map((rp) => rp.permission);
    }),

  // Get roles that have a specific permission
  getRolesByPermission: adminProcedure
    .input(z.object({ permissionId: z.string() }))
    .query(async ({ ctx, input }) => {
      const permissionRoles = await ctx.db.rolePermission.findMany({
        where: { permissionId: input.permissionId },
        include: {
          role: true,
        },
      });

      return permissionRoles.map((pr) => pr.role);
    }),
});
