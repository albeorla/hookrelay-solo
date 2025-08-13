"use client";

import { useState, useEffect } from "react";
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
import { Checkbox } from "~/components/ui/checkbox";
import { api } from "~/trpc/react";
import { Loader2 } from "lucide-react";

const roleSchema = z.object({
  name: z.string().min(1, "Role name is required"),
  description: z.string().optional(),
});

type RoleFormData = z.infer<typeof roleSchema>;

interface Permission {
  id: string;
  name: string;
  description?: string | null;
}

interface Role {
  id: string;
  name: string;
  description?: string | null;
  permissions: Array<{
    permission: Permission;
  }>;
}

interface RoleFormProps {
  role?: Role | null;
  permissions: Permission[];
  onSuccess: () => void;
}

export function RoleForm({ role, permissions, onSuccess }: RoleFormProps) {
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

  const form = useForm<RoleFormData>({
    resolver: zodResolver(roleSchema),
    defaultValues: {
      name: role?.name ?? "",
      description: role?.description ?? "",
    },
  });

  const createRole = api.role.create.useMutation();
  const updateRole = api.role.update.useMutation();
  const assignPermission = api.role.assignPermission.useMutation();
  const removePermission = api.role.removePermission.useMutation();

  useEffect(() => {
    if (role) {
      form.reset({
        name: role.name,
        description: role.description ?? "",
      });
      setSelectedPermissions(role.permissions.map((rp) => rp.permission.id));
    } else {
      form.reset({ name: "", description: "" });
      setSelectedPermissions([]);
    }
  }, [role, form]);

  const onSubmit = async (data: RoleFormData) => {
    try {
      let roleId: string;
      if (role) {
        // Update existing role
        roleId = role.id;
        await updateRole.mutateAsync({ id: roleId, ...data });

        const currentPermissions =
          role.permissions.map((rp) => rp.permission.id) ?? [];
        const permissionsToAdd = selectedPermissions.filter(
          (p) => !currentPermissions.includes(p),
        );
        const permissionsToRemove = currentPermissions.filter(
          (p) => !selectedPermissions.includes(p),
        );

        await Promise.all([
          ...permissionsToAdd.map((permissionId) =>
            assignPermission.mutateAsync({ roleId, permissionId }),
          ),
          ...permissionsToRemove.map((permissionId) =>
            removePermission.mutateAsync({ roleId, permissionId }),
          ),
        ]);

        toast.success("Role updated successfully");
      } else {
        // Create new role
        const newRole = await createRole.mutateAsync(data);
        roleId = newRole.id;

        await Promise.all(
          selectedPermissions.map((permissionId) =>
            assignPermission.mutateAsync({ roleId, permissionId }),
          ),
        );

        toast.success("Role created successfully");
      }
      onSuccess();
    } catch (error) {
      toast.error("Failed to save role. Please try again.");
      console.error("Error saving role:", error);
    }
  };

  const handlePermissionToggle = (permissionId: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(permissionId)
        ? prev.filter((id) => id !== permissionId)
        : [...prev, permissionId],
    );
  };

  const isSubmitting =
    createRole.isPending ||
    updateRole.isPending ||
    assignPermission.isPending ||
    removePermission.isPending;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Role Name</FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g., Content Editor"
                  {...field}
                  disabled={isSubmitting || role?.name === "ADMIN"}
                />
              </FormControl>
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
                  placeholder="Describe what this role can do"
                  className="min-h-[100px]"
                  {...field}
                  disabled={isSubmitting}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div>
          <FormLabel>Permissions</FormLabel>
          <FormDescription className="mb-4">
            Assign permissions to this role.
          </FormDescription>
          <div className="max-h-[250px] space-y-3 overflow-y-auto rounded-md border p-4">
            {permissions.map((permission) => (
              <div key={permission.id} className="flex items-center space-x-3">
                <Checkbox
                  id={permission.id}
                  checked={selectedPermissions.includes(permission.id)}
                  onCheckedChange={() => handlePermissionToggle(permission.id)}
                  disabled={isSubmitting || role?.name === "ADMIN"}
                />
                <label
                  htmlFor={permission.id}
                  className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  {permission.name}
                </label>
              </div>
            ))}
          </div>
        </div>

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
            {isSubmitting ? "Saving..." : role ? "Update Role" : "Create Role"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
