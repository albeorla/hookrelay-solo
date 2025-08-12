import dotenvFlow from "dotenv-flow";

dotenvFlow.config({ silent: true });

import { env } from "~/env";

export const app = {
  nodeEnv: env.NODE_ENV,
  port: (() => {
    const portStr = process.env.PORT;
    const port = parseInt(portStr ?? "", 10);
    return Number.isFinite(port) && port > 0 ? port : 3000;
  })(),
};

export const auth = {
  secret: env.AUTH_SECRET,
  discord: {
    id: env.AUTH_DISCORD_ID,
    secret: env.AUTH_DISCORD_SECRET,
  },
  enableTestAuth: process.env.ENABLE_TEST_AUTH === "true",
};

export const database = {
  url: env.DATABASE_URL,
};

export const ci = {
  isCI: process.env.CI === "true",
};

export const test = {
  verboseLogs: process.env.VERBOSE_TEST_LOGS === "true",
  logLevel: (process.env.LOG_LEVEL ?? "INFO").toUpperCase(),
};

export const modules = {
  enabled: process.env.MODULES_ENABLED !== "false", // Enable by default
  healthCheckInterval: parseInt(
    process.env.MODULE_HEALTH_CHECK_INTERVAL ?? "60000",
    10,
  ), // 1 minute
  operationTimeout: parseInt(
    process.env.MODULE_OPERATION_TIMEOUT ?? "30000",
    10,
  ), // 30 seconds
  enableMetrics: process.env.MODULE_METRICS_ENABLED !== "false", // Enable by default
  maxConcurrency: parseInt(process.env.MODULE_MAX_CONCURRENCY ?? "5", 10),
  rollbackOnFailure: process.env.MODULE_ROLLBACK_ON_FAILURE !== "false", // Enable by default
};

export const config = { app, auth, database, ci, test, modules };
export default config;
export type AppConfig = typeof config;
