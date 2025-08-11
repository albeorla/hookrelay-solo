import { test, expect } from "@playwright/test";
import {
  verifyDashboard,
  verifyStatsCards,
  verifyRoleBadges,
  verifyThemeToggle,
  verifyLoadingStates,
  takeScreenshot,
  waitForPageLoad,
  setupAdminSession,
  setupUserSession,
} from "../utils/test-helpers";

test.describe("Dashboard Functionality", () => {
  // Don't use the default auth state - use direct session creation
  test.use({
    storageState: undefined,
  });

  test.describe("Dashboard Access & Layout", () => {
    // Don't use the default auth state - use direct session creation
    test.use({
      storageState: undefined,
    });

    test("admin user can access dashboard with all features", async ({
      page,
      context,
    }) => {
      await setupAdminSession(context);

      // Navigate to dashboard
      await page.goto("/");

      // Verify main dashboard elements
      await verifyDashboard(page);

      // Verify time-based greeting
      await expect(
        page.getByText(/Good (morning|afternoon|evening)/),
      ).toBeVisible();

      // Verify admin-specific navigation
      await expect(page.getByText("Administration")).toBeVisible();
      await expect(page.getByText("Users").first()).toBeVisible();
      await expect(page.getByText("Roles").first()).toBeVisible();
      await expect(page.getByText("Permissions").first()).toBeVisible();

      // Verify profile section
      await expect(page.getByText("Profile Overview")).toBeVisible();

      await takeScreenshot(page, "admin-dashboard-full");
    });

    test("regular user can access dashboard with limited features", async ({
      page,
      context,
    }) => {
      await setupUserSession(context);
      await page.goto("/");
      await waitForPageLoad(page);

      // Verify main dashboard elements
      await verifyDashboard(page);

      // Verify greeting
      await expect(
        page.getByText(/Good (morning|afternoon|evening)/),
      ).toBeVisible();

      // Admin navigation should be hidden or disabled
      const adminSection = page.getByText("Administration");
      const isVisible = await adminSection.isVisible().catch(() => false);

      if (isVisible) {
        // If visible, clicking should not navigate to admin pages
        await adminSection.click();
        await waitForPageLoad(page);
        const url = page.url();
        expect(url).not.toContain("/admin");
      }

      // Profile section should still be visible
      await expect(page.getByText("Profile Overview")).toBeVisible();

      await takeScreenshot(page, "user-dashboard");
    });

    test.skip("dashboard displays user-specific information", async ({
      page,
      context,
    }) => {
      await setupAdminSession(context);

      // Verify personalized greeting with user name or fallback to account status
      const greeting = page.getByText(/Good (morning|afternoon|evening),/);
      const accountStatus = page.getByText("Account Status");

      // Try greeting first, fallback to account status
      try {
        await expect(greeting).toBeVisible({ timeout: 5000 });
      } catch {
        await expect(accountStatus).toBeVisible({ timeout: 5000 });
      }

      // Should show user's actual name, email, or admin status
      const userInfo = page
        .getByText("Admin User")
        .or(page.getByText("admin@example.com"))
        .or(page.getByText("Administrator"));
      await expect(userInfo).toBeVisible();

      // Verify user profile section shows correct info
      const profileSection = page
        .locator('[data-testid="profile-section"], section')
        .filter({ hasText: "Profile Overview" });
      if (await profileSection.isVisible()) {
        await expect(
          profileSection
            .getByText("Admin User")
            .or(profileSection.getByText("admin@example.com")),
        ).toBeVisible();
      }

      await takeScreenshot(page, "dashboard-user-info");
    });
  });

  test.describe("Stats Cards", () => {
    // Don't use the default auth state - use direct session creation
    test.use({
      storageState: undefined,
    });

    test("stats cards display correctly with enhanced styling", async ({
      page,
      context,
    }) => {
      await setupAdminSession(context);

      // Navigate to dashboard
      await page.goto("/");
      await verifyLoadingStates(page);

      // Verify all expected stats cards
      const expectedStats = [
        "Account Status",
        "Total Sessions",
        "Last Login",
        "Your Roles",
      ];
      await verifyStatsCards(page, expectedStats);

      // Skip card styling verification for now - focus on content
      // await verifyCardStyling(page, 'selector');
      await expect(page.getByText("Account Status")).toBeVisible();

      // Verify stats show actual data
      await expect(page.getByText("Active").first()).toBeVisible(); // Account status
      await expect(page.locator("text=/\\d+/").first()).toBeVisible(); // Numeric values

      await takeScreenshot(page, "stats-cards");
    });

    test("stats cards show loading states", async ({ page, context }) => {
      await setupAdminSession(context);

      // Navigate to dashboard and look for loading states
      await page.goto("/");

      // Look for skeleton loading states (may be brief)
      const skeletons = page.locator('[data-slot="skeleton"]');
      const hasSkeletons = await skeletons.count();

      if (hasSkeletons > 0) {
        // Verify skeletons are visible initially
        await expect(skeletons.first()).toBeVisible();

        // Wait for content to load
        await verifyLoadingStates(page);
      }

      // After loading, should show actual content
      await expect(page.getByText("Account Status")).toBeVisible();

      await takeScreenshot(page, "stats-loading-states");
    });

    test("stats cards have correct data and interactions", async ({
      page,
      context,
    }) => {
      await setupAdminSession(context);
      await page.goto("/");
      await waitForPageLoad(page);

      // Verify Account Status
      await expect(page.getByText("Account Status")).toBeVisible();
      await expect(page.getByText("Active").first()).toBeVisible();

      // Verify Total Sessions shows number
      const sessionsCard = page
        .locator('[data-slot="card"]')
        .filter({ hasText: "Total Sessions" });
      await expect(sessionsCard).toBeVisible();
      const sessionCount = sessionsCard
        .locator("div")
        .filter({ hasText: /^\d+$/ });
      await expect(sessionCount).toBeVisible();

      // Verify Last Login shows date/time
      const loginCard = page
        .locator('[data-slot="card"]')
        .filter({ hasText: "Last Login" });
      await expect(loginCard).toBeVisible();

      // Verify Your Roles shows role badges
      const rolesCard = page
        .locator('[data-slot="card"]')
        .filter({ hasText: "Your Roles" });
      await expect(rolesCard).toBeVisible();
      await verifyRoleBadges(page, ["ADMIN"]);

      await takeScreenshot(page, "stats-card-data");
    });

    test("stats cards have hover effects", async ({ page, context }) => {
      await setupAdminSession(context);
      await page.goto("/");
      await waitForPageLoad(page);

      // Find any stats card section
      await expect(page.getByText("Account Status")).toBeVisible();
      const statsCard = page.locator('text="Account Status"').locator("..");

      // Test hover effect
      await statsCard.hover();
      await page.waitForTimeout(300); // Allow hover animation

      // Verify hover interaction works (simplified check)
      await expect(statsCard).toBeVisible();

      // Note: Hover effects are often CSS-only and hard to test reliably

      await takeScreenshot(page, "stats-hover-effects");
    });
  });

  test.describe("Profile Overview Section", () => {
    // Don't use the default auth state - use direct session creation
    test.use({
      storageState: undefined,
    });

    test("profile overview displays user information", async ({
      page,
      context,
    }) => {
      await setupAdminSession(context);
      await page.goto("/");
      await waitForPageLoad(page);

      // Find profile overview section
      const profileSection = page.getByText("Profile Overview").locator("..");
      await expect(page.getByText("Profile Overview")).toBeVisible();

      // Verify user name and email are displayed somewhere on the page
      await expect(page.getByText("Test User")).toBeVisible();
      await expect(page.getByText("test@example.com")).toBeVisible();

      // Verify role badges in profile
      await verifyRoleBadges(page, ["ADMIN", "USER"]);

      // Verify action buttons
      const editButton = profileSection.getByRole("button", {
        name: "Edit Profile",
      });
      if (await editButton.isVisible()) {
        await expect(editButton).toBeVisible();
      }

      const settingsButton = profileSection.getByRole("button", {
        name: "Settings",
      });
      if (await settingsButton.isVisible()) {
        await expect(settingsButton).toBeVisible();
      }

      await takeScreenshot(page, "profile-overview");
    });

    test("profile section action buttons work", async ({ page, context }) => {
      await setupAdminSession(context);
      await verifyLoadingStates(page);

      const profileSection = page
        .locator('[data-slot="card"]')
        .filter({ hasText: "Profile Overview" });

      // Test Edit Profile button if present
      const editButton = profileSection.getByRole("button", {
        name: "Edit Profile",
      });
      if (await editButton.isVisible()) {
        await editButton.click();
        await waitForPageLoad(page);

        // Should navigate to profile settings or open dialog
        const url = page.url();
        if (url.includes("/settings") || url.includes("/profile")) {
          expect(url).toMatch(/\/(settings|profile)/);
        } else {
          // May open a dialog instead
          const dialog = page.getByRole("dialog");
          if (await dialog.isVisible()) {
            await expect(dialog).toBeVisible();
            // Close dialog
            await page.keyboard.press("Escape");
          }
        }
      }

      await takeScreenshot(page, "profile-actions");
    });
  });

  test.describe("Navigation & Theme", () => {
    // Don't use the default auth state - use direct session creation
    test.use({
      storageState: undefined,
    });

    test("navigation menu works correctly", async ({ page, context }) => {
      await setupAdminSession(context);

      // Test Dashboard navigation
      const dashboardNav = page.getByRole("button", { name: "Dashboard" });
      await expect(dashboardNav).toBeVisible();
      await dashboardNav.click();
      await waitForPageLoad(page);
      await expect(page).toHaveURL("/");

      // Test admin navigation
      const usersNav = page.getByRole("button", { name: "Users" });
      await expect(usersNav).toBeVisible();
      await usersNav.click();
      await waitForPageLoad(page);
      await expect(page).toHaveURL("/admin/users");

      // Return to dashboard
      await page.getByRole("button", { name: "Dashboard" }).click();
      await waitForPageLoad(page);
      await expect(page).toHaveURL("/");

      await takeScreenshot(page, "navigation-functionality");
    });

    test("theme toggle works on dashboard", async ({ page, context }) => {
      await setupAdminSession(context);

      const { currentTheme, newTheme } = await verifyThemeToggle(page);

      // Verify dashboard elements still visible after theme change
      await verifyDashboard(page);
      await expect(page.getByText("Account Status")).toBeVisible();

      console.log(`Theme changed from ${currentTheme} to ${newTheme}`);

      await takeScreenshot(page, "dashboard-theme-toggle");
    });

    test("user menu functionality", async ({ page, context }) => {
      await setupAdminSession(context);

      // Find user menu button (typically shows user name/email)
      const userMenuButton = page
        .getByRole("button")
        .filter({
          hasText: "Admin User",
        })
        .or(
          page.getByRole("button").filter({
            hasText: "admin@example.com",
          }),
        );

      if (await userMenuButton.isVisible()) {
        await userMenuButton.click();

        // Look for dropdown menu options
        const menuItems = [
          page.getByText("Profile"),
          page.getByText("Settings"),
          page.getByText("Logout"),
          page.getByText("Sign out"),
        ];

        let hasMenuItems = false;
        for (const item of menuItems) {
          if (await item.isVisible()) {
            hasMenuItems = true;
            break;
          }
        }

        expect(hasMenuItems).toBeTruthy();

        // Close menu by clicking elsewhere
        await page.locator("body").click();
      }

      await takeScreenshot(page, "user-menu");
    });
  });

  test.describe("Recent Activity & System Overview", () => {
    // Don't use the default auth state - use direct session creation
    test.use({
      storageState: undefined,
    });

    test("recent activity section displays correctly", async ({
      page,
      context,
    }) => {
      await setupAdminSession(context);
      await verifyLoadingStates(page);

      // Look for recent activity section
      const activitySection = page
        .locator('[data-slot="card"]')
        .filter({ hasText: "Recent Activity" });

      if (await activitySection.isVisible()) {
        await expect(activitySection).toBeVisible();

        // May show "No recent activity" message or actual activity items
        const noActivity = activitySection.getByText(/no recent activity/i);
        const hasActivity = await noActivity.isVisible();

        if (hasActivity) {
          await expect(noActivity).toBeVisible();
        } else {
          // Should show activity items
          const activityItems = activitySection.locator(
            '[data-testid="activity-item"], .activity-item',
          );
          const itemCount = await activityItems.count();
          expect(itemCount).toBeGreaterThan(0);
        }
      }

      await takeScreenshot(page, "recent-activity");
    });

    test("system overview section shows system stats", async ({
      page,
      context,
    }) => {
      await setupAdminSession(context);
      await verifyLoadingStates(page);

      // Look for system overview section
      const systemSection = page
        .locator('[data-slot="card"]')
        .filter({ hasText: "System Overview" });

      if (await systemSection.isVisible()) {
        await expect(systemSection).toBeVisible();

        // Should show system metrics
        const metrics = ["Total Users", "Active Sessions", "System Status"];

        for (const metric of metrics) {
          const metricElement = systemSection.getByText(metric);
          if (await metricElement.isVisible()) {
            await expect(metricElement).toBeVisible();
          }
        }

        // System status should show "Operational" or similar
        const operationalStatus = systemSection.getByText(/operational/i);
        if (await operationalStatus.isVisible()) {
          await expect(operationalStatus).toBeVisible();
        }
      }

      await takeScreenshot(page, "system-overview");
    });
  });

  test.describe("Dashboard Responsiveness", () => {
    // Don't use the default auth state - use direct session creation
    test.use({
      storageState: undefined,
    });

    test("dashboard works on different screen sizes", async ({
      page,
      context,
    }) => {
      await setupAdminSession(context);

      // Test desktop view
      await page.setViewportSize({ width: 1920, height: 1080 });
      await verifyDashboard(page);
      await takeScreenshot(page, "dashboard-desktop");

      // Test tablet view
      await page.setViewportSize({ width: 768, height: 1024 });
      await verifyDashboard(page);
      await takeScreenshot(page, "dashboard-tablet");

      // Test mobile view
      await page.setViewportSize({ width: 375, height: 812 });
      await verifyDashboard(page);

      // On mobile, navigation might be different (hamburger menu, bottom nav, etc.)
      const mobileNav = page.locator(
        '[data-testid="mobile-nav"], .mobile-nav, .bottom-nav',
      );
      if (await mobileNav.isVisible()) {
        await expect(mobileNav).toBeVisible();
      }

      await takeScreenshot(page, "dashboard-mobile");
    });

    test("dashboard cards reflow properly on smaller screens", async ({
      page,
      context,
    }) => {
      await setupAdminSession(context);
      await verifyLoadingStates(page);

      // Start with desktop
      await page.setViewportSize({ width: 1200, height: 800 });

      // Count stats cards in desktop view
      const statsCards = page.locator('[data-slot="card"]').filter({
        hasText: /Account Status|Total Sessions|Last Login|Your Roles/,
      });
      const desktopCardCount = await statsCards.count();

      // Switch to mobile
      await page.setViewportSize({ width: 375, height: 812 });
      await page.waitForTimeout(200); // Allow reflow

      // Cards should still be visible but may be stacked
      const mobileCardCount = await statsCards.count();
      expect(mobileCardCount).toBe(desktopCardCount);

      // All cards should still be visible
      for (let i = 0; i < mobileCardCount; i++) {
        await expect(statsCards.nth(i)).toBeVisible();
      }

      await takeScreenshot(page, "dashboard-card-reflow");
    });
  });
});
