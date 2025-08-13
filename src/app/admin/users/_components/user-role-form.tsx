"use client";

import { useState, useEffect } from "react";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Badge } from "~/components/ui/badge";

interface User {
  id: string;
  name?: string | null;
  email?: string | null;
  roles: Array<{
    role: {
      id: string;
      name: string;
    };
  }>;
}

interface Role {
  id: string;
  name: string;
  description?: string | null;
}

interface UserRoleFormProps {
  user?: User | null;
  roles: Role[];
  onSuccess: (roleIds: string[]) => void;
}

export function UserRoleForm({ user, roles, onSuccess }: UserRoleFormProps) {
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);

  // Initialize with user's current roles
  useEffect(() => {
    if (user) {
      setSelectedRoles(user.roles.map((ur) => ur.role.id));
    }
  }, [user]);

  const handleRoleToggle = (roleId: string) => {
    setSelectedRoles((prev) =>
      prev.includes(roleId)
        ? prev.filter((id) => id !== roleId)
        : [...prev, roleId],
    );
  };

  const handleSubmit = () => {
    onSuccess(selectedRoles);
  };

  const handleCancel = () => {
    // Reset to original roles
    if (user) {
      setSelectedRoles(user.roles.map((ur) => ur.role.id));
    }
    onSuccess([]); // This will close the dialog
  };

  return (
    <div className="space-y-4">
      <div>
        <h4 className="mb-3 text-sm font-medium">Available Roles</h4>
        <div className="max-h-[300px] space-y-3 overflow-y-auto rounded-md border p-3">
          {roles.map((role) => (
            <div key={role.id} className="flex items-center space-x-3">
              <Checkbox
                id={role.id}
                checked={selectedRoles.includes(role.id)}
                onCheckedChange={() => handleRoleToggle(role.id)}
              />
              <label
                htmlFor={role.id}
                className="flex-1 text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{role.name}</span>
                  {role.description && (
                    <Badge variant="secondary" className="text-xs">
                      {role.description}
                    </Badge>
                  )}
                </div>
              </label>
            </div>
          ))}
          {roles.length === 0 && (
            <p className="text-muted-foreground text-sm">
              No roles available. Create roles first.
            </p>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-3 border-t pt-4">
        <Button type="button" variant="outline" onClick={handleCancel}>
          Cancel
        </Button>
        <Button type="button" onClick={handleSubmit}>
          Save Changes
        </Button>
      </div>
    </div>
  );
}
