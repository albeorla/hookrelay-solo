"use client";

import React, { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Plus,
  Edit,
  Trash2,
  Key,
  Shield,
  Users,
  Settings,
  Eye,
  Lock,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import { Badge, getRoleBadgeVariant } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Separator } from "~/components/ui/separator";
import { api } from "~/trpc/react";
import { PermissionForm } from "./_components/permission-form";
import { AuthenticatedLayout } from "~/components/layout/authenticated-layout";

export default function PermissionsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingPermission, setEditingPermission] = useState<{
    id: string;
    name: string;
    description?: string | null;
  } | null>(null);

  const { data: permissions, refetch } = api.permission.getAll.useQuery(
    undefined,
    {
      enabled: session?.user.roles?.includes("ADMIN") ?? false,
    },
  );

  const deletePermission = api.permission.delete.useMutation({
    onSuccess: () => {
      toast.success("Permission deleted successfully");
      void refetch();
    },
    onError: (error) => {
      toast.error(`Failed to delete permission: ${error.message}`);
    },
  });

  React.useEffect(() => {
    if (session && !session.user.roles?.includes("ADMIN")) {
      router.push("/");
    }
  }, [session, router]);

  if (!session?.user.roles?.includes("ADMIN")) {
    return null;
  }

  const handleDeletePermission = (permissionId: string) => {
    deletePermission.mutate({ id: permissionId });
  };

  const handleEditPermission = (permission: {
    id: string;
    name: string;
    description?: string | null;
  }) => {
    setEditingPermission(permission);
    setIsCreateDialogOpen(true);
  };

  const handleFormSuccess = () => {
    setIsCreateDialogOpen(false);
    setEditingPermission(null);
    void refetch();
  };

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
          <h1 className="text-4xl font-bold tracking-tight">
            Permission Management
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage system permissions and their role assignments
          </p>
          <Dialog
            open={isCreateDialogOpen}
            onOpenChange={(isOpen) => {
              setIsCreateDialogOpen(isOpen);
              if (!isOpen) setEditingPermission(null);
            }}
          >
            <DialogTrigger asChild>
              <Button size="lg" className="mt-6">
                <Plus className="mr-2 h-5 w-5" />
                Create Permission
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>
                  {editingPermission
                    ? "Edit Permission"
                    : "Create New Permission"}
                </DialogTitle>
                <DialogDescription>
                  {editingPermission
                    ? "Update the permission details below."
                    : "Create a new permission with the details below."}
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <PermissionForm
                  permission={editingPermission}
                  onSuccess={handleFormSuccess}
                />
              </div>
            </DialogContent>
          </Dialog>
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
              <div className="border-t p-4">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEditPermission(permission)}
                    className="flex-1"
                  >
                    <Edit className="mr-2 h-4 w-4" />
                    Edit
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        color="destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          Delete Permission: {permission.name}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. This will permanently
                          delete the permission and remove it from all roles.
                          {permission.roles.length > 0 &&
                            ` This permission is currently assigned to ${permission.roles.length} role(s).`}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDeletePermission(permission.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
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
