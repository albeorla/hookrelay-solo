import { PrismaAdapter } from "@auth/prisma-adapter";
import { type DefaultSession, type NextAuthConfig } from "next-auth";
import DiscordProvider from "next-auth/providers/discord";
import CredentialsProvider from "next-auth/providers/credentials";

import config from "~/config";
import { db } from "~/server/db";

/**
 * Module augmentation for `next-auth` types. Allows us to add custom properties to the `session`
 * object and keep type safety.
 *
 * @see https://next-auth.js.org/getting-started/typescript#module-augmentation
 */
declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
      roles: string[];
    } & DefaultSession["user"];
  }

  interface User {
    roles?: string[];
  }
}

/**
 * Options for NextAuth.js used to configure adapters, providers, callbacks, etc.
 *
 * @see https://next-auth.js.org/configuration/options
 */
const isTestMode = config.app.nodeEnv === "test" || config.auth.enableTestAuth;

export const authConfig = {
  providers: [
    DiscordProvider,
    // Add test-only credentials provider
    ...(isTestMode
      ? [
          CredentialsProvider({
            id: "test-credentials",
            name: "Test Login",
            credentials: {
              email: { label: "Email", type: "email" },
              password: { label: "Password", type: "password" },
            },
            async authorize(credentials) {
              // In test mode, be more permissive
              if (isTestMode) {
                if (credentials?.email && credentials?.password) {
                  const email = credentials.email as string;
                  try {
                    // Find or create test user
                    const user = await db.user.upsert({
                      where: { email },
                      update: {
                        name: email.includes("@")
                          ? email.split("@")[0]
                          : "Test User",
                        image: "https://github.com/ghost.png",
                        emailVerified: new Date(), // Add email verified date
                      },
                      create: {
                        email,
                        name: email.includes("@")
                          ? email.split("@")[0]
                          : "Test User",
                        image: "https://github.com/ghost.png",
                        emailVerified: new Date(), // Add email verified date
                      },
                    });

                    // Ensure the user has the necessary roles based on email
                    const adminEmails = [
                      "admin@example.com",
                      "superuser@example.com",
                    ];
                    const isAdmin = adminEmails.includes(email);
                    const roleName = isAdmin ? "ADMIN" : "USER";

                    const role = await db.role.findFirst({
                      where: { name: roleName },
                    });

                    if (role) {
                      // Clear existing roles first for test accounts
                      if (isTestMode && email.includes("@test.com")) {
                        await db.userRole.deleteMany({
                          where: { userId: user.id },
                        });
                      }

                      // Assign the appropriate role
                      await db.userRole.create({
                        data: {
                          userId: user.id,
                          roleId: role.id,
                        },
                      });
                    }

                    // If admin, also assign USER role (admins typically have both)
                    if (isAdmin) {
                      const userRole = await db.role.findFirst({
                        where: { name: "USER" },
                      });

                      if (userRole) {
                        await db.userRole.create({
                          data: {
                            userId: user.id,
                            roleId: userRole.id,
                          },
                        });
                      }
                    }

                    // Return user object in the format NextAuth expects
                    return {
                      id: user.id,
                      email: user.email,
                      name: user.name,
                      image: user.image,
                      emailVerified: user.emailVerified,
                    };
                  } catch (error) {
                    if (isTestMode) {
                      console.error(
                        "Test user creation error:",
                        error instanceof Error
                          ? error.message
                          : "Unknown error",
                      );
                    }
                    return null;
                  }
                }
              }

              return null;
            },
          }),
        ]
      : []),
    /**
     * ...add more providers here.
     *
     * Most other providers require a bit more work than the Discord provider. For example, the
     * GitHub provider requires you to add the `refresh_token_expires_in` field to the Account
     * model. Refer to the NextAuth.js docs for the provider you want to use. Example:
     *
     * @see https://next-auth.js.org/providers/github
     */
  ],
  adapter: PrismaAdapter(db),
  callbacks: {
    async signIn({ user, account }) {
      // For OAuth providers (Discord, etc.), ensure user has at least the USER role
      if (account?.provider !== "test-credentials" && user.id) {
        const existingRoles = await db.userRole.findMany({
          where: { userId: user.id },
        });

        // If user has no roles, assign the default USER role
        if (existingRoles.length === 0) {
          const defaultRole = await db.role.findFirst({
            where: { name: "USER" },
          });

          if (defaultRole) {
            await db.userRole.create({
              data: {
                userId: user.id,
                roleId: defaultRole.id,
              },
            });
          }
        }
      }
      return true;
    },
    session: async ({ session, user }) => {
      // Debug logging for E2E tests
      if (isTestMode && config.test.verboseLogs) {
        console.log(`🔍 Session callback for user: ${user.id} (${user.email})`);
      }

      const userRoles = await db.userRole.findMany({
        where: { userId: user.id },
        include: { role: true },
      });

      const roles = userRoles.map((ur) => ur.role.name);

      if (isTestMode && config.test.verboseLogs) {
        console.log(`   Roles found: ${roles.join(", ")}`);
      }

      return {
        ...session,
        user: {
          ...session.user,
          id: user.id,
          roles,
        },
      };
    },
  },
} satisfies NextAuthConfig;
