import { z } from "zod";
import {
  adminProcedure,
  createTRPCRouter,
  protectedProcedure,
} from "~/server/api/trpc";

export const userRouter = createTRPCRouter({
  getAll: adminProcedure.query(({ ctx }) => {
    return ctx.db.user.findMany({
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: { permission: true },
                },
              },
            },
          },
        },
      },
    });
  }),

  getStats: protectedProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { id: input.userId },
        include: {
          sessions: {
            orderBy: { expires: "desc" },
          },
        },
      });

      if (!user) {
        throw new Error("User not found");
      }

      const totalSessions = user.sessions.length;
      const lastSession = user.sessions[0];
      const lastLogin = lastSession
        ? new Date(lastSession.expires.getTime() - 30 * 24 * 60 * 60 * 1000) // Approximate login time (30 days before expiry)
        : null;

      return {
        totalSessions,
        lastLogin,
        accountCreated:
          user.sessions.length > 0
            ? user.sessions[user.sessions.length - 1]
            : null,
      };
    }),

  // System-level statistics for admins
  getSystemStats: adminProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const [totalUsers, activeSessions] = await ctx.db.$transaction([
      ctx.db.user.count(),
      ctx.db.session.count({ where: { expires: { gt: now } } }),
    ]);

    return { totalUsers, activeSessions };
  }),

  setUserRoles: adminProcedure
    .input(z.object({ userId: z.string(), roleNames: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => {
      const { userId, roleNames } = input;

      const roles = await ctx.db.role.findMany({
        where: { name: { in: roleNames } },
      });

      if (roles.length !== roleNames.length) {
        const missingRoles = roleNames.filter(
          (name) => !roles.some((role) => role.name === name),
        );
        throw new Error(`Roles not found: ${missingRoles.join(", ")}`);
      }

      return ctx.db.$transaction(async (prisma) => {
        await prisma.userRole.deleteMany({
          where: { userId },
        });

        const newUserRoles = roles.map((role) => ({
          userId,
          roleId: role.id,
        }));

        await prisma.userRole.createMany({
          data: newUserRoles,
        });

        return prisma.user.findUnique({
          where: { id: userId },
          include: {
            roles: {
              include: {
                role: {
                  include: {
                    permissions: { include: { permission: true } },
                  },
                },
              },
            },
          },
        });
      });
    }),

  // Delete user
  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.user.delete({ where: { id: input.id } });
    }),
});
