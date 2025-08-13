import { z } from "zod";
import { adminProcedure, createTRPCRouter } from "~/server/api/trpc";

export const roleRouter = createTRPCRouter({
  // Get all roles
  getAll: adminProcedure.query(async ({ ctx }) => {
    return ctx.db.role.findMany({
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
        users: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });
  }),

  // Get role by ID
  getById: adminProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const role = await ctx.db.role.findUnique({
        where: { id: input.id },
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
          users: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
      });

      if (!role) {
        throw new Error("Role not found");
      }

      return role;
    }),

  // Create new role
  create: adminProcedure
    .input(
      z.object({
        name: z.string().min(1, "Role name is required"),
        description: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Check if role with same name already exists
      const existingRole = await ctx.db.role.findUnique({
        where: { name: input.name },
      });

      if (existingRole) {
        throw new Error("Role with this name already exists");
      }

      return ctx.db.role.create({
        data: {
          name: input.name,
          description: input.description,
        },
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
        },
      });
    }),

  // Update role
  update: adminProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1, "Role name is required"),
        description: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Check if role exists
      const existingRole = await ctx.db.role.findUnique({
        where: { id: input.id },
      });

      if (!existingRole) {
        throw new Error("Role not found");
      }

      // Prevent editing system roles
      if (existingRole.name === "ADMIN" || existingRole.name === "USER") {
        throw new Error("Cannot edit system roles");
      }

      // Check if new name conflicts with another role
      const conflictingRole = await ctx.db.role.findFirst({
        where: {
          name: input.name,
          id: { not: input.id },
        },
      });

      if (conflictingRole) {
        throw new Error("Role with this name already exists");
      }

      return ctx.db.role.update({
        where: { id: input.id },
        data: {
          name: input.name,
          description: input.description,
        },
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
        },
      });
    }),

  // Delete role
  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Check if role exists
      const role = await ctx.db.role.findUnique({
        where: { id: input.id },
        include: {
          users: true,
        },
      });

      if (!role) {
        throw new Error("Role not found");
      }

      // Prevent deletion of system roles
      if (role.name === "ADMIN" || role.name === "USER") {
        throw new Error("Cannot delete system roles");
      }

      // Check if role is assigned to any users
      if (role.users.length > 0) {
        throw new Error(
          "Cannot delete role that is assigned to users. Remove all user assignments first.",
        );
      }

      return ctx.db.role.delete({
        where: { id: input.id },
      });
    }),

  // Assign permission to role
  assignPermission: adminProcedure
    .input(
      z.object({
        roleId: z.string(),
        permissionId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Check if role and permission exist
      const [role, permission] = await Promise.all([
        ctx.db.role.findUnique({ where: { id: input.roleId } }),
        ctx.db.permission.findUnique({ where: { id: input.permissionId } }),
      ]);

      if (!role) {
        throw new Error("Role not found");
      }

      if (!permission) {
        throw new Error("Permission not found");
      }

      // Check if permission is already assigned
      const existingAssignment = await ctx.db.rolePermission.findUnique({
        where: {
          roleId_permissionId: {
            roleId: input.roleId,
            permissionId: input.permissionId,
          },
        },
      });

      if (existingAssignment) {
        throw new Error("Permission is already assigned to this role");
      }

      return ctx.db.rolePermission.create({
        data: {
          roleId: input.roleId,
          permissionId: input.permissionId,
        },
        include: {
          role: true,
          permission: true,
        },
      });
    }),

  // Remove permission from role
  removePermission: adminProcedure
    .input(
      z.object({
        roleId: z.string(),
        permissionId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const assignment = await ctx.db.rolePermission.findUnique({
        where: {
          roleId_permissionId: {
            roleId: input.roleId,
            permissionId: input.permissionId,
          },
        },
      });

      if (!assignment) {
        throw new Error("Permission is not assigned to this role");
      }

      return ctx.db.rolePermission.delete({
        where: {
          roleId_permissionId: {
            roleId: input.roleId,
            permissionId: input.permissionId,
          },
        },
      });
    }),
});
