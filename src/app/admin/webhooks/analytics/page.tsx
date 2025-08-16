"use client";

import React from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, BarChart3 } from "lucide-react";
import { Button } from "~/components/ui/button";
import { AuthenticatedLayout } from "~/components/layout/authenticated-layout";
import { WebhookErrorBoundary } from "~/components/error-boundary";
import { AnalyticsCharts } from "../_components/analytics-charts";

export default function WebhookAnalyticsPage() {
  const { data: session } = useSession();
  const router = useRouter();

  React.useEffect(() => {
    if (session && !session.user.roles?.includes("ADMIN")) {
      router.push("/");
    }
  }, [session, router]);

  if (!session?.user.roles?.includes("ADMIN")) {
    return null;
  }

  return (
    <AuthenticatedLayout>
      <WebhookErrorBoundary>
        <div className="container mx-auto py-8">
          {/* Header */}
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/admin/webhooks/dashboard">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Dashboard
                </Link>
              </Button>
              <div>
                <div className="flex items-center gap-3">
                  <BarChart3 className="text-primary h-8 w-8" />
                  <h1 className="text-3xl font-bold tracking-tight">
                    Webhook Analytics
                  </h1>
                </div>
                <p className="text-muted-foreground mt-2">
                  Analyze webhook delivery trends, performance metrics, and
                  system health
                </p>
              </div>
            </div>
          </div>

          {/* Analytics Charts */}
          <AnalyticsCharts />
        </div>
      </WebhookErrorBoundary>
    </AuthenticatedLayout>
  );
}
