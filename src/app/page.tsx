"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "~/components/ui/card";
import { api } from "~/trpc/react";
import { AuthenticatedLayout } from "~/components/layout/authenticated-layout";
import {
  Calendar,
  Activity,
  TrendingUp,
  Users,
  UserCircle,
  Bell,
  Lock,
  CheckCircle,
} from "lucide-react";
import { Badge, getRoleBadgeVariant } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Separator } from "~/components/ui/separator";

function StatCard({
  title,
  value,
  icon: Icon,
  description,
  isLoading,
}: {
  title: string;
  value: React.ReactNode;
  icon: React.ElementType;
  description: string;
  isLoading?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="text-muted-foreground h-4 w-4" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <>
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="mt-1 h-4 w-1/2" />
          </>
        ) : (
          <>
            <div className="text-2xl font-bold">{value}</div>
            <p className="text-muted-foreground text-xs">{description}</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { data: session } = useSession();
  const router = useRouter();

  const { data: userStats, isLoading: isLoadingStats } =
    api.user.getStats.useQuery(
      { userId: session?.user?.id ?? "" },
      { enabled: !!session?.user?.id },
    );

  const isAdmin = session?.user?.roles?.includes("ADMIN");

  const { data: systemStats, isLoading: isLoadingSystem } =
    api.user.getSystemStats.useQuery(undefined, { enabled: !!isAdmin });

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  const getUserInitials = (name?: string | null, email?: string | null) => {
    const displayName = name ?? email ?? "U";
    return displayName
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <AuthenticatedLayout>
      <div className="container mx-auto py-12">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">
            {getGreeting()}, {session?.user?.name?.split(" ")[0] ?? "there"}!
          </h1>
          <p className="text-muted-foreground mt-1">
            Here&apos;s what&apos;s happening with your account today.
          </p>
        </header>

        <div className="mb-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Account Status"
            value="Active"
            icon={Activity}
            description="Member since recently"
            isLoading={isLoadingStats}
          />
          <StatCard
            title="Total Sessions"
            value={userStats?.totalSessions ?? 0}
            icon={TrendingUp}
            description="All time logins"
            isLoading={isLoadingStats}
          />
          <StatCard
            title="Last Login"
            value={
              userStats?.lastLogin
                ? new Intl.DateTimeFormat("en-US", {
                    month: "short",
                    day: "numeric",
                  }).format(userStats.lastLogin)
                : "Today"
            }
            icon={Calendar}
            description={
              userStats?.lastLogin
                ? new Intl.DateTimeFormat("en-US", {
                    hour: "numeric",
                    minute: "numeric",
                  }).format(userStats.lastLogin)
                : "First login"
            }
            isLoading={isLoadingStats}
          />
          <StatCard
            title="Your Roles"
            value={
              <div className="flex flex-wrap gap-1">
                {session?.user?.roles?.map((role) => (
                  <Badge key={role} variant={getRoleBadgeVariant(role)}>
                    {role}
                  </Badge>
                )) ?? (
                  <p className="text-muted-foreground text-sm">
                    No roles assigned
                  </p>
                )}
              </div>
            }
            icon={Users}
            description={`${session?.user?.roles?.length ?? 0} roles assigned`}
            isLoading={isLoadingStats}
          />
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Profile Overview</CardTitle>
                <CardDescription>
                  Your account information and settings.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center space-x-6">
                  <Avatar className="h-20 w-20">
                    <AvatarImage
                      src={session?.user?.image ?? ""}
                      alt={session?.user?.name ?? ""}
                    />
                    <AvatarFallback className="text-2xl">
                      {getUserInitials(
                        session?.user?.name,
                        session?.user?.email,
                      )}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <h3 className="text-2xl font-bold">
                      {session?.user?.name ?? "User"}
                    </h3>
                    <p className="text-muted-foreground">
                      {session?.user?.email}
                    </p>
                  </div>
                </div>
                <Separator />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-muted-foreground text-sm font-medium">
                      Account Type
                    </p>
                    <p>{isAdmin ? "Administrator" : "Standard User"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-sm font-medium">
                      Roles
                    </p>
                    <p>{session?.user?.roles?.join(", ") ?? "N/A"}</p>
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button
                  onClick={() => router.push("/settings/profile")}
                  variant="default"
                >
                  <UserCircle className="mr-2 h-4 w-4" />
                  Edit Profile
                </Button>
              </CardFooter>
            </Card>
          </div>

          <div>
            {isAdmin ? (
              <Card>
                <CardHeader>
                  <CardTitle>System Overview</CardTitle>
                  <CardDescription>
                    Quick insights into system health.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-sm">
                      Total Users
                    </span>
                    <span className="font-semibold">
                      {isLoadingSystem
                        ? "Loading..."
                        : (systemStats?.totalUsers ?? 0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-sm">
                      Active Sessions
                    </span>
                    <span className="font-semibold">
                      {isLoadingSystem
                        ? "Loading..."
                        : (systemStats?.activeSessions ?? 0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-sm">
                      System Status
                    </span>
                    <Badge variant="default">Operational</Badge>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Getting Started</CardTitle>
                  <CardDescription>
                    Complete these steps to get the most out of your account.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <p className="flex-1 text-sm">Sign up successfully</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <UserCircle className="text-muted-foreground h-5 w-5" />
                    <p className="flex-1 text-sm">Complete your profile</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Bell className="text-muted-foreground h-5 w-5" />
                    <p className="flex-1 text-sm">
                      Set notification preferences
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Lock className="text-muted-foreground h-5 w-5" />
                    <p className="flex-1 text-sm">Enable 2FA for security</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </AuthenticatedLayout>
  );
}
