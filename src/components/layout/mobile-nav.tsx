"use client";

import { useSession } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { Home, Users, Shield, Settings as SettingsIcon } from "lucide-react";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";

export function MobileNav() {
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const isAdmin = session?.user?.roles?.includes("ADMIN");

  // For mobile, we'll show only the most important items
  const navigation = [
    {
      name: "Home",
      href: "/",
      icon: Home,
      show: true,
    },
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
      name: "Settings",
      href: "/settings/profile",
      icon: SettingsIcon,
      show: true,
    },
  ];

  const filteredNavigation = navigation.filter((item) => item.show);

  return (
    <div className="bg-background fixed right-0 bottom-0 left-0 z-40 border-t md:hidden">
      <nav className="flex items-center justify-around px-2 py-2">
        {filteredNavigation.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Button
              key={item.href}
              variant="ghost"
              size="sm"
              className={cn(
                "flex h-auto min-w-0 flex-col items-center gap-1 px-3 py-2",
                isActive && "text-primary",
              )}
              onClick={() => router.push(item.href)}
            >
              <Icon
                className={cn(
                  "h-5 w-5",
                  isActive ? "text-primary" : "text-muted-foreground",
                )}
              />
              <span
                className={cn(
                  "text-xs",
                  isActive ? "font-medium" : "text-muted-foreground",
                )}
              >
                {item.name}
              </span>
            </Button>
          );
        })}
      </nav>
    </div>
  );
}
