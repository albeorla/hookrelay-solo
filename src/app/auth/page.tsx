"use client";

import React from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "~/components/ui/accordion";
import { Github } from "lucide-react";

export default function AuthPage() {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") {
      router.push("/");
    }
  }, [status, router]);

  const handleSignIn = async () => {
    await signIn("discord", { callbackUrl: "/" });
  };

  const handleTestSignIn = async (role: "admin" | "user" | "albeorla") => {
    let email: string;
    if (role === "admin") {
      email = "admin@example.com";
    } else if (role === "albeorla") {
      email = "albertjorlando@gmail.com";
    } else {
      email = "test@example.com";
    }
    await signIn("test-credentials", {
      email,
      password: "test123",
      callbackUrl: "/",
    });
  };

  if (status === "loading") {
    return (
      <div className="bg-background flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="border-primary mx-auto h-12 w-12 animate-spin rounded-full border-b-2"></div>
          <p className="text-muted-foreground mt-4">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="from-background to-muted/40 flex min-h-screen items-center justify-center bg-gradient-to-br">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">Welcome Back</h1>
          <p className="text-muted-foreground">
            Sign in to access your dashboard
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={handleSignIn} className="w-full" size="lg">
            <Github className="mr-2 h-5 w-5" />
            Sign in with Discord
          </Button>

          {(process.env.NODE_ENV === "development" ||
            process.env.ENABLE_TEST_AUTH === "true") && (
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="item-1">
                <AccordionTrigger>Advanced: Test Logins</AccordionTrigger>
                <AccordionContent className="space-y-2">
                  <Button
                    onClick={() => handleTestSignIn("admin")}
                    variant="outline"
                    className="w-full"
                  >
                    Test Login (Admin)
                  </Button>
                  <Button
                    onClick={() => handleTestSignIn("user")}
                    variant="outline"
                    className="w-full"
                  >
                    Test Login (User)
                  </Button>
                  <Button
                    onClick={() => handleTestSignIn("albeorla")}
                    variant="outline"
                    className="w-full"
                  >
                    Test Login (albeorla - Admin)
                  </Button>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
