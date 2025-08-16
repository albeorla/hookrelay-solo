"use client";

import React, { useState } from "react";
import { Play, Copy, Check, RotateCcw, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Separator } from "~/components/ui/separator";
import { Textarea } from "~/components/ui/textarea";
import { Label } from "~/components/ui/label";
// removed unused Input import
import { Alert, AlertDescription } from "~/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";
import { ChevronDown, ChevronRight } from "lucide-react";
import { api } from "~/trpc/react";
import { ErrorBoundary } from "~/components/error-boundary";
import { PayloadInspector } from "./payload-inspector";
import { PayloadEditor } from "./payload-editor";

interface WebhookTestToolProps {
  endpointId: string;
  endpointUrl?: string;
  trigger?: React.ReactNode;
  className?: string;
}

const DEFAULT_TEST_PAYLOAD = {
  test: true,
  timestamp: Date.now(),
  event_type: "test.webhook",
  data: {
    id: "test_" + Math.random().toString(36).substr(2, 9),
    message: "This is a test webhook from HookRelay",
    metadata: {
      source: "hookrelay_dashboard",
      version: "1.0",
    },
  },
};

const DEFAULT_HEADERS = {
  "Content-Type": "application/json",
  "User-Agent": "HookRelay-Test/1.0",
  "X-Test-Mode": "true",
};

function WebhookTestToolInner({
  endpointId,
  endpointUrl,
  trigger,
  className,
}: WebhookTestToolProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [testPayload, setTestPayload] = useState(
    JSON.stringify(DEFAULT_TEST_PAYLOAD, null, 2),
  );
  const [customHeaders, setCustomHeaders] = useState(
    JSON.stringify(DEFAULT_HEADERS, null, 2),
  );
  const [showAdvanced, setShowAdvanced] = useState(false);
  type TestResult = {
    success: boolean;
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body: string;
    duration: number;
    url: string;
    error?: string;
  };
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [copiedResult, setCopiedResult] = useState(false);

  const testEndpoint = api.webhook.testEndpoint.useMutation({
    onSuccess: (result) => {
      setTestResult(result);
      if (result.success) {
        toast.success(
          `Test successful! Response: ${result.status} ${result.statusText}`,
        );
      } else {
        toast.error(`Test failed: ${result.status} ${result.statusText}`);
      }
    },
    onError: (error) => {
      console.error("WebhookTestTool: Test endpoint error:", error);
      toast.error(`Test request failed: ${error.message}`);
      // Set an error result to show diagnostic info
      setTestResult({
        success: false,
        status: 0,
        statusText: "Request Failed",
        url: endpointUrl ?? "Unknown",
        headers: {},
        body: "",
        duration: 0,
        error: error.message,
      });
    },
  });

  const handleRunTest = async () => {
    try {
      // Validate JSON payload
      JSON.parse(testPayload);

      // Validate headers if provided
      let headers: Record<string, string> = {};
      if (customHeaders.trim()) {
        headers = JSON.parse(customHeaders);
      }

      await testEndpoint.mutateAsync({
        endpointId,
        payload: testPayload,
        headers,
      });
    } catch (_error) {
      if (_error instanceof SyntaxError) {
        toast.error("Invalid JSON in payload or headers");
      } else {
        toast.error("Failed to run test");
      }
    }
  };

  const handleResetPayload = () => {
    setTestPayload(
      JSON.stringify(
        {
          ...DEFAULT_TEST_PAYLOAD,
          timestamp: Date.now(),
          data: {
            ...DEFAULT_TEST_PAYLOAD.data,
            id: "test_" + Math.random().toString(36).substr(2, 9),
          },
        },
        null,
        2,
      ),
    );
  };

  const handleResetHeaders = () => {
    setCustomHeaders(JSON.stringify(DEFAULT_HEADERS, null, 2));
  };

  const handleCopyResult = async () => {
    if (testResult) {
      try {
        await navigator.clipboard.writeText(
          JSON.stringify(testResult, null, 2),
        );
        setCopiedResult(true);
        toast.success("Test result copied to clipboard");
        setTimeout(() => setCopiedResult(false), 2000);
      } catch {
        toast.error("Failed to copy result");
      }
    }
  };

  const getStatusBadgeVariant = (status: number) => {
    if (status >= 200 && status < 300) return "default";
    if (status >= 400 && status < 500) return "secondary";
    if (status >= 500) return "destructive";
    return "outline";
  };

  const defaultTrigger = (
    <Button className={className}>
      <Play className="mr-2 h-4 w-4" />
      Test Webhook
    </Button>
  );

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{trigger ?? defaultTrigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Test Webhook Endpoint</DialogTitle>
          <DialogDescription>
            Send a test webhook to {endpointUrl ?? endpointId} and view the
            response
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Test Payload */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Test Payload</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleResetPayload}
              >
                <RotateCcw className="mr-2 h-3 w-3" />
                Reset
              </Button>
            </div>
            <PayloadEditor
              value={testPayload}
              onChange={setTestPayload}
              placeholder="Enter JSON payload to send..."
              showTemplates={true}
              showValidation={true}
            />
            <p className="text-muted-foreground text-sm">
              JSON payload that will be sent to your webhook endpoint
            </p>
          </div>

          {/* Advanced Settings */}
          <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
            <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium">
              {showAdvanced ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              Advanced Settings
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Custom Headers</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleResetHeaders}
                  >
                    <RotateCcw className="mr-2 h-3 w-3" />
                    Reset
                  </Button>
                </div>
                <Textarea
                  value={customHeaders}
                  onChange={(e) => setCustomHeaders(e.target.value)}
                  placeholder="Enter JSON headers"
                  className="font-mono text-sm"
                  rows={6}
                />
                <p className="text-muted-foreground text-sm">
                  Custom HTTP headers to include with the request (JSON format)
                </p>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Test Controls */}
          <div className="flex items-center justify-between pt-4">
            <div className="text-muted-foreground text-sm">
              Target:{" "}
              <code className="bg-muted rounded px-1 py-0.5">{endpointId}</code>
            </div>
            <Button onClick={handleRunTest} disabled={testEndpoint.isPending}>
              {testEndpoint.isPending ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Testing...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Run Test
                </>
              )}
            </Button>
          </div>

          {/* Test Results */}
          {testResult && (
            <>
              <Separator />
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Test Result</CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant={getStatusBadgeVariant(testResult.status)}>
                        {testResult.status} {testResult.statusText}
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCopyResult}
                        disabled={copiedResult}
                      >
                        {copiedResult ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <CardDescription>
                    Request completed in {testResult.duration}ms
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Response Details */}
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <Label className="text-sm font-medium">HTTP Status</Label>
                      <div className="mt-1">
                        <Badge
                          variant={getStatusBadgeVariant(testResult.status)}
                        >
                          {testResult.status}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Duration</Label>
                      <div className="mt-1 text-sm">
                        {testResult.duration}ms
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Success</Label>
                      <div className="mt-1">
                        <Badge
                          variant={
                            testResult.success ? "default" : "destructive"
                          }
                        >
                          {testResult.success ? "Yes" : "No"}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Target URL</Label>
                      <div className="mt-1 font-mono text-sm break-all">
                        {testResult.url}
                      </div>
                    </div>
                  </div>

                  {/* Response Headers */}
                  {Object.keys(testResult.headers).length > 0 && (
                    <div>
                      <Label className="text-sm font-medium">
                        Response Headers
                      </Label>
                      <pre className="bg-muted mt-1 overflow-x-auto rounded p-2 text-xs">
                        {JSON.stringify(testResult.headers, null, 2)}
                      </pre>
                    </div>
                  )}

                  {/* Response Body */}
                  <div>
                    <Label className="text-sm font-medium">Response Body</Label>
                    {testResult.body ? (
                      <div className="mt-1">
                        <PayloadInspector
                          payload={testResult.body}
                          headers={testResult.headers}
                          title="Test Response"
                          maxHeight="12rem"
                          showDownload={false}
                        />
                      </div>
                    ) : (
                      <div className="bg-muted text-muted-foreground mt-1 rounded p-2 text-xs">
                        (empty)
                      </div>
                    )}
                  </div>

                  {/* Error Details */}
                  {testResult.error && (
                    <div>
                      <Label className="text-destructive text-sm font-medium">
                        Error
                      </Label>
                      <pre className="bg-destructive/10 border-destructive/20 mt-1 rounded border p-2 text-xs">
                        {testResult.error}
                      </pre>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Export with error boundary
export function WebhookTestTool(props: WebhookTestToolProps) {
  return (
    <ErrorBoundary
      fallback={
        <Alert className="m-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Failed to load webhook test tool. Please refresh and try again.
          </AlertDescription>
        </Alert>
      }
    >
      <WebhookTestToolInner {...props} />
    </ErrorBoundary>
  );
}
