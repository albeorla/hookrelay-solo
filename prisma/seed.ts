import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Create Roles
  const adminRole = await prisma.role.upsert({
    where: { name: "ADMIN" },
    update: {},
    create: {
      name: "ADMIN",
      description: "Administrator with all permissions",
    },
  });

  const userRole = await prisma.role.upsert({
    where: { name: "USER" },
    update: {},
    create: {
      name: "USER",
      description: "Standard user with basic permissions",
    },
  });

  console.log("Created roles:", { adminRole, userRole });

  // Create Permissions
  const permissions = await Promise.all([
    prisma.permission.upsert({
      where: { name: "manage:users" },
      update: {},
      create: {
        name: "manage:users",
        description: "Allows managing users and their roles",
      },
    }),
    prisma.permission.upsert({
      where: { name: "manage:roles" },
      update: {},
      create: {
        name: "manage:roles",
        description: "Allows creating, editing, and deleting roles",
      },
    }),
    prisma.permission.upsert({
      where: { name: "manage:permissions" },
      update: {},
      create: {
        name: "manage:permissions",
        description: "Allows creating, editing, and deleting permissions",
      },
    }),
    prisma.permission.upsert({
      where: { name: "view:analytics" },
      update: {},
      create: {
        name: "view:analytics",
        description: "Allows viewing system analytics and reports",
      },
    }),
    prisma.permission.upsert({
      where: { name: "manage:content" },
      update: {},
      create: {
        name: "manage:content",
        description: "Allows managing application content",
      },
    }),
  ]);

  console.log("Created permissions:", permissions);

  // Assign all permissions to ADMIN role
  const adminPermissions = await Promise.all(
    permissions.map((permission) =>
      prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: adminRole.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: adminRole.id,
          permissionId: permission.id,
        },
      }),
    ),
  );

  console.log("Assigned permissions to admin role:", adminPermissions);

  // Create a default admin user
  const adminUser = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      name: "Admin User",
      email: "admin@example.com",
    },
  });

  // Assign ADMIN role to the admin user
  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: adminUser.id,
        roleId: adminRole.id,
      },
    },
    update: {},
    create: {
      userId: adminUser.id,
      roleId: adminRole.id,
    },
  });

  console.log("Created admin user:", adminUser);

  console.log("Seeding finished.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
