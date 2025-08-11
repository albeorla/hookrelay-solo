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

  // Get permission by ID
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

  // Create new permission
  create: adminProcedure
    .input(
      z.object({
        name: z.string().min(1, "Permission name is required"),
        description: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Check if permission with same name already exists
      const existingPermission = await ctx.db.permission.findUnique({
        where: { name: input.name },
      });

      if (existingPermission) {
        throw new Error("Permission with this name already exists");
      }

      return ctx.db.permission.create({
        data: {
          name: input.name,
          description: input.description,
        },
        include: {
          roles: {
            include: {
              role: true,
            },
          },
        },
      });
    }),

  // Update permission
  update: adminProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1, "Permission name is required"),
        description: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Check if permission exists
      const existingPermission = await ctx.db.permission.findUnique({
        where: { id: input.id },
      });

      if (!existingPermission) {
        throw new Error("Permission not found");
      }

      // Check if new name conflicts with another permission
      const conflictingPermission = await ctx.db.permission.findFirst({
        where: {
          name: input.name,
          id: { not: input.id },
        },
      });

      if (conflictingPermission) {
        throw new Error("Permission with this name already exists");
      }

      return ctx.db.permission.update({
        where: { id: input.id },
        data: {
          name: input.name,
          description: input.description,
        },
        include: {
          roles: {
            include: {
              role: true,
            },
          },
        },
      });
    }),

  // Delete permission
  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Check if permission exists
      const permission = await ctx.db.permission.findUnique({
        where: { id: input.id },
        include: {
          roles: true,
        },
      });

      if (!permission) {
        throw new Error("Permission not found");
      }

      // Check if permission is assigned to any roles
      if (permission.roles.length > 0) {
        throw new Error(
          "Cannot delete permission that is assigned to roles. Remove all role assignments first.",
        );
      }

      return ctx.db.permission.delete({
        where: { id: input.id },
      });
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
