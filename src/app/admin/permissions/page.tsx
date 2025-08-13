"use client";

import React from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Key,
  Shield,
  Users,
  Settings,
  Eye,
  Lock,
  AlertTriangle,
} from "lucide-react";
import { Badge, getRoleBadgeVariant } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Separator } from "~/components/ui/separator";
import { api } from "~/trpc/react";
import { AuthenticatedLayout } from "~/components/layout/authenticated-layout";

export default function PermissionsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const { data: permissions } = api.permission.getAll.useQuery(undefined, {
    enabled: session?.user.roles?.includes("ADMIN") ?? false,
  });

  React.useEffect(() => {
    if (session && !session.user.roles?.includes("ADMIN")) {
      router.push("/");
    }
  }, [session, router]);

  if (!session?.user.roles?.includes("ADMIN")) {
    return null;
  }

  const getPermissionIcon = (permissionName: string) => {
    const iconProps = { className: "h-5 w-5 text-muted-foreground" };
    if (
      permissionName.includes("manage:users") ||
      permissionName.includes("view:users")
    ) {
      return <Users {...iconProps} />;
    }
    if (
      permissionName.includes("manage:webhooks") ||
      permissionName.includes("view:webhooks")
    ) {
      return <Settings {...iconProps} />;
    }
    if (
      permissionName.includes("manage:content") ||
      permissionName.includes("view:content")
    ) {
      return <Eye {...iconProps} />;
    }
    if (
      permissionName.includes("manage:own_profile") ||
      permissionName.includes("view:own_profile")
    ) {
      return <Lock {...iconProps} />;
    }
    return <Key {...iconProps} />;
  };

  const getPermissionCategory = (permissionName: string) => {
    if (permissionName.includes("manage:")) return "Administrative";
    if (permissionName.includes("view:")) return "Read Access";
    return "General";
  };

  return (
    <AuthenticatedLayout>
      <div className="container mx-auto py-12">
        <header className="mb-8 text-center">
          <h1 className="text-4xl font-bold tracking-tight">Permissions</h1>
          <p className="text-muted-foreground mt-2">
            Permissions are seeded and map 1:1 to product features. They cannot
            be created or edited in the app.
          </p>
          <div className="text-muted-foreground mt-4 inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
            <AlertTriangle className="h-4 w-4" />
            Manage assignments by editing roles. Update the catalog via seeding.
          </div>
        </header>

        <Separator className="mb-8" />

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {permissions?.map((permission) => (
            <Card key={permission.id} className="flex flex-col">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    {getPermissionIcon(permission.name)}
                    <div>
                      <CardTitle>{permission.name}</CardTitle>
                      <Badge
                        variant={getRoleBadgeVariant(
                          getPermissionCategory(permission.name),
                        )}
                        className="mt-1"
                      >
                        {getPermissionCategory(permission.name)}
                      </Badge>
                    </div>
                  </div>
                  <div className="text-muted-foreground flex items-center gap-2 text-sm">
                    <Shield className="h-4 w-4" />
                    <span>{permission.roles.length} roles</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-grow space-y-4">
                <p className="text-muted-foreground text-sm">
                  {permission.description ?? "No description provided"}
                </p>
                <div>
                  <h4 className="mb-2 font-semibold">Assigned Roles</h4>
                  {permission.roles.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {permission.roles.map((rp) => (
                        <Badge
                          key={rp.role.id}
                          variant={getRoleBadgeVariant(rp.role.name)}
                        >
                          {rp.role.name}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm italic">
                      No roles assigned
                    </p>
                  )}
                </div>
              </CardContent>
              <div className="text-muted-foreground border-t p-4 text-center text-sm">
                View-only. Assign permissions on the Roles page.
              </div>
            </Card>
          ))}
        </div>

        <Separator className="my-8" />

        <footer className="text-center">
          <h3 className="text-2xl font-semibold">Permission System Overview</h3>
          <p className="text-muted-foreground mx-auto mt-2 max-w-2xl">
            This system provides granular access control with{" "}
            {permissions?.length ?? 0} distinct permissions covering user
            management, content administration, webhook operations, and system
            analytics. Each permission can be assigned to multiple roles for
            flexible access control.
          </p>
        </footer>
      </div>
    </AuthenticatedLayout>
  );
}
