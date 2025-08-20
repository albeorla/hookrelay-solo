// Hook for standardizing form patterns - kept simple to avoid complex generics
import { toast } from "sonner";

export const formHelpers = {
  handleFormError: (error: unknown, defaultMessage = "Operation failed") => {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    toast.error(`${defaultMessage}: ${errorMessage}`);
    console.error("Form error:", error);
  },

  handleFormSuccess: (message?: string) => {
    if (message) {
      toast.success(message);
    }
  },
} as const;
