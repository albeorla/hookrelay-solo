import { test as setup, expect } from "@playwright/test";

const authFile = "e2e/.auth/user.json";

setup("authenticate as admin", async ({ page }) => {
  // Navigate to the auth page
  await page.goto("/auth");

  // Wait for the page to load
  await page.waitForLoadState("networkidle");

  // Click the albeorla admin test login button
  await page.click('button:has-text("Test Login (albeorla - Admin)")');

  // Wait for authentication to complete and redirect
  await page.waitForURL("/");

  // Verify we're authenticated by checking for admin elements
  await expect(page.locator("text=Welcome back")).toBeVisible();

  // Save the authentication state
  await page.context().storageState({ path: authFile });

  console.log("✅ Authentication setup complete - admin session saved");
});
