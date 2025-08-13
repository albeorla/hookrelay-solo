import { test as setup } from "@playwright/test";
import { sessionPool } from "./utils/session-pool";
import { checkDatabase } from "./setup/check-database";
import { logger } from "./utils/logger";

const authFile = "e2e/.auth/user.json";

setup("authenticate", async ({ page, context }) => {
  logger.info("Starting automated authentication setup...");

  // Check database connection first
  logger.debug("Checking database connection...");
  const dbReady = await checkDatabase();

  if (!dbReady) {
    throw new Error(
      "Database is not available. Please ensure the database is running before running tests.",
    );
  }

  try {
    // Use session pool for better performance and reduced logging
    logger.authOperation("Setting up authentication with session pool");
    const sessionData = await sessionPool.getSession("USER");

    // Set the session cookie
    await context.addCookies([
      {
        name: "next-auth.session-token",
        value: sessionData.sessionToken,
        domain: "localhost",
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
        expires: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60, // 30 days
      },
      // Also set authjs cookie name (v5)
      {
        name: "authjs.session-token",
        value: sessionData.sessionToken,
        domain: "localhost",
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
        expires: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60, // 30 days
      },
    ]);

    // Navigate to home page to verify
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Verify we're logged in by checking for the dashboard greeting or key dashboard elements
    const greetingText = await page.locator(
      "text=/Good (morning|afternoon|evening)/i",
    );
    const dashboardHeading = await page.locator("h1");
    const accountStatusCard = await page.locator("text=Account Status");
    const profileOverviewCard = await page.locator("text=Profile Overview");

    const isGreetingVisible = await greetingText
      .isVisible({ timeout: 10000 })
      .catch(() => false);
    const isAccountStatusVisible = await accountStatusCard
      .isVisible({ timeout: 10000 })
      .catch(() => false);
    const isProfileOverviewVisible = await profileOverviewCard
      .isVisible({ timeout: 10000 })
      .catch(() => false);

    if (
      !isGreetingVisible &&
      !isAccountStatusVisible &&
      !isProfileOverviewVisible
    ) {
      // Debug information
      logger.debug("Page URL:", page.url());
      logger.error("Auth verification failed. Debug info:");
      logger.debug("- Session token created:", sessionData.sessionToken);
      logger.debug("- User email:", sessionData.userEmail);

      // Check page title and heading
      const pageTitle = await page.title();
      const headingText = await dashboardHeading
        .textContent()
        .catch(() => null);
      logger.debug("- Page title:", pageTitle);
      logger.debug("- Page heading:", headingText);

      // Check if there's an error on the page
      const errorText = await page
        .locator("text=/error/i")
        .textContent()
        .catch(() => null);
      if (errorText) {
        logger.error("- Error on page:", errorText);
      }

      throw new Error(
        "Failed to verify authentication - Dashboard elements not found",
      );
    }

    logger.info("✅ Authentication successful!");
    logger.info("✅ User:", sessionData.userEmail);

    // Save authentication state
    await context.storageState({ path: authFile });
    logger.info("✅ Authentication state saved for reuse in tests");
  } catch (error) {
    logger.error("❌ Authentication setup failed:", error);
    throw error;
  }
});
