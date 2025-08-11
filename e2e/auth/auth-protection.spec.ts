import { test, expect } from "@playwright/test";
import {
  loginAsAdmin,
  loginAsUser,
  waitForPageLoad,
  takeScreenshot,
  setupAdminSession,
  setupUserSession,
  verifyDashboard,
} from "../utils/test-helpers";

test.describe("Authentication & Authorization Protection", () => {
  // Don't use the default auth state - use direct session creation
  test.use({
    storageState: undefined,
  });

  test.beforeEach(async ({ context }) => {
    // Clear authentication state before each test
    await context.clearCookies();
  });

  test.describe("Route Protection", () => {
    // Don't use the default auth state - use direct session creation
    test.use({
      storageState: undefined,
    });

    const protectedRoutes = [
      { path: "/admin/users", adminOnly: true, name: "User Management" },
      { path: "/admin/roles", adminOnly: true, name: "Role Management" },
      {
        path: "/admin/permissions",
        adminOnly: true,
        name: "Permission Management",
      },
      { path: "/settings", adminOnly: false, name: "Settings" },
      { path: "/settings/profile", adminOnly: false, name: "Profile Settings" },
    ];

    protectedRoutes.forEach((route) => {
      test(`${route.path} requires authentication`, async ({
        page,
        context,
      }) => {
        // Try to access protected route without authentication
        await page.goto(route.path);
        await waitForPageLoad(page);

        const currentUrl = page.url();

        // Should either be redirected or show authentication requirement
        if (currentUrl.includes(route.path)) {
          // Still on the route - should show auth requirement or access denied
          const authRequired = await page
            .getByText(/sign in/i)
            .or(page.getByText(/login/i))
            .or(page.getByText(/authentication required/i))
            .or(page.getByText(/not authenticated/i))
            .or(page.getByRole("button", { name: /sign in/i }))
            .isVisible()
            .catch(() => false);

          if (authRequired) {
            expect(authRequired).toBeTruthy();
          } else {
            // Check if redirected to auth page
            await page.waitForURL(/\/auth/, { timeout: 5000 }).catch(() => {});
            const finalUrl = page.url();
            expect(finalUrl).toContain("/auth");
          }
        } else {
          // Redirected away from protected route
          expect(currentUrl).not.toContain(route.path);
          // Typically redirected to auth page or home
          expect(currentUrl).toMatch(/\/(auth)?$/);
        }

        await takeScreenshot(page, `${route.path.replace(/\//g, "-")}-no-auth`);
      });

      if (route.adminOnly) {
        test(`${route.path} requires admin role`, async ({ page, context }) => {
          // Login as regular user
          await setupUserSession(context);

          // Try to access admin-only route
          await page.goto(route.path);
          await waitForPageLoad(page);

          const currentUrl = page.url();

          if (currentUrl.includes(route.path)) {
            // Still on admin route - should show access denied
            const accessDenied = await page
              .getByText(/access denied/i)
              .or(page.getByText(/not authorized/i))
              .or(page.getByText(/forbidden/i))
              .or(page.getByText(/admin only/i))
              .or(page.getByText(/insufficient permissions/i))
              .isVisible()
              .catch(() => false);

            expect(accessDenied).toBeTruthy();
          } else {
            // Redirected away from admin route
            expect(currentUrl).not.toContain("/admin");
            // Should be redirected to dashboard or error page
            expect(currentUrl).toMatch(/\/(error|unauthorized)?$/);
          }

          await takeScreenshot(
            page,
            `${route.path.replace(/\//g, "-")}-user-denied`,
          );
        });

        test(`${route.path} allows admin access`, async ({ page, context }) => {
          // Login as admin
          await setupAdminSession(context);

          // Access admin route
          await page.goto(route.path);
          await waitForPageLoad(page);

          // Should successfully access the route
          await expect(page).toHaveURL(route.path);

          // Should see the appropriate page content
          await expect(
            page.getByRole("heading", { name: route.name }),
          ).toBeVisible();

          await takeScreenshot(
            page,
            `${route.path.replace(/\//g, "-")}-admin-access`,
          );
        });
      } else {
        test(`${route.path} allows authenticated user access`, async ({
          page,
          context,
        }) => {
          // Login as regular user
          await setupUserSession(context);

          // Access user route
          await page.goto(route.path);
          await waitForPageLoad(page);

          // Should successfully access the route or see appropriate content
          const currentUrl = page.url();

          if (currentUrl.includes(route.path)) {
            // Successfully on the route or redirected to a sub-page (e.g., /settings/profile)
            expect(currentUrl).toContain(route.path);
          } else {
            // May be redirected to a more specific settings page
            expect(currentUrl).toContain("/settings");
          }

          await takeScreenshot(
            page,
            `${route.path.replace(/\//g, "-")}-user-access`,
          );
        });
      }
    });
  });

  test.describe("Session Management", () => {
    // Don't use the default auth state - use direct session creation
    test.use({
      storageState: undefined,
    });

    test("session expires appropriately", async ({ page, context }) => {
      // Login
      await setupAdminSession(context);

      // Navigate to dashboard and verify logged in
      await page.goto("/");
      await waitForPageLoad(page);
      await verifyDashboard(page);

      // Manually expire session by clearing cookies
      await context.clearCookies();

      // Try to access protected route
      await page.goto("/admin/users");
      await waitForPageLoad(page);

      // Should be redirected or show authentication requirement
      const currentUrl = page.url();
      if (currentUrl.includes("/admin/users")) {
        // Still on admin page, should show auth requirement
        const needsAuth = await page
          .getByText(/sign in/i)
          .or(page.getByText(/authentication/i))
          .isVisible()
          .catch(() => false);
        expect(needsAuth).toBeTruthy();
      } else {
        // Redirected away from admin page
        expect(currentUrl).not.toContain("/admin/users");
      }

      await takeScreenshot(page, "session-expired");
    });

    test("concurrent sessions work correctly", async ({ browser }) => {
      // Create two separate browser contexts (different sessions)
      const context1 = await browser.newContext();
      const context2 = await browser.newContext();

      const page1 = await context1.newPage();
      const page2 = await context2.newPage();

      // Set up admin session in first context
      await setupAdminSession(context1);

      // Set up user session in second context
      await setupUserSession(context2);

      // Both should maintain their respective sessions
      await page1.goto("/admin/users");
      await waitForPageLoad(page1);
      await expect(
        page1.getByRole("heading", { name: "User Management" }),
      ).toBeVisible();

      await page2.goto("/");
      await waitForPageLoad(page2);
      await verifyDashboard(page2);

      // User should not access admin pages even with admin session in different context
      await page2.goto("/admin/users");
      await waitForPageLoad(page2);

      const page2Url = page2.url();
      if (page2Url.includes("/admin/users")) {
        const accessDenied = await page2
          .getByText(/access denied/i)
          .isVisible()
          .catch(() => false);
        expect(accessDenied).toBeTruthy();
      } else {
        expect(page2Url).not.toContain("/admin/users");
      }

      await takeScreenshot(page1, "concurrent-session-admin");
      await takeScreenshot(page2, "concurrent-session-user");

      await context1.close();
      await context2.close();
    });
  });

  test.describe("Permission Boundaries", () => {
    // Don't use the default auth state - use direct session creation
    test.use({
      storageState: undefined,
    });

    test("admin cannot access non-existent admin routes", async ({
      page,
      context,
    }) => {
      await setupAdminSession(context);

      // Try to access non-existent admin routes
      const nonExistentRoutes = [
        "/admin/nonexistent",
        "/admin/secret",
        "/admin/config",
      ];

      for (const route of nonExistentRoutes) {
        await page.goto(route);
        await waitForPageLoad(page);

        // Should get 404 or be redirected
        const currentUrl = page.url();
        if (currentUrl.includes(route)) {
          // Still on the route, should show 404
          const has404 = await page
            .getByText(/404/)
            .or(page.getByText(/not found/i))
            .or(page.getByText(/page not found/i))
            .isVisible()
            .catch(() => false);
          expect(has404).toBeTruthy();
        } else {
          // Redirected away from non-existent route
          expect(currentUrl).not.toContain(route);
        }
      }

      await takeScreenshot(page, "admin-nonexistent-routes");
    });

    test("role-based navigation visibility", async ({ page, context }) => {
      // Test admin navigation
      await setupAdminSession(context);
      await page.goto("/");
      await waitForPageLoad(page);

      await expect(page.getByText("Administration")).toBeVisible();
      await expect(page.getByText("Users").first()).toBeVisible();
      await expect(page.getByText("Roles").first()).toBeVisible();
      await expect(page.getByText("Permissions").first()).toBeVisible();

      // Clear session and set up user session
      await context.clearCookies();
      await setupUserSession(context);
      await page.goto("/");
      await waitForPageLoad(page);

      // User should not see admin navigation
      const adminNav = page.getByText("Administration");
      const isAdminNavVisible = await adminNav.isVisible().catch(() => false);

      if (isAdminNavVisible) {
        // If admin nav is visible, clicking should not work
        await adminNav.click();
        await waitForPageLoad(page);

        const url = page.url();
        expect(url).not.toContain("/admin");
      }

      await takeScreenshot(page, "navigation-visibility");
    });

    test("API endpoint protection", async ({ page, request, context }) => {
      // Test that API endpoints are protected
      const apiEndpoints = [
        "/api/trpc/user.getAll",
        "/api/trpc/role.getAll",
        "/api/trpc/permission.getAll",
      ];

      for (const endpoint of apiEndpoints) {
        // Try to access API without authentication
        const response = await request.get(endpoint);

        // Should return unauthorized or redirect
        expect(response.status()).toBeGreaterThanOrEqual(400);
      }

      // Login and test with authentication
      await setupAdminSession(context);

      // Note: Testing API endpoints directly through Playwright request is limited
      // This would typically be done through the UI interactions that call these endpoints
      await page.goto("/admin/users");
      await waitForPageLoad(page);

      // If page loads successfully, API endpoints are working with proper auth
      await expect(
        page.getByRole("heading", { name: "User Management" }),
      ).toBeVisible();

      await takeScreenshot(page, "api-endpoint-protection");
    });
  });

  test.describe("Edge Cases", () => {
    // Don't use the default auth state - use direct session creation
    test.use({
      storageState: undefined,
    });

    test("direct URL access with authentication", async ({ page, context }) => {
      // Login first
      await setupAdminSession(context);

      // Directly navigate to admin page via URL
      await page.goto("/admin/users");
      await waitForPageLoad(page);

      // Should work fine
      await expect(page).toHaveURL("/admin/users");
      await expect(
        page.getByRole("heading", { name: "User Management" }),
      ).toBeVisible();

      await takeScreenshot(page, "direct-url-access");
    });

    test("page refresh maintains authentication state", async ({
      page,
      context,
    }) => {
      await setupAdminSession(context);
      await page.goto("/admin/users");
      await waitForPageLoad(page);

      // Refresh page
      await page.reload();
      await waitForPageLoad(page);

      // Should maintain access
      await expect(page).toHaveURL("/admin/users");
      await expect(
        page.getByRole("heading", { name: "User Management" }),
      ).toBeVisible();

      await takeScreenshot(page, "refresh-maintains-auth");
    });

    test("back button navigation respects authentication", async ({
      page,
      context,
    }) => {
      await setupAdminSession(context);

      // Navigate through pages
      await page.goto("/admin/users");
      await waitForPageLoad(page);

      await page.goto("/admin/roles");
      await waitForPageLoad(page);

      // Use back button
      await page.goBack();
      await waitForPageLoad(page);

      // Should still be authenticated and on users page
      await expect(page).toHaveURL("/admin/users");
      await expect(
        page.getByRole("heading", { name: "User Management" }),
      ).toBeVisible();

      await takeScreenshot(page, "back-button-navigation");
    });
  });
});
