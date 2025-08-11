/* eslint-disable @typescript-eslint/no-explicit-any,@typescript-eslint/no-unsafe-member-access */
import { PrismaClient } from "@prisma/client";
import { randomBytes } from "crypto";

import config from "~/config";

const prisma = new PrismaClient();

// Control logging verbosity via environment variable
const isVerbose = config.test.verboseLogs;

interface CreateTestSessionOptions {
  email?: string;
  name?: string;
  role?: "USER" | "ADMIN";
}

async function createTestSession(options: CreateTestSessionOptions = {}) {
  const {
    email = "test@example.com",
    name = "Test User",
    role = "USER",
  } = options;

  // Only log in verbose mode
  if (isVerbose) {
    console.log(`🔐 Creating test session for ${role} user...`);
  }

  try {
    // Create or update test user (this ensures the user exists for NextAuth)
    const testUser = await prisma.user.upsert({
      where: { email },
      update: {
        name,
        image: "https://github.com/ghost.png",
        emailVerified: new Date(),
      },
      create: {
        email,
        name,
        image: "https://github.com/ghost.png",
        emailVerified: new Date(),
      },
    });

    // Get the requested role
    const requestedRole = await prisma.role.findFirst({
      where: { name: role },
    });

    if (requestedRole) {
      // First, remove any existing roles that are not the requested role
      await prisma.userRole.deleteMany({
        where: {
          userId: testUser.id,
          roleId: { not: requestedRole.id },
        },
      });

      // Then ensure the requested role is assigned (handle race conditions)
      try {
        await prisma.userRole.create({
          data: {
            userId: testUser.id,
            roleId: requestedRole.id,
          },
        });
      } catch (error: any) {
        // If it's a unique constraint error, the role is already assigned - that's fine
        if (error?.code !== "P2002") {
          console.error("Error creating test session:", error);
          throw error;
        }
      }
    } else {
      console.warn(`Warning: ${role} role not found in database`);
    }

    // For NextAuth v5, we need to create a proper session that NextAuth can validate
    // Instead of manually creating a session, we'll create the necessary records
    // that NextAuth expects when it validates the session

    // Create a session token using NextAuth's expected format
    const sessionToken = randomBytes(32).toString("hex");
    const expires = new Date();
    expires.setDate(expires.getDate() + 30); // 30 days from now

    // Create session record that NextAuth expects
    await prisma.session.upsert({
      where: { sessionToken },
      update: {
        userId: testUser.id,
        expires,
      },
      create: {
        sessionToken,
        userId: testUser.id,
        expires,
      },
    });

    // Create an account record if it doesn't exist (NextAuth may need this)
    await prisma.account.upsert({
      where: {
        provider_providerAccountId: {
          provider: "test-credentials",
          providerAccountId: testUser.id,
        },
      },
      update: {},
      create: {
        userId: testUser.id,
        type: "credentials",
        provider: "test-credentials",
        providerAccountId: testUser.id,
      },
    });

    if (isVerbose) {
      console.log(`✅ Test session created for ${email} (${role})`);
      console.log(`   User ID: ${testUser.id}`);
      console.log(`   Session Token: ${sessionToken.substring(0, 8)}...`);
    }

    // Return the session details
    return {
      sessionToken,
      userId: testUser.id,
      userEmail: testUser.email,
      userRole: role,
    };
  } catch (error) {
    console.error("Error creating test session:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

export { createTestSession };
