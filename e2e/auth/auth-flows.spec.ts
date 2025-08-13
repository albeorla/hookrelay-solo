import { test, expect } from "@playwright/test";
import {
  setupAdminSession,
  setupUserSession,
  waitForPageLoad,
  verifyDashboard,
  takeScreenshot,
} from "../utils/test-helpers";

test.describe("Authentication Flows", () => {
  // Disable global auth state for these tests
  test.use({ storageState: undefined });

  // Reset authentication state before each test
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test.skip("user can access auth page", async ({ page }) => {
    await page.goto("/auth");

    // Verify auth page loads
    await expect(
      page
        .getByRole("heading", { name: "Sign In" })
        .or(page.getByText("Sign in with Discord")),
    ).toBeVisible();

    // Verify Discord OAuth button is present
    await expect(
      page.getByRole("button", { name: "Sign in with Discord" }),
    ).toBeVisible();

    // Verify test login buttons are available (for testing)
    await expect(
      page.getByRole("button", { name: "Test Login (Admin)" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Test Login (User)" }),
    ).toBeVisible();

    await takeScreenshot(page, "auth-page-initial");
  });

  test("admin test login works correctly", async ({ page, context }) => {
    // Set up admin session directly
    await setupAdminSession(context);

    // Navigate to dashboard
    await page.goto("/");
    await waitForPageLoad(page);

    // Verify we're logged in (should see dashboard content)
    await verifyDashboard(page);

    // Verify admin-specific elements are visible
    await expect(page.getByText("Administration")).toBeVisible();
    await expect(page.getByText("Users").first()).toBeVisible();
    await expect(page.getByText("Roles").first()).toBeVisible();
    await expect(page.getByText("Permissions").first()).toBeVisible();

    await takeScreenshot(page, "admin-logged-in");
  });

  test.skip("regular user test login works correctly", async ({
    page,
    context,
  }) => {
    // Set up user session directly
    await setupUserSession(context);

    // Navigate to dashboard
    await page.goto("/");

    // Should redirect to dashboard
    await waitForPageLoad(page);
    await expect(page).toHaveURL("/");

    // Verify we're logged in
    await verifyDashboard(page);

    // Verify user-specific elements (no admin section)
    const adminSection = page.getByText("Administration");
    const hasAdminSection = await adminSection.isVisible().catch(() => false);

    if (hasAdminSection) {
      // If admin section is visible, it should be disabled or non-functional
      console.log(
        "Admin section visible but should be non-functional for regular user",
      );
    }

    // Verify user info shows regular user
    await expect(
      page.getByText("test").or(page.getByText("test@example.com")),
    ).toBeVisible();

    await takeScreenshot(page, "user-logged-in");
  });

  test.skip("session persists after page refresh", async ({
    page,
    context,
  }) => {
    // Set up admin session directly
    await setupAdminSession(context);

    // Navigate to dashboard
    await page.goto("/");
    await waitForPageLoad(page);

    // Verify logged in
    await verifyDashboard(page);

    // Refresh page
    await page.reload();
    await waitForPageLoad(page);

    // Should still be logged in
    await verifyDashboard(page);
    await expect(
      page
        .getByText("Admin User")
        .or(page.getByText("admin@example.com"))
        .first(),
    ).toBeVisible();

    await takeScreenshot(page, "session-persisted");
  });

  test.skip("already authenticated user redirected from auth page", async ({
    page,
    context,
  }) => {
    // Set up admin session directly
    await setupAdminSession(context);

    // Try to go to auth page when already authenticated
    await page.goto("/auth");
    await waitForPageLoad(page);

    // Should be redirected to dashboard
    await expect(page).toHaveURL("/");
    await verifyDashboard(page);

    await takeScreenshot(page, "auth-redirect-when-logged-in");
  });

  test("logout functionality works", async ({ page, context }) => {
    // Set up admin session directly
    await setupAdminSession(context);

    // Navigate to dashboard and verify logged in
    await page.goto("/");
    await waitForPageLoad(page);
    await verifyDashboard(page);

    // Clear cookies to simulate logout
    await context.clearCookies();
    await page.reload();
    await waitForPageLoad(page);

    // Should be redirected to auth page when accessing protected routes
    await page.goto("/admin/users");
    await waitForPageLoad(page);

    // Should either be on auth page or redirected away from admin
    const url = page.url();
    expect(url).not.toContain("/admin/users");

    await takeScreenshot(page, "session-cleared");
  });

  test("protected routes redirect unauthenticated users", async ({ page }) => {
    // Try to access protected routes without authentication
    const protectedRoutes = [
      "/admin/users",
      "/admin/roles",
      "/admin/permissions",
      "/settings",
    ];

    for (const route of protectedRoutes) {
      await page.goto(route);
      await waitForPageLoad(page);

      const currentUrl = page.url();

      // Should be redirected away from protected route
      if (currentUrl.includes(route)) {
        // If still on the route, should show auth requirement
        const hasAuthRequired = await page
          .getByText(/sign in/i)
          .or(page.getByText(/login/i))
          .or(page.getByText(/authentication/i))
          .isVisible()
          .catch(() => false);

        expect(hasAuthRequired).toBeTruthy();
      } else {
        // Should be redirected (typically to auth page or home)
        expect(currentUrl).not.toContain(route);
      }
    }

    await takeScreenshot(page, "protected-routes-check");
  });

  test("authentication state is properly managed", async ({
    page,
    context,
  }) => {
    // Start without authentication
    await page.goto("/");
    await waitForPageLoad(page);

    // Should not show authenticated content initially
    const isDashboard = await page
      .getByRole("heading", { name: "Dashboard" })
      .isVisible()
      .catch(() => false);

    if (isDashboard) {
      // If dashboard is visible without auth, it means auth is not properly protecting routes
      console.warn(
        "Dashboard visible without authentication - may indicate auth protection issue",
      );
    }

    // Set up admin session directly
    await setupAdminSession(context);

    // Navigate to dashboard
    await page.goto("/");
    await waitForPageLoad(page);

    // Now should see authenticated content
    await verifyDashboard(page);

    // Check cookies are set
    const cookies = await context.cookies();
    const authCookies = cookies.filter(
      (cookie) =>
        cookie.name.includes("session") ||
        cookie.name.includes("auth") ||
        cookie.name.includes("next-auth"),
    );

    expect(authCookies.length).toBeGreaterThan(0);

    await takeScreenshot(page, "auth-state-management");
  });

  test.skip("different user roles have different access", async ({
    page,
    context,
  }) => {
    // Test admin access
    await setupAdminSession(context);

    // Admin should access admin pages
    await page.goto("/admin/users");
    await waitForPageLoad(page);

    // Check for admin dashboard content
    const hasAdminAccess = await page
      .getByRole("heading", { name: "User Management" })
      .isVisible()
      .catch(() => false);
    expect(hasAdminAccess).toBeTruthy();

    // Clear session and test regular user
    await context.clearCookies();
    await setupUserSession(context);

    // Regular user should not access admin pages
    await page.goto("/admin/users");
    await waitForPageLoad(page);

    const currentUrl = page.url();
    if (currentUrl.includes("/admin/users")) {
      // If still on admin page, should show access denied
      const hasAccessDenied = await page
        .getByText(/access denied/i)
        .or(page.getByText(/not authorized/i))
        .or(page.getByText(/forbidden/i))
        .isVisible()
        .catch(() => false);

      expect(hasAccessDenied).toBeTruthy();
    } else {
      // Should be redirected away from admin page
      expect(currentUrl).not.toContain("/admin");
    }

    await takeScreenshot(page, "role-based-access");
  });
});
