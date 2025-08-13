import { test, expect } from "@playwright/test";

test.describe("Starter Test Suite", () => {
  test("basic page loads", async ({ page }) => {
    // Simple test to verify the test infrastructure works
    await page.goto("/");
    await expect(page).toHaveTitle(/.*/); // Any title is fine
  });
});
