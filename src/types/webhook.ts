// Webhook Dashboard Type Definitions

export interface WebhookEndpoint {
  id: string;
  name: string;
  url: string;
  description?: string;
  isActive: boolean;
  hmacSecret?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WebhookDelivery {
  endpointId: string;
  deliveryId: string;
  status: "pending" | "success" | "failed" | "retrying";
  timestamp: number;
  destUrl: string;
  attempt: number;
  responseStatus: number | null;
  durationMs: number | null;
  error: string | null;
  requestHeaders: string | null;
  requestBody: string | null;
  responseHeaders: string | null;
  responseBody: string | null;
}

export interface WebhookStats {
  totalDeliveries: number;
  successRate: number;
  deliveries?: {
    failed: number;
    pending: number;
    retrying: number;
  };
  queue?: {
    approximate: number;
  };
  endpoints?: {
    total: number;
  };
}

export interface DlqItem {
  key: string;
  endpointId: string;
  deliveryId: string;
  lastModified: number;
  reason: string;
  attemptCount: number;
  size: number;
  finalError: string;
  payload?: string;
}

export interface HealthAlert {
  id: string;
  type: "failure_rate" | "queue_depth" | "response_time" | "endpoint_down";
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  message: string;
  createdAt: Date;
  resolvedAt?: Date;
  acknowledged?: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
}

export interface HealthThreshold {
  id: string;
  name: string;
  description: string;
  type: "failure_rate" | "queue_depth" | "response_time" | "endpoint_down";
  threshold: number;
  timeWindow: number; // minutes
  severity: "low" | "medium" | "high" | "critical";
  enabled: boolean;
  notifications: {
    email: boolean;
    slack: boolean;
    sms: boolean;
    browser: boolean;
  };
}

export interface AnalyticsData {
  timeSeries: Array<{
    timestamp: number;
    successful: number;
    failed: number;
    total: number;
    averageResponseTime: number;
  }>;
  summary: {
    totalDeliveries: number;
    successRate: number;
    averageResponseTime: number;
    errorRate: number;
  };
  errorBreakdown: Array<{
    type: string;
    count: number;
    percentage: number;
  }>;
  responseTimeDistribution: Array<{
    bucket: string;
    count: number;
  }>;
  topFailingEndpoints: Array<{
    endpointId: string;
    url: string;
    failureRate: number;
    totalDeliveries: number;
  }>;
}

export interface BulkActionResult {
  total: number;
  successful: number;
  failed: number;
  errors?: Array<{
    id: string;
    error: string;
  }>;
  results?: Array<{
    success: boolean;
    deliveryId?: string;
    endpointId?: string;
    error?: string;
  }>;
  summary?: {
    total: number;
    succeeded: number;
    failed: number;
  };
}

export interface ExportOptions {
  format: "csv" | "json" | "pdf";
  dateRange?: {
    start: Date;
    end: Date;
  };
  filters?: {
    status?: string;
    endpointId?: string;
    search?: string;
  };
  selectedItems?: string[];
}

export interface SystemSettings {
  deliveryTimeout: number;
  maxRetries: number;
  retryDelayMs: number;
  maxPayloadSizeKb: number;
  dataRetentionDays: number;
  rateLimitPerMinute: number;
  enableHmacVerification: boolean;
  localstackEndpoints?: {
    dynamodb: string;
    sqs: string;
    s3: string;
  };
}

export interface WebhookTestPayload {
  endpointId: string;
  payload: string;
  headers?: Record<string, string>;
  customUrl?: string;
}

export interface WebhookTestResult {
  success: boolean;
  deliveryId?: string;
  responseStatus?: number;
  responseBody?: string;
  responseHeaders?: Record<string, string>;
  durationMs?: number;
  error?: string;
}

export interface PayloadValidation {
  valid: boolean;
  type: "json" | "xml" | "plain" | "unknown";
  size?: number;
  keys?: number;
  error?: string;
}

export interface PaginationData {
  items: unknown[];
  lastEvaluatedKey?: {
    endpoint_id: string;
    delivery_id: string;
  } | null;
  hasMore: boolean;
}

// SSE Message types
export interface SSEMessage {
  type: "delivery_update" | "health_alert" | "endpoint_update";
  data: unknown;
}

export interface DeliveryUpdateMessage extends SSEMessage {
  type: "delivery_update";
  data: {
    endpointId: string;
    deliveryId: string;
    status: WebhookDelivery["status"];
    timestamp: number;
  };
}

// Advanced Filter Types
export interface AdvancedFilters {
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
  hasErrors: boolean | null;
  errorPatterns: {
    patterns: string[];
    caseSensitive: boolean;
    enabled: boolean;
  };
  customFields: Array<{
    field: string;
    operator: "equals" | "contains" | "startsWith" | "endsWith" | "regex";
    value: string;
    enabled: boolean;
  }>;
}
