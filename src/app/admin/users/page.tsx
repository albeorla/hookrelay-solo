"use client";

import React, { useDeferredValue, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Edit, Trash2, RefreshCcw, MoreVertical } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "~/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Separator } from "~/components/ui/separator";
import { api, type RouterOutputs } from "~/trpc/react";
import { UserRoleForm } from "./_components/user-role-form";
import { AuthenticatedLayout } from "~/components/layout/authenticated-layout";
import { EmptyState } from "~/components/ui/empty-state";
import { SkeletonUserCard } from "~/components/ui/skeleton-card";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";

export default function UsersPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  type UserItem = RouterOutputs["user"]["getAll"][number];
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [sortOption, setSortOption] = useState<
    "name_asc" | "name_desc" | "roles_desc" | "roles_asc"
  >("name_asc");
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const {
    data: users,
    refetch,
    isLoading: isLoadingUsers,
    isError: isUsersError,
  } = api.user.getAll.useQuery(undefined, {
    enabled: session?.user.roles?.includes("ADMIN") ?? false,
  });
  const { data: allRoles, isLoading: isLoadingRoles } =
    api.role.getAll.useQuery(undefined, {
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

  React.useEffect(() => {
    if (session && !session.user.roles?.includes("ADMIN")) {
      router.push("/");
    }
  }, [session, router]);

  const handleDeleteUser = (userId: string) => {
    deleteUser.mutate({ id: userId });
  };

  const handleEditUserRoles = (user: UserItem) => {
    setEditingUser(user);
    setIsRoleDialogOpen(true);
  };

  const handleRoleFormSuccess = () => {
    setIsRoleDialogOpen(false);
    setEditingUser(null);
    void refetch();
  };

  const filteredAndSortedUsers = useMemo(() => {
    const base = users ?? [];
    const normalizedQuery = deferredSearchQuery.trim().toLowerCase();

    const filtered = base.filter((user) => {
      const matchesSearch =
        !normalizedQuery ||
        [user.name ?? "", user.email ?? ""].some((v) =>
          v.toLowerCase().includes(normalizedQuery),
        );
      const matchesRole =
        roleFilter === "ALL" ||
        user.roles.some((ur) => ur.role.id === roleFilter);
      return matchesSearch && matchesRole;
    });

    return [...filtered].sort((a, b) => {
      switch (sortOption) {
        case "name_desc":
          return (b.name ?? b.email ?? "").localeCompare(
            a.name ?? a.email ?? "",
          );
        case "roles_desc":
          return b.roles.length - a.roles.length;
        case "roles_asc":
          return a.roles.length - b.roles.length;
        case "name_asc":
        default:
          return (a.name ?? a.email ?? "").localeCompare(
            b.name ?? b.email ?? "",
          );
      }
    });
  }, [users, roleFilter, sortOption, deferredSearchQuery]);

  const getUserInitials = (name?: string | null, email?: string | null) => {
    const displayName = name ?? email ?? "U";
    return displayName
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (!session?.user.roles?.includes("ADMIN")) {
    return null;
  }

  return (
    <AuthenticatedLayout>
      <div className="container mx-auto py-12">
        <header className="mb-8 text-center">
          <h1 className="text-4xl font-bold tracking-tight">User Management</h1>
          <p className="text-muted-foreground mt-2">
            Manage system users and their role assignments
          </p>
        </header>

        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center">
          <Input
            placeholder="Search name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-sm"
          />
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Roles</SelectItem>
              {(allRoles ?? []).map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={sortOption}
            onValueChange={(v) => setSortOption(v as typeof sortOption)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name_asc">Name (A-Z)</SelectItem>
              <SelectItem value="name_desc">Name (Z-A)</SelectItem>
              <SelectItem value="roles_desc">Roles (High-Low)</SelectItem>
              <SelectItem value="roles_asc">Roles (Low-High)</SelectItem>
            </SelectContent>
          </Select>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              <RefreshCcw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>

        <Separator className="mb-8" />

        {isLoadingUsers || isLoadingRoles ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonUserCard key={i} />
            ))}
          </div>
        ) : isUsersError ? (
          <EmptyState
            title="Failed to load users"
            description="Please try refreshing the list."
            action={
              <Button onClick={() => void refetch()}>
                <RefreshCcw className="mr-2 h-4 w-4" /> Try again
              </Button>
            }
          />
        ) : filteredAndSortedUsers.length === 0 ? (
          <EmptyState
            title="No matching users"
            description="Try adjusting your search or filters."
            action={
              <Button
                variant="outline"
                onClick={() => {
                  setSearchQuery("");
                  setRoleFilter("ALL");
                }}
              >
                Clear Filters
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredAndSortedUsers.map((user) => (
              <Card key={user.id} className="flex flex-col">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={user.image ?? ""} />
                        <AvatarFallback>
                          {getUserInitials(user.name, user.email)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <CardTitle>{user.name ?? "Unnamed User"}</CardTitle>
                        <CardDescription>{user.email}</CardDescription>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => handleEditUserRoles(user)}
                        >
                          <Edit className="mr-2 h-4 w-4" />
                          Manage Roles
                        </DropdownMenuItem>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <DropdownMenuItem
                              onSelect={(e) => e.preventDefault()}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete User
                            </DropdownMenuItem>
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
                                onClick={() => handleDeleteUser(user.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent className="flex-grow space-y-4">
                  <div>
                    <h4 className="mb-2 font-semibold">Assigned Roles</h4>
                    {user.roles.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {user.roles.map((ur) => (
                          <Badge
                            key={ur.role.id}
                            variant={getRoleBadgeVariant(ur.role.name)}
                          >
                            {ur.role.name}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-sm italic">
                        No roles assigned
                      </p>
                    )}
                  </div>
                  <div>
                    <h4 className="mb-2 font-semibold">
                      Effective Permissions
                    </h4>
                    <p className="text-muted-foreground text-sm">
                      {user.roles.reduce(
                        (total, ur) => total + ur.role.permissions.length,
                        0,
                      )}{" "}
                      total permissions
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={isRoleDialogOpen} onOpenChange={setIsRoleDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>
                Manage Roles for {editingUser?.name ?? "User"}
              </DialogTitle>
              <DialogDescription>
                Select the roles to assign to this user.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              {editingUser && (
                <UserRoleForm
                  user={editingUser}
                  roles={(allRoles ?? []).map((r) => ({
                    id: r.id,
                    name: r.name,
                    description: r.description,
                  }))}
                  onSuccess={handleRoleFormSuccess}
                />
              )}
            </div>
          </DialogContent>
        </Dialog>

        <Separator className="my-8" />

        <footer className="text-center">
          <h3 className="text-2xl font-semibold">User System Overview</h3>
          <p className="text-muted-foreground mx-auto mt-2 max-w-2xl">
            This system manages {filteredAndSortedUsers.length ?? 0} users with
            different access levels through role-based permissions.
          </p>
        </footer>
      </div>
    </AuthenticatedLayout>
  );
}
