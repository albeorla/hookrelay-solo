"use client";

import React, { useState } from "react";
import {
  Archive,
  CheckCircle,
  MoreHorizontal,
  RotateCcw,
  Settings,
  Trash2,
  XCircle,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Badge } from "~/components/ui/badge";
import { api } from "~/trpc/react";
import { type BulkActionResult } from "~/types/webhook";

interface BulkActionsProps {
  selectedDeliveries: string[];
  onActionComplete: (results?: BulkActionResult) => void;
  className?: string;
}

type BulkActionType =
  | "retry"
  | "delete"
  | "archive"
  | "export"
  | "updateStatus";

type DeliveryStatus = "pending" | "success" | "failed" | "retrying";

// BulkActionResult now imported from types

export function BulkActions({
  selectedDeliveries,
  onActionComplete,
  className = "",
}: BulkActionsProps) {
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    action: BulkActionType;
    title: string;
    description: string;
    confirmText: string;
    variant?: "default" | "destructive";
  }>({
    open: false,
    action: "retry",
    title: "",
    description: "",
    confirmText: "",
  });

  const [statusUpdateDialog, setStatusUpdateDialog] = useState(false);
  const [newStatus, setNewStatus] = useState<DeliveryStatus>("pending");
  const [updateReason, setUpdateReason] = useState("");

  // API mutations
  const bulkRetryDeliveries = api.webhook.bulkRetryDeliveries.useMutation({
    onSuccess: (data) => {
      // Transform the response to match our BulkActionResult interface
      const transformedData: BulkActionResult = {
        total: data.summary?.total || selectedDeliveries.length,
        successful: data.summary?.succeeded || 0,
        failed: data.summary?.failed || 0,
        results: data.results,
      };
      handleActionResult(transformedData, "retry");
    },
    onError: (error) => {
      toast.error(`Failed to retry deliveries: ${error.message}`);
    },
  });

  const bulkDeleteDeliveries = api.webhook.bulkDeleteDeliveries.useMutation({
    onSuccess: (data) => {
      handleActionResult(data, "delete");
    },
    onError: (error) => {
      toast.error(`Failed to delete deliveries: ${error.message}`);
    },
  });

  const bulkArchiveDeliveries = api.webhook.bulkArchiveDeliveries.useMutation({
    onSuccess: (data) => {
      handleActionResult(data, "archive");
    },
    onError: (error) => {
      toast.error(`Failed to archive deliveries: ${error.message}`);
    },
  });

  const bulkUpdateStatus = api.webhook.bulkUpdateDeliveryStatus.useMutation({
    onSuccess: (data) => {
      handleActionResult(data, "updateStatus");
    },
    onError: (error) => {
      toast.error(`Failed to update delivery status: ${error.message}`);
    },
  });

  const parseDeliveryKeys = (keys: string[]) => {
    return keys.map((key) => {
      const [endpointId, deliveryId] = key.split("::");
      return { endpointId: endpointId!, deliveryId: deliveryId! };
    });
  };

  const handleActionResult = (
    result: BulkActionResult,
    action: BulkActionType,
  ) => {
    const actionNames = {
      retry: "retried",
      delete: "deleted",
      archive: "archived",
      export: "exported",
      updateStatus: "updated",
    };

    if (result.failed === 0) {
      toast.success(
        `Successfully ${actionNames[action]} ${result.successful} deliveries`,
      );
    } else if (result.successful === 0) {
      toast.error(`Failed to ${action} all ${result.total} deliveries`);
    } else {
      toast.warning(
        `Partially completed: ${result.successful} succeeded, ${result.failed} failed`,
      );
    }

    onActionComplete();
    setConfirmDialog((prev) => ({ ...prev, open: false }));
    setStatusUpdateDialog(false);
  };

  const showConfirmDialog = (
    action: BulkActionType,
    title: string,
    description: string,
    confirmText: string,
    variant: "default" | "destructive" = "default",
  ) => {
    setConfirmDialog({
      open: true,
      action,
      title,
      description,
      confirmText,
      variant,
    });
  };

  const handleConfirmAction = () => {
    const deliveries = parseDeliveryKeys(selectedDeliveries);

    switch (confirmDialog.action) {
      case "retry":
        bulkRetryDeliveries.mutate({ deliveries });
        break;
      case "delete":
        bulkDeleteDeliveries.mutate({ deliveries });
        break;
      case "archive":
        bulkArchiveDeliveries.mutate({ deliveries });
        break;
      default:
        break;
    }
  };

  const handleStatusUpdate = () => {
    const deliveries = parseDeliveryKeys(selectedDeliveries);
    bulkUpdateStatus.mutate({
      deliveries,
      status: newStatus,
      reason: updateReason || undefined,
    });
  };

  const isAnyOperationPending =
    bulkRetryDeliveries.isPending ||
    bulkDeleteDeliveries.isPending ||
    bulkArchiveDeliveries.isPending ||
    bulkUpdateStatus.isPending;

  if (selectedDeliveries.length === 0) {
    return null;
  }

  return (
    <>
      <div className={`flex items-center gap-2 ${className}`}>
        <Badge variant="outline" className="text-xs">
          {selectedDeliveries.length} selected
        </Badge>

        {/* Quick Actions */}
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            showConfirmDialog(
              "retry",
              "Retry Selected Deliveries",
              `Are you sure you want to retry ${selectedDeliveries.length} deliveries? This will re-queue failed deliveries for processing.`,
              "Retry Deliveries",
            )
          }
          disabled={isAnyOperationPending}
        >
          {bulkRetryDeliveries.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RotateCcw className="mr-2 h-4 w-4" />
          )}
          Retry
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            showConfirmDialog(
              "archive",
              "Archive Selected Deliveries",
              `Are you sure you want to archive ${selectedDeliveries.length} deliveries? Archived deliveries will be hidden from the main view but remain accessible.`,
              "Archive Deliveries",
            )
          }
          disabled={isAnyOperationPending}
        >
          {bulkArchiveDeliveries.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Archive className="mr-2 h-4 w-4" />
          )}
          Archive
        </Button>

        {/* More Actions Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              disabled={isAnyOperationPending}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>Bulk Actions</DropdownMenuLabel>
            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={() => setStatusUpdateDialog(true)}
              className="cursor-pointer"
            >
              <Settings className="mr-2 h-4 w-4" />
              Update Status
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={() =>
                showConfirmDialog(
                  "delete",
                  "Delete Selected Deliveries",
                  `Are you sure you want to permanently delete ${selectedDeliveries.length} deliveries? This action cannot be undone.`,
                  "Delete Deliveries",
                  "destructive",
                )
              }
              className="cursor-pointer text-red-600 focus:text-red-600"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Permanently
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Confirmation Dialog */}
      <Dialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog((prev) => ({ ...prev, open }))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {confirmDialog.variant === "destructive" && (
                <AlertTriangle className="h-5 w-5 text-red-500" />
              )}
              {confirmDialog.title}
            </DialogTitle>
            <DialogDescription>{confirmDialog.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setConfirmDialog((prev) => ({ ...prev, open: false }))
              }
              disabled={isAnyOperationPending}
            >
              Cancel
            </Button>
            <Button
              variant={confirmDialog.variant}
              onClick={handleConfirmAction}
              disabled={isAnyOperationPending}
            >
              {isAnyOperationPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {confirmDialog.confirmText}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Status Update Dialog */}
      <Dialog open={statusUpdateDialog} onOpenChange={setStatusUpdateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Delivery Status</DialogTitle>
            <DialogDescription>
              Change the status of {selectedDeliveries.length} selected
              deliveries.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-status">New Status</Label>
              <Select
                value={newStatus}
                onValueChange={(value) => setNewStatus(value as DeliveryStatus)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-blue-500" />
                      Pending
                    </div>
                  </SelectItem>
                  <SelectItem value="success">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      Success
                    </div>
                  </SelectItem>
                  <SelectItem value="failed">
                    <div className="flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-red-500" />
                      Failed
                    </div>
                  </SelectItem>
                  <SelectItem value="retrying">
                    <div className="flex items-center gap-2">
                      <RotateCcw className="h-4 w-4 text-yellow-500" />
                      Retrying
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="update-reason">Reason (Optional)</Label>
              <Textarea
                id="update-reason"
                placeholder="Enter reason for status change..."
                value={updateReason}
                onChange={(e) => setUpdateReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setStatusUpdateDialog(false);
                setUpdateReason("");
              }}
              disabled={bulkUpdateStatus.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleStatusUpdate}
              disabled={bulkUpdateStatus.isPending}
            >
              {bulkUpdateStatus.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Update Status
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
