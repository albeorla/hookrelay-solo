import { test, expect } from "@playwright/test";

test("Admin journey: login and open Webhook dashboard", async ({ page }) => {
  // Go to auth page
  await page.goto("/auth");

  // Open Advanced Test Logins and click the admin login
  const advanced = page.getByRole("button", { name: /Advanced: Test Logins/i });
  await advanced.click();
  await page
    .getByRole("button", { name: /Test Login \(albeorla - Admin\)/i })
    .click();

  // Wait for redirect to home
  await page.waitForURL("**/", { timeout: 15000 });

  // Navigate to Webhooks Dashboard (admin-only)
  await page.goto("/admin/webhooks/dashboard");

  // Assert dashboard header is visible
  await expect(
    page.getByRole("heading", { name: /Webhook Reliability Dashboard/i }),
  ).toBeVisible({ timeout: 20000 });
});
