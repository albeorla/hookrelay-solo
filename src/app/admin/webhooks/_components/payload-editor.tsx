"use client";

import React, { useState, useMemo } from "react";
import {
  Code,
  Copy,
  Check,
  Wand2,
  AlertTriangle,
  FileText,
  Lightbulb,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Label } from "~/components/ui/label";

interface PayloadEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  showTemplates?: boolean;
  showValidation?: boolean;
}

const WEBHOOK_TEMPLATES = {
  basic: {
    name: "Basic Event",
    payload: {
      event_type: "user.created",
      timestamp: Date.now(),
      data: {
        id: "user_123",
        email: "user@example.com",
        name: "John Doe",
      },
    },
  },
  stripe: {
    name: "Stripe Event",
    payload: {
      id: "evt_1234567890",
      object: "event",
      api_version: "2020-08-27",
      created: Math.floor(Date.now() / 1000),
      type: "payment_intent.succeeded",
      data: {
        object: {
          id: "pi_1234567890",
          object: "payment_intent",
          amount: 2000,
          currency: "usd",
          status: "succeeded",
        },
      },
    },
  },
  github: {
    name: "GitHub Event",
    payload: {
      action: "opened",
      number: 1,
      pull_request: {
        id: 1,
        title: "Update README",
        user: {
          login: "octocat",
          id: 1,
        },
      },
      repository: {
        id: 1296269,
        name: "Hello-World",
        full_name: "octocat/Hello-World",
      },
    },
  },
  shopify: {
    name: "Shopify Order",
    payload: {
      id: 820982911946154500,
      email: "customer@example.com",
      total_price: "199.65",
      order_number: 1001,
      line_items: [
        {
          id: 466157049,
          title: "Example Product",
          quantity: 1,
          price: "199.65",
        },
      ],
    },
  },
  custom: {
    name: "E-commerce Order",
    payload: {
      order_id: "ORD-2024-001",
      customer: {
        id: "CUST-123",
        email: "customer@example.com",
        name: "Jane Smith",
      },
      items: [
        {
          sku: "PROD-001",
          name: "Premium Widget",
          quantity: 2,
          price: 29.99,
        },
      ],
      total: 59.98,
      status: "confirmed",
      created_at: new Date().toISOString(),
    },
  },
};

export function PayloadEditor({
  value,
  onChange,
  placeholder = "Enter your JSON payload...",
  className = "",
  showTemplates: _showTemplates = true,
  showValidation = true,
}: PayloadEditorProps) {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState("editor");

  // Validate JSON
  const validation = useMemo(() => {
    if (!showValidation || !value.trim()) return null;

    try {
      const parsed = JSON.parse(value) as unknown;
      const size = new Blob([value]).size;
      const keys =
        typeof parsed === "object" && parsed !== null
          ? Object.keys(parsed as Record<string, unknown>).length
          : 0;

      return {
        valid: true,
        size,
        keys,
        type: Array.isArray(parsed) ? "array" : typeof parsed,
      };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : "Invalid JSON",
      };
    }
  }, [value, showValidation]);

  // Format JSON
  const handleFormat = () => {
    try {
      const parsed = JSON.parse(value) as unknown;
      const formatted = JSON.stringify(parsed, null, 2);
      onChange(formatted);
      toast.success("Payload formatted successfully");
    } catch {
      toast.error("Invalid JSON - cannot format");
    }
  };

  // Minify JSON
  const handleMinify = () => {
    try {
      const parsed = JSON.parse(value) as unknown;
      const minified = JSON.stringify(parsed);
      onChange(minified);
      toast.success("Payload minified successfully");
    } catch {
      toast.error("Invalid JSON - cannot minify");
    }
  };

  // Copy to clipboard
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  };

  // Load template
  const handleLoadTemplate = (templateKey: string) => {
    const template =
      WEBHOOK_TEMPLATES[templateKey as keyof typeof WEBHOOK_TEMPLATES];
    if (template) {
      const formattedPayload = JSON.stringify(template.payload, null, 2);
      onChange(formattedPayload);
      toast.success(`Loaded ${template.name} template`);
    }
  };

  // Generate timestamps
  const handleGenerateTimestamp = () => {
    try {
      const parsed = JSON.parse(value) as unknown;
      const base =
        typeof parsed === "object" && parsed !== null
          ? (parsed as Record<string, unknown>)
          : {};
      const withTimestamp = {
        ...base,
        timestamp: Date.now(),
        created_at: new Date().toISOString(),
      };
      const formatted = JSON.stringify(withTimestamp, null, 2);
      onChange(formatted);
      toast.success("Added timestamps to payload");
    } catch {
      toast.error("Invalid JSON - cannot add timestamps");
    }
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Code className="h-5 w-5" />
            Payload Editor
          </CardTitle>
          <div className="flex items-center gap-2">
            {validation && (
              <Badge variant={validation.valid ? "default" : "destructive"}>
                {validation.valid
                  ? `${formatFileSize(validation.size ?? 0)} • ${validation.keys ?? 0} keys`
                  : "Invalid JSON"}
              </Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              disabled={copied}
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-4"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="editor">Editor</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
          </TabsList>

          <TabsContent value="editor" className="space-y-4">
            {/* Editor Controls */}
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleFormat}>
                <Wand2 className="mr-2 h-4 w-4" />
                Format
              </Button>
              <Button variant="outline" size="sm" onClick={handleMinify}>
                <FileText className="mr-2 h-4 w-4" />
                Minify
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerateTimestamp}
              >
                <Lightbulb className="mr-2 h-4 w-4" />
                Add Timestamps
              </Button>
            </div>

            {/* Validation Status */}
            {validation && !validation.valid && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  JSON Error: {validation.error}
                </AlertDescription>
              </Alert>
            )}

            {/* Main Editor */}
            <div className="relative">
              <Textarea
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="min-h-64 resize-y font-mono text-sm"
              />
            </div>

            {/* JSON Info */}
            {validation?.valid && (
              <div className="text-muted-foreground space-y-1 text-sm">
                <div>Size: {formatFileSize(validation.size ?? 0)}</div>
                <div>
                  Type: {validation.type}{" "}
                  {(validation.keys ?? 0) > 0 && `(${validation.keys} keys)`}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="templates" className="space-y-4">
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Quick Templates</Label>
                <p className="text-muted-foreground text-sm">
                  Load common webhook payload templates
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {Object.entries(WEBHOOK_TEMPLATES).map(([key, template]) => (
                  <Card
                    key={key}
                    className="hover:bg-muted/50 cursor-pointer transition-colors"
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium">{template.name}</h4>
                          <p className="text-muted-foreground text-sm">
                            {Object.keys(template.payload).length} fields
                          </p>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleLoadTemplate(key)}
                        >
                          Load
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Alert>
                <Lightbulb className="h-4 w-4" />
                <AlertDescription>
                  Templates provide starting points for common webhook formats.
                  You can modify them after loading to match your specific
                  needs.
                </AlertDescription>
              </Alert>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
