import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Create Roles with detailed descriptions
  const adminRole = await prisma.role.upsert({
    where: { name: "ADMIN" },
    update: {},
    create: {
      name: "ADMIN",
      description:
        "Full system administrator with complete access to all features. Can manage users, roles, permissions, webhooks, content, and view all system analytics. This role has unrestricted access to the entire application and should be assigned sparingly to trusted personnel only.",
    },
  });

  const userRole = await prisma.role.upsert({
    where: { name: "USER" },
    update: {},
    create: {
      name: "USER",
      description:
        "Standard authenticated user with basic access to the platform. Can view content, access the dashboard, and manage their own profile information. This role provides essential functionality while maintaining security boundaries.",
    },
  });

  console.log("Created roles:", { adminRole, userRole });
  // Canonical permission catalog currently used by the app
  const canonicalPermissions = [
    "manage:users",
    "view:users",
    "manage:roles",
    "view:roles",
    "view:permissions",
    "manage:webhooks",
    "view:webhooks",
    "manage:own_profile",
    "view:own_profile",
    "view:dashboard",
  ] as const;

  // Remove any permissions not in the canonical list and their assignments
  const obsolete = await prisma.permission.findMany({
    where: { name: { notIn: [...canonicalPermissions] } },
    select: { id: true, name: true },
  });

  if (obsolete.length > 0) {
    const obsoleteIds = obsolete.map((p) => p.id);
    await prisma.rolePermission.deleteMany({
      where: { permissionId: { in: obsoleteIds } },
    });
    await prisma.permission.deleteMany({ where: { id: { in: obsoleteIds } } });
    console.log(
      `Removed obsolete permissions: ${obsolete.map((p) => p.name).join(", ")}`,
    );
  }

  // Ensure the canonical permissions exist (upsert)
  const permissions = await Promise.all([
    // User Management
    prisma.permission.upsert({
      where: { name: "manage:users" },
      update: {},
      create: {
        name: "manage:users",
        description:
          "Full user lifecycle management: create, edit, delete, suspend, and restore user accounts. Includes assigning/removing roles, resetting passwords, and managing user preferences.",
      },
    }),
    prisma.permission.upsert({
      where: { name: "view:users" },
      update: {},
      create: {
        name: "view:users",
        description:
          "Read-only access to user information including profiles, basic details, and role assignments.",
      },
    }),

    // Role Management
    prisma.permission.upsert({
      where: { name: "manage:roles" },
      update: {},
      create: {
        name: "manage:roles",
        description:
          "Complete role administration: create new roles, modify existing role definitions, delete unused roles, and adjust role hierarchies.",
      },
    }),
    prisma.permission.upsert({
      where: { name: "view:roles" },
      update: {},
      create: {
        name: "view:roles",
        description:
          "Browse available roles, view role descriptions, and see which permissions are assigned to each role.",
      },
    }),

    // Permissions listing (read-only in app)
    prisma.permission.upsert({
      where: { name: "view:permissions" },
      update: {},
      create: {
        name: "view:permissions",
        description:
          "Browse the complete permission catalog and see which roles have specific permissions.",
      },
    }),

    // Webhook Management
    prisma.permission.upsert({
      where: { name: "manage:webhooks" },
      update: {},
      create: {
        name: "manage:webhooks",
        description:
          "Create and manage webhook endpoints, configure delivery settings, and monitor performance.",
      },
    }),
    prisma.permission.upsert({
      where: { name: "view:webhooks" },
      update: {},
      create: {
        name: "view:webhooks",
        description: "View webhook endpoints and delivery logs.",
      },
    }),

    // Profile Management
    prisma.permission.upsert({
      where: { name: "manage:own_profile" },
      update: {},
      create: {
        name: "manage:own_profile",
        description: "Users can update their own profile details and settings.",
      },
    }),
    prisma.permission.upsert({
      where: { name: "view:own_profile" },
      update: {},
      create: {
        name: "view:own_profile",
        description:
          "Access to view one's own profile information, account details, and personal settings.",
      },
    }),

    // Dashboard Access
    prisma.permission.upsert({
      where: { name: "view:dashboard" },
      update: {},
      create: {
        name: "view:dashboard",
        description:
          "Access to the main application dashboard showing personalized content, quick actions, and recent activity.",
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

  // Assign basic permissions to USER role
  const userPermissions = await Promise.all([
    // Basic user permissions
    prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: userRole.id,
          permissionId: permissions.find((p) => p.name === "view:own_profile")!
            .id,
        },
      },
      update: {},
      create: {
        roleId: userRole.id,
        permissionId: permissions.find((p) => p.name === "view:own_profile")!
          .id,
      },
    }),
    prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: userRole.id,
          permissionId: permissions.find(
            (p) => p.name === "manage:own_profile",
          )!.id,
        },
      },
      update: {},
      create: {
        roleId: userRole.id,
        permissionId: permissions.find((p) => p.name === "manage:own_profile")!
          .id,
      },
    }),
    prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: userRole.id,
          permissionId: permissions.find((p) => p.name === "view:dashboard")!
            .id,
        },
      },
      update: {},
      create: {
        roleId: userRole.id,
        permissionId: permissions.find((p) => p.name === "view:dashboard")!.id,
      },
    }),
  ]);

  console.log("Assigned permissions to user role:", userPermissions);

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
  .finally(() => {
    void prisma.$disconnect();
  });
