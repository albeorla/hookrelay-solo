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

  const getPermissionIcon = (permissionName: string) => {
    if (
      permissionName.includes("manage:users") ||
      permissionName.includes("view:users")
    ) {
      return <Users className="h-5 w-5" />;
    }
    if (
      permissionName.includes("manage:webhooks") ||
      permissionName.includes("view:webhooks")
    ) {
      return <Settings className="h-5 w-5" />;
    }
    if (
      permissionName.includes("manage:content") ||
      permissionName.includes("view:content")
    ) {
      return <Eye className="h-5 w-5" />;
    }
    if (
      permissionName.includes("manage:own_profile") ||
      permissionName.includes("view:own_profile")
    ) {
      return <Lock className="h-5 w-5" />;
    }
    return <Key className="h-5 w-5" />;
  };

  const getPermissionCategory = (permissionName: string) => {
    if (permissionName.includes("manage:")) return "Administrative";
    if (permissionName.includes("view:")) return "Read Access";
    return "General";
  };

  const getPermissionVariant = (permissionName: string) => {
    if (permissionName.includes("manage:")) return "error" as const;
    if (permissionName.includes("view:")) return "neutral" as const;
    return "brand" as const;
  };

  return (
    <AuthenticatedLayout>
      <div className="bg-default-background container flex h-full w-full max-w-none flex-col items-start gap-6 py-12">
        {/* Header */}
        <div className="flex w-full flex-col items-center justify-center gap-6">
          <div className="text-center">
            <h1 className="text-heading-1 font-heading-1 text-default-font">
              Permission Management
            </h1>
            <p className="text-body font-body text-subtext-color mt-2">
              Manage system permissions and their role assignments
            </p>
          </div>
          <Dialog
            open={isCreateDialogOpen}
            onOpenChange={setIsCreateDialogOpen}
          >
            <DialogTrigger asChild>
              <Button className="h-12 px-6" size="large">
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
        </div>

        {/* Divider */}
        <div className="bg-neutral-border flex h-px w-full flex-none flex-col items-center gap-2" />

        {/* Main Content */}
        <div className="grid w-full grid-cols-1 flex-wrap items-start gap-6 md:grid-cols-2 lg:grid-cols-3">
          {permissions?.map((permission) => (
            <div
              key={permission.id}
              className="flex shrink-0 grow basis-0 flex-col items-start gap-3 overflow-hidden pb-3"
            >
              <div className="border-neutral-border bg-default-background flex w-full flex-col items-start rounded-md border border-solid shadow-sm">
                <div className="flex w-full flex-col items-start gap-2 py-4 pr-3 pl-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <IconWithBackground
                        size="medium"
                        icon={getPermissionIcon(permission.name)}
                      />
                      <div>
                        <span className="text-heading-3 font-heading-3 text-default-font">
                          {permission.name}
                        </span>
                        <Badge
                          variant={getPermissionVariant(permission.name)}
                          className="mt-2"
                        >
                          {getPermissionCategory(permission.name)}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-subtext-color text-caption font-caption flex items-center gap-1">
                        <Shield className="h-4 w-4" />
                        {permission.roles.length} roles
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-neutral-border flex h-px w-full flex-none flex-col items-center gap-2" />

                <div className="flex w-full flex-col items-start px-4 py-4">
                  <div className="space-y-4">
                    <div>
                      <p className="text-body font-body text-subtext-color leading-relaxed">
                        {permission.description ?? "No description provided"}
                      </p>
                    </div>

                    <div>
                      <h4 className="text-body-bold font-body-bold text-default-font mb-2">
                        Assigned Roles
                      </h4>
                      {permission.roles.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {permission.roles.map((rp) => {
                            const getBadgeVariant = (roleName: string) => {
                              switch (roleName.toLowerCase()) {
                                case "admin":
                                  return "error" as const;
                                case "user":
                                  return "neutral" as const;
                                case "test":
                                  return "brand" as const;
                                default:
                                  return "neutral" as const;
                              }
                            };

                            return (
                              <Badge
                                key={rp.role.id}
                                variant={getBadgeVariant(rp.role.name)}
                                className="text-xs"
                              >
                                {rp.role.name}
                              </Badge>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-subtext-color text-caption font-caption italic">
                          No roles assigned
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                      <Button
                        variant="neutral-secondary"
                        size="small"
                        onClick={() => handleEditPermission(permission)}
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
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="bg-neutral-border flex h-px w-full flex-none flex-col items-center gap-2" />
        <div className="flex w-full flex-col items-center justify-center gap-4 px-12 py-8">
          <span className="text-heading-3 font-heading-3 text-default-font">
            Permission System Overview
          </span>
          <div className="text-caption font-caption text-subtext-color max-w-2xl text-center">
            <p>
              This system provides granular access control with{" "}
              {permissions?.length ?? 0} distinct permissions covering user
              management, content administration, webhook operations, and system
              analytics. Each permission can be assigned to multiple roles for
              flexible access control.
            </p>
          </div>
        </div>
      </div>
    </AuthenticatedLayout>
  );
}
