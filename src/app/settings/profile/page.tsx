"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { AuthenticatedLayout } from "~/components/layout/authenticated-layout";
import { Separator } from "~/components/ui/separator";

export default function ProfilePage() {
  const { data: session, update } = useSession();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: session?.user?.name ?? "",
    email: session?.user?.email ?? "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch("/api/user/update-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: formData.name }),
      });

      if (!response.ok) {
        throw new Error("Failed to update profile");
      }

      await update({
        ...session,
        user: { ...session?.user, name: formData.name },
      });

      toast.success("Profile updated successfully");
    } catch (error) {
      toast.error("Failed to update profile");
      console.error("Profile update error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getUserInitials = (name?: string | null, email?: string | null) => {
    const displayName = name ?? email ?? "U";
    return displayName
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <AuthenticatedLayout>
      <div className="container mx-auto max-w-4xl py-12">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">
            Profile Settings
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage your account information and preferences.
          </p>
        </header>

        <div className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
              <CardDescription>
                Update your personal details below.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-6">
                <div className="flex items-center gap-6">
                  <Avatar className="h-20 w-20">
                    <AvatarImage
                      src={session?.user?.image ?? ""}
                      alt={session?.user?.name ?? ""}
                    />
                    <AvatarFallback className="text-lg">
                      {getUserInitials(
                        session?.user?.name,
                        session?.user?.email,
                      )}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <Label>Profile Picture</Label>
                    <p className="text-muted-foreground text-sm">
                      Managed via your OAuth provider (e.g., Discord). Update it
                      there to see changes.
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="Enter your full name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    disabled
                    className="bg-muted cursor-not-allowed"
                  />
                  <p className="text-muted-foreground text-xs">
                    Email is linked to your OAuth account and cannot be changed.
                  </p>
                </div>
              </CardContent>
              <CardFooter className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? "Saving..." : "Save Changes"}
                </Button>
              </CardFooter>
            </form>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Account Information</CardTitle>
              <CardDescription>
                View your account details and status.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm font-medium">
                  User ID
                </span>
                <span className="font-mono text-sm">{session?.user?.id}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm font-medium">
                  Account Type
                </span>
                <span className="text-sm">
                  {session?.user?.roles?.includes("ADMIN")
                    ? "Administrator"
                    : "Standard User"}
                </span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm font-medium">
                  Roles
                </span>
                <span className="text-sm">
                  {session?.user?.roles?.join(", ") ?? "No roles assigned"}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AuthenticatedLayout>
  );
}
