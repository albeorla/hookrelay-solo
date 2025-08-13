"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "~/components/ui/sheet";
import { Button } from "~/components/ui/button";
import {
  Home,
  Users,
  ShieldCheck,
  Settings,
  Webhook,
  Menu,
  LogOut,
} from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";

const navItems = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/admin/users", label: "Users", icon: Users, admin: true },
  {
    href: "/admin/roles",
    label: "Roles",
    icon: ShieldCheck,
    admin: true,
  },
  {
    href: "/admin/permissions",
    label: "Permissions",
    icon: ShieldCheck,
    admin: true,
  },
  {
    href: "/admin/webhooks",
    label: "Webhooks",
    icon: Webhook,
    admin: true,
  },
  { href: "/settings/profile", label: "Settings", icon: Settings },
];

function NavContent() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isAdmin = session?.user.roles?.includes("ADMIN");

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
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-2">
        {navItems.map((item) => {
          if (item.admin && !isAdmin) return null;
          const isActive = pathname === item.href;
          return (
            <Button
              asChild
              key={item.href}
              variant={isActive ? "secondary" : "ghost"}
              className="w-full justify-start"
            >
              <Link href={item.href}>
                <item.icon className="mr-3 h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            </Button>
          );
        })}
      </div>
      <div className="mt-auto space-y-2">
        <div className="flex items-center p-2">
          <Avatar className="mr-3">
            <AvatarImage src={session?.user.image ?? undefined} />
            <AvatarFallback>
              {getUserInitials(session?.user.name, session?.user.email)}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="text-sm font-medium">{session?.user.name}</span>
            <span className="text-muted-foreground text-xs">
              {session?.user.email}
            </span>
          </div>
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start"
          onClick={() => signOut()}
        >
          <LogOut className="mr-3 h-5 w-5" />
          <span>Logout</span>
        </Button>
      </div>
    </div>
  );
}

export function MobileNav() {
  return (
    <div className="bg-background fixed right-0 bottom-0 left-0 border-t p-2 md:hidden">
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon">
            <Menu className="h-6 w-6" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="flex w-64 flex-col p-4">
          <SheetHeader>
            <SheetTitle>My App</SheetTitle>
          </SheetHeader>
          <div className="flex-1 py-4">
            <NavContent />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
