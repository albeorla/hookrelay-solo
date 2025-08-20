import { toast } from "sonner";

export const toastMessages = {
  webhook: {
    endpoint: {
      created: () => toast.success("Webhook endpoint created successfully"),
      updated: () => toast.success("Endpoint updated"),
      deleted: () => toast.success("Webhook endpoint deleted successfully"),
      createFailed: (error: string) =>
        toast.error(`Failed to create endpoint: ${error}`),
      updateFailed: (error: string) =>
        toast.error(`Failed to update: ${error}`),
      deleteFailed: (error: string) =>
        toast.error(`Failed to delete endpoint: ${error}`),
    },
    delivery: {
      retryInitiated: () =>
        toast.success("Delivery retry initiated successfully"),
      retryFailed: (error: string) =>
        toast.error(`Failed to retry delivery: ${error}`),
      replayInitiated: () =>
        toast.success("Delivery replay initiated successfully"),
      replayFailed: (error: string) =>
        toast.error(`Failed to replay delivery: ${error}`),
    },
    dlq: {
      deleted: () => toast.success("DLQ item deleted successfully"),
      deleteFailed: (error: string) =>
        toast.error(`Failed to delete DLQ item: ${error}`),
      bulkDeleteSuccess: (count: number) =>
        toast.success(`Successfully deleted ${count} items from DLQ`),
      bulkDeleteFailed: (error: string) =>
        toast.error(`Failed to bulk delete: ${error}`),
      noItemsSelected: () => toast.error("No items selected"),
    },
    test: {
      success: (status: number, statusText: string) =>
        toast.success(
          `Test webhook sent successfully! Response: ${status} ${statusText}`,
        ),
      failed: (status: number, statusText: string) =>
        toast.error(`Test failed: ${status} ${statusText}`),
      requestFailed: (error: string) =>
        toast.error(`Test request failed: ${error}`),
    },
  },
  role: {
    created: () => toast.success("Role created successfully"),
    updated: () => toast.success("Role updated successfully"),
    deleted: () => toast.success("Role deleted successfully"),
    saveFailed: () => toast.error("Failed to save role. Please try again."),
    deleteFailed: (error: string) =>
      toast.error(`Failed to delete role: ${error}`),
  },
  general: {
    copied: (item: string) => toast.success(`Copied ${item}`),
    copyFailed: (item: string) => toast.error(`Failed to copy ${item}`),
  },
} as const;
