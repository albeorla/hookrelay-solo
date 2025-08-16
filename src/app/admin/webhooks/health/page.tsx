"use client";

import React, { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Activity,
  AlertTriangle,
  Bell,
  CheckCircle,
  Clock,
  Settings,
  Shield,
  TrendingUp,
  RefreshCw,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Switch } from "~/components/ui/switch";
// removed unused Separator
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { AuthenticatedLayout } from "~/components/layout/authenticated-layout";
import { WebhookErrorBoundary } from "~/components/error-boundary";
import { HealthThresholdsDialog } from "../_components/health-alerts";
import { RealtimeStatus } from "../_components/realtime-status";
import { api } from "~/trpc/react";

export default function HealthMonitoringPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [showResolved, setShowResolved] = useState(false);

  // Fetch health data
  const {
    data: healthAlerts,
    refetch: refetchAlerts,
    isLoading: alertsLoading,
  } = api.webhook.getHealthAlerts.useQuery({
    includeResolved: showResolved,
    limit: 50,
  });

  const {
    data: healthConfig,
    refetch: refetchConfig,
    isLoading: configLoading,
  } = api.webhook.getHealthConfig.useQuery();

  const { data: stats } = api.webhook.getStats.useQuery(undefined, {
    refetchInterval: 30000, // Update every 30 seconds
  });

  React.useEffect(() => {
    if (session && !session.user.roles?.includes("ADMIN")) {
      router.push("/");
    }
  }, [session, router]);

  if (!session?.user.roles?.includes("ADMIN")) {
    return null;
  }

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetchAlerts(), refetchConfig()]);
    } finally {
      setRefreshing(false);
    }
  };

  const activeAlerts = healthAlerts?.alerts?.filter((a) => !a.resolved) || [];
  const criticalAlerts = activeAlerts.filter((a) => a.severity === "critical");

  const getHealthStatusBadge = () => {
    if (criticalAlerts.length > 0) {
      return <Badge variant="destructive">CRITICAL</Badge>;
    }
    if (activeAlerts.length > 0) {
      return <Badge variant="secondary">WARNING</Badge>;
    }
    return <Badge variant="default">HEALTHY</Badge>;
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "critical":
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case "high":
        return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      case "medium":
        return <Bell className="h-4 w-4 text-yellow-500" />;
      case "low":
        return <Activity className="h-4 w-4 text-blue-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <AuthenticatedLayout>
      <WebhookErrorBoundary>
        <div className="container mx-auto py-8">
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/admin/webhooks/dashboard">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Dashboard
                </Link>
              </Button>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl font-bold tracking-tight">
                    Health Monitoring
                  </h1>
                  <RealtimeStatus />
                  {getHealthStatusBadge()}
                </div>
                <p className="text-muted-foreground">
                  Monitor system health and configure alerting thresholds
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={handleRefresh}
                disabled={refreshing || alertsLoading || configLoading}
              >
                <RefreshCw
                  className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
                />
                Refresh
              </Button>
            </div>
          </div>

          {/* Health Overview */}
          <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  System Health
                </CardTitle>
                <Shield className="text-muted-foreground h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {criticalAlerts.length > 0
                    ? "CRITICAL"
                    : activeAlerts.length > 0
                      ? "WARNING"
                      : "HEALTHY"}
                </div>
                <p className="text-muted-foreground text-xs">
                  {healthAlerts?.healthStatus?.lastCheck &&
                    `Last check: ${new Date(healthAlerts.healthStatus.lastCheck).toLocaleTimeString()}`}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Active Alerts
                </CardTitle>
                <AlertTriangle className="text-muted-foreground h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {activeAlerts.length}
                </div>
                <p className="text-muted-foreground text-xs">
                  {criticalAlerts.length} critical
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Monitoring Rules
                </CardTitle>
                <Settings className="text-muted-foreground h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {healthConfig?.thresholds?.filter((t) => t.enabled).length ||
                    0}
                </div>
                <p className="text-muted-foreground text-xs">
                  {healthConfig?.thresholds?.length || 0} total rules
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Success Rate
                </CardTitle>
                <TrendingUp className="text-muted-foreground h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stats?.successRate ?? 0}%
                </div>
                <p className="text-muted-foreground text-xs">Last 24 hours</p>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <Tabs defaultValue="alerts" className="space-y-6">
            <TabsList>
              <TabsTrigger value="alerts">
                <AlertTriangle className="mr-2 h-4 w-4" />
                Alerts ({activeAlerts.length})
              </TabsTrigger>
              <TabsTrigger value="thresholds">
                <Settings className="mr-2 h-4 w-4" />
                Thresholds
              </TabsTrigger>
              <TabsTrigger value="notifications">
                <Bell className="mr-2 h-4 w-4" />
                Notifications
              </TabsTrigger>
            </TabsList>

            <TabsContent value="alerts" className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Health Alerts</h2>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowResolved(!showResolved)}
                  >
                    {showResolved ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                    <span className="ml-2">
                      {showResolved ? "Hide" : "Show"} resolved
                    </span>
                  </Button>
                </div>
              </div>

              {healthAlerts?.alerts && healthAlerts.alerts.length > 0 ? (
                <div className="space-y-4">
                  {healthAlerts.alerts.map((alert) => (
                    <Card key={alert.id}>
                      <CardContent className="pt-6">
                        <div className="flex items-start gap-4">
                          {getSeverityIcon(alert.severity)}
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center justify-between">
                              <h3 className="font-semibold">{alert.title}</h3>
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant={
                                    alert.severity === "critical"
                                      ? "destructive"
                                      : alert.severity === "high"
                                        ? "secondary"
                                        : "outline"
                                  }
                                >
                                  {alert.severity.toUpperCase()}
                                </Badge>
                                {alert.resolved && (
                                  <Badge variant="secondary">Resolved</Badge>
                                )}
                                {alert.acknowledged && (
                                  <Badge variant="outline">Acknowledged</Badge>
                                )}
                              </div>
                            </div>
                            <p className="text-muted-foreground">
                              {alert.message}
                            </p>
                            <div className="text-muted-foreground flex items-center gap-4 text-sm">
                              <span>
                                Created:{" "}
                                {new Date(alert.createdAt).toLocaleString()}
                              </span>
                              <span>Type: {alert.type}</span>
                              {alert.threshold && (
                                <span>Threshold: {alert.threshold}</span>
                              )}
                              {alert.value && (
                                <span>Current: {alert.value}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="py-12 text-center">
                    <CheckCircle className="mx-auto mb-4 h-12 w-12 text-green-500" />
                    <h3 className="text-lg font-medium">No Active Alerts</h3>
                    <p className="text-muted-foreground">
                      All systems are healthy. Alerts will appear here when
                      thresholds are exceeded.
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="thresholds" className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">
                  Health Monitoring Thresholds
                </h2>
                <HealthThresholdsDialog
                  trigger={
                    <Button>
                      <Settings className="mr-2 h-4 w-4" />
                      Configure Thresholds
                    </Button>
                  }
                />
              </div>

              {healthConfig?.thresholds &&
              healthConfig.thresholds.length > 0 ? (
                <div className="grid gap-4">
                  {healthConfig.thresholds.map((threshold) => (
                    <Card key={threshold.id}>
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between text-base">
                          <span>{threshold.name}</span>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={
                                threshold.enabled ? "default" : "secondary"
                              }
                            >
                              {threshold.enabled ? "Enabled" : "Disabled"}
                            </Badge>
                            <Badge variant="outline">
                              {threshold.severity.toUpperCase()}
                            </Badge>
                          </div>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <p className="text-muted-foreground text-sm">
                            {threshold.description}
                          </p>
                          <div className="flex items-center gap-4 text-sm">
                            <span>
                              <strong>Threshold:</strong> {threshold.threshold}
                            </span>
                            <span>
                              <strong>Time Window:</strong>{" "}
                              {threshold.timeWindow} min
                            </span>
                            <span>
                              <strong>Type:</strong>{" "}
                              {threshold.type.replace("_", " ")}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {threshold.notifications.email && (
                              <Badge variant="outline">Email</Badge>
                            )}
                            {threshold.notifications.slack && (
                              <Badge variant="outline">Slack</Badge>
                            )}
                            {threshold.notifications.sms && (
                              <Badge variant="outline">SMS</Badge>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Settings className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
                    <h3 className="text-lg font-medium">
                      No Thresholds Configured
                    </h3>
                    <p className="text-muted-foreground mb-4">
                      Configure health monitoring thresholds to receive alerts
                      when issues occur.
                    </p>
                    <HealthThresholdsDialog
                      trigger={
                        <Button>
                          <Settings className="mr-2 h-4 w-4" />
                          Configure Thresholds
                        </Button>
                      }
                    />
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="notifications" className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Notification Channels</h2>
              </div>

              {healthConfig?.notificationChannels ? (
                <div className="grid gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between text-base">
                        <span>Email Notifications</span>
                        <Switch
                          checked={
                            healthConfig.notificationChannels.email?.enabled
                          }
                        />
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <p className="text-muted-foreground text-sm">
                          Send alert notifications via email
                        </p>
                        <div className="text-sm">
                          <strong>Address:</strong>{" "}
                          {healthConfig.notificationChannels.email?.address ||
                            "Not configured"}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between text-base">
                        <span>Slack Notifications</span>
                        <Switch
                          checked={
                            healthConfig.notificationChannels.slack?.enabled
                          }
                        />
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <p className="text-muted-foreground text-sm">
                          Send alert notifications to Slack
                        </p>
                        <div className="text-sm">
                          <strong>Status:</strong>{" "}
                          {healthConfig.notificationChannels.slack?.enabled
                            ? "Configured"
                            : "Not configured"}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between text-base">
                        <span>SMS Notifications</span>
                        <Switch
                          checked={
                            healthConfig.notificationChannels.sms?.enabled
                          }
                        />
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <p className="text-muted-foreground text-sm">
                          Send critical alerts via SMS
                        </p>
                        <div className="text-sm">
                          <strong>Number:</strong>{" "}
                          {healthConfig.notificationChannels.sms?.number ||
                            "Not configured"}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Bell className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
                    <h3 className="text-lg font-medium">
                      No Notification Channels
                    </h3>
                    <p className="text-muted-foreground">
                      Configure notification channels to receive health alerts.
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </WebhookErrorBoundary>
    </AuthenticatedLayout>
  );
}
