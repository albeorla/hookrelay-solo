import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Creating admin user: albeorla@gmail.com");

  // Get the ADMIN role
  const adminRole = await prisma.role.findUnique({
    where: { name: "ADMIN" },
  });

  if (!adminRole) {
    console.error("ADMIN role not found. Please run the seed script first.");
    process.exit(1);
  }

  // Create the albeorla user
  const albeorlaUser = await prisma.user.upsert({
    where: { email: "albeorla@gmail.com" },
    update: {},
    create: {
      name: "Albeorla",
      email: "albeorla@gmail.com",
    },
  });

  console.log("Created user:", albeorlaUser);

  // Assign ADMIN role to albeorla
  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: albeorlaUser.id,
        roleId: adminRole.id,
      },
    },
    update: {},
    create: {
      userId: albeorlaUser.id,
      roleId: adminRole.id,
    },
  });

  console.log("Assigned ADMIN role to albeorla@gmail.com");
  console.log("Admin user setup complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
