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
      // Update user profile via API
      const response = await fetch("/api/user/update-profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formData.name,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update profile");
      }

      // Update the session
      await update({
        ...session,
        user: {
          ...session?.user,
          name: formData.name,
        },
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
      <div className="bg-background min-h-screen">
        {/* Header */}
        <header className="bg-card border-b">
          <div className="container mx-auto px-4 py-6">
            <h1 className="text-3xl font-bold">Profile Settings</h1>
            <p className="text-muted-foreground mt-1">
              Manage your account information and preferences
            </p>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8">
          <div className="mx-auto max-w-2xl space-y-6">
            {/* Profile Picture Section */}
            <Card>
              <CardHeader>
                <CardTitle>Profile Picture</CardTitle>
                <CardDescription>
                  Your profile picture is currently managed through your OAuth
                  provider
                </CardDescription>
              </CardHeader>
              <CardContent>
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
                    <p className="text-muted-foreground text-sm">
                      To change your profile picture, update it in your Discord
                      account settings. Changes will be reflected here on your
                      next login.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Personal Information */}
            <Card>
              <CardHeader>
                <CardTitle>Personal Information</CardTitle>
                <CardDescription>
                  Update your personal details below
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid gap-4">
                    <div>
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

                    <div>
                      <Label htmlFor="email">Email Address</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        disabled
                        className="bg-muted"
                      />
                      <p className="text-muted-foreground mt-1 text-xs">
                        Email cannot be changed as it&apos;s linked to your
                        OAuth account
                      </p>
                    </div>
                  </div>

                  <Separator className="my-6" />

                  <div className="flex gap-4">
                    <Button type="submit" disabled={isLoading}>
                      {isLoading ? "Saving..." : "Save Changes"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => router.back()}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            {/* Account Information */}
            <Card>
              <CardHeader>
                <CardTitle>Account Information</CardTitle>
                <CardDescription>
                  View your account details and status
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground text-sm font-medium">
                      User ID
                    </span>
                    <span className="font-mono text-sm">
                      {session?.user?.id}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-muted-foreground text-sm font-medium">
                      Account Type
                    </span>
                    <span className="text-sm">
                      {session?.user?.roles?.includes("ADMIN")
                        ? "Administrator"
                        : "Standard User"}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-muted-foreground text-sm font-medium">
                      Roles
                    </span>
                    <span className="text-sm">
                      {session?.user?.roles?.join(", ") ?? "No roles assigned"}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-muted-foreground text-sm font-medium">
                      Member Since
                    </span>
                    <span className="text-sm">Recently</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </AuthenticatedLayout>
  );
}
