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

  // Create comprehensive permissions covering all functionality with detailed descriptions
  const permissions = await Promise.all([
    // User Management
    prisma.permission.upsert({
      where: { name: "manage:users" },
      update: {},
      create: {
        name: "manage:users",
        description:
          "Full user lifecycle management: create, edit, delete, suspend, and restore user accounts. Includes assigning/removing roles, resetting passwords, and managing user preferences. Essential for system administration and user onboarding.",
      },
    }),
    prisma.permission.upsert({
      where: { name: "view:users" },
      update: {},
      create: {
        name: "view:users",
        description:
          "Read-only access to user information including profiles, basic details, and role assignments. Useful for support staff, team leads, and administrators who need to understand user distribution without making changes.",
      },
    }),

    // Role Management
    prisma.permission.upsert({
      where: { name: "manage:roles" },
      update: {},
      create: {
        name: "manage:roles",
        description:
          "Complete role administration: create new roles, modify existing role definitions, delete unused roles, and adjust role hierarchies. Critical for implementing organizational access control policies and maintaining security compliance.",
      },
    }),
    prisma.permission.upsert({
      where: { name: "view:roles" },
      update: {},
      create: {
        name: "view:roles",
        description:
          "Browse available roles, view role descriptions, and see which permissions are assigned to each role. Helps users understand the access levels available and assists in role selection during user onboarding.",
      },
    }),

    // Permission Management
    prisma.permission.upsert({
      where: { name: "manage:permissions" },
      update: {},
      create: {
        name: "manage:permissions",
        description:
          "Granular permission control: create custom permissions, modify permission descriptions, delete obsolete permissions, and manage permission-role assignments. Enables fine-tuning of access control to match business requirements.",
      },
    }),
    prisma.permission.upsert({
      where: { name: "view:permissions" },
      update: {},
      create: {
        name: "view:permissions",
        description:
          "Browse the complete permission catalog, understand what each permission allows, and see which roles have been granted specific permissions. Essential for security audits and understanding system capabilities.",
      },
    }),

    // Analytics & Reporting
    prisma.permission.upsert({
      where: { name: "view:analytics" },
      update: {},
      create: {
        name: "view:analytics",
        description:
          "Access to comprehensive system analytics including user activity metrics, performance statistics, webhook delivery rates, error logs, and system health indicators. Provides insights for capacity planning and operational monitoring.",
      },
    }),

    // Content Management
    prisma.permission.upsert({
      where: { name: "manage:content" },
      update: {},
      create: {
        name: "manage:content",
        description:
          "Full content administration: create, edit, publish, unpublish, and delete application content. Includes managing static pages, dynamic content, media assets, and content workflows. Essential for content teams and marketing operations.",
      },
    }),
    prisma.permission.upsert({
      where: { name: "view:content" },
      update: {},
      create: {
        name: "view:content",
        description:
          "Read access to all published and draft content within the application. Allows users to browse, search, and consume content without the ability to modify it. Basic permission for all authenticated users.",
      },
    }),

    // Webhook Management
    prisma.permission.upsert({
      where: { name: "manage:webhooks" },
      update: {},
      create: {
        name: "manage:webhooks",
        description:
          "Complete webhook administration: create new webhook endpoints, configure delivery settings, manage authentication secrets, set up retry policies, and monitor webhook performance. Critical for integrating with external systems and APIs.",
      },
    }),
    prisma.permission.upsert({
      where: { name: "view:webhooks" },
      update: {},
      create: {
        name: "view:webhooks",
        description:
          "Monitor webhook endpoints, view delivery logs, check success/failure rates, and access webhook statistics. Useful for developers, support teams, and operations staff who need visibility into webhook performance.",
      },
    }),

    // Profile Management
    prisma.permission.upsert({
      where: { name: "manage:own_profile" },
      update: {},
      create: {
        name: "manage:own_profile",
        description:
          "Users can update their personal information including name, email, profile picture, preferences, and account settings. Allows self-service profile management without requiring administrative intervention.",
      },
    }),
    prisma.permission.upsert({
      where: { name: "view:own_profile" },
      update: {},
      create: {
        name: "view:own_profile",
        description:
          "Access to view one's own profile information, account details, and personal settings. Basic permission that enables users to see their account status and verify their information is correct.",
      },
    }),

    // Dashboard Access
    prisma.permission.upsert({
      where: { name: "view:dashboard" },
      update: {},
      create: {
        name: "view:dashboard",
        description:
          "Access to the main application dashboard showing personalized content, quick actions, recent activity, and system status. Provides the primary user interface and navigation hub for the application.",
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
    prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: userRole.id,
          permissionId: permissions.find((p) => p.name === "view:content")!.id,
        },
      },
      update: {},
      create: {
        roleId: userRole.id,
        permissionId: permissions.find((p) => p.name === "view:content")!.id,
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
