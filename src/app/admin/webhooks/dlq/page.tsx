"use client";

import React, { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  AlertTriangle,
  RotateCcw,
  Trash2,
  Eye,
  MoreHorizontal,
  RefreshCw,
  Download,
  Calendar,
  Skull,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Separator } from "~/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Checkbox } from "~/components/ui/checkbox";
import { AuthenticatedLayout } from "~/components/layout/authenticated-layout";
import { api } from "~/trpc/react";
import { WebhookErrorBoundary } from "~/components/error-boundary";
import { PayloadInspector } from "../_components/payload-inspector";
import { type DlqItem } from "~/types/webhook";
import { DlqItemsSkeleton } from "../_components/loading-skeletons";
import {
  usePerformanceMonitor,
  QueryOptimizations,
} from "~/hooks/use-optimized-query";

export default function DlqViewerPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Performance monitoring
  usePerformanceMonitor("DlqViewerPage");

  const {
    data: dlqData,
    refetch: refetchDlq,
    isLoading: dlqLoading,
    isFetching: dlqFetching,
  } = api.webhook.getDlqItems.useQuery(
    { limit: 50 },
    {
      enabled: session?.user.roles?.includes("ADMIN") ?? false,
      ...QueryOptimizations.dashboard, // Less frequent updates for DLQ
    },
  );

  const replayFromDlq = api.webhook.replayFromDlq.useMutation({
    onSuccess: () => {
      toast.success("Delivery replay initiated successfully");
      void refetchDlq();
    },
    onError: (error) => {
      toast.error(`Failed to replay delivery: ${error.message}`);
    },
  });

  const deleteDlqItem = api.webhook.deleteDlqItem.useMutation({
    onSuccess: () => {
      toast.success("DLQ item deleted successfully");
      void refetchDlq();
    },
    onError: (error) => {
      toast.error(`Failed to delete DLQ item: ${error.message}`);
    },
  });

  const bulkDeleteDlqItems = api.webhook.bulkDeleteDlqItems.useMutation({
    onSuccess: (result) => {
      toast.success(
        `Bulk delete completed: ${result.summary.succeeded} deleted, ${result.summary.failed} failed`,
      );
      setSelectedItems([]);
      void refetchDlq();
    },
    onError: (error) => {
      toast.error(`Failed to bulk delete: ${error.message}`);
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

  const rawItems = dlqData?.items as unknown;
  const dlqItems: DlqItem[] = Array.isArray(rawItems)
    ? (rawItems as DlqItem[])
    : [];
  const totalCount = dlqData?.totalCount ?? 0;

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refetchDlq();
    } finally {
      setRefreshing(false);
    }
  };

  const handleReplayItem = async (dlqKey: string) => {
    await replayFromDlq.mutateAsync({ dlqKey });
  };

  const handleDeleteItem = async (dlqKey: string) => {
    if (confirm("Delete this DLQ item? This action cannot be undone.")) {
      await deleteDlqItem.mutateAsync({ dlqKey });
    }
  };

  const handleBulkDelete = async () => {
    if (selectedItems.length === 0) {
      toast.error("No items selected");
      return;
    }

    if (
      confirm(
        `Delete ${selectedItems.length} DLQ items? This action cannot be undone.`,
      )
    ) {
      await bulkDeleteDlqItems.mutateAsync({ dlqKeys: selectedItems });
    }
  };

  const handleSelectItem = (dlqKey: string, checked: boolean) => {
    if (checked) {
      setSelectedItems((prev) => [...prev, dlqKey]);
    } else {
      setSelectedItems((prev) => prev.filter((key) => key !== dlqKey));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allKeys = dlqItems.map((item) => item.key);
      setSelectedItems(allKeys);
    } else {
      setSelectedItems([]);
    }
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const getReasonBadgeVariant = (reason: string) => {
    if (reason.toLowerCase().includes("timeout")) return "secondary";
    if (reason.toLowerCase().includes("retry")) return "destructive";
    if (reason.toLowerCase().includes("error")) return "destructive";
    return "outline";
  };

  const getDaysSinceFailed = (timestamp: number) => {
    const days = Math.floor((Date.now() - timestamp) / (1000 * 60 * 60 * 24));
    return days;
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
                  <Skull className="text-destructive h-8 w-8" />
                  Dead Letter Queue
                </h1>
                <p className="text-muted-foreground">
                  View and manage webhooks that failed after exhausting all
                  retries
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={handleRefresh}
              disabled={refreshing || dlqLoading || dlqFetching}
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
          </div>

          {/* DLQ Overview */}
          <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">DLQ Items</CardTitle>
                <AlertTriangle className="text-destructive h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="text-destructive text-2xl font-bold">
                  {totalCount}
                </div>
                <p className="text-muted-foreground text-xs">
                  Failed deliveries requiring attention
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Oldest Item
                </CardTitle>
                <Calendar className="text-muted-foreground h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {dlqItems.length > 0
                    ? `${getDaysSinceFailed(Math.min(...dlqItems.map((i) => i.lastModified)))} days`
                    : "N/A"}
                </div>
                <p className="text-muted-foreground text-xs">
                  Time since oldest failure
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Storage Used
                </CardTitle>
                <Download className="text-muted-foreground h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatFileSize(
                    dlqItems.reduce((acc, item) => acc + item.size, 0),
                  )}
                </div>
                <p className="text-muted-foreground text-xs">
                  Total DLQ storage usage
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Alert for old items */}
          {dlqItems.length > 0 &&
            getDaysSinceFailed(
              Math.min(...dlqItems.map((i) => i.lastModified)),
            ) > 7 && (
              <Alert className="mb-6" variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Old DLQ Items Detected</AlertTitle>
                <AlertDescription>
                  You have webhook deliveries that failed over a week ago.
                  Consider reviewing and cleaning up old items to prevent
                  storage costs and improve performance.
                </AlertDescription>
              </Alert>
            )}

          {/* Bulk Actions */}
          {selectedItems.length > 0 && (
            <Card className="mb-6">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {selectedItems.length} items selected
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedItems([])}
                    >
                      Clear Selection
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleBulkDelete}
                      disabled={bulkDeleteDlqItems.isPending}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Selected
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* DLQ Items Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                DLQ Items ({dlqItems.length} of {totalCount})
                {dlqFetching && (
                  <RefreshCw className="ml-2 h-4 w-4 animate-spin" />
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dlqLoading ? (
                <DlqItemsSkeleton count={10} />
              ) : (
                <div
                  className="overflow-x-auto"
                  role="region"
                  aria-label="Dead Letter Queue items table"
                >
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <Checkbox
                            checked={
                              selectedItems.length === dlqItems.length &&
                              dlqItems.length > 0
                            }
                            onCheckedChange={handleSelectAll}
                          />
                        </TableHead>
                        <TableHead>Endpoint</TableHead>
                        <TableHead>Delivery ID</TableHead>
                        <TableHead>Failed At</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Attempts</TableHead>
                        <TableHead>Size</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dlqItems.map((item) => {
                        const isSelected = selectedItems.includes(item.key);
                        const daysSince = getDaysSinceFailed(item.lastModified);

                        return (
                          <TableRow key={item.key}>
                            <TableCell>
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={(checked) =>
                                  handleSelectItem(item.key, checked as boolean)
                                }
                              />
                            </TableCell>
                            <TableCell>
                              <div>
                                <div className="max-w-32 truncate font-medium">
                                  {item.endpointId}
                                </div>
                                {daysSince > 3 && (
                                  <Badge
                                    variant="outline"
                                    className="mt-1 text-xs"
                                  >
                                    {daysSince} days old
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <code className="bg-muted rounded px-1 py-0.5 text-xs">
                                {item.deliveryId.length > 16
                                  ? item.deliveryId.substring(0, 16) + "..."
                                  : item.deliveryId}
                              </code>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                {formatTimestamp(item.lastModified)}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={getReasonBadgeVariant(item.reason)}
                              >
                                {item.reason}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {item.attemptCount}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <span className="text-muted-foreground text-sm">
                                {formatFileSize(item.size)}
                              </span>
                            </TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                  >
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setSelectedItem(item);
                                      setDetailsDialogOpen(true);
                                    }}
                                  >
                                    <Eye className="mr-2 h-4 w-4" />
                                    View Details
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => handleReplayItem(item.key)}
                                    disabled={replayFromDlq.isPending}
                                  >
                                    <RotateCcw className="mr-2 h-4 w-4" />
                                    Replay Delivery
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => handleDeleteItem(item.key)}
                                    disabled={deleteDlqItem.isPending}
                                    className="text-destructive"
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete Item
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}

              {dlqItems.length === 0 && !dlqLoading && (
                <div className="py-8 text-center">
                  <Skull className="text-muted-foreground/50 mx-auto h-12 w-12" />
                  <h3 className="mt-4 text-lg font-medium">
                    No DLQ items found
                  </h3>
                  <p className="text-muted-foreground mt-2">
                    Great! No webhook deliveries have failed after exhausting
                    retries.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* DLQ Item Details Dialog */}
          <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
            <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
              <DialogHeader>
                <DialogTitle>DLQ Item Details</DialogTitle>
                <DialogDescription>
                  Detailed information about the failed webhook delivery
                </DialogDescription>
              </DialogHeader>
              {selectedItem && (
                <div className="space-y-6">
                  {/* Basic Info */}
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className="text-sm font-medium">DLQ Key</label>
                      <code className="bg-muted mt-1 block rounded p-2 text-xs">
                        {selectedItem.key}
                      </code>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Endpoint ID</label>
                      <div className="mt-1 text-sm">
                        {selectedItem.endpointId}
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Delivery ID</label>
                      <div className="mt-1 text-sm">
                        {selectedItem.deliveryId}
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Failed At</label>
                      <div className="mt-1 text-sm">
                        {formatTimestamp(selectedItem.lastModified)}
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium">
                        Failure Reason
                      </label>
                      <div className="mt-1">
                        <Badge
                          variant={getReasonBadgeVariant(selectedItem.reason)}
                        >
                          {selectedItem.reason}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium">
                        Total Attempts
                      </label>
                      <div className="mt-1 text-sm">
                        {selectedItem.attemptCount}
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Error Details */}
                  <div>
                    <h3 className="mb-4 text-lg font-semibold">Final Error</h3>
                    <div className="bg-destructive/10 border-destructive/20 rounded-lg border p-4">
                      <pre className="text-sm whitespace-pre-wrap">
                        {selectedItem.finalError}
                      </pre>
                    </div>
                  </div>

                  {/* Original Payload */}
                  {selectedItem.payload && (
                    <>
                      <Separator />
                      <div>
                        <h3 className="mb-4 text-lg font-semibold">
                          Original Payload
                        </h3>
                        <PayloadInspector
                          payload={selectedItem.payload}
                          title="Failed Webhook Payload"
                          maxHeight="24rem"
                        />
                      </div>
                    </>
                  )}

                  {/* Actions */}
                  <Separator />
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => handleReplayItem(selectedItem.key)}
                      disabled={replayFromDlq.isPending}
                    >
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Replay Delivery
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => {
                        void handleDeleteItem(selectedItem.key);
                        setDetailsDialogOpen(false);
                      }}
                      disabled={deleteDlqItem.isPending}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Item
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </WebhookErrorBoundary>
    </AuthenticatedLayout>
  );
}
