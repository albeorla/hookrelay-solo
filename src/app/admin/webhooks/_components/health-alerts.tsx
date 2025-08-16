"use client";

import React, { useState, useEffect, memo, useCallback, useMemo } from "react";
import {
  usePerformanceMonitor,
  QueryOptimizations,
} from "~/hooks/use-optimized-query";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Bell,
  Eye,
  EyeOff,
  Shield,
  Activity,
  AlertCircle,
  Settings,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Switch } from "~/components/ui/switch";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Separator } from "~/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";
import {
  type HealthAlert,
  type HealthThreshold,
  DEFAULT_HEALTH_THRESHOLDS,
  HealthMonitor,
} from "~/lib/health-monitor";
import { api } from "~/trpc/react";

interface HealthAlertsProps {
  className?: string;
}

// Simulated health monitor instance (in production, this would be managed server-side)
const healthMonitor = new HealthMonitor();

// Memoized component for performance optimization
export const HealthAlertsCard = memo(function HealthAlertsCard({
  className = "",
}: HealthAlertsProps) {
  usePerformanceMonitor("HealthAlertsCard");
  const [alerts, setAlerts] = useState<HealthAlert[]>([]);
  const [healthStatus, setHealthStatus] = useState(
    healthMonitor.getHealthStatus(),
  );
  const [showResolved, setShowResolved] = useState(false);

  // Simulate health monitoring with webhook stats
  const { data: stats } = api.webhook.getStats.useQuery(undefined, {
    ...QueryOptimizations.dashboard,
    refetchInterval: 30000, // Check every 30 seconds
  });

  useEffect(() => {
    if (stats) {
      // Convert stats to health metrics and add to monitor
      const metric = {
        timestamp: new Date(),
        totalDeliveries: stats.totalDeliveries || 0,
        successfulDeliveries:
          (stats.totalDeliveries || 0) - (stats.deliveries?.failed || 0),
        failedDeliveries: stats.deliveries?.failed || 0,
        averageResponseTime: 500, // Would come from actual metrics
        queueDepth: stats.queue?.approximate || 0,
        activeEndpoints: stats.endpoints?.total || 0,
        unhealthyEndpoints: [], // Would be calculated from endpoint health
      };

      healthMonitor.addMetric(metric);
      setAlerts(healthMonitor.getAllAlerts());
      setHealthStatus(healthMonitor.getHealthStatus());
    }
  }, [stats]);

  // Memoized computed values
  const activeAlerts = useMemo(
    () => alerts.filter((a) => !a.resolvedAt),
    [alerts],
  );
  const displayedAlerts = useMemo(
    () => (showResolved ? alerts.slice(0, 10) : activeAlerts.slice(0, 5)),
    [showResolved, alerts, activeAlerts],
  );

  // removed unused getSeverityColor

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "critical":
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case "high":
        return <AlertCircle className="h-4 w-4 text-orange-500" />;
      case "medium":
        return <Bell className="h-4 w-4 text-yellow-500" />;
      case "low":
        return <Activity className="h-4 w-4 text-blue-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusIcon = () => {
    switch (healthStatus.status) {
      case "healthy":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "warning":
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case "critical":
        return <AlertTriangle className="h-5 w-5 text-red-500" />;
      default:
        return <Activity className="h-5 w-5 text-gray-500" />;
    }
  };

  const handleAcknowledgeAlert = useCallback((alertId: string) => {
    healthMonitor.acknowledgeAlert(alertId, "Admin User");
    setAlerts(healthMonitor.getAllAlerts());
    toast.success("Alert acknowledged");
  }, []);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Health Monitoring
            <Badge
              variant={
                healthStatus.status === "healthy"
                  ? "default"
                  : healthStatus.status === "warning"
                    ? "secondary"
                    : "destructive"
              }
            >
              {healthStatus.status.toUpperCase()}
            </Badge>
          </div>
          {getStatusIcon()}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Health Status Overview */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-lg font-semibold text-red-600">
              {healthStatus.criticalAlerts}
            </div>
            <p className="text-muted-foreground">Critical alerts</p>
          </div>
          <div>
            <div className="text-lg font-semibold text-yellow-600">
              {healthStatus.activeAlerts}
            </div>
            <p className="text-muted-foreground">Active alerts</p>
          </div>
        </div>

        <Separator />

        {/* Active Alerts */}
        {activeAlerts.length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Recent Alerts</h4>
              <Button
                variant="ghost"
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

            <div className="max-h-64 space-y-2 overflow-y-auto">
              {displayedAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="bg-muted/50 flex items-start gap-3 rounded-lg border p-3"
                >
                  {getSeverityIcon(alert.severity)}
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <h5 className="text-sm font-medium">{alert.title}</h5>
                      <Badge variant="outline" className="text-xs">
                        {alert.type.replace("_", " ")}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground text-xs">
                      {alert.message}
                    </p>
                    <div className="text-muted-foreground flex items-center gap-2 text-xs">
                      <span>{alert.createdAt.toLocaleString()}</span>
                      {alert.resolvedAt && (
                        <Badge variant="secondary" className="text-xs">
                          Resolved
                        </Badge>
                      )}
                      {alert.acknowledged && (
                        <Badge variant="secondary" className="text-xs">
                          Acknowledged
                        </Badge>
                      )}
                    </div>
                  </div>
                  {!alert.resolvedAt && !alert.acknowledged && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleAcknowledgeAlert(alert.id)}
                    >
                      <CheckCircle className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="py-6 text-center">
            <CheckCircle className="mx-auto mb-4 h-12 w-12 text-green-500" />
            <h3 className="text-lg font-medium">All systems healthy</h3>
            <p className="text-muted-foreground">
              No active alerts at this time
            </p>
          </div>
        )}

        <Separator />

        {/* Quick Stats */}
        <div className="text-muted-foreground text-xs">
          Last check: {healthStatus.lastCheck.toLocaleTimeString()}
        </div>
      </CardContent>
    </Card>
  );
});

export function HealthThresholdsDialog({
  trigger,
  onThresholdsUpdate,
}: {
  trigger: React.ReactNode;
  onThresholdsUpdate?: (thresholds: HealthThreshold[]) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [thresholds, setThresholds] = useState<HealthThreshold[]>(
    DEFAULT_HEALTH_THRESHOLDS,
  );

  const updateThreshold = (id: string, updates: Partial<HealthThreshold>) => {
    setThresholds((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    );
  };

  const handleSave = () => {
    healthMonitor.updateThresholds(thresholds);
    onThresholdsUpdate?.(thresholds);
    setIsOpen(false);
    toast.success("Health monitoring thresholds updated");
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Health Monitoring Configuration</DialogTitle>
          <DialogDescription>
            Configure thresholds and notification settings for health monitoring
            alerts.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {thresholds.map((threshold) => (
            <Card key={threshold.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-base">
                  <span>{threshold.name}</span>
                  <Switch
                    checked={threshold.enabled}
                    onCheckedChange={(enabled) =>
                      updateThreshold(threshold.id, { enabled })
                    }
                  />
                </CardTitle>
                <p className="text-muted-foreground text-sm">
                  {threshold.description}
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div>
                    <Label className="text-sm">Threshold</Label>
                    <Input
                      type="number"
                      value={threshold.threshold}
                      onChange={(e) =>
                        updateThreshold(threshold.id, {
                          threshold: parseFloat(e.target.value) || 0,
                        })
                      }
                      disabled={!threshold.enabled}
                    />
                  </div>
                  <div>
                    <Label className="text-sm">Time Window (minutes)</Label>
                    <Input
                      type="number"
                      value={threshold.timeWindow}
                      onChange={(e) =>
                        updateThreshold(threshold.id, {
                          timeWindow: parseInt(e.target.value) || 1,
                        })
                      }
                      disabled={!threshold.enabled}
                    />
                  </div>
                  <div>
                    <Label className="text-sm">Severity</Label>
                    <Select
                      value={threshold.severity}
                      onValueChange={(severity: HealthThreshold["severity"]) =>
                        updateThreshold(threshold.id, { severity })
                      }
                      disabled={!threshold.enabled}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Collapsible>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <Settings className="mr-2 h-4 w-4" />
                      Notification Settings
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Email notifications</Label>
                      <Switch
                        checked={threshold.notifications.email}
                        onCheckedChange={(email) =>
                          updateThreshold(threshold.id, {
                            notifications: {
                              ...threshold.notifications,
                              email,
                            },
                          })
                        }
                        disabled={!threshold.enabled}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Slack notifications</Label>
                      <Switch
                        checked={threshold.notifications.slack}
                        onCheckedChange={(slack) =>
                          updateThreshold(threshold.id, {
                            notifications: {
                              ...threshold.notifications,
                              slack,
                            },
                          })
                        }
                        disabled={!threshold.enabled}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">SMS notifications</Label>
                      <Switch
                        checked={threshold.notifications.sms}
                        onCheckedChange={(sms) =>
                          updateThreshold(threshold.id, {
                            notifications: { ...threshold.notifications, sms },
                          })
                        }
                        disabled={!threshold.enabled}
                      />
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Configuration</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function HealthMonitoringBanner() {
  const [healthStatus, setHealthStatus] = useState(
    healthMonitor.getHealthStatus(),
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setHealthStatus(healthMonitor.getHealthStatus());
    }, 10000); // Update every 10 seconds

    return () => clearInterval(interval);
  }, []);

  if (healthStatus.status === "healthy") {
    return null; // Don't show banner when healthy
  }

  return (
    <Alert
      variant={healthStatus.status === "critical" ? "destructive" : "default"}
      className="mb-6"
    >
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>
        Health Monitoring Alert - {healthStatus.status.toUpperCase()}
      </AlertTitle>
      <AlertDescription>
        {healthStatus.criticalAlerts > 0 && (
          <span>
            {healthStatus.criticalAlerts} critical alert
            {healthStatus.criticalAlerts !== 1 ? "s" : ""} require immediate
            attention.{" "}
          </span>
        )}
        {healthStatus.activeAlerts > 0 && (
          <span>
            {healthStatus.activeAlerts} total alert
            {healthStatus.activeAlerts !== 1 ? "s" : ""} active.{" "}
          </span>
        )}
        Check the health monitoring section for details.
      </AlertDescription>
    </Alert>
  );
}
