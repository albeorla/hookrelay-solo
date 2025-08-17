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
          isDesktop && sidebarOpen && "md:pl-[calc(16rem+1rem)]",
          isDesktop && !sidebarOpen && "md:pl-[calc(4rem+1rem)]",
          !isDesktop && "pb-16", // Space for mobile nav
        )}
      >
        <div className="mx-auto w-full max-w-7xl py-4 pr-4 pl-4 sm:pr-6 md:py-6 md:pl-0 lg:pr-8">
          {children}
        </div>
      </div>

      {/* Mobile Navigation */}
      {!isDesktop && <MobileNav />}
    </div>
  );
}
