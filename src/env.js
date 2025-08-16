import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  /**
   * Specify your server-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars.
   */
  server: {
    AUTH_SECRET:
      process.env.NODE_ENV === "production"
        ? z.string()
        : z.string().optional(),
    AUTH_DISCORD_ID:
      process.env.NODE_ENV === "production"
        ? z.string()
        : z.string().optional(),
    AUTH_DISCORD_SECRET:
      process.env.NODE_ENV === "production"
        ? z.string()
        : z.string().optional(),
    DATABASE_URL: z.string().url(),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),

    // AWS Configuration
    AWS_REGION: z.string().default("us-east-1"),
    AWS_ACCESS_KEY_ID: z.string().optional(),
    AWS_SECRET_ACCESS_KEY: z.string().optional(),

    // AWS Service Endpoints (for LocalStack)
    AWS_DDB_ENDPOINT: z.string().optional(),
    AWS_SQS_ENDPOINT: z.string().optional(),
    AWS_S3_ENDPOINT: z.string().optional(),

    // AWS Resource Names
    AWS_DDB_ENDPOINTS_TABLE: z.string().optional(),
    AWS_DDB_DELIVERIES_TABLE: z.string().optional(),
    AWS_SQS_QUEUE_URL: z.string().optional(),
    AWS_S3_DLQ_BUCKET: z.string().optional(),
  },

  /**
   * Specify your client-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars. To expose them to the client, prefix them with
   * `NEXT_PUBLIC_`.
   */
  client: {
    // NEXT_PUBLIC_CLIENTVAR: z.string(),
  },

  /**
   * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
   * middlewares) or client-side so we need to destruct manually.
   */
  runtimeEnv: {
    AUTH_SECRET: process.env.AUTH_SECRET,
    AUTH_DISCORD_ID: process.env.AUTH_DISCORD_ID,
    AUTH_DISCORD_SECRET: process.env.AUTH_DISCORD_SECRET,
    DATABASE_URL: process.env.DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV,

    // AWS Configuration
    AWS_REGION: process.env.AWS_REGION,
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,

    // AWS Service Endpoints
    AWS_DDB_ENDPOINT: process.env.AWS_DDB_ENDPOINT,
    AWS_SQS_ENDPOINT: process.env.AWS_SQS_ENDPOINT,
    AWS_S3_ENDPOINT: process.env.AWS_S3_ENDPOINT,

    // AWS Resource Names
    AWS_DDB_ENDPOINTS_TABLE: process.env.AWS_DDB_ENDPOINTS_TABLE,
    AWS_DDB_DELIVERIES_TABLE: process.env.AWS_DDB_DELIVERIES_TABLE,
    AWS_SQS_QUEUE_URL: process.env.AWS_SQS_QUEUE_URL,
    AWS_S3_DLQ_BUCKET: process.env.AWS_S3_DLQ_BUCKET,
  },
  /**
   * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially
   * useful for Docker builds.
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  /**
   * Makes it so that empty strings are treated as undefined. `SOME_VAR: z.string()` and
   * `SOME_VAR=''` will throw an error.
   */
  emptyStringAsUndefined: true,
});
