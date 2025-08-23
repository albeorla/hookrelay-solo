"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { AppShell } from "./app-shell";
import { WebSocketProvider } from "~/contexts/websocket-context";

interface AuthenticatedLayoutProps {
  children: React.ReactNode;
}

export function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  const { status } = useSession();
  const router = useRouter();

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="border-primary mx-auto h-12 w-12 animate-spin rounded-full border-b-2"></div>
          <p className="text-muted-foreground mt-4">Loading...</p>
        </div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    router.replace("/auth");
    return null;
  }

  return (
    <WebSocketProvider>
      <AppShell>{children}</AppShell>
    </WebSocketProvider>
  );
}
