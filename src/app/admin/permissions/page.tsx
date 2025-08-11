"use client";

import React, { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Edit, Trash2, Key, Shield } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
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
import { Badge } from "~/components/ui/badge";
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

  // Always call hooks, but conditionally enable them
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

  // Use effect to handle redirect on client side
  React.useEffect(() => {
    if (session && !session.user.roles?.includes("ADMIN")) {
      router.push("/");
    }
  }, [session, router]);

  if (!session?.user.roles?.includes("ADMIN")) {
    return null;
  }

  const handleDeletePermission = (
    permissionId: string,
    _permissionName: string,
  ) => {
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

  return (
    <AuthenticatedLayout>
      <div className="bg-background min-h-screen">
        {/* Header */}
        <header className="bg-card border-b">
          <div className="container mx-auto px-4 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">Permission Management</h1>
                <p className="text-muted-foreground mt-1">
                  Manage system permissions and their assignments
                </p>
              </div>
              <Dialog
                open={isCreateDialogOpen}
                onOpenChange={setIsCreateDialogOpen}
              >
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
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
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="container mx-auto px-4 py-8">
          <div className="grid gap-6">
            {permissions?.map((permission) => (
              <Card key={permission.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Key className="text-muted-foreground h-5 w-5" />
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          {permission.name}
                        </CardTitle>
                        <CardDescription>
                          {permission.description ?? "No description provided"}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-muted-foreground flex items-center gap-1 text-sm">
                        <Shield className="h-4 w-4" />
                        {permission.roles.length} roles
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditPermission(permission)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              Delete Permission: {permission.name}
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              This action cannot be undone. This will
                              permanently delete the permission and remove it
                              from all roles.
                              {permission.roles.length > 0 &&
                                ` This permission is currently assigned to ${permission.roles.length} role(s).`}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() =>
                                handleDeletePermission(
                                  permission.id,
                                  permission.name,
                                )
                              }
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h4 className="mb-2 text-sm font-medium">
                        Assigned Roles
                      </h4>
                      {permission.roles.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {permission.roles.map((rp) => {
                            const getBadgeVariant = (roleName: string) => {
                              switch (roleName.toLowerCase()) {
                                case "admin":
                                  return "admin" as const;
                                case "user":
                                  return "user" as const;
                                case "test":
                                  return "test" as const;
                                default:
                                  return "secondary" as const;
                              }
                            };

                            return (
                              <Badge
                                key={rp.role.id}
                                variant={getBadgeVariant(rp.role.name)}
                              >
                                {rp.role.name}
                              </Badge>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-muted-foreground text-sm">
                          No roles assigned
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </main>
      </div>
    </AuthenticatedLayout>
  );
}
