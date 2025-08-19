import { test, expect } from "@playwright/test";

test("Admin journey: login and open Webhook dashboard", async ({ page }) => {
  await page.goto("/auth", { waitUntil: "domcontentloaded" });

  const doTestAdminLogin = async () => {
    await page.getByRole("button", { name: /Advanced: Test Logins/i }).click();
    await page
      .getByRole("button", { name: /Test Login \(albeorla - Admin\)/i })
      .click();
    await page.waitForTimeout(500);
  };

  // First attempt
  await doTestAdminLogin();

  // Wait until we are not on /auth; retry once if needed
  try {
    await page.waitForURL((url) => !url.pathname.startsWith("/auth"), {
      timeout: 20000,
    });
  } catch {
    await doTestAdminLogin();
    await page.waitForURL((url) => !url.pathname.startsWith("/auth"), {
      timeout: 20000,
    });
  }

  // Navigate to dashboard; if redirected back to /auth, log in again and retry once
  await page.goto("/admin/webhooks/dashboard", {
    waitUntil: "domcontentloaded",
  });
  if (new URL(page.url()).pathname.startsWith("/auth")) {
    await doTestAdminLogin();
    await page.waitForURL((url) => !url.pathname.startsWith("/auth"), {
      timeout: 20000,
    });
    await page.goto("/admin/webhooks/dashboard", {
      waitUntil: "domcontentloaded",
    });
  }

  await expect(
    page.getByRole("heading", { name: /Webhook Reliability Dashboard/i }),
  ).toBeVisible({ timeout: 25000 });
});
