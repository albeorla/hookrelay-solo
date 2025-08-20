"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { LoadingButton } from "~/components/ui/loading-button";
import { api } from "~/trpc/react";
import { toastMessages } from "~/lib/toast-messages";
import { roleSchema, type RoleFormData } from "~/lib/validation-schemas";

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

  const handleRoleSubmit = async (data: RoleFormData) => {
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

        toastMessages.role.updated();
      } else {
        // Create new role
        const newRole = await createRole.mutateAsync(data);
        roleId = newRole.id;

        await Promise.all(
          selectedPermissions.map((permissionId) =>
            assignPermission.mutateAsync({ roleId, permissionId }),
          ),
        );

        toastMessages.role.created();
      }
      form.reset();
      onSuccess();
    } catch (error) {
      toastMessages.role.saveFailed();
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

  const allMutationsLoading =
    createRole.isPending ||
    updateRole.isPending ||
    assignPermission.isPending ||
    removePermission.isPending;

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleRoleSubmit)}
        className="space-y-6"
      >
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
                  disabled={allMutationsLoading || role?.name === "ADMIN"}
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
                  disabled={allMutationsLoading}
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
                  disabled={allMutationsLoading || role?.name === "ADMIN"}
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
            disabled={allMutationsLoading}
          >
            Cancel
          </Button>
          <LoadingButton
            type="submit"
            loading={allMutationsLoading}
            loadingText="Saving..."
          >
            {role ? "Update Role" : "Create Role"}
          </LoadingButton>
        </div>
      </form>
    </Form>
  );
}
