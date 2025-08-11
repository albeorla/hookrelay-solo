"use client";

import React, { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Edit, Trash2, Shield, Users } from "lucide-react";
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
import { RoleForm } from "./_components/role-form";
import { AuthenticatedLayout } from "~/components/layout/authenticated-layout";

export default function RolesPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<{
    id: string;
    name: string;
    description?: string | null;
    permissions: Array<{
      permission: {
        id: string;
        name: string;
        description?: string | null;
      };
    }>;
  } | null>(null);

  // Always call hooks, but conditionally enable them
  const { data: roles, refetch } = api.role.getAll.useQuery(undefined, {
    enabled: session?.user.roles?.includes("ADMIN") ?? false,
  });
  const { data: permissions } = api.permission.getAll.useQuery(undefined, {
    enabled: session?.user.roles?.includes("ADMIN") ?? false,
  });

  const deleteRole = api.role.delete.useMutation({
    onSuccess: () => {
      toast.success("Role deleted successfully");
      void refetch();
    },
    onError: (error) => {
      toast.error(`Failed to delete role: ${error.message}`);
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

  const handleDeleteRole = (roleId: string, _roleName: string) => {
    deleteRole.mutate({ id: roleId });
  };

  const handleEditRole = (role: {
    id: string;
    name: string;
    description?: string | null;
    permissions: Array<{
      permission: {
        id: string;
        name: string;
        description?: string | null;
      };
    }>;
  }) => {
    setEditingRole(role);
    setIsCreateDialogOpen(true);
  };

  const handleFormSuccess = () => {
    setIsCreateDialogOpen(false);
    setEditingRole(null);
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
                <h1 className="text-3xl font-bold">Role Management</h1>
                <p className="text-muted-foreground mt-1">
                  Manage roles and their permissions
                </p>
              </div>
              <Dialog
                open={isCreateDialogOpen}
                onOpenChange={setIsCreateDialogOpen}
              >
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Role
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      {editingRole ? "Edit Role" : "Create New Role"}
                    </DialogTitle>
                    <DialogDescription>
                      {editingRole
                        ? "Update the role details below."
                        : "Create a new role with the details below."}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-4">
                    <RoleForm
                      role={editingRole}
                      permissions={permissions ?? []}
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
            {roles?.map((role) => (
              <Card key={role.id} variant="elevated">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <Shield className="text-primary h-5 w-5" />
                        <div className="bg-primary/20 absolute inset-0 rounded-full blur-sm" />
                      </div>
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <span
                            className={`gradient-text-${role.name.toLowerCase() === "admin" ? "admin" : role.name.toLowerCase() === "user" ? "user" : "primary"}`}
                          >
                            {role.name}
                          </span>
                          {role.name === "ADMIN" && (
                            <Badge variant="admin">System</Badge>
                          )}
                        </CardTitle>
                        <CardDescription>
                          {role.description ?? "No description provided"}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-muted-foreground flex items-center gap-1 text-sm">
                        <Users className="h-4 w-4" />
                        {role.users.length} users
                      </div>
                      {role.name !== "ADMIN" && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditRole(role)}
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
                                  Delete Role: {role.name}
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  This action cannot be undone. This will
                                  permanently delete the role and remove it from
                                  all users.
                                  {role.users.length > 0 &&
                                    ` This role is currently assigned to ${role.users.length} user(s).`}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() =>
                                    handleDeleteRole(role.id, role.name)
                                  }
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h4 className="mb-2 text-sm font-medium">Permissions</h4>
                      {role.permissions.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {role.permissions.map((rp) => (
                            <Badge key={rp.permission.id} variant="permission">
                              {rp.permission.name}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted-foreground text-sm">
                          No permissions assigned
                        </p>
                      )}
                    </div>
                    {role.users.length > 0 && (
                      <div>
                        <h4 className="mb-2 text-sm font-medium">Users</h4>
                        <div className="flex flex-wrap gap-2">
                          {role.users.map((ur) => (
                            <Badge key={ur.user.id} variant="outline">
                              {ur.user.name ?? ur.user.email}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
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
