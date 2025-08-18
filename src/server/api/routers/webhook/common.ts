import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { SQSClient } from "@aws-sdk/client-sqs";
import { S3Client } from "@aws-sdk/client-s3";
import {
  getDynamoDBConfig,
  getSQSConfig,
  getS3Config,
  AWS_RESOURCES,
  validateAWSConfig,
  logAWSConfig,
} from "~/config/aws";

// Validate AWS configuration on startup
const configValidation = validateAWSConfig();
if (!configValidation.isValid) {
  console.error("AWS Configuration Errors:", configValidation.errors);
  throw new Error("Invalid AWS configuration. Check environment variables.");
}

// Log current configuration (without sensitive data)
logAWSConfig();

// Initialize AWS clients with environment-specific configuration
export const dynamoDb = new DynamoDBClient(getDynamoDBConfig());
export const sqs = new SQSClient(getSQSConfig());
export const s3 = new S3Client(getS3Config());

// Use configured resource names
export const ENDPOINTS_TABLE = AWS_RESOURCES.ENDPOINTS_TABLE;
export const DELIVERIES_TABLE = AWS_RESOURCES.DELIVERIES_TABLE;
export const QUEUE_URL = AWS_RESOURCES.QUEUE_URL;
export const DLQ_BUCKET = AWS_RESOURCES.DLQ_BUCKET;

// Delivery status types
export type DeliveryStatus = "pending" | "success" | "failed" | "retrying";

// Enhanced delivery record structure
export interface DeliveryRecord {
  endpoint_id: string;
  delivery_id: string;
  status: DeliveryStatus;
  timestamp: number;
  dest_url: string;
  attempt: number;
  request_headers?: Record<string, string>;
  request_body?: string;
  response_status?: number;
  response_headers?: Record<string, string>;
  response_body?: string;
  duration_ms?: number;
  error?: string;
  retry_at?: number;
}

// Helper function to format data as CSV
export function formatAsCSV<T extends Record<string, unknown>>(
  data: T[],
  columns: Array<keyof T & string>,
): string {
  if (data.length === 0) return "";

  const header = columns.join(",");
  const rows = data.map((row) => {
    return columns
      .map((col) => {
        const value = row[col];
        if (value === null || value === undefined) return "";

        if (typeof value === "object") {
          return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
        }

        const stringValue = String(value);
        if (
          stringValue.includes(",") ||
          stringValue.includes("\n") ||
          stringValue.includes('"')
        ) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }

        return stringValue;
      })
      .join(",");
  });

  return [header, ...rows].join("\n");
}
