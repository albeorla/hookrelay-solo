"use client";

import { useState } from "react";
import { useMediaQuery } from "~/hooks/use-media-query";
import { Sidebar } from "./sidebar";
import { MobileNav } from "./mobile-nav";
import { cn } from "~/lib/utils";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const isDesktop = useMediaQuery("(min-width: 768px)");

  return (
    <div className="relative flex min-h-screen">
      {/* Desktop Sidebar */}
      {isDesktop && (
        <Sidebar open={sidebarOpen} onOpenChange={setSidebarOpen} />
      )}

      {/* Main Content */}
      <div
        className={cn(
          "flex flex-1 flex-col",
          isDesktop && sidebarOpen && "md:pl-64",
          isDesktop && !sidebarOpen && "md:pl-16",
          !isDesktop && "pb-16", // Space for mobile nav
        )}
      >
        {children}
      </div>

      {/* Mobile Navigation */}
      {!isDesktop && <MobileNav />}
    </div>
  );
}
