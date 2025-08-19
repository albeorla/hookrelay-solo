import { chromium } from "playwright";

async function main() {
  const baseURL = process.env.BASE_URL || "http://localhost:3001";
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Auth page
    await page.goto(`${baseURL}/auth`, { waitUntil: "domcontentloaded" });
    // Expand Advanced Test Logins
    await page.getByRole("button", { name: /Advanced: Test Logins/i }).click();
    // Click admin login
    await page
      .getByRole("button", { name: /Test Login \(albeorla - Admin\)/i })
      .click();

    // After login redirect home
    await page.waitForURL("**/", { timeout: 15000 });

    // Navigate to admin dashboard
    await page.goto(`${baseURL}/admin/webhooks/dashboard`, {
      waitUntil: "domcontentloaded",
    });

    // Expect the main heading
    const heading = page.getByRole("heading", {
      name: /Webhook Reliability Dashboard/i,
    });
    await heading.waitFor({ state: "visible", timeout: 20000 });

    console.log("OK: Admin dashboard verified");
    await browser.close();
    process.exit(0);
  } catch (err) {
    console.error("FAIL:", err);
    // Snapshot useful info
    try {
      console.error("Current URL:", page.url());
    } catch {}
    await page
      .screenshot({ path: "e2e-admin-check-fail.png", fullPage: true })
      .catch(() => {});
    await browser.close();
    process.exit(1);
  }
}

main();
