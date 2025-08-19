"use client";

import React, { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  Settings,
  Shield,
  Clock,
  RotateCcw,
  Bell,
  Database,
  Zap,
  Save,
  RefreshCw,
  AlertTriangle,
  ExternalLink,
  Server,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
// removed unused Input
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { Textarea } from "~/components/ui/textarea";
import { Input } from "~/components/ui/input";
// removed unused Separator
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Slider } from "~/components/ui/slider";
import { AuthenticatedLayout } from "~/components/layout/authenticated-layout";
import { WebhookErrorBoundary } from "~/components/error-boundary";
import { api } from "~/trpc/react";

interface WebhookSettings {
  // Global Settings
  defaultTimeout: number;
  defaultMaxRetries: number;
  defaultRetryBackoff: "linear" | "exponential" | "constant";

  // Security Settings
  requireHmacVerification: boolean;
  allowedIpRanges: string[];
  rateLimitEnabled: boolean;
  rateLimitRps: number;

  // Monitoring & Alerting
  monitoringEnabled: boolean;
  alertOnFailureRate: boolean;
  failureRateThreshold: number;
  alertOnQueueDepth: boolean;
  queueDepthThreshold: number;
  notificationChannels: string[];

  // Performance Settings
  concurrentDeliveries: number;
  batchSize: number;
  dlqRetentionDays: number;
  logRetentionDays: number;

  // Advanced Settings
  enableWebhookSignatures: boolean;
  customHeaders: Record<string, string>;
  debugMode: boolean;
  enableMetrics: boolean;

  // LocalStack / Endpoint overrides (UI-only for now; persisted in settings payload)
  localstackDynamoUrl?: string;
  localstackSqsUrl?: string;
  localstackS3Url?: string;
}

const DEFAULT_SETTINGS: WebhookSettings = {
  defaultTimeout: 30,
  defaultMaxRetries: 3,
  defaultRetryBackoff: "exponential",
  requireHmacVerification: false,
  allowedIpRanges: [],
  rateLimitEnabled: true,
  rateLimitRps: 100,
  monitoringEnabled: true,
  alertOnFailureRate: true,
  failureRateThreshold: 10,
  alertOnQueueDepth: true,
  queueDepthThreshold: 1000,
  notificationChannels: [],
  concurrentDeliveries: 10,
  batchSize: 50,
  dlqRetentionDays: 30,
  logRetentionDays: 90,
  enableWebhookSignatures: true,
  customHeaders: {},
  debugMode: false,
  enableMetrics: true,
  localstackDynamoUrl: "",
  localstackSqsUrl: "",
  localstackS3Url: "",
};

export default function WebhookSettingsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [settings, setSettings] = useState<WebhookSettings>(DEFAULT_SETTINGS);
  const [activeTab, setActiveTab] = useState("general");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);

  // Load settings
  const { data: currentSettings, refetch: refetchSettings } =
    api.webhook.getSystemSettings.useQuery(undefined, {
      enabled: session?.user.roles?.includes("ADMIN") ?? false,
    });

  // Update settings when data changes
  React.useEffect(() => {
    if (currentSettings) {
      setSettings({ ...DEFAULT_SETTINGS, ...currentSettings });
    }
  }, [currentSettings]);

  // Save settings mutation
  const saveSettings = api.webhook.updateSystemSettings.useMutation({
    onSuccess: () => {
      toast.success("Settings saved successfully");
      setHasUnsavedChanges(false);
      void refetchSettings();
    },
    onError: (error) => {
      toast.error(`Failed to save settings: ${error.message}`);
    },
  });

  // Test connection mutation
  const testConnection = api.webhook.testSystemConnection.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success("System connection test successful");
      } else {
        toast.error(`Connection test failed: ${result.error}`);
      }
    },
    onError: (error) => {
      toast.error(`Connection test failed: ${error.message}`);
    },
  });

  React.useEffect(() => {
    if (session && !session.user.roles?.includes("ADMIN")) {
      router.push("/");
    }
  }, [session, router]);

  if (!session?.user.roles?.includes("ADMIN")) {
    return null;
  }

  const handleSettingChange = (key: keyof WebhookSettings, value: any) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setHasUnsavedChanges(true);
  };

  const handleSaveSettings = async () => {
    await saveSettings.mutateAsync(settings as any);
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    try {
      await testConnection.mutateAsync();
    } finally {
      setTestingConnection(false);
    }
  };

  const handleResetToDefaults = () => {
    if (
      confirm(
        "Reset all settings to defaults? This will lose your current configuration.",
      )
    ) {
      setSettings(DEFAULT_SETTINGS);
      setHasUnsavedChanges(true);
      toast.info("Settings reset to defaults. Don't forget to save!");
    }
  };

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
                <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
                  <Settings className="h-8 w-8" />
                  Webhook System Settings
                </h1>
                <p className="text-muted-foreground">
                  Configure global webhook behavior, security, and monitoring
                  settings
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={handleTestConnection}
                disabled={testingConnection}
              >
                {testingConnection ? (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Zap className="mr-2 h-4 w-4" />
                )}
                Test Connection
              </Button>
              <Button
                onClick={handleSaveSettings}
                disabled={!hasUnsavedChanges || saveSettings.isPending}
              >
                {saveSettings.isPending ? (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save Changes
              </Button>
            </div>
          </div>

          {/* Unsaved changes alert */}
          {hasUnsavedChanges && (
            <Alert className="mb-6">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Unsaved Changes</AlertTitle>
              <AlertDescription>
                You have unsaved changes. Don't forget to save your
                configuration.
              </AlertDescription>
            </Alert>
          )}

          {/* Settings Tabs */}
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="space-y-6"
          >
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="security">Security</TabsTrigger>
              <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
              <TabsTrigger value="performance">Performance</TabsTrigger>
              <TabsTrigger value="advanced">Advanced</TabsTrigger>
              <TabsTrigger value="localstack">LocalStack</TabsTrigger>
            </TabsList>

            {/* General Settings */}
            <TabsContent value="general" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Default Delivery Settings
                  </CardTitle>
                  <CardDescription>
                    Global defaults for new webhook endpoints
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Default Timeout (seconds)</Label>
                      <div className="flex items-center gap-4">
                        <Slider
                          value={[settings.defaultTimeout]}
                          onValueChange={([value]) =>
                            handleSettingChange("defaultTimeout", value)
                          }
                          max={120}
                          min={5}
                          step={5}
                          className="flex-1"
                        />
                        <Badge variant="outline" className="min-w-[60px]">
                          {settings.defaultTimeout}s
                        </Badge>
                      </div>
                      <p className="text-muted-foreground text-sm">
                        How long to wait for webhook responses
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label>Default Max Retries</Label>
                      <div className="flex items-center gap-4">
                        <Slider
                          value={[settings.defaultMaxRetries]}
                          onValueChange={([value]) =>
                            handleSettingChange("defaultMaxRetries", value)
                          }
                          max={10}
                          min={0}
                          step={1}
                          className="flex-1"
                        />
                        <Badge variant="outline" className="min-w-[60px]">
                          {settings.defaultMaxRetries}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground text-sm">
                        Number of retry attempts for failed deliveries
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Retry Backoff Strategy</Label>
                    <Select
                      value={settings.defaultRetryBackoff}
                      onValueChange={(value: any) =>
                        handleSettingChange("defaultRetryBackoff", value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="constant">
                          Constant - Same delay between retries
                        </SelectItem>
                        <SelectItem value="linear">
                          Linear - Increasing delay (1x, 2x, 3x)
                        </SelectItem>
                        <SelectItem value="exponential">
                          Exponential - Exponential backoff (1x, 2x, 4x, 8x)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-muted-foreground text-sm">
                      How delays between retry attempts are calculated
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Security Settings */}
            <TabsContent value="security" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Authentication & Security
                  </CardTitle>
                  <CardDescription>
                    Configure security policies for webhook processing
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Require HMAC Verification</Label>
                      <p className="text-muted-foreground text-sm">
                        Enforce HMAC signature verification for all webhooks
                      </p>
                    </div>
                    <Switch
                      checked={settings.requireHmacVerification}
                      onCheckedChange={(checked) =>
                        handleSettingChange("requireHmacVerification", checked)
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Enable Rate Limiting</Label>
                      <p className="text-muted-foreground text-sm">
                        Limit the number of requests per second
                      </p>
                    </div>
                    <Switch
                      checked={settings.rateLimitEnabled}
                      onCheckedChange={(checked) =>
                        handleSettingChange("rateLimitEnabled", checked)
                      }
                    />
                  </div>

                  {settings.rateLimitEnabled && (
                    <div className="space-y-2">
                      <Label>Rate Limit (requests per second)</Label>
                      <div className="flex items-center gap-4">
                        <Slider
                          value={[settings.rateLimitRps]}
                          onValueChange={([value]) =>
                            handleSettingChange("rateLimitRps", value)
                          }
                          max={1000}
                          min={1}
                          step={10}
                          className="flex-1"
                        />
                        <Badge variant="outline" className="min-w-[80px]">
                          {settings.rateLimitRps} rps
                        </Badge>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Allowed IP Ranges (optional)</Label>
                    <Textarea
                      placeholder="192.168.1.0/24&#10;10.0.0.0/8&#10;203.0.113.0/24"
                      value={settings.allowedIpRanges.join("\n")}
                      onChange={(e) =>
                        handleSettingChange(
                          "allowedIpRanges",
                          e.target.value.split("\n").filter(Boolean),
                        )
                      }
                      rows={4}
                    />
                    <p className="text-muted-foreground text-sm">
                      Leave empty to allow all IPs. Enter CIDR ranges, one per
                      line.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Monitoring Settings */}
            <TabsContent value="monitoring" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="h-5 w-5" />
                    Monitoring & Alerts
                  </CardTitle>
                  <CardDescription>
                    Configure monitoring and alerting for webhook system health
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Enable System Monitoring</Label>
                      <p className="text-muted-foreground text-sm">
                        Collect metrics and health data
                      </p>
                    </div>
                    <Switch
                      checked={settings.monitoringEnabled}
                      onCheckedChange={(checked) =>
                        handleSettingChange("monitoringEnabled", checked)
                      }
                    />
                  </div>

                  {settings.monitoringEnabled && (
                    <>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label>Alert on High Failure Rate</Label>
                            <p className="text-muted-foreground text-sm">
                              Get notified when delivery failure rate exceeds
                              threshold
                            </p>
                          </div>
                          <Switch
                            checked={settings.alertOnFailureRate}
                            onCheckedChange={(checked) =>
                              handleSettingChange("alertOnFailureRate", checked)
                            }
                          />
                        </div>

                        {settings.alertOnFailureRate && (
                          <div className="space-y-2">
                            <Label>Failure Rate Threshold (%)</Label>
                            <div className="flex items-center gap-4">
                              <Slider
                                value={[settings.failureRateThreshold]}
                                onValueChange={([value]) =>
                                  handleSettingChange(
                                    "failureRateThreshold",
                                    value,
                                  )
                                }
                                max={50}
                                min={1}
                                step={1}
                                className="flex-1"
                              />
                              <Badge variant="outline" className="min-w-[60px]">
                                {settings.failureRateThreshold}%
                              </Badge>
                            </div>
                          </div>
                        )}

                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label>Alert on High Queue Depth</Label>
                            <p className="text-muted-foreground text-sm">
                              Get notified when queue backlog gets too large
                            </p>
                          </div>
                          <Switch
                            checked={settings.alertOnQueueDepth}
                            onCheckedChange={(checked) =>
                              handleSettingChange("alertOnQueueDepth", checked)
                            }
                          />
                        </div>

                        {settings.alertOnQueueDepth && (
                          <div className="space-y-2">
                            <Label>Queue Depth Threshold</Label>
                            <div className="flex items-center gap-4">
                              <Slider
                                value={[settings.queueDepthThreshold]}
                                onValueChange={([value]) =>
                                  handleSettingChange(
                                    "queueDepthThreshold",
                                    value,
                                  )
                                }
                                max={10000}
                                min={100}
                                step={100}
                                className="flex-1"
                              />
                              <Badge variant="outline" className="min-w-[80px]">
                                {settings.queueDepthThreshold}
                              </Badge>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label>Notification Channels</Label>
                        <div className="text-muted-foreground text-sm">
                          Configure external notification channels (Slack,
                          email, etc.)
                        </div>
                        <Button variant="outline" size="sm" asChild>
                          <Link href="/admin/webhooks/settings/notifications">
                            <ExternalLink className="mr-2 h-4 w-4" />
                            Manage Notifications
                          </Link>
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Performance Settings */}
            <TabsContent value="performance" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5" />
                    Performance & Storage
                  </CardTitle>
                  <CardDescription>
                    Configure system performance and data retention policies
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Concurrent Deliveries</Label>
                      <div className="flex items-center gap-4">
                        <Slider
                          value={[settings.concurrentDeliveries]}
                          onValueChange={([value]) =>
                            handleSettingChange("concurrentDeliveries", value)
                          }
                          max={100}
                          min={1}
                          step={5}
                          className="flex-1"
                        />
                        <Badge variant="outline" className="min-w-[60px]">
                          {settings.concurrentDeliveries}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground text-sm">
                        Maximum parallel webhook deliveries
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label>Batch Processing Size</Label>
                      <div className="flex items-center gap-4">
                        <Slider
                          value={[settings.batchSize]}
                          onValueChange={([value]) =>
                            handleSettingChange("batchSize", value)
                          }
                          max={500}
                          min={10}
                          step={10}
                          className="flex-1"
                        />
                        <Badge variant="outline" className="min-w-[60px]">
                          {settings.batchSize}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground text-sm">
                        Number of messages processed per batch
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label>DLQ Retention (days)</Label>
                      <div className="flex items-center gap-4">
                        <Slider
                          value={[settings.dlqRetentionDays]}
                          onValueChange={([value]) =>
                            handleSettingChange("dlqRetentionDays", value)
                          }
                          max={365}
                          min={1}
                          step={1}
                          className="flex-1"
                        />
                        <Badge variant="outline" className="min-w-[80px]">
                          {settings.dlqRetentionDays} days
                        </Badge>
                      </div>
                      <p className="text-muted-foreground text-sm">
                        How long to keep failed webhook data
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label>Log Retention (days)</Label>
                      <div className="flex items-center gap-4">
                        <Slider
                          value={[settings.logRetentionDays]}
                          onValueChange={([value]) =>
                            handleSettingChange("logRetentionDays", value)
                          }
                          max={365}
                          min={7}
                          step={7}
                          className="flex-1"
                        />
                        <Badge variant="outline" className="min-w-[80px]">
                          {settings.logRetentionDays} days
                        </Badge>
                      </div>
                      <p className="text-muted-foreground text-sm">
                        How long to keep delivery logs
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Advanced Settings */}
            <TabsContent value="advanced" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Server className="h-5 w-5" />
                    Advanced Configuration
                  </CardTitle>
                  <CardDescription>
                    Advanced settings for power users and debugging
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Enable Webhook Signatures</Label>
                      <p className="text-muted-foreground text-sm">
                        Add cryptographic signatures to outgoing webhooks
                      </p>
                    </div>
                    <Switch
                      checked={settings.enableWebhookSignatures}
                      onCheckedChange={(checked) =>
                        handleSettingChange("enableWebhookSignatures", checked)
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Debug Mode</Label>
                      <p className="text-muted-foreground text-sm">
                        Enable detailed logging for troubleshooting
                      </p>
                    </div>
                    <Switch
                      checked={settings.debugMode}
                      onCheckedChange={(checked) =>
                        handleSettingChange("debugMode", checked)
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Enable Metrics Collection</Label>
                      <p className="text-muted-foreground text-sm">
                        Collect detailed performance metrics
                      </p>
                    </div>
                    <Switch
                      checked={settings.enableMetrics}
                      onCheckedChange={(checked) =>
                        handleSettingChange("enableMetrics", checked)
                      }
                    />
                  </div>

                  {settings.debugMode && (
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Debug Mode Enabled</AlertTitle>
                      <AlertDescription>
                        Debug mode will generate verbose logs and may impact
                        performance. Only enable in development or when
                        troubleshooting issues.
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-2">
                    <Label>Custom Global Headers</Label>
                    <Textarea
                      placeholder='{"X-Custom-Header": "value", "X-Source": "HookRelay"}'
                      value={JSON.stringify(settings.customHeaders, null, 2)}
                      onChange={(e) => {
                        try {
                          const parsed = JSON.parse(e.target.value);
                          handleSettingChange("customHeaders", parsed);
                        } catch {
                          // Invalid JSON, don't update
                        }
                      }}
                      className="font-mono text-sm"
                      rows={6}
                    />
                    <p className="text-muted-foreground text-sm">
                      Headers added to all outgoing webhook requests (JSON
                      format)
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-destructive">
                    Danger Zone
                  </CardTitle>
                  <CardDescription>
                    Irreversible actions that affect your entire webhook system
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    variant="outline"
                    onClick={handleResetToDefaults}
                    className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Reset All Settings to Defaults
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* LocalStack Configuration */}
            <TabsContent value="localstack" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Server className="h-5 w-5" />
                    LocalStack Configuration
                  </CardTitle>
                  <CardDescription>
                    Override AWS service endpoints for local development.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>DynamoDB Endpoint URL</Label>
                      <Input
                        placeholder="http://localhost:4566"
                        value={settings.localstackDynamoUrl}
                        onChange={(e) =>
                          handleSettingChange(
                            "localstackDynamoUrl",
                            e.target.value,
                          )
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>SQS Endpoint URL</Label>
                      <Input
                        placeholder="http://localhost:4566"
                        value={settings.localstackSqsUrl}
                        onChange={(e) =>
                          handleSettingChange(
                            "localstackSqsUrl",
                            e.target.value,
                          )
                        }
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>S3 Endpoint URL</Label>
                      <Input
                        placeholder="http://localhost:4566"
                        value={settings.localstackS3Url}
                        onChange={(e) =>
                          handleSettingChange("localstackS3Url", e.target.value)
                        }
                      />
                    </div>
                  </div>
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Note</AlertTitle>
                    <AlertDescription>
                      These values are stored with system settings and can be
                      used by your backend to override AWS SDK endpoints in
                      development.
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </WebhookErrorBoundary>
    </AuthenticatedLayout>
  );
}
