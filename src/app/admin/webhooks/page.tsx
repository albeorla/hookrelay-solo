"use client";

import React, { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Webhook,
  Activity,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Plus,
  Trash2,
  ExternalLink,
  Zap,
  Settings,
  BarChart3,
} from "lucide-react";
import { Button } from "@/ui/components/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Badge } from "@/ui/components/Badge";
import { IconWithBackground } from "@/ui/components/IconWithBackground";
import { AuthenticatedLayout } from "~/components/layout/authenticated-layout";
import { api } from "~/trpc/react";
import { WebhookEndpointForm } from "./_components/webhook-endpoint-form";

export default function WebhooksPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  // Always call hooks, but conditionally enable them
  const { data: endpoints, refetch: refetchEndpoints } =
    api.webhook.getEndpoints.useQuery(undefined, {
      enabled: session?.user.roles?.includes("ADMIN") ?? false,
      refetchInterval: 5000, // Real-time updates every 5 seconds
    });

  const { data: stats } = api.webhook.getStats.useQuery(undefined, {
    enabled: session?.user.roles?.includes("ADMIN") ?? false,
    refetchInterval: 2000, // Real-time stats every 2 seconds
  });

  const { data: recentDeliveries } = api.webhook.getRecentDeliveries.useQuery(
    { limit: 10 },
    {
      enabled: session?.user.roles?.includes("ADMIN") ?? false,
      refetchInterval: 3000, // Real-time deliveries every 3 seconds
    },
  );

  // Strengthen types locally to avoid any/unknown lint issues
  // Using UI-level types below to avoid unnecessary type alias warnings
  type EndpointUI = {
    id: string;
    name?: string | null;
    url: string;
    isActive: boolean;
    deliveryCount: number;
    method?: string | null;
    timeout?: number | null;
    maxRetries?: number | null;
  };
  type DeliveryUI = {
    id: string;
    endpointId: string;
    status: string;
    timestamp: number;
  };

  const endpointsList: EndpointUI[] =
    (endpoints as unknown as EndpointUI[]) ?? [];
  const deliveriesList: DeliveryUI[] =
    (recentDeliveries as unknown as DeliveryUI[]) ?? [];
  const statsData = stats;

  const deleteEndpoint = api.webhook.deleteEndpoint.useMutation({
    onSuccess: () => {
      toast.success("Webhook endpoint deleted successfully");
      void refetchEndpoints();
    },
    onError: (error) => {
      toast.error(`Failed to delete endpoint: ${error.message}`);
    },
  });

  // Use effect to handle redirect on client side
  React.useEffect(() => {
    if (session && !session.user.roles?.includes("ADMIN")) {
      router.push("/");
    }
  }, [session, router]);

  if (!session?.user.roles?.includes("ADMIN")) {
    return null;
  }

  const handleDeleteEndpoint = async (endpointId: string) => {
    if (
      confirm(
        `Delete webhook endpoint "${endpointId}"? This action cannot be undone.`,
      )
    ) {
      await deleteEndpoint.mutateAsync({ endpointId });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "success":
        return "text-green-600";
      case "failed":
        return "text-red-600";
      case "pending":
        return "text-yellow-600";
      default:
        return "text-gray-600";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return <CheckCircle className="h-4 w-4" />;
      case "failed":
        return <XCircle className="h-4 w-4" />;
      case "pending":
        return <Clock className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <AuthenticatedLayout>
      <div className="bg-default-background container flex h-full w-full max-w-none flex-col items-start gap-6 py-12">
        {/* Header */}
        <div className="flex w-full flex-col items-center justify-center gap-6">
          <div className="text-center">
            <h1 className="text-heading-1 font-heading-1 text-default-font">
              Webhook Management
            </h1>
            <p className="text-body font-body text-subtext-color mt-2">
              Monitor and manage webhook endpoints with real-time observability
            </p>
          </div>
          <Dialog
            open={isCreateDialogOpen}
            onOpenChange={setIsCreateDialogOpen}
          >
            <DialogTrigger asChild>
              <Button className="h-12 px-6" size="large">
                <Plus className="mr-2 h-5 w-5" />
                Add Endpoint
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Webhook Endpoint</DialogTitle>
                <DialogDescription>
                  Add a new webhook endpoint for receiving and processing
                  webhooks
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <WebhookEndpointForm
                  onSuccess={() => {
                    setIsCreateDialogOpen(false);
                    void refetchEndpoints();
                  }}
                />
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Divider */}
        <div className="bg-neutral-border flex h-px w-full flex-none flex-col items-center gap-2" />

        {/* Stats Overview */}
        {statsData && (
          <div className="grid w-full grid-cols-1 flex-wrap items-start gap-6 md:grid-cols-3">
            <div className="border-neutral-border bg-default-background flex w-full flex-col items-start rounded-md border border-solid shadow-sm">
              <div className="flex w-full flex-col items-start gap-2 py-4 pr-3 pl-6">
                <div className="flex items-center gap-3">
                  <IconWithBackground
                    size="medium"
                    icon={<BarChart3 className="h-5 w-5" />}
                  />
                  <div>
                    <span className="text-heading-3 font-heading-3 text-default-font">
                      Total Deliveries
                    </span>
                    <Badge variant="neutral" className="mt-2">
                      Last 24h
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="bg-neutral-border flex h-px w-full flex-none flex-col items-center gap-2" />
              <div className="flex w-full flex-col items-start px-4 py-4">
                <div className="text-3xl font-bold text-blue-600">
                  {statsData.totalDeliveries}
                </div>
                <p className="text-caption font-caption text-subtext-color mt-2">
                  {statsData.successRate}% success rate
                </p>
              </div>
            </div>

            <div className="border-neutral-border bg-default-background flex w-full flex-col items-start rounded-md border border-solid shadow-sm">
              <div className="flex w-full flex-col items-start gap-2 py-4 pr-3 pl-6">
                <div className="flex items-center gap-3">
                  <IconWithBackground
                    size="medium"
                    icon={<Activity className="h-5 w-5" />}
                  />
                  <div>
                    <span className="text-heading-3 font-heading-3 text-default-font">
                      Active Endpoints
                    </span>
                    <Badge variant="neutral" className="mt-2">
                      Currently Active
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="bg-neutral-border flex h-px w-full flex-none flex-col items-center gap-2" />
              <div className="flex w-full flex-col items-start px-4 py-4">
                <div className="text-3xl font-bold text-green-600">
                  {endpointsList.length}
                </div>
                <p className="text-caption font-caption text-subtext-color mt-2">
                  {endpointsList.filter((e) => e.isActive).length} enabled
                </p>
              </div>
            </div>

            <div className="border-neutral-border bg-default-background flex w-full flex-col items-start rounded-md border border-solid shadow-sm">
              <div className="flex w-full flex-col items-start gap-2 py-4 pr-3 pl-6">
                <div className="flex items-center gap-3">
                  <IconWithBackground
                    size="medium"
                    icon={<Zap className="h-5 w-5" />}
                  />
                  <div>
                    <span className="text-heading-3 font-heading-3 text-default-font">
                      Recent Activity
                    </span>
                    <Badge variant="neutral" className="mt-2">
                      Last Hour
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="bg-neutral-border flex h-px w-full flex-none flex-col items-center gap-2" />
              <div className="flex w-full flex-col items-start px-4 py-4">
                <div className="text-3xl font-bold text-purple-600">
                  {recentDeliveries?.length ?? 0}
                </div>
                <p className="text-caption font-caption text-subtext-color mt-2">
                  deliveries in last hour
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="grid w-full grid-cols-1 flex-wrap items-start gap-6 md:grid-cols-2 lg:grid-cols-3">
          {endpointsList.map((endpoint: EndpointUI) => (
            <div
              key={endpoint.id}
              className="flex shrink-0 grow basis-0 flex-col items-start gap-3 overflow-hidden pb-3"
            >
              <div className="border-neutral-border bg-default-background flex w-full flex-col items-start rounded-md border border-solid shadow-sm">
                <div className="flex w-full flex-col items-start gap-2 py-4 pr-3 pl-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <IconWithBackground
                        size="medium"
                        icon={<Webhook className="h-5 w-5" />}
                      />
                      <div>
                        <span className="text-heading-3 font-heading-3 text-default-font">
                          {endpoint.name ?? "Unnamed Endpoint"}
                        </span>
                        <Badge
                          variant={endpoint.isActive ? "brand" : "neutral"}
                          className="mt-2"
                        >
                          {endpoint.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-subtext-color text-caption font-caption flex items-center gap-1">
                        <Settings className="h-4 w-4" />
                        {endpoint.deliveryCount ?? 0} deliveries
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-neutral-border flex h-px w-full flex-none flex-col items-center gap-2" />

                <div className="flex w-full flex-col items-start px-4 py-4">
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-body-bold font-body-bold text-default-font mb-2">
                        Endpoint URL
                      </h4>
                      <p className="text-caption font-caption text-subtext-color font-mono break-all">
                        {endpoint.url}
                      </p>
                    </div>

                    <div>
                      <h4 className="text-body-bold font-body-bold text-default-font mb-2">
                        Configuration
                      </h4>
                      <div className="space-y-2">
                        <div className="text-caption font-caption flex items-center justify-between">
                          <span className="text-subtext-color">Method:</span>
                          <Badge variant="neutral" className="text-xs">
                            {endpoint.method ?? "POST"}
                          </Badge>
                        </div>
                        <div className="text-caption font-caption flex items-center justify-between">
                          <span className="text-subtext-color">Timeout:</span>
                          <Badge variant="neutral" className="text-xs">
                            {endpoint.timeout ?? 30}s
                          </Badge>
                        </div>
                        <div className="text-caption font-caption flex items-center justify-between">
                          <span className="text-subtext-color">Retries:</span>
                          <Badge variant="neutral" className="text-xs">
                            {endpoint.maxRetries ?? 3}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-body-bold font-body-bold text-default-font mb-2">
                        Recent Deliveries
                      </h4>
                      {deliveriesList && deliveriesList.length > 0 ? (
                        <div className="space-y-2">
                          {deliveriesList
                            .filter(
                              (d: DeliveryUI) => d.endpointId === endpoint.id,
                            )
                            .slice(0, 3)
                            .map((delivery: DeliveryUI) => (
                              <div
                                key={delivery.id}
                                className="flex items-center justify-between text-xs"
                              >
                                <div className="flex items-center gap-2">
                                  {getStatusIcon(delivery.status)}
                                  <span
                                    className={getStatusColor(delivery.status)}
                                  >
                                    {delivery.status}
                                  </span>
                                </div>
                                <span className="text-subtext-color text-caption font-caption">
                                  {formatTimestamp(delivery.timestamp)}
                                </span>
                              </div>
                            ))}
                        </div>
                      ) : (
                        <p className="text-subtext-color text-caption font-caption italic">
                          No recent deliveries
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                      <Button
                        variant="neutral-secondary"
                        size="small"
                        onClick={() => {
                          const targetUrl =
                            typeof endpoint.url === "string"
                              ? endpoint.url
                              : String(endpoint.url);
                          window.open(targetUrl, "_blank");
                        }}
                        className="flex-1"
                      >
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Test
                      </Button>
                      <Button
                        variant="neutral-secondary"
                        size="small"
                        onClick={() => handleDeleteEndpoint(endpoint.id)}
                        className="flex-1"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="bg-neutral-border flex h-px w-full flex-none flex-col items-center gap-2" />
        <div className="flex w-full flex-col items-center justify-center gap-4 px-12 py-8">
          <span className="text-heading-3 font-heading-3 text-default-font">
            Webhook System Overview
          </span>
          <div className="text-caption font-caption text-subtext-color max-w-2xl text-center">
            <p>
              This system manages {endpoints?.length ?? 0} webhook endpoints
              with real-time monitoring, delivery tracking, and comprehensive
              analytics. Each endpoint can be configured with custom retry
              policies, timeouts, and authentication for reliable webhook
              delivery.
            </p>
          </div>
        </div>
      </div>
    </AuthenticatedLayout>
  );
}
