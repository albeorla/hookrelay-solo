"use client";

import React, { useState, useMemo } from "react";
import {
  Search,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Code,
  FileText,
  AlertTriangle,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Separator } from "~/components/ui/separator";
import { Alert, AlertDescription } from "~/components/ui/alert";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";

interface PayloadInspectorProps {
  payload: string | object;
  headers?: Record<string, string>;
  title?: string;
  className?: string;
  showDownload?: boolean;
  showSearch?: boolean;
  maxHeight?: string;
}

interface PayloadAnalysis {
  type: "json" | "xml" | "form" | "text" | "binary";
  size: number;
  encoding: string;
  structure?: {
    depth: number;
    keys: string[];
    arrays: string[];
    nullFields: string[];
  };
  errors?: string[];
}

const isRecord = (val: unknown): val is Record<string, unknown> =>
  typeof val === "object" && val !== null;

const COMMON_WEBHOOK_PATTERNS = {
  stripe: {
    name: "Stripe",
    detect: (obj: unknown) => {
      if (!isRecord(obj)) return false;
      const id = obj["id"];
      const object = obj["object"];
      return (
        (typeof id === "string" && id.startsWith("evt_")) || object === "event"
      );
    },
    highlight: ["id", "type", "data.object", "created"],
  },
  github: {
    name: "GitHub",
    detect: (obj: unknown) => {
      if (!isRecord(obj)) return false;
      const zen = obj["zen"];
      const hookId = obj["hook_id"];
      const repo = obj["repository"];
      const fullName = isRecord(repo) ? repo["full_name"] : undefined;
      return Boolean(zen ?? hookId ?? fullName);
    },
    highlight: ["action", "repository.name", "sender.login", "ref"],
  },
  shopify: {
    name: "Shopify",
    detect: (obj: unknown) => {
      if (!isRecord(obj)) return false;
      const id = obj["id"];
      const agid = obj["admin_graphql_api_id"];
      const domain = obj["myshopify_domain"];
      return Boolean(id && (agid ?? domain));
    },
    highlight: ["id", "email", "total_price", "order_number"],
  },
  discord: {
    name: "Discord",
    detect: (obj: unknown) => {
      if (!isRecord(obj)) return false;
      const guildId = obj["guild_id"];
      const channelId = obj["channel_id"];
      const user = obj["user"];
      const discrim = isRecord(user) ? user["discriminator"] : undefined;
      return Boolean(guildId ?? channelId ?? discrim);
    },
    highlight: ["type", "guild_id", "channel_id", "user.username"],
  },
  slack: {
    name: "Slack",
    detect: (obj: unknown) => {
      if (!isRecord(obj)) return false;
      const teamId = obj["team_id"];
      const appId = obj["api_app_id"];
      const event = obj["event"];
      const eventType = isRecord(event) ? event["type"] : undefined;
      return Boolean(teamId ?? appId ?? eventType);
    },
    highlight: ["type", "team_id", "event.type", "event.user"],
  },
};

export function PayloadInspector({
  payload,
  headers = {},
  title = "Payload Inspector",
  className = "",
  showDownload = true,
  showSearch = true,
  maxHeight = "32rem",
}: PayloadInspectorProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<"formatted" | "raw" | "tree">(
    "formatted",
  );
  const [copied, setCopied] = useState(false);
  const [showSensitive, setShowSensitive] = useState(false);

  // Analyze payload
  const analysis = useMemo((): PayloadAnalysis => {
    try {
      const payloadStr =
        typeof payload === "string" ? payload : JSON.stringify(payload);
      const size = new Blob([payloadStr]).size;

      // Detect content type
      const contentType =
        headers["content-type"] ?? headers["Content-Type"] ?? "";
      let type: PayloadAnalysis["type"] = "text";

      if (
        contentType.includes("application/json") ||
        payloadStr.trim().startsWith("{")
      ) {
        type = "json";
      } else if (
        contentType.includes("application/xml") ||
        payloadStr.trim().startsWith("<")
      ) {
        type = "xml";
      } else if (contentType.includes("application/x-www-form-urlencoded")) {
        type = "form";
      }

      const result: PayloadAnalysis = {
        type,
        size,
        encoding: "utf-8",
      };

      // JSON-specific analysis
      if (type === "json") {
        try {
          const parsed =
            typeof payload === "string"
              ? (JSON.parse(payload) as unknown)
              : (payload as unknown);
          result.structure = analyzeJsonStructure(parsed);
        } catch (error) {
          result.errors = [
            `Invalid JSON: ${error instanceof Error ? error.message : "Unknown error"}`,
          ];
        }
      }

      return result;
    } catch (error) {
      return {
        type: "text",
        size: 0,
        encoding: "unknown",
        errors: [
          `Analysis failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        ],
      };
    }
  }, [payload, headers]);

  // Detect webhook provider
  const detectedProvider = useMemo(() => {
    if (analysis.type !== "json" || analysis.errors?.length) return null;

    try {
      const parsed =
        typeof payload === "string"
          ? (JSON.parse(payload) as unknown)
          : (payload as unknown);
      for (const [key, pattern] of Object.entries(COMMON_WEBHOOK_PATTERNS)) {
        if (pattern.detect(parsed)) {
          return { key, ...pattern };
        }
      }
    } catch {
      return null;
    }

    return null;
  }, [payload, analysis]);

  // Format payload for display
  const formattedPayload = useMemo(() => {
    if (analysis.type === "json" && !analysis.errors?.length) {
      try {
        const parsed =
          typeof payload === "string"
            ? (JSON.parse(payload) as unknown)
            : (payload as unknown);
        return JSON.stringify(parsed, null, 2);
      } catch {
        return typeof payload === "string" ? payload : JSON.stringify(payload);
      }
    }
    return typeof payload === "string" ? payload : JSON.stringify(payload);
  }, [payload, analysis]);

  // Filter payload based on search
  const searchFilteredPayload = useMemo(() => {
    if (!searchTerm) return formattedPayload;

    const lines = formattedPayload.split("\n");
    const filteredLines = lines.filter((line) =>
      line.toLowerCase().includes(searchTerm.toLowerCase()),
    );

    return filteredLines.join("\n");
  }, [formattedPayload, searchTerm]);

  // Copy to clipboard
  const handleCopy = async (content?: string) => {
    try {
      await navigator.clipboard.writeText(content ?? formattedPayload);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  };

  // Download payload
  const handleDownload = () => {
    const blob = new Blob([formattedPayload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `webhook-payload-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // removed unused toggleSection

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
          <div className="flex items-center gap-2">
            <Code className="h-5 w-5" />
            <CardTitle>{title}</CardTitle>
            {detectedProvider && (
              <Badge variant="secondary" className="ml-2">
                {detectedProvider.name}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {formatFileSize(analysis.size)} • {analysis.type.toUpperCase()}
            </Badge>
            {showDownload && (
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <Download className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleCopy()}
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

        {/* Analysis Summary */}
        {analysis.structure && (
          <div className="text-muted-foreground flex items-center gap-4 text-sm">
            <span>{analysis.structure.keys.length} keys</span>
            <span>depth: {analysis.structure.depth}</span>
            {analysis.structure.arrays.length > 0 && (
              <span>{analysis.structure.arrays.length} arrays</span>
            )}
            {analysis.structure.nullFields.length > 0 && (
              <span>{analysis.structure.nullFields.length} null fields</span>
            )}
          </div>
        )}

        {/* Errors */}
        {analysis.errors && analysis.errors.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{analysis.errors.join(", ")}</AlertDescription>
          </Alert>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Controls */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {showSearch && (
            <div className="relative max-w-xs flex-1">
              <Search className="text-muted-foreground absolute top-2.5 left-2 h-4 w-4" />
              <Input
                placeholder="Search in payload..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
          )}

          <div className="flex items-center gap-2">
            <Select
              value={viewMode}
              onValueChange={(value: "formatted" | "raw" | "tree") =>
                setViewMode(value)
              }
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="formatted">Formatted</SelectItem>
                <SelectItem value="raw">Raw</SelectItem>
                <SelectItem value="tree">Tree View</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSensitive(!showSensitive)}
            >
              {showSensitive ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
              Sensitive
            </Button>
          </div>
        </div>

        {/* Highlighted Fields (for known providers) */}
        {detectedProvider &&
          analysis.type === "json" &&
          !analysis.errors?.length && (
            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-between"
                >
                  <span className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Key Fields ({detectedProvider.name})
                  </span>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {detectedProvider.highlight.map((field) => {
                    try {
                      const parsed =
                        typeof payload === "string"
                          ? (JSON.parse(payload) as unknown)
                          : (payload as unknown);
                      const value = getNestedValue(parsed, field);
                      if (value !== undefined) {
                        return (
                          <div
                            key={field}
                            className="flex justify-between text-sm"
                          >
                            <span className="text-muted-foreground font-medium">
                              {field}:
                            </span>
                            <span className="font-mono">
                              {typeof value === "object"
                                ? JSON.stringify(value)
                                : String(value)}
                            </span>
                          </div>
                        );
                      }
                    } catch {
                      return null;
                    }
                    return null;
                  })}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

        <Separator />

        {/* Payload Display */}
        <div className="relative" style={{ maxHeight }}>
          {viewMode === "tree" &&
          analysis.type === "json" &&
          !analysis.errors?.length ? (
            <JsonTreeView
              data={
                typeof payload === "string"
                  ? (JSON.parse(payload) as unknown)
                  : (payload as unknown)
              }
              searchTerm={searchTerm}
              showSensitive={showSensitive}
            />
          ) : (
            <pre className="bg-muted overflow-auto rounded-lg p-4 font-mono text-xs whitespace-pre-wrap">
              {viewMode === "raw"
                ? typeof payload === "string"
                  ? payload
                  : JSON.stringify(payload)
                : searchFilteredPayload}
            </pre>
          )}
        </div>

        {searchTerm && (
          <div className="text-muted-foreground text-sm">
            {searchFilteredPayload.split("\n").length} lines match &quot;
            {searchTerm}&quot;
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Helper function to analyze JSON structure
function analyzeJsonStructure(
  obj: unknown,
  depth = 0,
): PayloadAnalysis["structure"] {
  const keys: string[] = [];
  const arrays: string[] = [];
  const nullFields: string[] = [];
  let maxDepth = depth;

  if (typeof obj === "object" && obj !== null) {
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      keys.push(key);

      if (value === null) {
        nullFields.push(key);
      } else if (Array.isArray(value)) {
        arrays.push(key);
      } else if (typeof value === "object") {
        const nested = analyzeJsonStructure(value, depth + 1);
        if (nested) {
          maxDepth = Math.max(maxDepth, nested.depth);
          keys.push(...nested.keys.map((k) => `${key}.${k}`));
          arrays.push(...nested.arrays.map((k) => `${key}.${k}`));
          nullFields.push(...nested.nullFields.map((k) => `${key}.${k}`));
        }
      }
    }
  }

  return {
    depth: maxDepth,
    keys,
    arrays,
    nullFields,
  };
}

// Helper function to get nested values
function getNestedValue(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, key) => {
    if (
      typeof current === "object" &&
      current !== null &&
      key in (current as Record<string, unknown>)
    ) {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

// Tree view component for JSON
function JsonTreeView({
  data,
  searchTerm,
  showSensitive,
  level = 0,
}: {
  data: unknown;
  searchTerm: string;
  showSensitive: boolean;
  level?: number;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const toggleCollapsed = (key: string) => {
    const newCollapsed = new Set(collapsed);
    if (newCollapsed.has(key)) {
      newCollapsed.delete(key);
    } else {
      newCollapsed.add(key);
    }
    setCollapsed(newCollapsed);
  };

  const isSensitiveField = (key: string) => {
    const sensitiveFields = [
      "password",
      "token",
      "secret",
      "key",
      "auth",
      "credential",
    ];
    return sensitiveFields.some((field) => key.toLowerCase().includes(field));
  };

  const renderValue = (value: unknown, key?: string): React.ReactNode => {
    if (value === null)
      return <span className="text-muted-foreground">null</span>;
    if (value === undefined)
      return <span className="text-muted-foreground">undefined</span>;

    if (typeof value === "string") {
      const isSensitive = key && isSensitiveField(key);
      const displayValue = isSensitive && !showSensitive ? "***" : value;
      return <span className="text-green-600">&quot;{displayValue}&quot;</span>;
    }

    if (typeof value === "number")
      return <span className="text-blue-600">{value}</span>;
    if (typeof value === "boolean")
      return <span className="text-purple-600">{String(value)}</span>;

    return typeof value === "object" ? JSON.stringify(value) : String(value);
  };

  const shouldHighlight = (key: string, value: unknown) => {
    if (!searchTerm) return false;
    const searchLower = searchTerm.toLowerCase();
    return (
      key.toLowerCase().includes(searchLower) ||
      String(value).toLowerCase().includes(searchLower)
    );
  };

  if (typeof data !== "object" || data === null) {
    return <div className="font-mono text-sm">{renderValue(data)}</div>;
  }

  return (
    <div className="space-y-1">
      {Object.entries(data).map(([key, value]) => {
        const keyPath = `${level}-${key}`;
        const isCollapsed = collapsed.has(keyPath);
        const highlight = shouldHighlight(key, value);
        const isObject = typeof value === "object" && value !== null;

        return (
          <div
            key={key}
            className={`font-mono text-sm ${highlight ? "bg-yellow-100 dark:bg-yellow-900/30" : ""}`}
          >
            <div
              className="flex items-start gap-2 py-1"
              style={{ paddingLeft: `${level * 1.5}rem` }}
            >
              {isObject && (
                <button
                  onClick={() => toggleCollapsed(keyPath)}
                  className="text-muted-foreground hover:text-foreground mt-0.5"
                >
                  {isCollapsed ? (
                    <ChevronRight className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                </button>
              )}

              <span className="text-blue-700 dark:text-blue-400">
                &quot;{key}&quot;
              </span>
              <span className="text-muted-foreground">:</span>

              {!isObject ? (
                renderValue(value, key)
              ) : (
                <span className="text-muted-foreground">
                  {Array.isArray(value)
                    ? `[${value.length} items]`
                    : `{${Object.keys(value).length} keys}`}
                </span>
              )}
            </div>

            {isObject && !isCollapsed && (
              <JsonTreeView
                data={value}
                searchTerm={searchTerm}
                showSensitive={showSensitive}
                level={level + 1}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
