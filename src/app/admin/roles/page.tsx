"use client";

import React, { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Edit, Trash2, Shield, Crown, UserCheck } from "lucide-react";
import { Button } from "@/ui/components/Button";
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
import { Badge } from "@/ui/components/Badge";
import { IconWithBackground } from "@/ui/components/IconWithBackground";
import { api, type RouterOutputs } from "~/trpc/react";
import { RoleForm } from "./_components/role-form";
import { AuthenticatedLayout } from "~/components/layout/authenticated-layout";

export default function RolesPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  type RoleItem = RouterOutputs["role"]["getAll"][number];
  const [editingRole, setEditingRole] = useState<RoleItem | null>(null);

  // Always call hooks, but conditionally enable them
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
    if (roleName === "ADMIN") {
      return <Crown className="h-5 w-5" />;
    }
    if (roleName === "USER") {
      return <UserCheck className="h-5 w-5" />;
    }
    return <Shield className="h-5 w-5" />;
  };

  const getRoleVariant = (roleName: string) => {
    if (roleName === "ADMIN") return "error" as const;
    if (roleName === "USER") return "neutral" as const;
    return "brand" as const;
  };

  const getRolePriority = (roleName: string) => {
    if (roleName === "ADMIN") return "High Priority";
    if (roleName === "USER") return "Standard";
    return "Custom";
  };

  return (
    <AuthenticatedLayout>
      <div className="bg-default-background container flex h-full w-full max-w-none flex-col items-start gap-6 py-12">
        {/* Header */}
        <div className="flex w-full flex-col items-center justify-center gap-6">
          <div className="text-center">
            <h1 className="text-heading-1 font-heading-1 text-default-font">
              Role Management
            </h1>
            <p className="text-body font-body text-subtext-color mt-2">
              Manage system roles and their permission assignments
            </p>
          </div>
          <Dialog
            open={isCreateDialogOpen}
            onOpenChange={setIsCreateDialogOpen}
          >
            <DialogTrigger asChild>
              <Button className="h-12 px-6" size="large">
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
                {/* Narrow type to RoleForm's expected shape */}
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
        </div>

        {/* Divider */}
        <div className="bg-neutral-border flex h-px w-full flex-none flex-col items-center gap-2" />

        {/* Main Content */}
        <div className="grid w-full grid-cols-1 flex-wrap items-start gap-6 md:grid-cols-2 lg:grid-cols-3">
          {roles?.map((role) => (
            <div
              key={role.id}
              className="flex shrink-0 grow basis-0 flex-col items-start gap-3 overflow-hidden pb-3"
            >
              <div className="border-neutral-border bg-default-background flex w-full flex-col items-start rounded-md border border-solid shadow-sm">
                <div className="flex w-full flex-col items-start gap-2 py-4 pr-3 pl-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <IconWithBackground
                        size="medium"
                        icon={getRoleIcon(role.name)}
                      />
                      <div>
                        <span className="text-heading-3 font-heading-3 text-default-font">
                          {role.name}
                        </span>
                        <Badge
                          variant={getRoleVariant(role.name)}
                          className="mt-2"
                        >
                          {getRolePriority(role.name)}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-subtext-color text-caption font-caption flex items-center gap-1">
                        <Shield className="h-4 w-4" />
                        {role.permissions.length} permissions
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-neutral-border flex h-px w-full flex-none flex-col items-center gap-2" />

                <div className="flex w-full flex-col items-start px-4 py-4">
                  <div className="space-y-4">
                    <div>
                      <p className="text-body font-body text-subtext-color leading-relaxed">
                        {role.description ?? "No description provided"}
                      </p>
                    </div>

                    <div>
                      <h4 className="text-body-bold font-body-bold text-default-font mb-2">
                        Assigned Permissions
                      </h4>
                      {role.permissions.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {role.permissions.map((rp) => {
                            const getPermissionVariant = (
                              permissionName: string,
                            ) => {
                              if (permissionName.includes("manage:"))
                                return "error" as const;
                              if (permissionName.includes("view:"))
                                return "neutral" as const;
                              return "brand" as const;
                            };

                            return (
                              <Badge
                                key={rp.permission.id}
                                variant={getPermissionVariant(
                                  rp.permission.name,
                                )}
                                className="text-xs"
                              >
                                {rp.permission.name}
                              </Badge>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-subtext-color text-caption font-caption italic">
                          No permissions assigned
                        </p>
                      )}
                    </div>

                    <div>
                      <h4 className="text-body-bold font-body-bold text-default-font mb-2">
                        Users with this Role
                      </h4>
                      {role.users.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {role.users.map((ur) => (
                            <Badge
                              key={ur.user.id}
                              variant="neutral"
                              className="text-xs"
                            >
                              {ur.user.name ?? ur.user.email}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <p className="text-subtext-color text-caption font-caption italic">
                          No users assigned
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                      <Button
                        variant="neutral-secondary"
                        size="small"
                        onClick={() => handleEditRole(role)}
                        className="flex-1"
                      >
                        <Edit className="mr-2 h-4 w-4" />
                        Edit
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="neutral-secondary"
                            size="small"
                            className="flex-1"
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
                              This action cannot be undone. This will
                              permanently delete the role and remove it from all
                              users.
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
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="bg-neutral-border flex h-px w-full flex-none flex-col items-center gap-2" />
        <div className="flex w-full flex-col items-center justify-center gap-4 px-12 py-8">
          <span className="text-heading-3 font-heading-3 text-default-font">
            Role System Overview
          </span>
          <div className="text-caption font-caption text-subtext-color max-w-2xl text-center">
            <p>
              This system provides {roles?.length ?? 0} distinct roles with
              different access levels. Roles can be customized with specific
              permissions to create tailored access control for different user
              groups and organizational needs.
            </p>
          </div>
        </div>
      </div>
    </AuthenticatedLayout>
  );
}
