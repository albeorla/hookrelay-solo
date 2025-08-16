"use client";

import React, { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  Bell,
  Plus,
  Trash2,
  TestTube,
  Mail,
  MessageSquare,
  Webhook,
  Save,
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
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { AuthenticatedLayout } from "~/components/layout/authenticated-layout";
import { WebhookErrorBoundary } from "~/components/error-boundary";

interface NotificationChannel {
  id: string;
  name: string;
  type: "email" | "slack" | "webhook" | "teams";
  enabled: boolean;
  config: Record<string, string>;
  events: string[];
}

const EVENT_TYPES = [
  { value: "failure_rate_high", label: "High Failure Rate" },
  { value: "queue_depth_high", label: "High Queue Depth" },
  { value: "endpoint_down", label: "Endpoint Down" },
  { value: "dlq_full", label: "DLQ Full" },
  { value: "system_error", label: "System Error" },
];

const CHANNEL_TYPES = [
  { value: "email", label: "Email", icon: Mail },
  { value: "slack", label: "Slack", icon: MessageSquare },
  { value: "webhook", label: "Webhook", icon: Webhook },
  { value: "teams", label: "Microsoft Teams", icon: MessageSquare },
];

export default function NotificationSettingsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [channels, setChannels] = useState<NotificationChannel[]>([]);
  const [showAddChannel, setShowAddChannel] = useState(false);
  const [newChannel, setNewChannel] = useState({
    name: "",
    type: "email" as const,
    config: {} as Record<string, string>,
    events: [] as string[],
  });

  React.useEffect(() => {
    if (session && !session.user.roles?.includes("ADMIN")) {
      router.push("/");
    }
  }, [session, router]);

  if (!session?.user.roles?.includes("ADMIN")) {
    return null;
  }

  const handleAddChannel = () => {
    if (!newChannel.name) {
      toast.error("Channel name is required");
      return;
    }

    const channel: NotificationChannel = {
      id: `ch_${Date.now()}`,
      name: newChannel.name,
      type: newChannel.type,
      enabled: true,
      config: newChannel.config,
      events: newChannel.events,
    };

    setChannels((prev) => [...prev, channel]);
    setNewChannel({ name: "", type: "email", config: {}, events: [] });
    setShowAddChannel(false);
    toast.success("Notification channel added");
  };

  const handleDeleteChannel = (channelId: string) => {
    setChannels((prev) => prev.filter((c) => c.id !== channelId));
    toast.success("Notification channel removed");
  };

  const handleTestChannel = (channel: NotificationChannel) => {
    // In a real implementation, this would send a test notification
    toast.success(`Test notification sent to ${channel.name}`);
  };

  const handleToggleChannel = (channelId: string) => {
    setChannels((prev) =>
      prev.map((c) => (c.id === channelId ? { ...c, enabled: !c.enabled } : c)),
    );
  };

  const getChannelIcon = (type: string) => {
    const channelType = CHANNEL_TYPES.find((ct) => ct.value === type);
    return channelType ? channelType.icon : Bell;
  };

  const renderChannelConfig = (
    type: string,
    config: Record<string, string>,
    onChange: (config: Record<string, string>) => void,
  ) => {
    switch (type) {
      case "email":
        return (
          <div className="space-y-2">
            <Label>Email Address</Label>
            <Input
              placeholder="alerts@company.com"
              value={config.email || ""}
              onChange={(e) => onChange({ ...config, email: e.target.value })}
            />
          </div>
        );
      case "slack":
        return (
          <div className="space-y-2">
            <Label>Slack Webhook URL</Label>
            <Input
              placeholder="https://hooks.slack.com/services/..."
              value={config.webhookUrl || ""}
              onChange={(e) =>
                onChange({ ...config, webhookUrl: e.target.value })
              }
            />
          </div>
        );
      case "webhook":
        return (
          <div className="space-y-2">
            <Label>Webhook URL</Label>
            <Input
              placeholder="https://your-app.com/webhooks/alerts"
              value={config.url || ""}
              onChange={(e) => onChange({ ...config, url: e.target.value })}
            />
          </div>
        );
      case "teams":
        return (
          <div className="space-y-2">
            <Label>Teams Webhook URL</Label>
            <Input
              placeholder="https://outlook.office.com/webhook/..."
              value={config.webhookUrl || ""}
              onChange={(e) =>
                onChange({ ...config, webhookUrl: e.target.value })
              }
            />
          </div>
        );
      default:
        return null;
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
                <Link href="/admin/webhooks/settings">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Settings
                </Link>
              </Button>
              <div>
                <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
                  <Bell className="h-8 w-8" />
                  Notification Settings
                </h1>
                <p className="text-muted-foreground">
                  Configure alerts and notifications for webhook system events
                </p>
              </div>
            </div>
            <Button onClick={() => setShowAddChannel(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Channel
            </Button>
          </div>

          {/* Existing Channels */}
          <div className="space-y-6">
            {channels.map((channel) => {
              const Icon = getChannelIcon(channel.type);

              return (
                <Card key={channel.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Icon className="h-5 w-5" />
                        <div>
                          <CardTitle>{channel.name}</CardTitle>
                          <CardDescription className="capitalize">
                            {channel.type} notifications
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={channel.enabled}
                          onCheckedChange={() =>
                            handleToggleChannel(channel.id)
                          }
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleTestChannel(channel)}
                        >
                          <TestTube className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteChannel(channel.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <Label className="text-sm font-medium">Events</Label>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {channel.events.length > 0 ? (
                            channel.events.map((event) => (
                              <Badge key={event} variant="secondary">
                                {EVENT_TYPES.find((e) => e.value === event)
                                  ?.label || event}
                              </Badge>
                            ))
                          ) : (
                            <Badge variant="outline">No events selected</Badge>
                          )}
                        </div>
                      </div>

                      <div>
                        <Label className="text-sm font-medium">
                          Configuration
                        </Label>
                        <div className="text-muted-foreground mt-2 text-sm">
                          {Object.entries(channel.config).map(
                            ([key, value]) => (
                              <div key={key} className="flex justify-between">
                                <span className="capitalize">{key}:</span>
                                <span className="font-mono">{value}</span>
                              </div>
                            ),
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {channels.length === 0 && !showAddChannel && (
              <Card>
                <CardContent className="py-8 text-center">
                  <Bell className="text-muted-foreground/50 mx-auto h-12 w-12" />
                  <h3 className="mt-4 text-lg font-medium">
                    No notification channels configured
                  </h3>
                  <p className="text-muted-foreground mt-2">
                    Add notification channels to receive alerts about webhook
                    system events
                  </p>
                  <Button
                    className="mt-4"
                    onClick={() => setShowAddChannel(true)}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add First Channel
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Add Channel Form */}
            {showAddChannel && (
              <Card>
                <CardHeader>
                  <CardTitle>Add Notification Channel</CardTitle>
                  <CardDescription>
                    Configure a new channel to receive webhook system alerts
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Channel Name</Label>
                      <Input
                        placeholder="Production Alerts"
                        value={newChannel.name}
                        onChange={(e) =>
                          setNewChannel((prev) => ({
                            ...prev,
                            name: e.target.value,
                          }))
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Channel Type</Label>
                      <Select
                        value={newChannel.type}
                        onValueChange={(value: any) =>
                          setNewChannel((prev) => ({
                            ...prev,
                            type: value,
                            config: {},
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CHANNEL_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {renderChannelConfig(
                    newChannel.type,
                    newChannel.config,
                    (config) => setNewChannel((prev) => ({ ...prev, config })),
                  )}

                  <div className="space-y-2">
                    <Label>Event Types</Label>
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                      {EVENT_TYPES.map((event) => (
                        <div
                          key={event.value}
                          className="flex items-center space-x-2"
                        >
                          <input
                            type="checkbox"
                            id={event.value}
                            checked={newChannel.events.includes(event.value)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setNewChannel((prev) => ({
                                  ...prev,
                                  events: [...prev.events, event.value],
                                }));
                              } else {
                                setNewChannel((prev) => ({
                                  ...prev,
                                  events: prev.events.filter(
                                    (ev) => ev !== event.value,
                                  ),
                                }));
                              }
                            }}
                          />
                          <Label htmlFor={event.value} className="text-sm">
                            {event.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button onClick={handleAddChannel}>
                      <Save className="mr-2 h-4 w-4" />
                      Add Channel
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowAddChannel(false);
                        setNewChannel({
                          name: "",
                          type: "email",
                          config: {},
                          events: [],
                        });
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </WebhookErrorBoundary>
    </AuthenticatedLayout>
  );
}
