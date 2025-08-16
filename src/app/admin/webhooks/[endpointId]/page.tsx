"use client";

import React, { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  Settings,
  Trash2,
  ExternalLink,
  Activity,
  AlertCircle,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Separator } from "~/components/ui/separator";
// Removed unused Alert components
import { AuthenticatedLayout } from "~/components/layout/authenticated-layout";
import { api } from "~/trpc/react";
import { HmacSecretManager } from "../_components/hmac-secret-manager";
import { WebhookTestTool } from "../_components/webhook-test-tool";
import { type WebhookDelivery } from "~/types/webhook";

interface WebhookEndpointDetailsPageProps {
  params: {
    endpointId: string;
  };
}

export default function WebhookEndpointDetailsPage({
  params,
}: WebhookEndpointDetailsPageProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  const {
    data: endpoint,
    refetch: refetchEndpoint,
    isLoading: endpointLoading,
  } = api.webhook.getEndpoint.useQuery(
    { endpointId: params.endpointId },
    {
      enabled: session?.user.roles?.includes("ADMIN") ?? false,
    },
  );

  const { data: recentDeliveries } = api.webhook.getDeliveryLogs.useQuery(
    {
      endpointId: params.endpointId,
      limit: 10,
    },
    {
      enabled: session?.user.roles?.includes("ADMIN") ?? false,
      refetchInterval: 5000,
    },
  );

  const deleteEndpoint = api.webhook.deleteEndpoint.useMutation({
    onSuccess: () => {
      toast.success("Webhook endpoint deleted successfully");
      router.push("/admin/webhooks");
    },
    onError: (error) => {
      toast.error(`Failed to delete endpoint: ${error.message}`);
      setIsDeleting(false);
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

  if (endpointLoading) {
    return (
      <AuthenticatedLayout>
        <div className="container mx-auto py-8">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="border-primary mx-auto h-8 w-8 animate-spin rounded-full border-b-2"></div>
              <p className="text-muted-foreground mt-4">
                Loading endpoint details...
              </p>
            </div>
          </div>
        </div>
      </AuthenticatedLayout>
    );
  }

  if (!endpoint) {
    return (
      <AuthenticatedLayout>
        <div className="container mx-auto py-8">
          <div className="py-12 text-center">
            <AlertCircle className="text-muted-foreground mx-auto h-12 w-12" />
            <h3 className="mt-4 text-lg font-semibold">Endpoint not found</h3>
            <p className="text-muted-foreground mt-2">
              The requested webhook endpoint could not be found.
            </p>
            <Button asChild className="mt-4">
              <Link href="/admin/webhooks">Back to Webhooks</Link>
            </Button>
          </div>
        </div>
      </AuthenticatedLayout>
    );
  }

  const handleDeleteEndpoint = async () => {
    if (
      confirm(
        `Delete webhook endpoint "${endpoint.id}"? This action cannot be undone.`,
      )
    ) {
      setIsDeleting(true);
      await deleteEndpoint.mutateAsync({ endpointId: endpoint.id });
    }
  };

  const rawDeliveries = recentDeliveries?.deliveries;
  const deliveries: WebhookDelivery[] = Array.isArray(rawDeliveries)
    ? (rawDeliveries as unknown as WebhookDelivery[])
    : [];
  const successfulDeliveries = deliveries.filter(
    (d) => d.status === "success",
  ).length;
  const failedDeliveries = deliveries.filter(
    (d) => d.status === "failed",
  ).length;
  const pendingDeliveries = deliveries.filter(
    (d) => d.status === "pending",
  ).length;

  return (
    <AuthenticatedLayout>
      <div className="container mx-auto py-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/admin/webhooks">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Webhooks
              </Link>
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                Endpoint: {endpoint.name}
              </h1>
              <p className="text-muted-foreground">
                Manage settings and view delivery history
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <WebhookTestTool
              endpointId={endpoint.id}
              endpointUrl={endpoint.url}
              trigger={
                <Button variant="outline">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Test Endpoint
                </Button>
              }
            />
            <Button
              variant="destructive"
              onClick={handleDeleteEndpoint}
              disabled={isDeleting}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </div>

        {/* Basic Info */}
        <div className="mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Endpoint Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <h4 className="mb-2 font-semibold">Endpoint ID</h4>
                  <code className="bg-muted rounded px-2 py-1 text-sm">
                    {endpoint.id}
                  </code>
                </div>
                <div>
                  <h4 className="mb-2 font-semibold">Status</h4>
                  <Badge variant={endpoint.isActive ? "default" : "outline"}>
                    {endpoint.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <div className="md:col-span-2">
                  <h4 className="mb-2 font-semibold">Destination URL</h4>
                  <p className="bg-muted rounded px-2 py-1 font-mono text-sm break-all">
                    {endpoint.url}
                  </p>
                </div>
                <div>
                  <h4 className="mb-2 font-semibold">HTTP Method</h4>
                  <Badge variant="outline">{endpoint.method}</Badge>
                </div>
                <div>
                  <h4 className="mb-2 font-semibold">Timeout</h4>
                  <span className="text-sm">{endpoint.timeout}s</span>
                </div>
                <div>
                  <h4 className="mb-2 font-semibold">Max Retries</h4>
                  <span className="text-sm">{endpoint.maxRetries}</span>
                </div>
                <div>
                  <h4 className="mb-2 font-semibold">HMAC Mode</h4>
                  {endpoint.hmacMode ? (
                    <Badge variant="secondary">
                      {endpoint.hmacMode.toUpperCase()}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground text-sm">None</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* HMAC Secret Management */}
        <div className="mb-8">
          <HmacSecretManager
            endpointId={endpoint.id}
            currentHmacMode={endpoint.hmacMode ?? undefined}
            hasSecret={endpoint.hasSecret}
            onSecretGenerated={() => refetchEndpoint()}
          />
        </div>

        {/* Recent Deliveries Summary */}
        <div className="mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Recent Delivery Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-500">
                    {successfulDeliveries}
                  </div>
                  <p className="text-muted-foreground text-sm">Successful</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-500">
                    {failedDeliveries}
                  </div>
                  <p className="text-muted-foreground text-sm">Failed</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-500">
                    {pendingDeliveries}
                  </div>
                  <p className="text-muted-foreground text-sm">Pending</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{deliveries.length}</div>
                  <p className="text-muted-foreground text-sm">Total Recent</p>
                </div>
              </div>

              <Separator className="my-4" />

              <div className="flex justify-center">
                <Button variant="outline" asChild>
                  <Link
                    href={`/admin/webhooks/deliveries?endpointId=${endpoint.id}`}
                  >
                    View All Deliveries
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Deliveries List */}
        {deliveries.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Latest Deliveries (Last 10)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {deliveries.map((delivery) => (
                  <div
                    key={delivery.deliveryId}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-2 w-2 rounded-full ${
                          delivery.status === "success"
                            ? "bg-green-500"
                            : delivery.status === "failed"
                              ? "bg-red-500"
                              : delivery.status === "pending"
                                ? "bg-blue-500"
                                : "bg-yellow-500"
                        }`}
                      />
                      <div>
                        <div className="font-medium">
                          {delivery.status.charAt(0).toUpperCase() +
                            delivery.status.slice(1)}
                        </div>
                        <div className="text-muted-foreground text-sm">
                          Attempt #{delivery.attempt}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {delivery.responseStatus && (
                        <Badge
                          variant={
                            delivery.responseStatus >= 200 &&
                            delivery.responseStatus < 300
                              ? "default"
                              : "destructive"
                          }
                        >
                          {delivery.responseStatus}
                        </Badge>
                      )}
                      {delivery.durationMs && (
                        <span className="text-muted-foreground text-xs">
                          {delivery.durationMs}ms
                        </span>
                      )}
                      <div className="text-muted-foreground text-xs">
                        {new Date(delivery.timestamp).toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AuthenticatedLayout>
  );
}
