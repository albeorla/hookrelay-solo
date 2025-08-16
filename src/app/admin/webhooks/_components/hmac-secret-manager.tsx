"use client";

import React, { useState } from "react";
import { Eye, EyeOff, RefreshCw, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { api } from "~/trpc/react";

interface HmacSecretManagerProps {
  endpointId: string;
  currentHmacMode?: string;
  hasSecret?: boolean;
  onSecretGenerated?: () => void;
}

export function HmacSecretManager({
  endpointId,
  currentHmacMode,
  hasSecret,
  onSecretGenerated,
}: HmacSecretManagerProps) {
  const [showSecret, setShowSecret] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [generatedSecret, setGeneratedSecret] = useState<string | null>(null);

  const generateSecret = api.webhook.generateHmacSecret.useMutation({
    onSuccess: (data) => {
      setGeneratedSecret(data.secret);
      toast.success("HMAC secret generated successfully");
      onSecretGenerated?.();
    },
    onError: (error) => {
      toast.error(`Failed to generate secret: ${error.message}`);
    },
  });

  const handleGenerateSecret = async () => {
    if (hasSecret && generatedSecret === null) {
      // Confirm rotation if secret already exists
      if (
        !confirm(
          "This will rotate the existing secret. The old secret will stop working immediately. Continue?",
        )
      ) {
        return;
      }
    }

    await generateSecret.mutateAsync({ endpointId });
  };

  const handleCopySecret = async () => {
    if (generatedSecret) {
      try {
        await navigator.clipboard.writeText(generatedSecret);
        setCopiedSecret(true);
        toast.success("Secret copied to clipboard");

        // Reset the copied state after 2 seconds
        setTimeout(() => setCopiedSecret(false), 2000);
      } catch {
        toast.error("Failed to copy secret to clipboard");
      }
    }
  };

  const toggleSecretVisibility = () => {
    setShowSecret(!showSecret);
  };

  const displaySecret =
    generatedSecret ?? (hasSecret ? "•".repeat(64) : "No secret configured");
  const isSecretGenerated = Boolean(generatedSecret);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              HMAC Secret Management
              {hasSecret && <Badge variant="outline">Secret Configured</Badge>}
            </CardTitle>
            <CardDescription>
              Generate and manage HMAC secrets for webhook signature
              verification
            </CardDescription>
          </div>
          {currentHmacMode && (
            <Badge variant="secondary">
              {currentHmacMode.toUpperCase()} Mode
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!currentHmacMode && (
          <Alert>
            <AlertDescription>
              Configure an HMAC verification mode in the endpoint settings to
              use secret-based authentication.
            </AlertDescription>
          </Alert>
        )}

        {currentHmacMode && (
          <>
            <div className="space-y-2">
              <Label>Current Secret</Label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Input
                    type={showSecret ? "text" : "password"}
                    value={displaySecret}
                    readOnly
                    className="pr-10 font-mono text-sm"
                  />
                  {(isSecretGenerated || hasSecret) && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute top-1 right-1 h-8 w-8"
                      onClick={toggleSecretVisibility}
                    >
                      {showSecret ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                </div>
                {isSecretGenerated && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleCopySecret}
                    disabled={copiedSecret}
                  >
                    {copiedSecret ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                )}
              </div>
              {isSecretGenerated && (
                <p className="text-muted-foreground text-sm">
                  ⚠️ Save this secret now! You won&apos;t be able to see it
                  again.
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                onClick={handleGenerateSecret}
                disabled={generateSecret.isPending}
                variant={hasSecret ? "outline" : "default"}
              >
                {generateSecret.isPending && (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                )}
                {hasSecret ? "Rotate Secret" : "Generate Secret"}
              </Button>

              {hasSecret && (
                <p className="text-muted-foreground text-sm">
                  Last updated: {new Date().toLocaleDateString()}
                </p>
              )}
            </div>

            {isSecretGenerated && (
              <Alert>
                <AlertDescription>
                  <strong>Secret generated successfully!</strong> Make sure to
                  copy and save it securely. Update your webhook endpoint to use
                  this new secret for signature verification.
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label>Signature Verification</Label>
              <div className="text-muted-foreground space-y-1 text-sm">
                {currentHmacMode === "stripe" && (
                  <div>
                    <p>
                      <strong>Stripe format:</strong> Check the{" "}
                      <code>Stripe-Signature</code> header
                    </p>
                    <p>
                      Example: <code>t=timestamp,v1=signature</code>
                    </p>
                  </div>
                )}
                {currentHmacMode === "github" && (
                  <div>
                    <p>
                      <strong>GitHub format:</strong> Check the{" "}
                      <code>X-Hub-Signature-256</code> header
                    </p>
                    <p>
                      Example: <code>sha256=signature</code>
                    </p>
                  </div>
                )}
                {currentHmacMode === "generic" && (
                  <div>
                    <p>
                      <strong>Generic format:</strong> Check the{" "}
                      <code>X-Signature</code> header
                    </p>
                    <p>HMAC-SHA256 of the request body using your secret</p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
