"use client";

import { useSession } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import {
  Home,
  Users,
  Shield,
  Key,
  Settings,
  LogOut,
  ChevronLeft,
  Menu,
  User,
  UserCircle,
} from "lucide-react";
import { ThemeToggle } from "~/components/ui/theme-toggle";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { signOut } from "next-auth/react";

interface SidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function Sidebar({ open, onOpenChange }: SidebarProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const isAdmin = session?.user?.roles?.includes("ADMIN");

  const navigation = [
    {
      name: "Dashboard",
      href: "/",
      icon: Home,
      show: true,
    },
  ];

  const adminNavigation = [
    {
      name: "Users",
      href: "/admin/users",
      icon: Users,
      show: isAdmin,
    },
    {
      name: "Roles",
      href: "/admin/roles",
      icon: Shield,
      show: isAdmin,
    },
    {
      name: "Permissions",
      href: "/admin/permissions",
      icon: Key,
      show: isAdmin,
    },
  ];

  const settingsNavigation = [
    {
      name: "Profile",
      href: "/settings/profile",
      icon: UserCircle,
      show: true,
    },
  ];

  const filteredAdminNavigation = adminNavigation.filter((item) => item.show);
  const filteredSettingsNavigation = settingsNavigation.filter(
    (item) => item.show,
  );

  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/auth" });
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
    <TooltipProvider delayDuration={0}>
      <div
        className={cn(
          "bg-background fixed top-0 left-0 z-40 h-full border-r transition-all duration-300",
          open ? "w-64" : "w-16",
        )}
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex h-16 items-center justify-between border-b px-4">
            {open ? (
              <>
                <h2 className="text-lg font-semibold">Dashboard</h2>
                <div className="flex items-center gap-1">
                  <ThemeToggle />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onOpenChange(false)}
                    className="h-8 w-8"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onOpenChange(true)}
                  className="h-8 w-8"
                >
                  <Menu className="h-4 w-4" />
                </Button>
                <ThemeToggle />
              </div>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-4 px-2 py-4">
            {/* Main Navigation */}
            <div className="space-y-1">
              {navigation.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;

                return (
                  <Tooltip key={item.href}>
                    <TooltipTrigger asChild>
                      <Button
                        variant={isActive ? "secondary" : "ghost"}
                        className={cn(
                          "w-full justify-start",
                          !open && "justify-center px-2",
                        )}
                        onClick={() => router.push(item.href)}
                      >
                        <Icon className={cn("h-5 w-5", open && "mr-3")} />
                        {open && <span>{item.name}</span>}
                      </Button>
                    </TooltipTrigger>
                    {!open && (
                      <TooltipContent side="right">
                        <p>{item.name}</p>
                      </TooltipContent>
                    )}
                  </Tooltip>
                );
              })}
            </div>

            {/* Admin Section */}
            {filteredAdminNavigation.length > 0 && (
              <div className="space-y-1">
                {open && (
                  <h3 className="text-muted-foreground px-3 text-xs font-medium uppercase">
                    Administration
                  </h3>
                )}
                {filteredAdminNavigation.map((item) => {
                  const isActive = pathname === item.href;
                  const Icon = item.icon;

                  return (
                    <Tooltip key={item.href}>
                      <TooltipTrigger asChild>
                        <Button
                          variant={isActive ? "secondary" : "ghost"}
                          className={cn(
                            "w-full justify-start",
                            !open && "justify-center px-2",
                          )}
                          onClick={() => router.push(item.href)}
                        >
                          <Icon className={cn("h-5 w-5", open && "mr-3")} />
                          {open && <span>{item.name}</span>}
                        </Button>
                      </TooltipTrigger>
                      {!open && (
                        <TooltipContent side="right">
                          <p>{item.name}</p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  );
                })}
              </div>
            )}

            {/* Settings Section */}
            <div className="space-y-1">
              {open && (
                <h3 className="text-muted-foreground px-3 text-xs font-medium uppercase">
                  Settings
                </h3>
              )}
              {filteredSettingsNavigation.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;

                return (
                  <Tooltip key={item.href}>
                    <TooltipTrigger asChild>
                      <Button
                        variant={isActive ? "secondary" : "ghost"}
                        className={cn(
                          "w-full justify-start",
                          !open && "justify-center px-2",
                        )}
                        onClick={() => router.push(item.href)}
                      >
                        <Icon className={cn("h-5 w-5", open && "mr-3")} />
                        {open && <span>{item.name}</span>}
                      </Button>
                    </TooltipTrigger>
                    {!open && (
                      <TooltipContent side="right">
                        <p>{item.name}</p>
                      </TooltipContent>
                    )}
                  </Tooltip>
                );
              })}
            </div>
          </nav>

          {/* User Menu */}
          <div className="border-t p-4">
            {session?.user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className={cn(
                      "w-full",
                      open ? "justify-start" : "justify-center px-2",
                    )}
                  >
                    <Avatar className={cn("h-8 w-8", open && "mr-3")}>
                      <AvatarImage
                        src={session.user.image ?? ""}
                        alt={session.user.name ?? ""}
                      />
                      <AvatarFallback>
                        {getUserInitials(
                          session.user.name,
                          session.user.email ?? "",
                        )}
                      </AvatarFallback>
                    </Avatar>
                    {open && (
                      <div className="flex flex-col items-start">
                        <span className="text-sm font-medium">
                          {session.user.name ?? "User"}
                        </span>
                        <span className="text-muted-foreground text-xs">
                          {session.user.email}
                        </span>
                      </div>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align={open ? "end" : "center"}
                  side={open ? "top" : "right"}
                  className="w-56"
                >
                  <DropdownMenuLabel>My Account</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => router.push("/settings/profile")}
                  >
                    <User className="mr-2 h-4 w-4" />
                    Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push("/settings")}>
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
