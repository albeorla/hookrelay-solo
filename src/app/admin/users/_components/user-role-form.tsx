"use client";

import { useState, useEffect } from "react";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { api, type RouterOutputs } from "~/trpc/react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

type User = RouterOutputs["user"]["getAll"][number];

interface Role {
  id: string;
  name: string;
  description?: string | null;
}

interface UserRoleFormProps {
  user: User;
  roles: Role[];
  onSuccess: () => void;
}

export function UserRoleForm({ user, roles, onSuccess }: UserRoleFormProps) {
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  // Use a single mutation that sets the full set of roles
  const setUserRoles = api.user.setUserRoles.useMutation();

  useEffect(() => {
    setSelectedRoles(user.roles.map((ur) => ur.role.id));
  }, [user]);

  const handleSubmit = async () => {
    try {
      // Convert selected role IDs to role names expected by the API
      const roleNames = roles
        .filter((r) => selectedRoles.includes(r.id))
        .map((r) => r.name);

      await setUserRoles.mutateAsync({
        userId: user.id,
        roleNames,
      });
      toast.success("User roles updated successfully");
      onSuccess();
    } catch (error) {
      toast.error("Failed to update roles. Please try again.");
      console.error("Error updating roles:", error);
    }
  };

  const filteredRoles = roles.filter((role) =>
    role.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const isSubmitting = setUserRoles.isPending;

  return (
    <div className="space-y-6">
      <Input
        placeholder="Search roles..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />
      <div className="max-h-[300px] space-y-3 overflow-y-auto rounded-md border p-4">
        {filteredRoles.map((role) => (
          <div key={role.id} className="flex items-center space-x-3">
            <Checkbox
              id={role.id}
              checked={selectedRoles.includes(role.id)}
              onCheckedChange={() =>
                setSelectedRoles((prev) =>
                  prev.includes(role.id)
                    ? prev.filter((id) => id !== role.id)
                    : [...prev, role.id],
                )
              }
              disabled={isSubmitting}
            />
            <label
              htmlFor={role.id}
              className="flex-1 cursor-pointer text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              <p>{role.name}</p>
              {role.description && (
                <p className="text-muted-foreground text-xs">
                  {role.description}
                </p>
              )}
            </label>
          </div>
        ))}
        {filteredRoles.length === 0 && (
          <p className="text-muted-foreground text-center text-sm">
            No roles found.
          </p>
        )}
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
        <Button type="button" onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isSubmitting ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
