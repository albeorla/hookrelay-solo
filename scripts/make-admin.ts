import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function makeUserAdmin(email: string) {
  try {
    // Find the user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      console.error(`User with email ${email} not found`);
      return;
    }

    // Find the ADMIN role
    const adminRole = await prisma.role.findUnique({
      where: { name: "ADMIN" },
    });

    if (!adminRole) {
      console.error("ADMIN role not found");
      return;
    }

    // Check if user already has ADMIN role
    const existingRole = await prisma.userRole.findUnique({
      where: {
        userId_roleId: {
          userId: user.id,
          roleId: adminRole.id,
        },
      },
    });

    if (existingRole) {
      console.log(`User ${email} already has ADMIN role`);
      return;
    }

    // Assign ADMIN role to user
    await prisma.userRole.create({
      data: {
        userId: user.id,
        roleId: adminRole.id,
      },
    });

    console.log(`Successfully assigned ADMIN role to ${email}`);
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

// Get email from command line argument
const email = process.argv[2];
if (!email) {
  console.error("Please provide an email address");
  console.log("Usage: npx tsx scripts/make-admin.ts user@example.com");
  process.exit(1);
}

makeUserAdmin(email);
