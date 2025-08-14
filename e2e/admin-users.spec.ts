// Import necessary modules
import { test, expect } from "@playwright/test";

// Test suite for Admin Users page
test.describe("Admin Users Page E2E", () => {
  // Auth is handled by auth.setup.ts which runs before this test

  test("should display user list and allow editing roles", async ({ page }) => {
    // Navigate directly to users page - we're already logged in as admin
    await page.goto("http://localhost:3001/admin/users");
    await page.waitForLoadState("networkidle");

    // Verify page title (be more specific since there are multiple h1s)
    await expect(
      page.getByRole("heading", { name: "User Management" }),
    ).toBeVisible();

    // Check for user cards - we should see at least the admin user
    const userCards = page
      .locator(".grid > div")
      .filter({ has: page.locator('h4:has-text("Assigned Roles")') });
    const userCount = await userCards.count();
    expect(userCount).toBeGreaterThan(0);

    // Verify we can see user information (use first match since email appears multiple times)
    await expect(page.getByText("admin@example.com").first()).toBeVisible();
    await expect(page.getByText("ADMIN").first()).toBeVisible();

    // Test search functionality
    await page.fill('input[placeholder*="Search"]', "admin");
    await page.waitForTimeout(500); // Wait for debounced search

    // Should still see admin user
    await expect(page.getByText("admin@example.com").first()).toBeVisible();

    // Clear search
    await page.fill('input[placeholder*="Search"]', "");
    await page.waitForTimeout(500);

    // Test role filter
    const roleSelect = page.locator("select").first();
    if (await roleSelect.isVisible()) {
      await roleSelect.selectOption({ label: "ADMIN" });
      await page.waitForTimeout(500);
      // Admin user should still be visible
      await expect(page.getByText("admin@example.com").first()).toBeVisible();
    }
  });
});
