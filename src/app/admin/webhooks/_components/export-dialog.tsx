"use client";

import React, { useState } from "react";
import { Download, Filter, AlertTriangle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Separator } from "~/components/ui/separator";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Input } from "~/components/ui/input";
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
import { Checkbox } from "~/components/ui/checkbox";
import { api } from "~/trpc/react";

interface ExportDialogProps {
  trigger: React.ReactNode;
  defaultFilters?: {
    status?: string;
    endpointId?: string;
    search?: string;
  };
  selectedItems?: string[];
  className?: string;
}

interface ExportConfig {
  format: "csv" | "json" | "xlsx";
  dateRange: {
    start: string;
    end: string;
  };
  filters: {
    status?: string;
    endpointId?: string;
    search?: string;
  };
  columns: string[];
  includePayloads: boolean;
  includeHeaders: boolean;
  maxRecords: number;
  selectedOnly: boolean;
}

const EXPORT_FORMATS = [
  {
    value: "csv",
    label: "CSV",
    description: "Comma-separated values (Excel compatible)",
  },
  { value: "json", label: "JSON", description: "JavaScript Object Notation" },
  { value: "xlsx", label: "Excel", description: "Microsoft Excel workbook" },
];

const AVAILABLE_COLUMNS = [
  { key: "deliveryId", label: "Delivery ID", required: true },
  { key: "endpointId", label: "Endpoint ID", required: true },
  { key: "status", label: "Status", required: true },
  { key: "timestamp", label: "Timestamp", required: true },
  { key: "responseStatus", label: "HTTP Status", required: false },
  { key: "durationMs", label: "Duration (ms)", required: false },
  { key: "attempt", label: "Attempt", required: false },
  { key: "destUrl", label: "Destination URL", required: false },
  { key: "requestHeaders", label: "Request Headers", required: false },
  { key: "responseHeaders", label: "Response Headers", required: false },
  { key: "requestBody", label: "Request Body", required: false },
  { key: "responseBody", label: "Response Body", required: false },
  { key: "error", label: "Error Message", required: false },
];

const MAX_RECORDS_OPTIONS = [
  { value: 100, label: "100 records" },
  { value: 500, label: "500 records" },
  { value: 1000, label: "1,000 records" },
  { value: 5000, label: "5,000 records" },
  { value: 10000, label: "10,000 records" },
  { value: 50000, label: "50,000 records (Large)" },
];

export function ExportDialog({
  trigger,
  defaultFilters = {},
  selectedItems = [],
  className = "",
}: ExportDialogProps) {
  const [open, setOpen] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [exportConfig, setExportConfig] = useState<ExportConfig>({
    format: "csv",
    dateRange: {
      start:
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0] ?? "", // 30 days ago
      end: new Date().toISOString().split("T")[0] ?? "", // today
    },
    filters: defaultFilters,
    columns: [
      "deliveryId",
      "endpointId",
      "status",
      "timestamp",
      "responseStatus",
      "durationMs",
    ],
    includePayloads: false,
    includeHeaders: false,
    maxRecords: 1000,
    selectedOnly: selectedItems.length > 0,
  });
  const [isExporting, setIsExporting] = useState(false);

  // Get available endpoints for filtering
  const { data: endpoints } = api.webhook.getEndpoints.useQuery();

  // Export mutation
  const exportDeliveries = api.webhook.exportDeliveries.useMutation({
    onSuccess: (result) => {
      // Create and download the file
      downloadFile(result.data, result.filename, exportConfig.format);
      toast.success(`Export completed: ${result.recordCount} records exported`);
      setOpen(false);
    },
    onError: (error) => {
      toast.error(`Export failed: ${error.message}`);
    },
    onSettled: () => {
      setIsExporting(false);
    },
  });

  const handleExport = async () => {
    if (!exportConfig.columns.length) {
      toast.error("Please select at least one column to export");
      return;
    }

    setIsExporting(true);

    const exportRequest = {
      ...exportConfig,
      selectedItems: exportConfig.selectedOnly ? selectedItems : undefined,
    };

    await exportDeliveries.mutateAsync(exportRequest);
  };

  const downloadFile = (data: string, filename: string, format: string) => {
    let blob: Blob;

    switch (format) {
      case "csv":
        blob = new Blob([data], { type: "text/csv;charset=utf-8;" });
        break;
      case "json":
        blob = new Blob([data], { type: "application/json;charset=utf-8;" });
        break;
      case "xlsx":
        // For XLSX, the data would be base64 encoded
        const binaryString = atob(data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        blob = new Blob([bytes], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        break;
      default:
        blob = new Blob([data], { type: "text/plain;charset=utf-8;" });
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleColumnToggle = (columnKey: string, checked: boolean) => {
    if (checked) {
      setExportConfig((prev) => ({
        ...prev,
        columns: [...prev.columns, columnKey],
      }));
    } else {
      const column = AVAILABLE_COLUMNS.find((col) => col.key === columnKey);
      if (column?.required) {
        toast.error(`${column.label} is required and cannot be removed`);
        return;
      }

      setExportConfig((prev) => ({
        ...prev,
        columns: prev.columns.filter((col) => col !== columnKey),
      }));
    }
  };

  const getEstimatedFileSize = () => {
    const avgRecordSize = exportConfig.includePayloads ? 2048 : 256; // bytes
    const estimatedSize = exportConfig.maxRecords * avgRecordSize;

    if (estimatedSize < 1024) return `${estimatedSize} B`;
    if (estimatedSize < 1024 * 1024)
      return `${Math.round(estimatedSize / 1024)} KB`;
    return `${Math.round(estimatedSize / (1024 * 1024))} MB`;
  };

  const getDaysInRange = () => {
    const start = new Date(exportConfig.dateRange.start);
    const end = new Date(exportConfig.dateRange.end);
    return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild className={className}>
        {trigger}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Delivery Logs
          </DialogTitle>
          <DialogDescription>
            Export webhook delivery logs in your preferred format with
            customizable filters and columns
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Export Summary */}
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {selectedItems.length > 0 && exportConfig.selectedOnly
                      ? selectedItems.length
                      : exportConfig.maxRecords.toLocaleString()}
                  </div>
                  <p className="text-muted-foreground text-sm">Max Records</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {getDaysInRange()}
                  </div>
                  <p className="text-muted-foreground text-sm">Days Range</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {getEstimatedFileSize()}
                  </div>
                  <p className="text-muted-foreground text-sm">Est. Size</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Basic Options */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Export Format</Label>
                <Select
                  value={exportConfig.format}
                  onValueChange={(value: "csv" | "json" | "xlsx") =>
                    setExportConfig((prev) => ({ ...prev, format: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPORT_FORMATS.map((format) => (
                      <SelectItem key={format.value} value={format.value}>
                        <div>
                          <div>{format.label}</div>
                          <div className="text-muted-foreground text-xs">
                            {format.description}
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Maximum Records</Label>
                <Select
                  value={String(exportConfig.maxRecords)}
                  onValueChange={(value) =>
                    setExportConfig((prev) => ({
                      ...prev,
                      maxRecords: parseInt(value),
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MAX_RECORDS_OPTIONS.map((option) => (
                      <SelectItem
                        key={option.value}
                        value={String(option.value)}
                      >
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={exportConfig.dateRange.start}
                  onChange={(e) =>
                    setExportConfig((prev) => ({
                      ...prev,
                      dateRange: { ...prev.dateRange, start: e.target.value },
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={exportConfig.dateRange.end}
                  onChange={(e) =>
                    setExportConfig((prev) => ({
                      ...prev,
                      dateRange: { ...prev.dateRange, end: e.target.value },
                    }))
                  }
                />
              </div>
            </div>

            {/* Selected Items Only */}
            {selectedItems.length > 0 && (
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Export Selected Items Only</Label>
                  <p className="text-muted-foreground text-sm">
                    Export only the {selectedItems.length} selected delivery
                    records
                  </p>
                </div>
                <Switch
                  checked={exportConfig.selectedOnly}
                  onCheckedChange={(checked) =>
                    setExportConfig((prev) => ({
                      ...prev,
                      selectedOnly: checked,
                    }))
                  }
                />
              </div>
            )}
          </div>

          {/* Advanced Options */}
          <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between">
                <span className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  Advanced Options
                </span>
                <Badge variant="secondary">
                  {exportConfig.columns.length} columns
                </Badge>
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-4">
              {/* Filters */}
              <div className="space-y-4">
                <Label className="text-sm font-medium">
                  Additional Filters
                </Label>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-xs">Status Filter</Label>
                    <Select
                      value={exportConfig.filters.status ?? ""}
                      onValueChange={(value) =>
                        setExportConfig((prev) => ({
                          ...prev,
                          filters: {
                            ...prev.filters,
                            status: value || undefined,
                          },
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All statuses</SelectItem>
                        <SelectItem value="success">Success</SelectItem>
                        <SelectItem value="failed">Failed</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="retrying">Retrying</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Endpoint Filter</Label>
                    <Select
                      value={exportConfig.filters.endpointId ?? ""}
                      onValueChange={(value) =>
                        setExportConfig((prev) => ({
                          ...prev,
                          filters: {
                            ...prev.filters,
                            endpointId: value || undefined,
                          },
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All endpoints" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All endpoints</SelectItem>
                        {endpoints?.map(
                          (endpoint: { id: string; name?: string | null }) => (
                            <SelectItem
                              key={endpoint.id}
                              value={String(endpoint.id)}
                            >
                              {endpoint.name ?? endpoint.id}
                            </SelectItem>
                          ),
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Column Selection */}
              <div className="space-y-4">
                <Label className="text-sm font-medium">Columns to Export</Label>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {AVAILABLE_COLUMNS.map((column) => (
                    <div
                      key={column.key}
                      className="flex items-center space-x-2"
                    >
                      <Checkbox
                        id={column.key}
                        checked={exportConfig.columns.includes(column.key)}
                        onCheckedChange={(checked) =>
                          handleColumnToggle(column.key, checked as boolean)
                        }
                        disabled={column.required}
                      />
                      <Label htmlFor={column.key} className="text-sm">
                        {column.label}
                        {column.required && (
                          <span className="ml-1 text-red-500">*</span>
                        )}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Data Options */}
              <div className="space-y-4">
                <Label className="text-sm font-medium">Data Options</Label>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-sm">
                        Include Request/Response Payloads
                      </Label>
                      <p className="text-muted-foreground text-xs">
                        Include full request and response bodies (increases file
                        size)
                      </p>
                    </div>
                    <Switch
                      checked={exportConfig.includePayloads}
                      onCheckedChange={(checked) =>
                        setExportConfig((prev) => ({
                          ...prev,
                          includePayloads: checked,
                        }))
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-sm">Include HTTP Headers</Label>
                      <p className="text-muted-foreground text-xs">
                        Include request and response headers
                      </p>
                    </div>
                    <Switch
                      checked={exportConfig.includeHeaders}
                      onCheckedChange={(checked) =>
                        setExportConfig((prev) => ({
                          ...prev,
                          includeHeaders: checked,
                        }))
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Size Warning */}
              {(exportConfig.includePayloads ||
                exportConfig.maxRecords > 10000) && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Large exports may take several minutes to complete and could
                    result in large file sizes. Consider using filters to reduce
                    the dataset size.
                  </AlertDescription>
                </Alert>
              )}
            </CollapsibleContent>
          </Collapsible>

          <Separator />

          {/* Export Actions */}
          <div className="flex items-center justify-between">
            <div className="text-muted-foreground text-sm">
              Ready to export {exportConfig.columns.length} columns in{" "}
              {exportConfig.format.toUpperCase()} format
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleExport}
                disabled={isExporting || exportConfig.columns.length === 0}
              >
                {isExporting ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Export
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
