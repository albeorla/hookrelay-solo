import { test, expect } from "@playwright/test";

test.describe("Authentication Flow", () => {
  test("should show auth page with test login options", async ({ page }) => {
    await page.goto("/auth");

    // Check that the auth page loads
    await expect(page.locator("text=Welcome")).toBeVisible();
    await expect(
      page.locator("text=Sign in to access your dashboard"),
    ).toBeVisible();

    // Check that Discord login is available
    await expect(
      page.locator('button:has-text("Sign in with Discord")'),
    ).toBeVisible();

    // Check that test login buttons are visible (when enabled)
    await expect(
      page.locator('button:has-text("Test Login (Admin)")'),
    ).toBeVisible();
    await expect(
      page.locator('button:has-text("Test Login (User)")'),
    ).toBeVisible();
    await expect(
      page.locator('button:has-text("Test Login (albeorla - Admin)")'),
    ).toBeVisible();
  });

  test("should authenticate with albeorla admin account", async ({ page }) => {
    await page.goto("/auth");

    // Click the albeorla admin test login
    await page.click('button:has-text("Test Login (albeorla - Admin)")');

    // Should redirect to dashboard after successful auth
    await page.waitForURL("/");

    // Verify we're on the dashboard
    await expect(page.locator("text=Welcome back")).toBeVisible();

    // Check that admin features are accessible
    await expect(page.locator('a[href="/admin"]')).toBeVisible();
  });

  test("should authenticate with regular admin account", async ({ page }) => {
    await page.goto("/auth");

    // Click the regular admin test login
    await page.click('button:has-text("Test Login (Admin)")');

    // Should redirect to dashboard after successful auth
    await page.waitForURL("/");

    // Verify we're on the dashboard
    await expect(page.locator("text=Welcome back")).toBeVisible();
  });

  test("should authenticate with regular user account", async ({ page }) => {
    await page.goto("/auth");

    // Click the regular user test login
    await page.click('button:has-text("Test Login (User)")');

    // Should redirect to dashboard after successful auth
    await page.waitForURL("/");

    // Verify we're on the dashboard
    await expect(page.locator("text=Welcome back")).toBeVisible();

    // Regular users shouldn't see admin links
    await expect(page.locator('a[href="/admin"]')).not.toBeVisible();
  });

  test("should redirect authenticated users away from auth page", async ({
    page,
  }) => {
    // First authenticate
    await page.goto("/auth");
    await page.click('button:has-text("Test Login (albeorla - Admin)")');
    await page.waitForURL("/");

    // Now try to go back to auth page
    await page.goto("/auth");

    // Should be redirected back to dashboard
    await page.waitForURL("/");
    await expect(page.locator("text=Welcome back")).toBeVisible();
  });
});
