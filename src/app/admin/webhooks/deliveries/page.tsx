"use client";

import React, { useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle,
  Clock,
  Download,
  Eye,
  Filter,
  MoreHorizontal,
  RefreshCw,
  RotateCcw,
  Search,
  X,
  XCircle,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
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
import { Separator } from "~/components/ui/separator";
import { AuthenticatedLayout } from "~/components/layout/authenticated-layout";
import { api } from "~/trpc/react";
import { WebhookErrorBoundary } from "~/components/error-boundary";
import { PayloadInspector } from "../_components/payload-inspector";
import { ExportDialog } from "../_components/export-dialog";
import { AdvancedFilters } from "../_components/advanced-filters";
import { RealtimeStatus } from "../_components/realtime-status";
import { BulkActions } from "../_components/bulk-actions";
import { Pagination, usePagination } from "../_components/pagination";
import { useDeliveryUpdates } from "~/contexts/websocket-context";
import { DeliveryTableSkeleton } from "../_components/loading-skeletons";
import {
  usePerformanceMonitor,
  useOptimizedSearch,
  QueryOptimizations,
} from "~/hooks/use-optimized-query";

type DeliveryStatus = "pending" | "success" | "failed" | "retrying";

interface DeliveryFilter {
  status?: DeliveryStatus;
  endpointId?: string;
  search?: string;
  limit: number;
  startKey?: {
    endpoint_id: string;
    delivery_id: string;
  };
}

// Advanced filter interface matching the AdvancedFilters component
interface AdvancedFiltersType {
  dateRange: { start: string; end: string; enabled: boolean };
  timeRange: { startTime: string; endTime: string; enabled: boolean };
  httpStatusCodes: {
    ranges: string[];
    specific: number[];
    exclude: number[];
    enabled: boolean;
  };
  deliveryStatus: { include: string[]; exclude: string[] };
  duration: { min: number; max: number; enabled: boolean };
  attemptCount: { min: number; max: number; enabled: boolean };
  payloadSize: { min: number; max: number; enabled: boolean };
  contentType: { include: string[]; exclude: string[]; enabled: boolean };
  hasErrors: boolean | null;
  errorPatterns: {
    patterns: string[];
    caseSensitive: boolean;
    enabled: boolean;
  };
  customFields: {
    field: string;
    operator: "equals" | "contains" | "startsWith" | "endsWith" | "regex";
    value: string;
    enabled: boolean;
  }[];
}

export default function DeliveryLogsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Pagination state
  const pagination = usePagination(20);

  // State management
  const [filter, setFilter] = useState<DeliveryFilter>({
    limit: pagination.pageSize,
  });
  const [selectedDeliveries, setSelectedDeliveries] = useState<string[]>([]);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  // Performance monitoring
  usePerformanceMonitor("DeliveryLogsPage");

  // Optimized search with debouncing
  const {
    searchInput,
    setSearchInput,
    debouncedSearch,
    isSearching,
    hasSearch,
    clearSearch,
  } = useOptimizedSearch("", 300);

  // Advanced filters state
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFiltersType>({
    dateRange: { start: "", end: "", enabled: false },
    timeRange: { startTime: "", endTime: "", enabled: false },
    httpStatusCodes: { ranges: [], specific: [], exclude: [], enabled: false },
    deliveryStatus: { include: [], exclude: [] },
    duration: { min: 0, max: 30000, enabled: false },
    attemptCount: { min: 1, max: 10, enabled: false },
    payloadSize: { min: 0, max: 1048576, enabled: false },
    contentType: { include: [], exclude: [], enabled: false },
    hasErrors: null,
    errorPatterns: { patterns: [], caseSensitive: false, enabled: false },
    customFields: [],
  });

  // Get endpoints for filtering
  const { data: endpoints } = api.webhook.getEndpoints.useQuery(undefined, {
    enabled: session?.user.roles?.includes("ADMIN") ?? false,
  });

  // Get delivery logs with current filter and pagination
  const {
    data: deliveryLogsData,
    refetch: refetchDeliveries,
    isLoading: deliveriesLoading,
    isFetching: deliveriesFetching,
  } = api.webhook.getDeliveryLogs.useQuery(
    {
      limit: pagination.pageSize,
      startKey: pagination.getCurrentPageKey() ?? undefined,
      status: filter.status,
      endpointId: filter.endpointId,
      search: debouncedSearch || undefined, // Use debounced search
      advancedFilters: advancedFilters,
    },
    {
      enabled: session?.user.roles?.includes("ADMIN") ?? false,
      ...QueryOptimizations.dashboard,
      // Override refetch interval for search
      refetchInterval: hasSearch
        ? false
        : QueryOptimizations.dashboard.refetchInterval,
    },
  );

  // Update pagination data when query succeeds
  React.useEffect(() => {
    if (deliveryLogsData) {
      pagination.updatePaginationData({
        items: deliveryLogsData.deliveries,
        lastEvaluatedKey: deliveryLogsData.lastEvaluatedKey,
        hasMore: !!deliveryLogsData.lastEvaluatedKey,
      });
    }
  }, [deliveryLogsData, pagination]);

  // Retry mutation
  const retryDelivery = api.webhook.retryDelivery.useMutation({
    onSuccess: () => {
      toast.success("Delivery retry initiated successfully");
      void refetchDeliveries();
    },
    onError: (error: any) => {
      toast.error(`Failed to retry delivery: ${error.message}`);
    },
  });

  // Reset pagination when debounced search changes
  React.useEffect(() => {
    setFilter((prev) => ({ ...prev, search: debouncedSearch || undefined }));
    pagination.reset();
  }, [debouncedSearch, pagination]);

  // Reset pagination when filters change
  React.useEffect(() => {
    pagination.reset();
  }, [filter.status, filter.endpointId, advancedFilters, pagination]);

  // Handle page size changes
  const handlePageSizeChange = (newPageSize: number) => {
    pagination.handlePageSizeChange(newPageSize);
    setFilter((prev) => ({ ...prev, limit: newPageSize }));
  };

  React.useEffect(() => {
    if (session && !session.user.roles?.includes("ADMIN")) {
      router.push("/");
    }
  }, [session, router]);
  const isAdmin = session?.user.roles?.includes("ADMIN") ?? false;

  // Get deliveries from data
  const allDeliveries = useMemo(() => {
    return deliveryLogsData?.deliveries ?? [];
  }, [deliveryLogsData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refetchDeliveries();
    } finally {
      setRefreshing(false);
    }
  };

  const handleRetryDelivery = async (
    endpointId: string,
    deliveryId: string,
  ) => {
    await retryDelivery.mutateAsync({ endpointId, deliveryId });
  };

  const handleSelectDelivery = (
    deliveryId: string,
    endpointId: string,
    checked: boolean,
  ) => {
    const key = `${endpointId}::${deliveryId}`;
    if (checked) {
      setSelectedDeliveries((prev) => [...prev, key]);
    } else {
      setSelectedDeliveries((prev) => prev.filter((id) => id !== key));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allKeys = allDeliveries.map(
        (d: any) => `${d.endpointId}::${d.deliveryId}`,
      );
      setSelectedDeliveries(allKeys);
    } else {
      setSelectedDeliveries([]);
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
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "success":
        return <Badge className="bg-green-100 text-green-800">Success</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      case "pending":
        return <Badge variant="outline">Pending</Badge>;
      case "retrying":
        return <Badge variant="secondary">Retrying</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const clearFilters = () => {
    setFilter({ limit: pagination.pageSize });
    setSearchInput("");
    setAdvancedFilters({
      dateRange: { start: "", end: "", enabled: false },
      timeRange: { startTime: "", endTime: "", enabled: false },
      httpStatusCodes: {
        ranges: [],
        specific: [],
        exclude: [],
        enabled: false,
      },
      deliveryStatus: { include: [], exclude: [] },
      duration: { min: 0, max: 30000, enabled: false },
      attemptCount: { min: 1, max: 10, enabled: false },
      payloadSize: { min: 0, max: 1048576, enabled: false },
      contentType: { include: [], exclude: [], enabled: false },
      hasErrors: null,
      errorPatterns: { patterns: [], caseSensitive: false, enabled: false },
      customFields: [],
    });
    pagination.reset();
  };

  // Check if advanced filters are active
  const hasAdvancedFilters = React.useMemo(() => {
    return (
      advancedFilters.dateRange.enabled ||
      advancedFilters.timeRange.enabled ||
      advancedFilters.httpStatusCodes.enabled ||
      advancedFilters.duration.enabled ||
      advancedFilters.attemptCount.enabled ||
      advancedFilters.payloadSize.enabled ||
      advancedFilters.contentType.enabled ||
      advancedFilters.hasErrors !== null ||
      advancedFilters.errorPatterns.enabled ||
      advancedFilters.deliveryStatus.include.length > 0 ||
      advancedFilters.deliveryStatus.exclude.length > 0 ||
      advancedFilters.customFields.some((f) => f.enabled)
    );
  }, [advancedFilters]);

  const hasFilters =
    filter.status ||
    filter.endpointId ||
    filter.search ||
    searchInput ||
    hasAdvancedFilters;

  // Real-time updates - placed after all dependencies are defined
  const { isConnected } = useDeliveryUpdates(
    React.useCallback(
      (_message) => {
        // Auto-refresh delivery logs when we get updates
        // Only refresh if no specific filters are applied to avoid disrupting user workflow
        if (
          !hasAdvancedFilters &&
          !filter.search &&
          !filter.status &&
          !filter.endpointId
        ) {
          void refetchDeliveries();
        }
      },
      [
        hasAdvancedFilters,
        filter.search,
        filter.status,
        filter.endpointId,
        refetchDeliveries,
      ],
    ),
  );

  if (status === "loading") {
    return (
      <AuthenticatedLayout>
        <div className="container mx-auto py-8">
          <Card>
            <CardHeader>
              <CardTitle>Delivery Logs</CardTitle>
            </CardHeader>
            <CardContent>
              <DeliveryTableSkeleton rows={20} />
            </CardContent>
          </Card>
        </div>
      </AuthenticatedLayout>
    );
  }

  return (
    <AuthenticatedLayout>
      <WebhookErrorBoundary>
        {!isAdmin ? null : (
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
                      Delivery Logs
                    </h1>
                    <RealtimeStatus />
                  </div>
                  <p className="text-muted-foreground">
                    View and manage all webhook delivery attempts
                    {isConnected && (
                      <span className="ml-2 text-green-600">
                        • Live updates enabled
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <ExportDialog
                  trigger={
                    <Button variant="outline">
                      <Download className="mr-2 h-4 w-4" />
                      Export
                    </Button>
                  }
                  defaultFilters={filter}
                  selectedItems={selectedDeliveries}
                />
                <Button
                  variant="outline"
                  onClick={handleRefresh}
                  disabled={
                    refreshing || deliveriesLoading || deliveriesFetching
                  }
                >
                  <RefreshCw
                    className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
                  />
                  Refresh
                </Button>
              </div>
            </div>

            {/* Basic Filters */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Filter className="mr-2 h-5 w-5" />
                    Basic Filters
                  </div>
                  {hasFilters && (
                    <Button variant="ghost" size="sm" onClick={clearFilters}>
                      <X className="mr-2 h-4 w-4" />
                      Clear All
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium">
                      Status
                    </label>
                    <Select
                      value={filter.status ?? ""}
                      onValueChange={(value) =>
                        setFilter((prev) => ({
                          ...prev,
                          status:
                            value === ""
                              ? undefined
                              : (value as DeliveryStatus),
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All statuses</SelectItem>
                        <SelectItem value="success">Success</SelectItem>
                        <SelectItem value="failed">Failed</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="retrying">Retrying</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium">
                      Endpoint
                    </label>
                    <Select
                      value={filter.endpointId ?? ""}
                      onValueChange={(value) =>
                        setFilter((prev) => ({
                          ...prev,
                          endpointId: value === "" ? undefined : value,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All endpoints" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All endpoints</SelectItem>
                        {endpoints?.map((endpoint) => (
                          <SelectItem key={endpoint.id} value={endpoint.id}>
                            {endpoint.name || endpoint.id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium">
                      Search
                    </label>
                    <div className="relative">
                      <Search className="text-muted-foreground absolute top-2.5 left-2 h-4 w-4" />
                      <Input
                        placeholder="Search delivery IDs or endpoint IDs..."
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        className="pl-8"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium">
                      Limit
                    </label>
                    <Select
                      value={String(filter.limit)}
                      onValueChange={(value) =>
                        setFilter((prev) => ({
                          ...prev,
                          limit: parseInt(value),
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="20">20 per page</SelectItem>
                        <SelectItem value="50">50 per page</SelectItem>
                        <SelectItem value="100">100 per page</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Advanced Filters */}
            <AdvancedFilters
              filters={advancedFilters}
              onFiltersChange={setAdvancedFilters}
              availableEndpoints={endpoints ?? []}
              className="mb-6"
            />

            {/* Bulk Actions */}
            {selectedDeliveries.length > 0 && (
              <Card className="mb-6">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <BulkActions
                      selectedDeliveries={selectedDeliveries}
                      onActionComplete={() => {
                        // Clear selection and refresh data after bulk actions
                        setSelectedDeliveries([]);
                        // Reset to first page and refresh
                        pagination.reset();
                        void refetchDeliveries();
                      }}
                    />
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedDeliveries([])}
                      >
                        <X className="mr-2 h-4 w-4" />
                        Clear Selection
                      </Button>
                      <ExportDialog
                        trigger={
                          <Button variant="outline" size="sm">
                            <Download className="mr-2 h-4 w-4" />
                            Export Selected
                          </Button>
                        }
                        defaultFilters={filter}
                        selectedItems={selectedDeliveries}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Delivery Logs Table */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  Delivery Logs ({allDeliveries.length} results)
                  {(deliveriesFetching || isSearching) && (
                    <RefreshCw className="ml-2 h-4 w-4 animate-spin" />
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {deliveriesLoading ? (
                  <DeliveryTableSkeleton rows={pagination.pageSize} />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <Checkbox
                            checked={
                              selectedDeliveries.length ===
                                allDeliveries.length && allDeliveries.length > 0
                            }
                            onCheckedChange={handleSelectAll}
                          />
                        </TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Endpoint</TableHead>
                        <TableHead>Delivery ID</TableHead>
                        <TableHead>Timestamp</TableHead>
                        <TableHead>HTTP Status</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Attempts</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allDeliveries.map((delivery: any) => {
                        const isSelected = selectedDeliveries.includes(
                          `${delivery.endpointId}::${delivery.deliveryId}`,
                        );
                        return (
                          <TableRow
                            key={`${delivery.endpointId}-${delivery.deliveryId}`}
                          >
                            <TableCell>
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={(checked) =>
                                  handleSelectDelivery(
                                    delivery.deliveryId,
                                    delivery.endpointId,
                                    checked as boolean,
                                  )
                                }
                              />
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {getStatusIcon(delivery.status)}
                                {getStatusBadge(delivery.status)}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>
                                <div className="max-w-32 truncate font-medium">
                                  {delivery.endpointId}
                                </div>
                                <div className="text-muted-foreground max-w-32 truncate text-sm">
                                  {delivery.destUrl}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <code className="bg-muted rounded px-1 py-0.5 text-xs">
                                {delivery.deliveryId}
                              </code>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                {formatTimestamp(delivery.timestamp)}
                              </div>
                            </TableCell>
                            <TableCell>
                              {delivery.responseStatus ? (
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
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {delivery.durationMs ? (
                                <span className="text-sm">
                                  {delivery.durationMs}ms
                                </span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {delivery.attempt}
                              </Badge>
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
                                      setSelectedDelivery(delivery);
                                      setDetailsDialogOpen(true);
                                    }}
                                  >
                                    <Eye className="mr-2 h-4 w-4" />
                                    View Details
                                  </DropdownMenuItem>
                                  {delivery.status === "failed" && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        onClick={() =>
                                          handleRetryDelivery(
                                            delivery.endpointId,
                                            delivery.deliveryId,
                                          )
                                        }
                                        disabled={retryDelivery.isPending}
                                      >
                                        <RotateCcw className="mr-2 h-4 w-4" />
                                        Retry Delivery
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}

                {allDeliveries.length === 0 && !deliveriesLoading && (
                  <div className="py-8 text-center">
                    <Clock className="text-muted-foreground/50 mx-auto h-12 w-12" />
                    <h3 className="mt-4 text-lg font-medium">
                      No deliveries found
                    </h3>
                    <p className="text-muted-foreground mt-2">
                      {hasFilters
                        ? "Try adjusting your filters"
                        : "Deliveries will appear here when webhooks are processed"}
                    </p>
                    {hasSearch && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={clearSearch}
                      >
                        <X className="mr-2 h-4 w-4" />
                        Clear Search
                      </Button>
                    )}
                  </div>
                )}

                {/* Pagination */}
                {allDeliveries.length > 0 && (
                  <div className="mt-6">
                    <Pagination
                      currentPage={pagination.currentPage}
                      totalPages={pagination.totalPages}
                      pageSize={pagination.pageSize}
                      totalItems={pagination.totalItems}
                      hasNextPage={pagination.hasNextPage}
                      hasPreviousPage={pagination.hasPreviousPage}
                      onPageChange={pagination.handlePageChange}
                      onPageSizeChange={handlePageSizeChange}
                      isLoading={deliveriesLoading}
                      className="border-t pt-6"
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Delivery Details Dialog */}
            <Dialog
              open={detailsDialogOpen}
              onOpenChange={setDetailsDialogOpen}
            >
              <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Delivery Details</DialogTitle>
                  <DialogDescription>
                    Detailed information about the webhook delivery
                  </DialogDescription>
                </DialogHeader>
                {selectedDelivery && (
                  <div className="space-y-6">
                    {/* Basic Info */}
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <label className="text-sm font-medium">
                          Delivery ID
                        </label>
                        <code className="bg-muted mt-1 block rounded p-2 text-xs">
                          {selectedDelivery.deliveryId}
                        </code>
                      </div>
                      <div>
                        <label className="text-sm font-medium">Status</label>
                        <div className="mt-1">
                          {getStatusBadge(selectedDelivery.status)}
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium">
                          Endpoint ID
                        </label>
                        <div className="mt-1 text-sm">
                          {selectedDelivery.endpointId}
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium">
                          Destination URL
                        </label>
                        <div className="mt-1 text-sm break-all">
                          {selectedDelivery.destUrl}
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium">Timestamp</label>
                        <div className="mt-1 text-sm">
                          {formatTimestamp(selectedDelivery.timestamp)}
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium">Attempt #</label>
                        <div className="mt-1 text-sm">
                          {selectedDelivery.attempt}
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* Request Details */}
                    <div>
                      <h3 className="mb-4 text-lg font-semibold">
                        Request Details
                      </h3>
                      <div className="space-y-4">
                        {/* Request Headers */}
                        <div>
                          <label className="mb-2 block text-sm font-medium">
                            Request Headers
                          </label>
                          <pre className="bg-muted overflow-x-auto rounded border p-3 text-xs">
                            {selectedDelivery.requestHeaders
                              ? JSON.stringify(
                                  JSON.parse(selectedDelivery.requestHeaders),
                                  null,
                                  2,
                                )
                              : "No headers recorded"}
                          </pre>
                        </div>

                        {/* Request Body */}
                        <div>
                          <label className="mb-2 block text-sm font-medium">
                            Request Body
                          </label>
                          {selectedDelivery.requestBody ? (
                            <PayloadInspector
                              payload={selectedDelivery.requestBody}
                              headers={
                                selectedDelivery.requestHeaders
                                  ? JSON.parse(selectedDelivery.requestHeaders)
                                  : {}
                              }
                              title="Request Payload"
                              maxHeight="20rem"
                            />
                          ) : (
                            <div className="bg-muted text-muted-foreground rounded border p-3 text-xs">
                              No body recorded
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* Response Info */}
                    <div>
                      <h3 className="mb-4 text-lg font-semibold">
                        Response Information
                      </h3>
                      <div className="space-y-4">
                        {/* Response Summary */}
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                          <div>
                            <label className="text-sm font-medium">
                              HTTP Status
                            </label>
                            <div className="mt-1">
                              {selectedDelivery.responseStatus ? (
                                <Badge
                                  variant={
                                    selectedDelivery.responseStatus >= 200 &&
                                    selectedDelivery.responseStatus < 300
                                      ? "default"
                                      : "destructive"
                                  }
                                >
                                  {selectedDelivery.responseStatus}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground text-sm">
                                  No response
                                </span>
                              )}
                            </div>
                          </div>
                          <div>
                            <label className="text-sm font-medium">
                              Duration
                            </label>
                            <div className="mt-1 text-sm">
                              {selectedDelivery.durationMs
                                ? `${selectedDelivery.durationMs}ms`
                                : "N/A"}
                            </div>
                          </div>
                          <div>
                            <label className="text-sm font-medium">
                              Content Length
                            </label>
                            <div className="mt-1 text-sm">
                              {selectedDelivery.responseBody
                                ? `${selectedDelivery.responseBody.length} bytes`
                                : "N/A"}
                            </div>
                          </div>
                          <div>
                            <label className="text-sm font-medium">
                              Success
                            </label>
                            <div className="mt-1">
                              <Badge
                                variant={
                                  selectedDelivery.status === "success"
                                    ? "default"
                                    : "destructive"
                                }
                              >
                                {selectedDelivery.status === "success"
                                  ? "Yes"
                                  : "No"}
                              </Badge>
                            </div>
                          </div>
                        </div>

                        {/* Response Headers */}
                        {selectedDelivery.responseHeaders && (
                          <div>
                            <label className="mb-2 block text-sm font-medium">
                              Response Headers
                            </label>
                            <pre className="bg-muted overflow-x-auto rounded border p-3 text-xs">
                              {JSON.stringify(
                                JSON.parse(selectedDelivery.responseHeaders),
                                null,
                                2,
                              )}
                            </pre>
                          </div>
                        )}

                        {/* Response Body */}
                        <div>
                          <label className="mb-2 block text-sm font-medium">
                            Response Body
                          </label>
                          {selectedDelivery.responseBody ? (
                            <PayloadInspector
                              payload={selectedDelivery.responseBody}
                              headers={
                                selectedDelivery.responseHeaders
                                  ? JSON.parse(selectedDelivery.responseHeaders)
                                  : {}
                              }
                              title="Response Payload"
                              maxHeight="20rem"
                            />
                          ) : (
                            <div className="bg-muted text-muted-foreground rounded border p-3 text-xs">
                              No response body
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Error Info */}
                    {selectedDelivery.error && (
                      <>
                        <Separator />
                        <div>
                          <h3 className="mb-4 text-lg font-semibold">
                            Error Information
                          </h3>
                          <div className="bg-destructive/10 border-destructive/20 rounded-lg border p-4">
                            <div className="space-y-2">
                              <div className="text-destructive font-semibold">
                                Error Details:
                              </div>
                              <pre className="text-sm whitespace-pre-wrap">
                                {selectedDelivery.error}
                              </pre>
                            </div>
                          </div>
                        </div>
                      </>
                    )}

                    {/* Retry History */}
                    {selectedDelivery.attempt > 1 && (
                      <>
                        <Separator />
                        <div>
                          <h3 className="mb-4 text-lg font-semibold">
                            Retry History
                          </h3>
                          <div className="bg-muted/50 rounded-lg p-4">
                            <div className="text-muted-foreground text-sm">
                              This delivery has been attempted{" "}
                              {selectedDelivery.attempt} time(s).
                            </div>
                            <div className="mt-2">
                              <Badge variant="outline">
                                Attempt #{selectedDelivery.attempt}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </>
                    )}

                    {/* Actions */}
                    {selectedDelivery.status === "failed" && (
                      <>
                        <Separator />
                        <div className="flex justify-end">
                          <Button
                            onClick={() =>
                              handleRetryDelivery(
                                selectedDelivery.endpointId,
                                selectedDelivery.deliveryId,
                              )
                            }
                            disabled={retryDelivery.isPending}
                          >
                            <RotateCcw className="mr-2 h-4 w-4" />
                            Retry Delivery
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </div>
        )}
      </WebhookErrorBoundary>
    </AuthenticatedLayout>
  );
}
