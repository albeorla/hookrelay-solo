"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { api } from "~/trpc/react";
import { Loader2 } from "lucide-react";

const permissionSchema = z.object({
  name: z
    .string()
    .min(1, "Permission name is required")
    .regex(
      /^[a-z]+:[a-z_]+$/,
      'Invalid format. Use "resource:action" (e.g., "user:create").',
    ),
  description: z.string().optional(),
});

type PermissionFormData = z.infer<typeof permissionSchema>;

interface Permission {
  id: string;
  name: string;
  description?: string | null;
}

interface PermissionFormProps {
  permission?: Permission | null;
  onSuccess: () => void;
}

export function PermissionForm({ permission, onSuccess }: PermissionFormProps) {
  const form = useForm<PermissionFormData>({
    resolver: zodResolver(permissionSchema),
    defaultValues: {
      name: permission?.name ?? "",
      description: permission?.description ?? "",
    },
  });

  const createPermission = api.permission.create.useMutation({
    onSuccess: () => {
      toast.success("Permission created successfully");
      onSuccess();
    },
  });

  const updatePermission = api.permission.update.useMutation({
    onSuccess: () => {
      toast.success("Permission updated successfully");
      onSuccess();
    },
  });

  useEffect(() => {
    if (permission) {
      form.reset({
        name: permission.name,
        description: permission.description ?? "",
      });
    } else {
      form.reset({ name: "", description: "" });
    }
  }, [permission, form]);

  const onSubmit = async (data: PermissionFormData) => {
    try {
      if (permission) {
        await updatePermission.mutateAsync({
          id: permission.id,
          ...data,
        });
      } else {
        await createPermission.mutateAsync(data);
      }
    } catch {
      // Errors are handled by the mutation's onError callback
    }
  };

  const isSubmitting = createPermission.isPending || updatePermission.isPending;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Permission Name</FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g., user:create"
                  {...field}
                  disabled={isSubmitting}
                />
              </FormControl>
              <FormDescription>
                Use the format &quot;resource:action&quot; (e.g.,
                &quot;user:create&quot;, &quot;post:delete&quot;).
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Describe what this permission allows"
                  className="min-h-[100px]"
                  {...field}
                  disabled={isSubmitting}
                />
              </FormControl>
              <FormDescription>
                A brief, clear description of the permission.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-4 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onSuccess}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSubmitting
              ? "Saving..."
              : permission
                ? "Update Permission"
                : "Create Permission"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
