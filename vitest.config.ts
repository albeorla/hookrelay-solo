import { defineConfig } from "vitest/config";
import { resolve } from "path";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
const dirname =
  typeof __dirname !== "undefined"
    ? __dirname
    : path.dirname(fileURLToPath(import.meta.url));

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
// This config is for backwards compatibility
// Use vitest.unit.config.ts for unit tests
// Use vitest.storybook.config.ts for storybook tests
export default defineConfig({
  test: {
    // Minimal default config - use specific configs instead
    include: [],
  },
  // Path resolution
  resolve: {
    alias: {
      "~": resolve(__dirname, "./src"),
    },
  },
});
