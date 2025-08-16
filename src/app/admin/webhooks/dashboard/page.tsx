"use client";

import React, { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Activity,
  AlertCircle,
  BarChart3,
  CheckCircle,
  Clock,
  Download,
  ExternalLink,
  Gauge,
  Plus,
  RefreshCw,
  Settings,
  TrendingUp,
  Webhook,
  XCircle,
  Zap,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Separator } from "~/components/ui/separator";
import { AuthenticatedLayout } from "~/components/layout/authenticated-layout";
import { api } from "~/trpc/react";
import { WebhookTestTool } from "../_components/webhook-test-tool";
import { WebhookErrorBoundary } from "~/components/error-boundary";
import { ExportDialog } from "../_components/export-dialog";
import {
  RealtimeStatus,
  RealtimeStatsCard,
} from "../_components/realtime-status";
import {
  HealthAlertsCard,
  HealthMonitoringBanner,
  HealthThresholdsDialog,
} from "../_components/health-alerts";
import {
  DashboardMetricsSkeleton,
  RecentActivitySkeleton,
} from "../_components/loading-skeletons";
import {
  usePerformanceMonitor,
  QueryOptimizations,
} from "~/hooks/use-optimized-query";

export default function WebhooksDashboardPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  // Performance optimizations
  // removed unused loadingState

  // Data fetching with real-time updates and optimized query options
  const {
    data: stats,
    refetch: refetchStats,
    isLoading: statsLoading,
    isFetching: statsFetching,
  } = api.webhook.getStats.useQuery(undefined, {
    enabled: session?.user.roles?.includes("ADMIN") ?? false,
    ...QueryOptimizations.realtime,
  });

  const {
    data: endpoints,
    refetch: refetchEndpoints,
    isLoading: endpointsLoading,
    isFetching: endpointsFetching,
  } = api.webhook.getEndpoints.useQuery(undefined, {
    enabled: session?.user.roles?.includes("ADMIN") ?? false,
    ...QueryOptimizations.dashboard,
  });

  const {
    data: recentDeliveries,
    refetch: refetchDeliveries,
    isLoading: deliveriesLoading,
    isFetching: deliveriesFetching,
  } = api.webhook.getRecentDeliveries.useQuery(
    { limit: 10 },
    {
      enabled: session?.user.roles?.includes("ADMIN") ?? false,
      ...QueryOptimizations.realtime,
    },
  );

  React.useEffect(() => {
    if (session && !session.user.roles?.includes("ADMIN")) {
      router.push("/");
    }
  }, [session, router]);

  // Performance monitoring (must be called consistently across renders)
  usePerformanceMonitor("WebhooksDashboardPage");

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refetchStats(),
        refetchEndpoints(),
        refetchDeliveries(),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "pending":
        return <Clock className="h-4 w-4 text-blue-500" />;
      case "retrying":
        return <RefreshCw className="h-4 w-4 text-yellow-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const getHealthStatus = () => {
    if (!stats || typeof stats.successRate !== "number") return "unknown";
    const { successRate } = stats;
    if (successRate >= 99) return "excellent";
    if (successRate >= 95) return "good";
    if (successRate >= 90) return "fair";
    return "poor";
  };

  const getHealthColor = (status: string) => {
    switch (status) {
      case "excellent":
        return "text-green-500";
      case "good":
        return "text-blue-500";
      case "fair":
        return "text-yellow-500";
      case "poor":
        return "text-red-500";
      default:
        return "text-gray-500";
    }
  };

  // Critical alerts logic
  const criticalAlerts = [];
  if (stats?.successRate && stats.successRate < 90) {
    criticalAlerts.push({
      type: "warning" as const,
      title: "Low Success Rate",
      message: `Current success rate is ${stats.successRate}%. Consider investigating failed deliveries.`,
    });
  }
  if (stats?.queue?.approximate && stats.queue.approximate > 100) {
    criticalAlerts.push({
      type: "error" as const,
      title: "High Queue Backlog",
      message: `${stats.queue.approximate} messages in queue. System may be experiencing delays.`,
    });
  }

  // Authorization guard rendered later to avoid conditional hook order
  const isAdmin = session?.user.roles?.includes("ADMIN") ?? false;

  // Optimized loading states
  const isInitialLoading =
    statsLoading || endpointsLoading || deliveriesLoading;
  const isFetching = statsFetching || endpointsFetching || deliveriesFetching;
  // removed unused isLoading

  return (
    <AuthenticatedLayout>
      <WebhookErrorBoundary>
        {!isAdmin ? null : (
          <div className="container mx-auto py-8">
            {/* Header */}
            <div className="mb-8 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl font-bold tracking-tight">
                    Webhook Reliability Dashboard
                  </h1>
                  <RealtimeStatus />
                </div>
                <p className="text-muted-foreground mt-2">
                  Monitor webhook deliveries and system health in real-time
                </p>
              </div>
              <div className="flex items-center gap-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={refreshing || isInitialLoading}
                >
                  <RefreshCw
                    className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
                  />
                  Refresh
                </Button>
                <Button asChild>
                  <Link href="/admin/webhooks">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Endpoint
                  </Link>
                </Button>
              </div>
            </div>

            {/* Health Monitoring Banner */}
            <HealthMonitoringBanner />

            {/* Critical Alerts */}
            {criticalAlerts.length > 0 && (
              <div className="mb-6 space-y-4">
                {criticalAlerts.map((alert, index) => (
                  <Alert
                    key={index}
                    variant={alert.type === "error" ? "destructive" : "default"}
                  >
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>{alert.title}</AlertTitle>
                    <AlertDescription>{alert.message}</AlertDescription>
                  </Alert>
                ))}
              </div>
            )}

            {/* Health Metrics */}
            <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
              {isInitialLoading ? (
                <DashboardMetricsSkeleton />
              ) : (
                <>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium">
                        System Health
                      </CardTitle>
                      <Gauge
                        className={`h-4 w-4 ${getHealthColor(getHealthStatus())}`}
                      />
                    </CardHeader>
                    <CardContent>
                      <div
                        className={`text-2xl font-bold ${getHealthColor(getHealthStatus())}`}
                      >
                        {getHealthStatus().toUpperCase()}
                      </div>
                      <p className="text-muted-foreground text-xs">
                        {stats?.successRate}% success rate
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium">
                        Total Deliveries
                      </CardTitle>
                      <BarChart3 className="text-muted-foreground h-4 w-4" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {stats?.totalDeliveries?.toLocaleString() ?? 0}
                      </div>
                      <p className="text-muted-foreground flex items-center text-xs">
                        <TrendingUp className="mr-1 h-3 w-3" />
                        Last 24 hours
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium">
                        Active Endpoints
                      </CardTitle>
                      <Activity className="text-muted-foreground h-4 w-4" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {endpoints?.length ?? 0}
                      </div>
                      <p className="text-muted-foreground text-xs">
                        {endpoints?.filter((e) => e.isActive).length ?? 0}{" "}
                        enabled
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium">
                        Queue Status
                      </CardTitle>
                      <Zap className="text-muted-foreground h-4 w-4" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {stats?.queue?.approximate ?? 0}
                      </div>
                      <p className="text-muted-foreground text-xs">
                        messages pending
                      </p>
                    </CardContent>
                  </Card>
                </>
              )}
            </div>

            {/* Delivery Status Breakdown */}
            {stats?.deliveries && (
              <div className="mb-8">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Activity className="mr-2 h-5 w-5" />
                      Delivery Status Breakdown
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-500">
                          {stats.totalDeliveries -
                            (stats.deliveries?.failed ?? 0) -
                            (stats.deliveries?.pending ?? 0) -
                            (stats.deliveries?.retrying ?? 0)}
                        </div>
                        <p className="text-muted-foreground text-sm">
                          Successful
                        </p>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-red-500">
                          {stats.deliveries?.failed ?? 0}
                        </div>
                        <p className="text-muted-foreground text-sm">Failed</p>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-500">
                          {stats.deliveries?.pending ?? 0}
                        </div>
                        <p className="text-muted-foreground text-sm">Pending</p>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-yellow-500">
                          {stats.deliveries?.retrying ?? 0}
                        </div>
                        <p className="text-muted-foreground text-sm">
                          Retrying
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Real-time Delivery Feed */}
            <div className="mb-8">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center">
                    <Webhook className="mr-2 h-5 w-5" />
                    Recent Delivery Activity
                    {isFetching && (
                      <RefreshCw className="ml-2 h-4 w-4 animate-spin" />
                    )}
                  </CardTitle>
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/admin/webhooks/deliveries">
                      View All
                      <ExternalLink className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </CardHeader>
                <CardContent>
                  {deliveriesLoading ? (
                    <RecentActivitySkeleton />
                  ) : recentDeliveries && recentDeliveries.length > 0 ? (
                    <div className="space-y-3">
                      {recentDeliveries.map((delivery: any) => (
                        <div
                          key={delivery.id}
                          className="flex items-center justify-between rounded-lg border p-3"
                        >
                          <div className="flex items-center gap-3">
                            {getStatusIcon(delivery.status)}
                            <div>
                              <div className="font-medium">
                                {delivery.endpointId}
                              </div>
                              <div className="text-muted-foreground text-sm">
                                {delivery.destUrl}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <Badge
                              variant={
                                delivery.status === "success"
                                  ? "default"
                                  : delivery.status === "failed"
                                    ? "destructive"
                                    : delivery.status === "retrying"
                                      ? "secondary"
                                      : "outline"
                              }
                            >
                              {delivery.status}
                            </Badge>
                            {delivery.responseStatus && (
                              <Badge variant="outline">
                                {delivery.responseStatus}
                              </Badge>
                            )}
                            {delivery.durationMs && (
                              <span className="text-muted-foreground text-xs">
                                {delivery.durationMs}ms
                              </span>
                            )}
                            <div className="text-muted-foreground text-xs">
                              {formatTimestamp(delivery.timestamp)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-8 text-center">
                      <Webhook className="text-muted-foreground/50 mx-auto h-12 w-12" />
                      <h3 className="mt-4 text-lg font-medium">
                        No recent deliveries
                      </h3>
                      <p className="text-muted-foreground mt-2">
                        Webhook deliveries will appear here as they occur
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <RealtimeStatsCard />

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Plus className="mr-2 h-5 w-5" />
                    Quick Actions
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button className="w-full" asChild>
                    <Link href="/admin/webhooks">Create New Endpoint</Link>
                  </Button>
                  <Button variant="outline" className="w-full" asChild>
                    <Link href="/admin/webhooks/deliveries">
                      View All Deliveries
                    </Link>
                  </Button>
                  <Button variant="outline" className="w-full" asChild>
                    <Link href="/admin/webhooks/deliveries?status=failed">
                      View Failed Deliveries
                    </Link>
                  </Button>
                  <Button variant="outline" className="w-full" asChild>
                    <Link href="/admin/webhooks/analytics">
                      <BarChart3 className="mr-2 h-4 w-4" />
                      View Analytics
                    </Link>
                  </Button>
                  <Button variant="outline" className="w-full" asChild>
                    <Link href="/admin/webhooks/dlq">Dead Letter Queue</Link>
                  </Button>
                  <HealthThresholdsDialog
                    trigger={
                      <Button variant="outline" className="w-full">
                        <Settings className="mr-2 h-4 w-4" />
                        Health Config
                      </Button>
                    }
                  />
                  <ExportDialog
                    trigger={
                      <Button variant="outline" className="w-full">
                        <Download className="mr-2 h-4 w-4" />
                        Export Logs
                      </Button>
                    }
                    defaultFilters={{}}
                    selectedItems={[]}
                  />
                  {endpoints && endpoints.length > 0 && endpoints[0] && (
                    <WebhookTestTool
                      endpointId={endpoints[0].id}
                      trigger={
                        <Button variant="outline" className="w-full">
                          <Zap className="mr-2 h-4 w-4" />
                          Test Webhook
                        </Button>
                      }
                    />
                  )}
                </CardContent>
              </Card>

              <HealthAlertsCard />
            </div>

            <Separator className="my-8" />

            {/* Footer */}
            <div className="text-muted-foreground text-center text-sm">
              Dashboard updates automatically every few seconds. Last updated:{" "}
              {new Date().toLocaleTimeString()}
            </div>
          </div>
        )}
      </WebhookErrorBoundary>
    </AuthenticatedLayout>
  );
}
