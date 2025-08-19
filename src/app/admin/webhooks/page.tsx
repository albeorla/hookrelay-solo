"use client";

import React, { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
import {
  DashboardMetricsSkeleton,
  RecentActivitySkeleton,
} from "./_components/loading-skeletons";
import { Separator } from "~/components/ui/separator";
import { AuthenticatedLayout } from "~/components/layout/authenticated-layout";
import { api } from "~/trpc/react";
import { WebhookEndpointForm } from "./_components/webhook-endpoint-form";
import { WebhookErrorBoundary } from "~/components/error-boundary";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Switch } from "~/components/ui/switch";
import { Pencil } from "lucide-react";
import { Textarea } from "~/components/ui/textarea";

export default function WebhooksPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const {
    data: endpoints,
    refetch: refetchEndpoints,
    isLoading: endpointsLoading,
  } = api.webhook.getEndpoints.useQuery(undefined, {
    enabled: session?.user.roles?.includes("ADMIN") ?? false,
    refetchInterval: 5000,
  });

  const { data: stats, isLoading: statsLoading } =
    api.webhook.getStats.useQuery(undefined, {
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

  const endpointsList: EndpointUI[] = React.useMemo(() => {
    return (endpoints as unknown as EndpointUI[]) ?? [];
  }, [endpoints]);
  const deliveriesList: DeliveryUI[] =
    (recentDeliveries as unknown as DeliveryUI[]) ?? [];
  const statsData = stats;

  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<
    "all" | "active" | "inactive"
  >("all");

  const filteredEndpoints = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return endpointsList.filter((e) => {
      const matchesQuery =
        !q ||
        e.id.toLowerCase().includes(q) ||
        (e.name ?? "").toLowerCase().includes(q) ||
        e.url.toLowerCase().includes(q);
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" ? e.isActive : !e.isActive);
      return matchesQuery && matchesStatus;
    });
  }, [endpointsList, search, statusFilter]);

  const updateEndpoint = api.webhook.updateEndpoint.useMutation({
    onSuccess: async () => {
      toast.success("Endpoint updated");
      await refetchEndpoints();
    },
    onError: (error) => toast.error(`Failed to update: ${error.message}`),
  });

  const [editing, setEditing] = React.useState<EndpointUI | null>(null);
  const [editUrl, setEditUrl] = React.useState("");
  const [editHmacMode, setEditHmacMode] = React.useState<string>("");
  const [editTimeout, setEditTimeout] = React.useState<number>(30);
  const [editMaxRetries, setEditMaxRetries] = React.useState<number>(3);
  const [editDescription, setEditDescription] = React.useState<string>("");
  const [editActive, setEditActive] = React.useState<boolean>(true);

  const openEdit = (ep: EndpointUI) => {
    setEditing(ep);
    setEditUrl(ep.url);
    setEditHmacMode("");
    setEditTimeout(ep.timeout ?? 30);
    setEditMaxRetries(ep.maxRetries ?? 3);
    setEditDescription(((ep as any).description as string) ?? "");
    setEditActive(ep.isActive);
  };
  const closeEdit = () => setEditing(null);
  const submitEdit = async () => {
    if (!editing) return;
    await updateEndpoint.mutateAsync({
      endpointId: editing.id,
      destUrl: editUrl,
      hmacMode: (editHmacMode || undefined) as any,
      timeout: editTimeout,
      maxRetries: editMaxRetries,
      description: editDescription || undefined,
      isActive: editActive,
    });
    setEditing(null);
  };

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

  if (status === "loading") {
    return (
      <AuthenticatedLayout>
        <div className="container mx-auto py-12">
          <div className="mb-8">
            <DashboardMetricsSkeleton />
          </div>
          <RecentActivitySkeleton />
        </div>
      </AuthenticatedLayout>
    );
  }

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
      <WebhookErrorBoundary>
        <div className="container mx-auto py-12">
          <header className="mb-8 text-center">
            <h1 className="text-4xl font-bold tracking-tight">
              Webhook Management
            </h1>
            <p className="text-muted-foreground mt-2">
              Monitor and manage webhook endpoints with real-time observability
            </p>
            <div className="mt-6 flex items-center justify-center gap-4">
              <Button size="lg" variant="outline" asChild>
                <Link href="/admin/webhooks/dashboard">
                  <BarChart3 className="mr-2 h-5 w-5" />
                  View Dashboard
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/admin/webhooks/dlq">Dead Letter Queue</Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/admin/webhooks/settings">
                  <Settings className="mr-2 h-5 w-5" />
                  Settings
                </Link>
              </Button>
              <Dialog
                open={isCreateDialogOpen}
                onOpenChange={setIsCreateDialogOpen}
              >
                <DialogTrigger asChild>
                  <Button size="lg">
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
          </header>

          <Separator className="mb-8" />

          {/* Search and Filters */}
          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <Input
                placeholder="Search by name, ID, or URL"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search endpoints"
              />
            </div>
            <div>
              <Select
                value={statusFilter}
                onValueChange={(v) => setStatusFilter(v as any)}
              >
                <SelectTrigger aria-label="Filter by status">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {statsData && !statsLoading && (
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
                  <div className="text-2xl font-bold">
                    {endpointsList.length}
                  </div>
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

          {endpointsLoading ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="min-h-[220px]">
                  <CardContent className="pt-6">
                    <div className="space-y-3">
                      <div className="bg-muted/50 h-6 w-1/3 animate-pulse rounded" />
                      <div className="bg-muted/50 h-4 w-1/2 animate-pulse rounded" />
                      <div className="bg-muted/50 h-4 w-full animate-pulse rounded" />
                      <div className="bg-muted/50 h-4 w-3/4 animate-pulse rounded" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredEndpoints.map((endpoint: EndpointUI) => (
                <Card key={endpoint.id} className="flex flex-col">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-4">
                        <Webhook className="text-muted-foreground h-6 w-6" />
                        <div>
                          <CardTitle>
                            {endpoint.name ?? "Unnamed Endpoint"}
                          </CardTitle>
                          <div className="mt-2 flex items-center gap-2">
                            <Badge
                              variant={
                                endpoint.isActive ? "default" : "outline"
                              }
                            >
                              {endpoint.isActive ? "Active" : "Inactive"}
                            </Badge>
                            <Switch
                              aria-label="Toggle active"
                              checked={endpoint.isActive}
                              onCheckedChange={(checked) =>
                                updateEndpoint.mutate({
                                  endpointId: endpoint.id,
                                  isActive: checked,
                                })
                              }
                            />
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-muted-foreground text-sm">
                          {endpoint.deliveryCount ?? 0} deliveries
                        </div>
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/admin/webhooks/${endpoint.id}`}>
                            <Settings className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Edit ${endpoint.id}`}
                          onClick={() => openEdit(endpoint)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-grow space-y-4">
                    <div>
                      <h4 className="mb-2 font-semibold">Endpoint URL</h4>
                      <div className="flex items-center gap-2">
                        <p className="text-muted-foreground font-mono text-sm break-all">
                          {endpoint.url}
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(endpoint.url);
                              toast.success("Copied URL");
                            } catch {
                              toast.error("Failed to copy URL");
                            }
                          }}
                          aria-label="Copy webhook URL"
                        >
                          Copy
                        </Button>
                      </div>
                      {(endpoint as any).description && (
                        <p className="text-muted-foreground mt-2 text-sm">
                          {(endpoint as any).description}
                        </p>
                      )}
                    </div>
                    <div>
                      <h4 className="mb-2 font-semibold">Configuration</h4>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Method:</span>
                          <span>{endpoint.method ?? "POST"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Timeout:
                          </span>
                          <span>{endpoint.timeout ?? 30}s</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Retries:
                          </span>
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
                        aria-label="Open endpoint URL in new tab"
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
                        aria-label={`Delete endpoint ${endpoint.id}`}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Edit Dialog */}
          <Dialog open={!!editing} onOpenChange={(o) => !o && closeEdit()}>
            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle>Edit Endpoint</DialogTitle>
                <DialogDescription>
                  Update configuration for this endpoint.
                </DialogDescription>
              </DialogHeader>
              {editing && (
                <div className="space-y-4">
                  <div>
                    <label
                      className="mb-1 block text-sm font-medium"
                      htmlFor="edit-url"
                    >
                      Destination URL
                    </label>
                    <Input
                      id="edit-url"
                      value={editUrl}
                      onChange={(e) => setEditUrl(e.target.value)}
                      aria-describedby="edit-url-help"
                    />
                    <div
                      id="edit-url-help"
                      className="text-muted-foreground mt-1 text-xs"
                    >
                      Where webhooks will be delivered.
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm font-medium">
                        HMAC Mode
                      </label>
                      <Select
                        value={editHmacMode}
                        onValueChange={setEditHmacMode}
                      >
                        <SelectTrigger aria-label="Select HMAC mode">
                          <SelectValue placeholder="None" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">None</SelectItem>
                          <SelectItem value="stripe">Stripe</SelectItem>
                          <SelectItem value="github">GitHub</SelectItem>
                          <SelectItem value="generic">Generic</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center justify-between rounded border p-3">
                      <div className="text-sm">Active</div>
                      <Switch
                        checked={editActive}
                        onCheckedChange={setEditActive}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label
                        className="mb-1 block text-sm font-medium"
                        htmlFor="edit-timeout"
                      >
                        Timeout (s)
                      </label>
                      <Input
                        id="edit-timeout"
                        type="number"
                        min={5}
                        max={300}
                        value={editTimeout}
                        onChange={(e) =>
                          setEditTimeout(parseInt(e.target.value) || 30)
                        }
                      />
                    </div>
                    <div>
                      <label
                        className="mb-1 block text-sm font-medium"
                        htmlFor="edit-retries"
                      >
                        Max Retries
                      </label>
                      <Input
                        id="edit-retries"
                        type="number"
                        min={0}
                        max={10}
                        value={editMaxRetries}
                        onChange={(e) =>
                          setEditMaxRetries(parseInt(e.target.value) || 3)
                        }
                      />
                    </div>
                  </div>
                  <div>
                    <label
                      className="mb-1 block text-sm font-medium"
                      htmlFor="edit-desc"
                    >
                      Description
                    </label>
                    <Textarea
                      id="edit-desc"
                      rows={3}
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={closeEdit}
                      disabled={updateEndpoint.isPending}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={submitEdit}
                      disabled={updateEndpoint.isPending}
                    >
                      Save Changes
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

          <Separator className="my-8" />

          <footer className="text-center">
            <h3 className="text-2xl font-semibold">Webhook System Overview</h3>
            <p className="text-muted-foreground mx-auto mt-2 max-w-2xl">
              This system manages {endpoints?.length ?? 0} webhook endpoints
              with real-time monitoring, delivery tracking, and comprehensive
              analytics.
            </p>
          </footer>
        </div>
      </WebhookErrorBoundary>
    </AuthenticatedLayout>
  );
}
