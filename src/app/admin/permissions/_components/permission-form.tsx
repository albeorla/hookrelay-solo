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

const permissionSchema = z.object({
  name: z.string().min(1, "Permission name is required"),
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
    onError: (error) => {
      toast.error(`Failed to create permission: ${error.message}`);
    },
  });

  const updatePermission = api.permission.update.useMutation({
    onSuccess: () => {
      toast.success("Permission updated successfully");
      onSuccess();
    },
    onError: (error) => {
      toast.error(`Failed to update permission: ${error.message}`);
    },
  });

  // Initialize form with permission data if editing
  useEffect(() => {
    if (permission) {
      form.reset({
        name: permission.name,
        description: permission.description ?? "",
      });
    }
  }, [permission, form]);

  const onSubmit = async (data: PermissionFormData) => {
    try {
      if (permission) {
        // Update existing permission
        await updatePermission.mutateAsync({
          id: permission.id,
          name: data.name,
          description: data.description,
        });
      } else {
        // Create new permission
        await createPermission.mutateAsync({
          name: data.name,
          description: data.description,
        });
      }
    } catch (error) {
      console.error("Error saving permission:", error);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Permission Name</FormLabel>
              <FormControl>
                <Input
                  placeholder="Enter permission name (e.g., user:create)"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                A unique name for this permission using the format
                &quot;resource:action&quot;
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
                  className="min-h-[80px]"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Optional description of what this permission enables
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-3 border-t pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onSuccess}
            disabled={createPermission.isPending || updatePermission.isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={createPermission.isPending || updatePermission.isPending}
          >
            {createPermission.isPending || updatePermission.isPending
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
