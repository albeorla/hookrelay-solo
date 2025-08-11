"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { api } from "~/trpc/react";

const roleSchema = z.object({
  name: z.string().min(1, "Role name is required"),
  description: z.string().optional(),
  permissions: z.array(z.string()).optional(),
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
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<RoleFormData>({
    resolver: zodResolver(roleSchema),
    defaultValues: {
      name: role?.name ?? "",
      description: role?.description ?? "",
      permissions: [],
    },
  });

  const createRole = api.role.create.useMutation({
    onError: (error) => {
      toast.error(`Failed to create role: ${error.message}`);
    },
  });

  const updateRole = api.role.update.useMutation({
    onError: (error) => {
      toast.error(`Failed to update role: ${error.message}`);
    },
  });

  const assignPermission = api.role.assignPermission.useMutation({
    onError: (error) => {
      toast.error(`Failed to assign permission: ${error.message}`);
    },
  });

  const removePermission = api.role.removePermission.useMutation({
    onError: (error) => {
      toast.error(`Failed to remove permission: ${error.message}`);
    },
  });

  // Initialize form with role data if editing
  useEffect(() => {
    if (role) {
      form.reset({
        name: role.name,
        description: role.description ?? "",
      });
      setSelectedPermissions(role.permissions.map((rp) => rp.permission.id));
    }
  }, [role, form]);

  const onSubmit = async (data: RoleFormData) => {
    setIsSubmitting(true);
    try {
      if (role) {
        // Update existing role
        await updateRole.mutateAsync({
          id: role.id,
          name: data.name,
          description: data.description,
        });

        // Handle permission changes
        const currentPermissions = role.permissions.map(
          (rp) => rp.permission.id,
        );
        const permissionsToAdd = selectedPermissions.filter(
          (p) => !currentPermissions.includes(p),
        );
        const permissionsToRemove = currentPermissions.filter(
          (p) => !selectedPermissions.includes(p),
        );

        // Add new permissions
        for (const permissionId of permissionsToAdd) {
          await assignPermission.mutateAsync({
            roleId: role.id,
            permissionId,
          });
        }

        // Remove permissions
        for (const permissionId of permissionsToRemove) {
          await removePermission.mutateAsync({
            roleId: role.id,
            permissionId,
          });
        }

        toast.success("Role updated successfully");
        onSuccess();
      } else {
        // Create new role
        const newRole = await createRole.mutateAsync({
          name: data.name,
          description: data.description,
        });

        // Assign permissions to new role
        for (const permissionId of selectedPermissions) {
          await assignPermission.mutateAsync({
            roleId: newRole.id,
            permissionId,
          });
        }

        toast.success("Role created successfully");
        onSuccess();
      }
    } catch (error) {
      console.error("Error saving role:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePermissionToggle = (permissionId: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(permissionId)
        ? prev.filter((id) => id !== permissionId)
        : [...prev, permissionId],
    );
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="text-sm font-medium">Role Name</label>
        <input
          type="text"
          placeholder="Enter role name"
          className="w-full rounded border p-2"
          disabled={role?.name === "ADMIN"}
          {...form.register("name")}
        />
        {form.formState.errors.name && (
          <p className="mt-1 text-sm text-red-500">
            {form.formState.errors.name.message}
          </p>
        )}
      </div>

      <div>
        <label className="text-sm font-medium">Description</label>
        <textarea
          placeholder="Describe what this role can do"
          className="min-h-[80px] w-full rounded border p-2"
          {...form.register("description")}
        />
      </div>

      <div>
        <h4 className="mb-2 text-sm font-medium">Permissions</h4>
        <div className="max-h-[200px] space-y-2 overflow-y-auto rounded-md border p-3">
          {permissions.map((permission) => (
            <div key={permission.id} className="flex items-center space-x-3">
              <input
                type="checkbox"
                id={permission.id}
                checked={selectedPermissions.includes(permission.id)}
                onChange={() => handlePermissionToggle(permission.id)}
                disabled={role?.name === "ADMIN"}
              />
              <label htmlFor={permission.id} className="text-sm">
                {permission.name}
              </label>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-3 border-t pt-4">
        <Button type="button" variant="outline" onClick={onSuccess}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : role ? "Update Role" : "Create Role"}
        </Button>
      </div>
    </form>
  );
}
