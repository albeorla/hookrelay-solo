import { env } from "~/env.js";

/**
 * AWS Configuration for different environments
 * Supports both LocalStack (development) and production AWS
 */

export interface AWSConfig {
  region: string;
  credentials?: {
    accessKeyId: string;
    secretAccessKey: string;
  };
  endpoints?: {
    dynamodb?: string;
    sqs?: string;
    s3?: string;
  };
  s3?: {
    forcePathStyle?: boolean;
  };
}

/**
 * Get environment-specific AWS configuration
 */
export function getAWSConfig(): AWSConfig {
  const isLocal = env.NODE_ENV === "development" || env.NODE_ENV === "test";
  const isCI = process.env.CI === "true";

  // LocalStack configuration for local development and testing
  if (isLocal && !isCI) {
    return {
      region: env.AWS_REGION ?? "us-east-1",
      credentials: {
        accessKeyId: "test",
        secretAccessKey: "test",
      },
      endpoints: {
        dynamodb: env.AWS_DDB_ENDPOINT ?? "http://localhost:4566",
        sqs: env.AWS_SQS_ENDPOINT ?? "http://localhost:4566",
        s3: env.AWS_S3_ENDPOINT ?? "http://localhost:4566",
      },
      s3: {
        forcePathStyle: true, // Required for LocalStack
      },
    };
  }

  // Production AWS configuration
  return {
    region: env.AWS_REGION ?? "us-east-1",
    // In production, credentials should come from:
    // - IAM roles (preferred)
    // - Environment variables (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
    // - AWS credential files
    // We don't set credentials here to let AWS SDK handle it automatically
  };
}

/**
 * DynamoDB configuration
 */
export function getDynamoDBConfig() {
  const config = getAWSConfig();
  return {
    region: config.region,
    ...(config.credentials && { credentials: config.credentials }),
    ...(config.endpoints?.dynamodb && { endpoint: config.endpoints.dynamodb }),
  };
}

/**
 * SQS configuration
 */
export function getSQSConfig() {
  const config = getAWSConfig();
  return {
    region: config.region,
    ...(config.credentials && { credentials: config.credentials }),
    ...(config.endpoints?.sqs && { endpoint: config.endpoints.sqs }),
  };
}

/**
 * S3 configuration
 */
export function getS3Config() {
  const config = getAWSConfig();
  return {
    region: config.region,
    ...(config.credentials && { credentials: config.credentials }),
    ...(config.endpoints?.s3 && { endpoint: config.endpoints.s3 }),
    ...(config.s3?.forcePathStyle && {
      forcePathStyle: config.s3.forcePathStyle,
    }),
  };
}

/**
 * AWS resource names configuration
 */
export const AWS_RESOURCES = {
  ENDPOINTS_TABLE: env.AWS_DDB_ENDPOINTS_TABLE ?? "hookrelay-endpoints",
  DELIVERIES_TABLE: env.AWS_DDB_DELIVERIES_TABLE ?? "hookrelay-deliveries",
  QUEUE_URL:
    env.AWS_SQS_QUEUE_URL ??
    "http://localhost:4566/000000000000/hookrelay-delivery-attempts",
  DLQ_BUCKET: env.AWS_S3_DLQ_BUCKET ?? "hookrelay-dlq",
} as const;

/**
 * Validate AWS configuration
 */
export function validateAWSConfig(): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  const config = getAWSConfig();

  if (!config.region) {
    errors.push("AWS region is required");
  }

  // In production, ensure we have proper authentication
  if (env.NODE_ENV === "production") {
    // Check if we have required environment variables or IAM role
    const hasEnvCredentials =
      process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY;
    const hasIAMRole =
      process.env.AWS_ROLE_ARN ?? process.env.AWS_WEB_IDENTITY_TOKEN_FILE;

    if (!hasEnvCredentials && !hasIAMRole) {
      // In production, this might be OK if running on EC2 with instance profile
      console.warn(
        "No explicit AWS credentials found. Relying on AWS SDK default credential chain.",
      );
    }
  }

  // Validate resource names
  if (!AWS_RESOURCES.ENDPOINTS_TABLE) {
    errors.push("DynamoDB endpoints table name is required");
  }

  if (!AWS_RESOURCES.DELIVERIES_TABLE) {
    errors.push("DynamoDB deliveries table name is required");
  }

  if (!AWS_RESOURCES.QUEUE_URL) {
    errors.push("SQS queue URL is required");
  }

  if (!AWS_RESOURCES.DLQ_BUCKET) {
    errors.push("S3 DLQ bucket name is required");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Log current AWS configuration (without sensitive data)
 */
export function logAWSConfig(): void {
  const config = getAWSConfig();
  const hasCredentials = Boolean(config.credentials);
  const hasEndpoints = Boolean(config.endpoints);

  console.log("AWS Configuration:", {
    region: config.region,
    environment: env.NODE_ENV,
    hasCredentials,
    hasEndpoints,
    endpoints: config.endpoints ? Object.keys(config.endpoints) : [],
    resources: {
      endpointsTable: AWS_RESOURCES.ENDPOINTS_TABLE,
      deliveriesTable: AWS_RESOURCES.DELIVERIES_TABLE,
      queueUrl: AWS_RESOURCES.QUEUE_URL?.includes("localhost")
        ? "LocalStack"
        : "Production",
      dlqBucket: AWS_RESOURCES.DLQ_BUCKET,
    },
  });
}
