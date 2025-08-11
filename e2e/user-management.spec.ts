import { test, expect } from "@playwright/test";
import {
  setupAdminSession,
  setupUserSession,
  navigateToAdmin,
  verifyStatsCards,
  verifyRoleBadges,
  verifyCardStyling,
  verifyDialog,
  waitForPageLoad,
  takeScreenshot,
  verifyLoadingStates,
} from "./utils/test-helpers";

test.describe("User Management - Admin Access", () => {
  // Don't use the default auth state - use direct session creation
  test.use({
    storageState: undefined,
  });

  test("admin can access user management page", async ({ page, context }) => {
    await setupAdminSession(context);
    await navigateToAdmin(page, "users");

    // Verify page loads correctly
    await expect(
      page.getByRole("heading", { name: "User Management" }),
    ).toBeVisible();
    await expect(
      page.getByText("Manage users and their role assignments"),
    ).toBeVisible();

    // Verify stats cards with enhanced styling
    await verifyStatsCards(page, [
      "Total Users",
      "Active Roles",
      "Admin Users",
    ]);

    // Verify stats cards have enhanced styling
    await verifyCardStyling(page, '[data-slot="card"]:first-child');

    // Verify user list is visible
    await expect(page.getByText("Admin User")).toBeVisible();
    await expect(page.getByText("test")).toBeVisible();
    await expect(page.getByText("albeorla")).toBeVisible();

    await takeScreenshot(page, "user-management-admin-view");
  });

  test("user management displays enhanced UI elements", async ({
    page,
    context,
  }) => {
    await setupAdminSession(context);
    await navigateToAdmin(page, "users");

    // Wait for any loading states to complete
    await verifyLoadingStates(page);

    // Verify stats cards are visible
    const statsCards = page.locator('[data-slot="card"]').first();
    await expect(statsCards).toBeVisible();

    // Verify user cards have interactive styling
    const userCards = page.locator('[data-slot="card"]').nth(3); // First user card after stats
    await expect(userCards).toBeVisible();

    // Verify role badges are visible (only check for roles that exist)
    await verifyRoleBadges(page, ["ADMIN", "USER"]);

    // Test hover effects on cards
    await userCards.hover();
    await page.waitForTimeout(200); // Allow hover animation

    await takeScreenshot(page, "user-management-enhanced-ui");
  });

  test("admin can edit user roles with enhanced dialog", async ({
    page,
    context,
  }) => {
    await setupAdminSession(context);
    await navigateToAdmin(page, "users");

    // Wait for page to load completely
    await verifyLoadingStates(page);

    // Click edit roles for first available user
    const editButton = page.getByRole("button", { name: "Edit Roles" }).first();
    await expect(editButton).toBeVisible();

    const dialog = await verifyDialog(page, "Edit Roles", "Edit User Roles");

    // Verify role checkboxes are available
    await expect(dialog.getByText("ADMIN")).toBeVisible();
    await expect(dialog.getByText("USER")).toBeVisible();
    await expect(dialog.getByText("TEST")).toBeVisible();

    // Verify form functionality
    const checkboxes = dialog.locator('input[type="checkbox"]');
    const checkboxCount = await checkboxes.count();
    expect(checkboxCount).toBeGreaterThan(0);

    // Close dialog
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).not.toBeVisible();

    await takeScreenshot(page, "user-role-edit-dialog");
  });

  test("stats cards show accurate data", async ({ page, context }) => {
    await setupAdminSession(context);
    await navigateToAdmin(page, "users");

    // Wait for data to load
    await verifyLoadingStates(page);

    // Count actual users displayed and compare with stats
    const userCards = page
      .locator('[data-slot="card"]')
      .filter({ hasText: "@" });
    const userCount = await userCards.count();

    // Get total users stat
    const totalUsersCard = page
      .locator('[data-slot="card"]')
      .filter({ hasText: "Total Users" });
    const totalUsersText = await totalUsersCard
      .locator("div")
      .filter({ hasText: /^\d+$/ })
      .first()
      .textContent();
    const displayedCount = parseInt(totalUsersText || "0");

    expect(userCount).toBe(displayedCount);

    // Verify admin users count
    const adminBadges = page
      .locator('[data-slot="badge"]')
      .filter({ hasText: "ADMIN" });
    const adminCount = await adminBadges.count();

    const adminUsersCard = page
      .locator('[data-slot="card"]')
      .filter({ hasText: "Admin Users" });
    const adminUsersText = await adminUsersCard
      .locator("div")
      .filter({ hasText: /^\d+$/ })
      .first()
      .textContent();
    const displayedAdminCount = parseInt(adminUsersText || "0");

    expect(adminCount).toBeGreaterThanOrEqual(displayedAdminCount);

    await takeScreenshot(page, "user-management-stats-verification");
  });

  test("user cards display complete information", async ({ page, context }) => {
    await setupAdminSession(context);
    await navigateToAdmin(page, "users");

    await verifyLoadingStates(page);

    // Find any user card (skip stats cards)
    const userCard = page
      .locator('[data-slot="card"]')
      .filter({ hasText: "@example.com" })
      .first();
    await expect(userCard).toBeVisible();

    // Verify user information is displayed (email should be visible)
    const emailElement = userCard.locator("text=/@example\\.com/");
    await expect(emailElement).toBeVisible();

    // Verify role badges are present
    const badges = userCard.locator('[data-slot="badge"]');
    const badgeCount = await badges.count();
    expect(badgeCount).toBeGreaterThan(0);

    // Verify edit button is present
    await expect(
      userCard.getByRole("button", { name: "Edit Roles" }),
    ).toBeVisible();

    // Verify enhanced avatar styling
    const avatar = userCard
      .locator('[data-testid="avatar"], .avatar, [role="img"]')
      .first();
    if (await avatar.isVisible()) {
      // Check for ring styling
      const hasRingStyling = await avatar.evaluate((el) => {
        return el.className.includes("ring-");
      });
      expect(hasRingStyling).toBeTruthy();
    }

    await takeScreenshot(page, "user-card-details");
  });
});

test.describe("User Management - Access Control", () => {
  // Don't use the default auth state - use direct session creation
  test.use({
    storageState: undefined,
  });

  test("non-admin cannot access user management page", async ({
    page,
    context,
  }) => {
    await setupUserSession(context);

    // Try to access user management directly
    await page.goto("/admin/users");

    // Should be redirected to dashboard or show access denied
    await waitForPageLoad(page);

    // Either redirected to dashboard or staying on page with access denied
    const currentUrl = page.url();
    if (currentUrl.includes("/admin/users")) {
      // If still on admin page, should show access denied
      await expect(
        page.getByText(/access denied/i).or(page.getByText(/not authorized/i)),
      ).toBeVisible();
    } else {
      // Should be redirected to dashboard
      await expect(page).toHaveURL("/");
    }

    await takeScreenshot(page, "user-management-access-denied");
  });

  test("non-admin user doesn't see admin navigation", async ({
    page,
    context,
  }) => {
    await setupUserSession(context);
    await page.goto("/");
    await waitForPageLoad(page);

    // Check dashboard for admin navigation
    await expect(
      page.getByRole("heading", { name: "Dashboard" }),
    ).toBeVisible();

    // Admin navigation should not be visible
    const adminNavigation = page
      .getByText("Administration")
      .or(page.getByText("User Management"));

    // This might be visible in sidebar but disabled, or completely hidden
    if (await adminNavigation.isVisible()) {
      // If visible, clicking should not work or show access denied
      await adminNavigation.click();

      // Should not navigate to admin pages
      const url = page.url();
      expect(url).not.toContain("/admin");
    }

    await takeScreenshot(page, "regular-user-dashboard");
  });
});

test.describe("User Management - UI Interactions", () => {
  // Don't use the default auth state - use direct session creation
  test.use({
    storageState: undefined,
  });

  test("card hover effects work correctly", async ({ page, context }) => {
    await setupAdminSession(context);
    await navigateToAdmin(page, "users");

    await verifyLoadingStates(page);

    // Find a user card
    const userCard = page
      .locator('[data-slot="card"]')
      .filter({ hasText: "@" })
      .first();
    await expect(userCard).toBeVisible();

    // Test hover effect
    await userCard.hover();
    await page.waitForTimeout(300); // Allow animation

    // Verify hover styling (shadow changes, scale, etc.)
    const hasHoverEffect = await userCard.evaluate((el) => {
      const computedStyle = window.getComputedStyle(el);
      return (
        computedStyle.transform !== "none" ||
        computedStyle.boxShadow.includes("rgba")
      );
    });

    expect(hasHoverEffect).toBeTruthy();

    await takeScreenshot(page, "card-hover-effects");
  });

  test("theme toggle works on user management page", async ({
    page,
    context,
  }) => {
    await setupAdminSession(context);
    await navigateToAdmin(page, "users");

    // Find theme toggle button
    const themeButton = page.getByRole("button", { name: "Toggle theme" });
    await expect(themeButton).toBeVisible();

    // Get current theme
    const html = page.locator("html");
    const initialClass = await html.getAttribute("class");

    // Toggle theme - click to open dropdown
    await themeButton.click();

    // Click on dark theme option
    await page.getByRole("menuitem", { name: "Dark" }).click();
    await page.waitForTimeout(200);

    // Verify theme changed
    const newClass = await html.getAttribute("class");
    expect(newClass).toContain("dark");

    // Verify UI elements are still visible after theme change
    await expect(
      page.getByRole("heading", { name: "User Management" }),
    ).toBeVisible();
    await verifyStatsCards(page, [
      "Total Users",
      "Active Roles",
      "Admin Users",
    ]);

    await takeScreenshot(page, "user-management-theme-toggle");
  });
});
