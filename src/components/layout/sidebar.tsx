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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";

const navItems = [
  { href: "/", label: "Dashboard", icon: Home },
  {
    href: "/admin/webhooks",
    label: "Webhooks",
    icon: Webhook,
    admin: true,
  },
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
  { href: "/settings/profile", label: "Settings", icon: Settings },
];

function NavContent({ open }: { open: boolean }) {
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
            <TooltipProvider key={item.href} delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    asChild
                    variant={isActive ? "secondary" : "ghost"}
                    className={cn(
                      "w-full justify-start",
                      !open && "justify-center",
                    )}
                  >
                    <Link href={item.href}>
                      <item.icon className={cn("h-5 w-5", open && "mr-3")} />
                      {open && <span>{item.label}</span>}
                    </Link>
                  </Button>
                </TooltipTrigger>
                {!open && (
                  <TooltipContent side="right">
                    <p>{item.label}</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          );
        })}
      </div>
      <div className="mt-auto space-y-2">
        <div className="flex items-center p-2">
          <Avatar className={cn(open && "mr-3")}>
            <AvatarImage src={session?.user.image ?? undefined} />
            <AvatarFallback>
              {getUserInitials(session?.user.name, session?.user.email)}
            </AvatarFallback>
          </Avatar>
          {open && (
            <div className="flex flex-col">
              <span className="text-sm font-medium">{session?.user.name}</span>
              <span className="text-muted-foreground text-xs">
                {session?.user.email}
              </span>
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          className={cn("w-full justify-start", !open && "justify-center")}
          onClick={() => signOut()}
        >
          <LogOut className={cn("h-5 w-5", open && "mr-3")} />
          {open && <span>Logout</span>}
        </Button>
      </div>
    </div>
  );
}

export function Sidebar({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <aside
      className={cn(
        "bg-background fixed inset-y-0 left-0 z-10 hidden h-full flex-col border-r transition-all md:flex",
        open ? "w-64" : "w-16",
      )}
    >
      <div className="flex h-16 items-center justify-between border-b px-4">
        {open && <h1 className="text-lg font-bold">Solo 🏔️</h1>}
        <Button variant="ghost" size="icon" onClick={() => onOpenChange(!open)}>
          <Menu className="h-5 w-5" />
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <NavContent open={open} />
      </div>
    </aside>
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
        <SheetContent side="left" className="w-64 p-4">
          <SheetHeader>
            <SheetTitle>Solo 🏔️</SheetTitle>
          </SheetHeader>
          <NavContent open={true} />
        </SheetContent>
      </Sheet>
    </div>
  );
}
