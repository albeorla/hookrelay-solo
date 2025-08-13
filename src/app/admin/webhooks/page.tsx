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
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Separator } from "~/components/ui/separator";
import { AuthenticatedLayout } from "~/components/layout/authenticated-layout";
import { api } from "~/trpc/react";
import { WebhookEndpointForm } from "./_components/webhook-endpoint-form";

export default function WebhooksPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const { data: endpoints, refetch: refetchEndpoints } =
    api.webhook.getEndpoints.useQuery(undefined, {
      enabled: session?.user.roles?.includes("ADMIN") ?? false,
      refetchInterval: 5000,
    });

  const { data: stats } = api.webhook.getStats.useQuery(undefined, {
    enabled: session?.user.roles?.includes("ADMIN") ?? false,
    refetchInterval: 2000,
  });

  const { data: recentDeliveries } = api.webhook.getRecentDeliveries.useQuery(
    { limit: 10 },
    {
      enabled: session?.user.roles?.includes("ADMIN") ?? false,
      refetchInterval: 3000,
    },
  );

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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "pending":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <AuthenticatedLayout>
      <div className="container mx-auto py-12">
        <header className="mb-8 text-center">
          <h1 className="text-4xl font-bold tracking-tight">
            Webhook Management
          </h1>
          <p className="text-muted-foreground mt-2">
            Monitor and manage webhook endpoints with real-time observability
          </p>
          <Dialog
            open={isCreateDialogOpen}
            onOpenChange={setIsCreateDialogOpen}
          >
            <DialogTrigger asChild>
              <Button size="lg" className="mt-6">
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
        </header>

        <Separator className="mb-8" />

        {statsData && (
          <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Deliveries
                </CardTitle>
                <BarChart3 className="text-muted-foreground h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {statsData.totalDeliveries}
                </div>
                <p className="text-muted-foreground text-xs">
                  {statsData.successRate}% success rate
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
                <div className="text-2xl font-bold">{endpointsList.length}</div>
                <p className="text-muted-foreground text-xs">
                  {endpointsList.filter((e) => e.isActive).length} enabled
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Recent Activity
                </CardTitle>
                <Zap className="text-muted-foreground h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {recentDeliveries?.length ?? 0}
                </div>
                <p className="text-muted-foreground text-xs">
                  deliveries in the last hour
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {endpointsList.map((endpoint: EndpointUI) => (
            <Card key={endpoint.id} className="flex flex-col">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <Webhook className="text-muted-foreground h-6 w-6" />
                    <div>
                      <CardTitle>
                        {endpoint.name ?? "Unnamed Endpoint"}
                      </CardTitle>
                      <Badge
                        variant={endpoint.isActive ? "default" : "outline"}
                        className="mt-1"
                      >
                        {endpoint.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </div>
                  <div className="text-muted-foreground flex items-center gap-2 text-sm">
                    <Settings className="h-4 w-4" />
                    <span>{endpoint.deliveryCount ?? 0} deliveries</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-grow space-y-4">
                <div>
                  <h4 className="mb-2 font-semibold">Endpoint URL</h4>
                  <p className="text-muted-foreground font-mono text-sm break-all">
                    {endpoint.url}
                  </p>
                </div>
                <div>
                  <h4 className="mb-2 font-semibold">Configuration</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Method:</span>
                      <span>{endpoint.method ?? "POST"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Timeout:</span>
                      <span>{endpoint.timeout ?? 30}s</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Retries:</span>
                      <span>{endpoint.maxRetries ?? 3}</span>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="mb-2 font-semibold">Recent Deliveries</h4>
                  {deliveriesList &&
                  deliveriesList.filter(
                    (d: DeliveryUI) => d.endpointId === endpoint.id,
                  ).length > 0 ? (
                    <div className="space-y-2">
                      {deliveriesList
                        .filter((d: DeliveryUI) => d.endpointId === endpoint.id)
                        .slice(0, 3)
                        .map((delivery: DeliveryUI) => (
                          <div
                            key={delivery.id}
                            className="flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center gap-2">
                              {getStatusIcon(delivery.status)}
                              <span className="capitalize">
                                {delivery.status}
                              </span>
                            </div>
                            <span className="text-muted-foreground">
                              {formatTimestamp(delivery.timestamp)}
                            </span>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm italic">
                      No recent deliveries
                    </p>
                  )}
                </div>
              </CardContent>
              <div className="border-t p-4">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(endpoint.url, "_blank")}
                    className="flex-1"
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Test
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteEndpoint(endpoint.id)}
                    className="flex-1"
                    color="destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <Separator className="my-8" />

        <footer className="text-center">
          <h3 className="text-2xl font-semibold">Webhook System Overview</h3>
          <p className="text-muted-foreground mx-auto mt-2 max-w-2xl">
            This system manages {endpoints?.length ?? 0} webhook endpoints with
            real-time monitoring, delivery tracking, and comprehensive
            analytics.
          </p>
        </footer>
      </div>
    </AuthenticatedLayout>
  );
}
