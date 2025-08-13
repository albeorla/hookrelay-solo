"use client";

import React, { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Edit, Trash2, Shield, Crown, UserCheck } from "lucide-react";
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
import { api, type RouterOutputs } from "~/trpc/react";
import { RoleForm } from "./_components/role-form";
import { AuthenticatedLayout } from "~/components/layout/authenticated-layout";

export default function RolesPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  type RoleItem = RouterOutputs["role"]["getAll"][number];
  const [editingRole, setEditingRole] = useState<RoleItem | null>(null);

  const { data: roles, refetch } = api.role.getAll.useQuery(undefined, {
    enabled: session?.user.roles?.includes("ADMIN") ?? false,
  });
  const { data: allPermissions } = api.permission.getAll.useQuery(undefined, {
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

  React.useEffect(() => {
    if (session && !session.user.roles?.includes("ADMIN")) {
      router.push("/");
    }
  }, [session, router]);

  if (!session?.user.roles?.includes("ADMIN")) {
    return null;
  }

  const handleDeleteRole = (roleId: string) => {
    deleteRole.mutate({ id: roleId });
  };

  const handleEditRole = (role: RoleItem) => {
    setEditingRole(role);
    setIsCreateDialogOpen(true);
  };

  const handleFormSuccess = () => {
    setIsCreateDialogOpen(false);
    setEditingRole(null);
    void refetch();
  };

  const getRoleIcon = (roleName: string) => {
    const iconProps = { className: "h-5 w-5 text-muted-foreground" };
    if (roleName === "ADMIN") {
      return <Crown {...iconProps} />;
    }
    if (roleName === "USER") {
      return <UserCheck {...iconProps} />;
    }
    return <Shield {...iconProps} />;
  };

  const getRolePriority = (roleName: string) => {
    if (roleName === "ADMIN") return "High Priority";
    if (roleName === "USER") return "Standard";
    return "Custom";
  };

  return (
    <AuthenticatedLayout>
      <div className="container mx-auto py-12">
        <header className="mb-8 text-center">
          <h1 className="text-4xl font-bold tracking-tight">Role Management</h1>
          <p className="text-muted-foreground mt-2">
            Manage system roles and their permission assignments
          </p>
          <Dialog
            open={isCreateDialogOpen}
            onOpenChange={(isOpen) => {
              setIsCreateDialogOpen(isOpen);
              if (!isOpen) setEditingRole(null);
            }}
          >
            <DialogTrigger asChild>
              <Button size="lg" className="mt-6">
                <Plus className="mr-2 h-5 w-5" />
                Create Role
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
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
                  role={
                    editingRole as unknown as {
                      id: string;
                      name: string;
                      description?: string | null;
                      permissions: {
                        permission: {
                          id: string;
                          name: string;
                          description?: string | null;
                        };
                      }[];
                    } | null
                  }
                  permissions={allPermissions ?? []}
                  onSuccess={handleFormSuccess}
                />
              </div>
            </DialogContent>
          </Dialog>
        </header>

        <Separator className="mb-8" />

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {roles?.map((role) => (
            <Card key={role.id} className="flex flex-col">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    {getRoleIcon(role.name)}
                    <div>
                      <CardTitle>{role.name}</CardTitle>
                      <Badge
                        variant={getRoleBadgeVariant(role.name)}
                        className="mt-1"
                      >
                        {getRolePriority(role.name)}
                      </Badge>
                    </div>
                  </div>
                  <div className="text-muted-foreground flex items-center gap-2 text-sm">
                    <Shield className="h-4 w-4" />
                    <span>{role.permissions.length} permissions</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-grow space-y-4">
                <p className="text-muted-foreground text-sm">
                  {role.description ?? "No description provided"}
                </p>
                <div>
                  <h4 className="mb-2 font-semibold">Assigned Permissions</h4>
                  {role.permissions.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {role.permissions.map((rp) => (
                        <Badge
                          key={rp.permission.id}
                          variant={getRoleBadgeVariant(rp.permission.name)}
                        >
                          {rp.permission.name}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm italic">
                      No permissions assigned
                    </p>
                  )}
                </div>
                <div>
                  <h4 className="mb-2 font-semibold">Users with this Role</h4>
                  {role.users.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {role.users.map((ur) => (
                        <Badge key={ur.user.id} variant="secondary">
                          {ur.user.name ?? ur.user.email}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm italic">
                      No users assigned
                    </p>
                  )}
                </div>
              </CardContent>
              {role.name !== "ADMIN" && role.name !== "USER" ? (
                <div className="border-t p-4">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditRole(role)}
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
                            Delete Role: {role.name}
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone. This will permanently
                            delete the role and remove it from all users.
                            {role.users.length > 0 &&
                              ` This role is currently assigned to ${role.users.length} user(s).`}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteRole(role.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ) : (
                <div className="border-t p-4">
                  <div className="text-muted-foreground flex items-center text-sm">
                    <Shield className="mr-2 h-4 w-4" />
                    <span>System role (protected)</span>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>

        <Separator className="my-8" />

        <footer className="text-center">
          <h3 className="text-2xl font-semibold">Role System Overview</h3>
          <p className="text-muted-foreground mx-auto mt-2 max-w-2xl">
            This system provides {roles?.length ?? 0} distinct roles with
            different access levels. Roles can be customized with specific
            permissions to create tailored access control for different user
            groups and organizational needs.
          </p>
        </footer>
      </div>
    </AuthenticatedLayout>
  );
}
