"use client";

import React, { useState } from "react";
import {
  Filter,
  Calendar,
  Clock,
  Code,
  Save,
  Trash2,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Star,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { Separator } from "~/components/ui/separator";
import { Textarea } from "~/components/ui/textarea";
import { Collapsible, CollapsibleContent } from "~/components/ui/collapsible";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";

interface AdvancedFilters {
  // Date & Time Filters
  dateRange: {
    start: string;
    end: string;
    enabled: boolean;
  };
  timeRange: {
    startTime: string;
    endTime: string;
    enabled: boolean;
  };

  // Status & Response Filters
  httpStatusCodes: {
    ranges: string[];
    specific: number[];
    exclude: number[];
    enabled: boolean;
  };
  deliveryStatus: {
    include: string[];
    exclude: string[];
  };

  // Performance Filters
  duration: {
    min: number;
    max: number;
    enabled: boolean;
  };
  attemptCount: {
    min: number;
    max: number;
    enabled: boolean;
  };

  // Content Filters
  payloadSize: {
    min: number;
    max: number;
    enabled: boolean;
  };
  contentType: {
    include: string[];
    exclude: string[];
    enabled: boolean;
  };

  // Error Filters
  hasErrors: boolean | null; // null = any, true = only errors, false = only success
  errorPatterns: {
    patterns: string[];
    caseSensitive: boolean;
    enabled: boolean;
  };

  // Custom Filters
  customFields: {
    field: string;
    operator: "equals" | "contains" | "startsWith" | "endsWith" | "regex";
    value: string;
    enabled: boolean;
  }[];
}

interface SavedFilter {
  id: string;
  name: string;
  description: string;
  filters: AdvancedFilters;
  isDefault: boolean;
  createdAt: Date;
  lastUsed: Date;
}

interface AdvancedFiltersProps {
  filters: AdvancedFilters;
  onFiltersChange: (filters: AdvancedFilters) => void;
  availableEndpoints?: Array<{ id: string; name?: string }>;
  className?: string;
}

const DEFAULT_FILTERS: AdvancedFilters = {
  dateRange: {
    start: "",
    end: "",
    enabled: false,
  },
  timeRange: {
    startTime: "",
    endTime: "",
    enabled: false,
  },
  httpStatusCodes: {
    ranges: [],
    specific: [],
    exclude: [],
    enabled: false,
  },
  deliveryStatus: {
    include: [],
    exclude: [],
  },
  duration: {
    min: 0,
    max: 30000,
    enabled: false,
  },
  attemptCount: {
    min: 1,
    max: 10,
    enabled: false,
  },
  payloadSize: {
    min: 0,
    max: 1048576, // 1MB
    enabled: false,
  },
  contentType: {
    include: [],
    exclude: [],
    enabled: false,
  },
  hasErrors: null,
  errorPatterns: {
    patterns: [],
    caseSensitive: false,
    enabled: false,
  },
  customFields: [],
};

const HTTP_STATUS_RANGES = [
  { value: "2xx", label: "2xx Success (200-299)", min: 200, max: 299 },
  { value: "3xx", label: "3xx Redirection (300-399)", min: 300, max: 399 },
  { value: "4xx", label: "4xx Client Error (400-499)", min: 400, max: 499 },
  { value: "5xx", label: "5xx Server Error (500-599)", min: 500, max: 599 },
];

const COMMON_STATUS_CODES = [
  200, 201, 400, 401, 403, 404, 429, 500, 502, 503, 504,
];

const DELIVERY_STATUSES = ["pending", "success", "failed", "retrying"];

const PRESET_FILTERS: Record<string, Partial<AdvancedFilters>> = {
  "recent-errors": {
    dateRange: {
      start:
        new Date(Date.now() - 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0] ?? "", // 24h ago
      end: new Date().toISOString().split("T")[0] ?? "",
      enabled: true,
    },
    hasErrors: true,
    deliveryStatus: { include: ["failed"], exclude: [] },
  },
  "slow-requests": {
    duration: { min: 5000, max: 30000, enabled: true },
    dateRange: {
      start:
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0] ?? "", // 7 days
      end: new Date().toISOString().split("T")[0] ?? "",
      enabled: true,
    },
  },
  "client-errors": {
    httpStatusCodes: {
      ranges: ["4xx"],
      specific: [],
      exclude: [],
      enabled: true,
    },
    dateRange: {
      start:
        new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0] ?? "", // 3 days
      end: new Date().toISOString().split("T")[0] ?? "",
      enabled: true,
    },
  },
  "server-errors": {
    httpStatusCodes: {
      ranges: ["5xx"],
      specific: [],
      exclude: [],
      enabled: true,
    },
    dateRange: {
      start:
        new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0] ?? "", // 3 days
      end: new Date().toISOString().split("T")[0] ?? "",
      enabled: true,
    },
  },
};

export function AdvancedFilters({
  filters,
  onFiltersChange,
  availableEndpoints: _availableEndpoints,
  className = "",
}: AdvancedFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeSection, setActiveSection] = useState<string>("date");
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [newFilterName, setNewFilterName] = useState("");
  const [newFilterDescription, setNewFilterDescription] = useState("");

  // Calculate active filter count
  const activeFilterCount = React.useMemo(() => {
    let count = 0;
    if (filters.dateRange.enabled) count++;
    if (filters.timeRange.enabled) count++;
    if (filters.httpStatusCodes.enabled) count++;
    if (filters.duration.enabled) count++;
    if (filters.attemptCount.enabled) count++;
    if (filters.payloadSize.enabled) count++;
    if (filters.contentType.enabled) count++;
    if (filters.hasErrors !== null) count++;
    if (filters.errorPatterns.enabled) count++;
    if (
      filters.deliveryStatus.include.length > 0 ||
      filters.deliveryStatus.exclude.length > 0
    )
      count++;
    count += filters.customFields.filter((f) => f.enabled).length;
    return count;
  }, [filters]);

  const updateFilters = (updates: Partial<AdvancedFilters>) => {
    onFiltersChange({ ...filters, ...updates });
  };

  const clearAllFilters = () => {
    onFiltersChange(DEFAULT_FILTERS);
    toast.success("All filters cleared");
  };

  const applyPreset = (presetKey: string) => {
    const preset = PRESET_FILTERS[presetKey];
    if (preset) {
      onFiltersChange({ ...DEFAULT_FILTERS, ...preset });
      toast.success(`Applied ${presetKey.replace("-", " ")} filter`);
    }
  };

  const saveCurrentFilter = () => {
    if (!newFilterName.trim()) {
      toast.error("Filter name is required");
      return;
    }

    const newFilter: SavedFilter = {
      id: `filter_${Date.now()}`,
      name: newFilterName,
      description: newFilterDescription,
      filters,
      isDefault: false,
      createdAt: new Date(),
      lastUsed: new Date(),
    };

    setSavedFilters((prev) => [...prev, newFilter]);
    setShowSaveDialog(false);
    setNewFilterName("");
    setNewFilterDescription("");
    toast.success("Filter saved successfully");
  };

  const loadSavedFilter = (savedFilter: SavedFilter) => {
    onFiltersChange(savedFilter.filters);
    toast.success(`Loaded filter: ${savedFilter.name}`);
  };

  const deleteSavedFilter = (filterId: string) => {
    setSavedFilters((prev) => prev.filter((f) => f.id !== filterId));
    toast.success("Filter deleted");
  };

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
            <Filter className="h-5 w-5" />
            Advanced Filters
            {activeFilterCount > 0 && (
              <Badge variant="secondary">{activeFilterCount} active</Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            {activeFilterCount > 0 && (
              <Button variant="outline" size="sm" onClick={clearAllFilters}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Clear All
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Quick Preset Filters */}
        {!isExpanded && activeFilterCount === 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => applyPreset("recent-errors")}
            >
              Recent Errors
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => applyPreset("slow-requests")}
            >
              Slow Requests
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => applyPreset("client-errors")}
            >
              4xx Errors
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => applyPreset("server-errors")}
            >
              5xx Errors
            </Button>
          </div>
        )}
      </CardHeader>

      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleContent>
          <CardContent className="space-y-6">
            {/* Filter Tabs */}
            <div className="flex flex-wrap gap-2 border-b pb-4">
              {[
                { id: "date", label: "Date & Time", icon: Calendar },
                { id: "status", label: "Status & Response", icon: Code },
                { id: "performance", label: "Performance", icon: Clock },
                { id: "content", label: "Content", icon: Filter },
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <Button
                    key={tab.id}
                    variant={activeSection === tab.id ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setActiveSection(tab.id)}
                  >
                    <Icon className="mr-2 h-4 w-4" />
                    {tab.label}
                  </Button>
                );
              })}
            </div>

            {/* Date & Time Filters */}
            {activeSection === "date" && (
              <div className="space-y-6">
                {/* Date Range */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Date Range</Label>
                    <Switch
                      checked={filters.dateRange.enabled}
                      onCheckedChange={(enabled) =>
                        updateFilters({
                          dateRange: { ...filters.dateRange, enabled },
                        })
                      }
                    />
                  </div>
                  {filters.dateRange.enabled && (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="text-xs">Start Date</Label>
                        <Input
                          type="date"
                          value={filters.dateRange.start}
                          onChange={(e) =>
                            updateFilters({
                              dateRange: {
                                ...filters.dateRange,
                                start: e.target.value,
                              },
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">End Date</Label>
                        <Input
                          type="date"
                          value={filters.dateRange.end}
                          onChange={(e) =>
                            updateFilters({
                              dateRange: {
                                ...filters.dateRange,
                                end: e.target.value,
                              },
                            })
                          }
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Time Range */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Time Range</Label>
                    <Switch
                      checked={filters.timeRange.enabled}
                      onCheckedChange={(enabled) =>
                        updateFilters({
                          timeRange: { ...filters.timeRange, enabled },
                        })
                      }
                    />
                  </div>
                  {filters.timeRange.enabled && (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="text-xs">Start Time</Label>
                        <Input
                          type="time"
                          value={filters.timeRange.startTime}
                          onChange={(e) =>
                            updateFilters({
                              timeRange: {
                                ...filters.timeRange,
                                startTime: e.target.value,
                              },
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">End Time</Label>
                        <Input
                          type="time"
                          value={filters.timeRange.endTime}
                          onChange={(e) =>
                            updateFilters({
                              timeRange: {
                                ...filters.timeRange,
                                endTime: e.target.value,
                              },
                            })
                          }
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Status & Response Filters */}
            {activeSection === "status" && (
              <div className="space-y-6">
                {/* HTTP Status Codes */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">
                      HTTP Status Codes
                    </Label>
                    <Switch
                      checked={filters.httpStatusCodes.enabled}
                      onCheckedChange={(enabled) =>
                        updateFilters({
                          httpStatusCodes: {
                            ...filters.httpStatusCodes,
                            enabled,
                          },
                        })
                      }
                    />
                  </div>
                  {filters.httpStatusCodes.enabled && (
                    <div className="space-y-4">
                      <div>
                        <Label className="mb-2 block text-xs">
                          Status Ranges
                        </Label>
                        <div className="flex flex-wrap gap-2">
                          {HTTP_STATUS_RANGES.map((range) => (
                            <Button
                              key={range.value}
                              variant={
                                filters.httpStatusCodes.ranges.includes(
                                  range.value,
                                )
                                  ? "default"
                                  : "outline"
                              }
                              size="sm"
                              onClick={() => {
                                const ranges =
                                  filters.httpStatusCodes.ranges.includes(
                                    range.value,
                                  )
                                    ? filters.httpStatusCodes.ranges.filter(
                                        (r) => r !== range.value,
                                      )
                                    : [
                                        ...filters.httpStatusCodes.ranges,
                                        range.value,
                                      ];
                                updateFilters({
                                  httpStatusCodes: {
                                    ...filters.httpStatusCodes,
                                    ranges,
                                  },
                                });
                              }}
                            >
                              {range.label}
                            </Button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <Label className="mb-2 block text-xs">
                          Specific Status Codes
                        </Label>
                        <div className="mb-2 flex flex-wrap gap-2">
                          {COMMON_STATUS_CODES.map((code) => (
                            <Button
                              key={code}
                              variant={
                                filters.httpStatusCodes.specific.includes(code)
                                  ? "default"
                                  : "outline"
                              }
                              size="sm"
                              onClick={() => {
                                const specific =
                                  filters.httpStatusCodes.specific.includes(
                                    code,
                                  )
                                    ? filters.httpStatusCodes.specific.filter(
                                        (c) => c !== code,
                                      )
                                    : [
                                        ...filters.httpStatusCodes.specific,
                                        code,
                                      ];
                                updateFilters({
                                  httpStatusCodes: {
                                    ...filters.httpStatusCodes,
                                    specific,
                                  },
                                });
                              }}
                            >
                              {code}
                            </Button>
                          ))}
                        </div>
                      </div>

                      {filters.httpStatusCodes.specific.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {filters.httpStatusCodes.specific.map((code) => (
                            <Badge key={code} variant="secondary">
                              {code}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Delivery Status */}
                <div className="space-y-4">
                  <Label className="text-sm font-medium">Delivery Status</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="mb-2 block text-xs">Include</Label>
                      <div className="space-y-2">
                        {DELIVERY_STATUSES.map((status) => (
                          <div
                            key={status}
                            className="flex items-center space-x-2"
                          >
                            <input
                              type="checkbox"
                              id={`include-${status}`}
                              checked={filters.deliveryStatus.include.includes(
                                status,
                              )}
                              onChange={(e) => {
                                const include = e.target.checked
                                  ? [...filters.deliveryStatus.include, status]
                                  : filters.deliveryStatus.include.filter(
                                      (s) => s !== status,
                                    );
                                updateFilters({
                                  deliveryStatus: {
                                    ...filters.deliveryStatus,
                                    include,
                                  },
                                });
                              }}
                            />
                            <Label
                              htmlFor={`include-${status}`}
                              className="text-sm capitalize"
                            >
                              {status}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <Label className="mb-2 block text-xs">Exclude</Label>
                      <div className="space-y-2">
                        {DELIVERY_STATUSES.map((status) => (
                          <div
                            key={status}
                            className="flex items-center space-x-2"
                          >
                            <input
                              type="checkbox"
                              id={`exclude-${status}`}
                              checked={filters.deliveryStatus.exclude.includes(
                                status,
                              )}
                              onChange={(e) => {
                                const exclude = e.target.checked
                                  ? [...filters.deliveryStatus.exclude, status]
                                  : filters.deliveryStatus.exclude.filter(
                                      (s) => s !== status,
                                    );
                                updateFilters({
                                  deliveryStatus: {
                                    ...filters.deliveryStatus,
                                    exclude,
                                  },
                                });
                              }}
                            />
                            <Label
                              htmlFor={`exclude-${status}`}
                              className="text-sm capitalize"
                            >
                              {status}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Performance Filters */}
            {activeSection === "performance" && (
              <div className="space-y-6">
                {/* Duration Filter */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">
                      Response Duration (ms)
                    </Label>
                    <Switch
                      checked={filters.duration.enabled}
                      onCheckedChange={(enabled) =>
                        updateFilters({
                          duration: { ...filters.duration, enabled },
                        })
                      }
                    />
                  </div>
                  {filters.duration.enabled && (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="text-xs">Min Duration</Label>
                        <Input
                          type="number"
                          value={filters.duration.min}
                          onChange={(e) =>
                            updateFilters({
                              duration: {
                                ...filters.duration,
                                min: parseInt(e.target.value) || 0,
                              },
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Max Duration</Label>
                        <Input
                          type="number"
                          value={filters.duration.max}
                          onChange={(e) =>
                            updateFilters({
                              duration: {
                                ...filters.duration,
                                max: parseInt(e.target.value) || 30000,
                              },
                            })
                          }
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Attempt Count */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Attempt Count</Label>
                    <Switch
                      checked={filters.attemptCount.enabled}
                      onCheckedChange={(enabled) =>
                        updateFilters({
                          attemptCount: { ...filters.attemptCount, enabled },
                        })
                      }
                    />
                  </div>
                  {filters.attemptCount.enabled && (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="text-xs">Min Attempts</Label>
                        <Input
                          type="number"
                          min="1"
                          value={filters.attemptCount.min}
                          onChange={(e) =>
                            updateFilters({
                              attemptCount: {
                                ...filters.attemptCount,
                                min: parseInt(e.target.value) || 1,
                              },
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Max Attempts</Label>
                        <Input
                          type="number"
                          min="1"
                          value={filters.attemptCount.max}
                          onChange={(e) =>
                            updateFilters({
                              attemptCount: {
                                ...filters.attemptCount,
                                max: parseInt(e.target.value) || 10,
                              },
                            })
                          }
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Content Filters */}
            {activeSection === "content" && (
              <div className="space-y-6">
                {/* Payload Size */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Payload Size</Label>
                    <Switch
                      checked={filters.payloadSize.enabled}
                      onCheckedChange={(enabled) =>
                        updateFilters({
                          payloadSize: { ...filters.payloadSize, enabled },
                        })
                      }
                    />
                  </div>
                  {filters.payloadSize.enabled && (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="text-xs">Min Size</Label>
                        <Input
                          type="number"
                          value={filters.payloadSize.min}
                          onChange={(e) =>
                            updateFilters({
                              payloadSize: {
                                ...filters.payloadSize,
                                min: parseInt(e.target.value) || 0,
                              },
                            })
                          }
                        />
                        <span className="text-muted-foreground text-xs">
                          {formatFileSize(filters.payloadSize.min)}
                        </span>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Max Size</Label>
                        <Input
                          type="number"
                          value={filters.payloadSize.max}
                          onChange={(e) =>
                            updateFilters({
                              payloadSize: {
                                ...filters.payloadSize,
                                max: parseInt(e.target.value) || 1048576,
                              },
                            })
                          }
                        />
                        <span className="text-muted-foreground text-xs">
                          {formatFileSize(filters.payloadSize.max)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Error Filters */}
                <div className="space-y-4">
                  <Label className="text-sm font-medium">Error Status</Label>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant={
                        filters.hasErrors === null ? "default" : "outline"
                      }
                      size="sm"
                      onClick={() => updateFilters({ hasErrors: null })}
                    >
                      Any
                    </Button>
                    <Button
                      variant={
                        filters.hasErrors === true ? "default" : "outline"
                      }
                      size="sm"
                      onClick={() => updateFilters({ hasErrors: true })}
                    >
                      Errors Only
                    </Button>
                    <Button
                      variant={
                        filters.hasErrors === false ? "default" : "outline"
                      }
                      size="sm"
                      onClick={() => updateFilters({ hasErrors: false })}
                    >
                      Success Only
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <Separator />

            {/* Filter Actions */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSaveDialog(true)}
                >
                  <Save className="mr-2 h-4 w-4" />
                  Save Filter
                </Button>
                {savedFilters.length > 0 && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm">
                        Load Saved ({savedFilters.length})
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80">
                      <div className="space-y-2">
                        {savedFilters.map((filter) => (
                          <div
                            key={filter.id}
                            className="flex items-center justify-between rounded border p-2"
                          >
                            <div className="flex-1">
                              <div className="text-sm font-medium">
                                {filter.name}
                              </div>
                              {filter.description && (
                                <div className="text-muted-foreground text-xs">
                                  {filter.description}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => loadSavedFilter(filter)}
                              >
                                <Star className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive h-6 w-6"
                                onClick={() => deleteSavedFilter(filter.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
              </div>

              <div className="text-muted-foreground text-sm">
                {activeFilterCount} filter{activeFilterCount !== 1 ? "s" : ""}{" "}
                active
              </div>
            </div>

            {/* Save Filter Dialog */}
            {showSaveDialog && (
              <div className="bg-muted/50 rounded-lg border p-4">
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium">Filter Name</Label>
                    <Input
                      placeholder="My Custom Filter"
                      value={newFilterName}
                      onChange={(e) => setNewFilterName(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium">
                      Description (optional)
                    </Label>
                    <Textarea
                      placeholder="Description of what this filter shows..."
                      value={newFilterDescription}
                      onChange={(e) => setNewFilterDescription(e.target.value)}
                      rows={2}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" onClick={saveCurrentFilter}>
                      Save Filter
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowSaveDialog(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
