"use client";

import React, { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Plus,
  Edit,
  Trash2,
  User,
  Mail,
  Shield,
  Crown,
  UserCheck,
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
import { api, type RouterOutputs } from "~/trpc/react";
import { UserRoleForm } from "./_components/user-role-form";
import { AuthenticatedLayout } from "~/components/layout/authenticated-layout";

export default function UsersPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  type UserItem = RouterOutputs["user"]["getAll"][number];
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);

  // Always call hooks, but conditionally enable them
  const { data: users, refetch } = api.user.getAll.useQuery(undefined, {
    enabled: session?.user.roles?.includes("ADMIN") ?? false,
  });
  const { data: allRoles } = api.role.getAll.useQuery(undefined, {
    enabled: session?.user.roles?.includes("ADMIN") ?? false,
  });

  const deleteUser = api.user.delete.useMutation({
    onSuccess: () => {
      toast.success("User deleted successfully");
      void refetch();
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast.error(`Failed to delete user: ${message}`);
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

  const handleDeleteUser = (userId: string, _userName: string) => {
    deleteUser.mutate({ id: userId });
  };

  const handleEditUser = (user: UserItem) => {
    setEditingUser(user);
    setIsCreateDialogOpen(true);
  };

  const handleFormSuccess = () => {
    setIsCreateDialogOpen(false);
    setEditingUser(null);
    void refetch();
  };

  const getUserIcon = (userRoles: string[]) => {
    if (userRoles.includes("ADMIN")) {
      return <Crown className="h-5 w-5" />;
    }
    if (userRoles.includes("USER")) {
      return <UserCheck className="h-5 w-5" />;
    }
    return <User className="h-5 w-5" />;
  };

  const getUserStatus = (userRoles: string[]) => {
    if (userRoles.includes("ADMIN")) return "Administrator";
    if (userRoles.includes("USER")) return "Standard User";
    return "Custom Role";
  };

  const getUserVariant = (userRoles: string[]) => {
    if (userRoles.includes("ADMIN")) return "error" as const;
    if (userRoles.includes("USER")) return "neutral" as const;
    return "brand" as const;
  };

  //

  return (
    <AuthenticatedLayout>
      <div className="bg-default-background container flex h-full w-full max-w-none flex-col items-start gap-6 py-12">
        {/* Header */}
        <div className="flex w-full flex-col items-center justify-center gap-6">
          <div className="text-center">
            <h1 className="text-heading-1 font-heading-1 text-default-font">
              User Management
            </h1>
            <p className="text-body font-body text-subtext-color mt-2">
              Manage system users and their role assignments
            </p>
          </div>
          <Dialog
            open={isCreateDialogOpen}
            onOpenChange={setIsCreateDialogOpen}
          >
            <DialogTrigger asChild>
              <Button className="h-12 px-6" size="large">
                <Plus className="mr-2 h-5 w-5" />
                Manage User Roles
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>
                  {editingUser ? "Edit User Roles" : "Manage User Roles"}
                </DialogTitle>
                <DialogDescription>
                  {editingUser
                    ? "Update the user's role assignments below."
                    : "Select a user to manage their role assignments."}
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                {/* Narrow type to UserRoleForm's expected shape */}
                <UserRoleForm
                  user={
                    editingUser as unknown as {
                      id: string;
                      name?: string | null;
                      email?: string | null;
                      roles: { role: { id: string; name: string } }[];
                    } | null
                  }
                  roles={(allRoles ?? []).map((r) => ({
                    id: r.id,
                    name: r.name,
                    description: r.description,
                  }))}
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
          {users?.map((user) => (
            <div
              key={user.id}
              className="flex shrink-0 grow basis-0 flex-col items-start gap-3 overflow-hidden pb-3"
            >
              <div className="border-neutral-border bg-default-background flex w-full flex-col items-start rounded-md border border-solid shadow-sm">
                <div className="flex w-full flex-col items-start gap-2 py-4 pr-3 pl-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <IconWithBackground
                        size="medium"
                        icon={getUserIcon(user.roles.map((r) => r.role.name))}
                      />
                      <div>
                        <span className="text-heading-3 font-heading-3 text-default-font">
                          {user.name ?? "Unnamed User"}
                        </span>
                        <Badge
                          variant={getUserVariant(
                            user.roles.map((r) => r.role.name),
                          )}
                          className="mt-2"
                        >
                          {getUserStatus(user.roles.map((r) => r.role.name))}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-subtext-color text-caption font-caption flex items-center gap-1">
                        <Shield className="h-4 w-4" />
                        {user.roles.length} roles
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-neutral-border flex h-px w-full flex-none flex-col items-center gap-2" />

                <div className="flex w-full flex-col items-start px-4 py-4">
                  <div className="space-y-4">
                    <div className="text-caption font-caption text-subtext-color flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      <span>{user.email}</span>
                    </div>

                    <div>
                      <h4 className="text-body-bold font-body-bold text-default-font mb-2">
                        Assigned Roles
                      </h4>
                      {user.roles.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {user.roles.map((ur) => {
                            const getRoleVariant = (roleName: string) => {
                              if (roleName === "ADMIN") return "error" as const;
                              if (roleName === "USER")
                                return "neutral" as const;
                              return "brand" as const;
                            };

                            return (
                              <Badge
                                key={ur.role.id}
                                variant={getRoleVariant(ur.role.name)}
                                className="text-xs"
                              >
                                {ur.role.name}
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

                    <div>
                      <h4 className="text-body-bold font-body-bold text-default-font mb-2">
                        Effective Permissions
                      </h4>
                      {user.roles.length > 0 ? (
                        <div className="text-caption font-caption text-subtext-color">
                          <p>
                            This user has access to{" "}
                            {user.roles.reduce(
                              (total, ur) => total + ur.role.permissions.length,
                              0,
                            )}{" "}
                            total permissions across all assigned roles.
                          </p>
                        </div>
                      ) : (
                        <p className="text-subtext-color text-caption font-caption italic">
                          No permissions available
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                      <Button
                        variant="neutral-secondary"
                        size="small"
                        onClick={() => handleEditUser(user)}
                        className="flex-1"
                      >
                        <Edit className="mr-2 h-4 w-4" />
                        Manage Roles
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
                              Delete User: {user.name ?? user.email}
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              This action cannot be undone. This will
                              permanently delete the user and remove all their
                              role assignments.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() =>
                                handleDeleteUser(
                                  user.id,
                                  user.name ?? user.email ?? "Unknown User",
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
            User System Overview
          </span>
          <div className="text-caption font-caption text-subtext-color max-w-2xl text-center">
            <p>
              This system manages {users?.length ?? 0} users with different
              access levels through role-based permissions. Users can be
              assigned multiple roles, and each role provides specific
              permissions for secure access control.
            </p>
          </div>
        </div>
      </div>
    </AuthenticatedLayout>
  );
}
