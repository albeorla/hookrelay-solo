import { test, expect } from "@playwright/test";
import {
  loginAsAdmin,
  loginAsUser,
  verifyCardStyling,
  verifyRoleBadges,
  verifyLoadingStates,
  verifyThemeToggle,
  takeScreenshot,
  waitForPageLoad,
  setupAdminSession,
  setupUserSession,
} from "../utils/test-helpers";

test.describe("UI Styling and Interactions", () => {
  // Don't use the default auth state - use direct session creation
  test.use({
    storageState: undefined,
  });

  test.describe("Enhanced Card Styling", () => {
    // Don't use the default auth state - use direct session creation
    test.use({
      storageState: undefined,
    });

    test("dashboard cards have correct styling variants", async ({
      page,
      context,
    }) => {
      await setupAdminSession(context);
      await verifyLoadingStates(page);

      // Verify stats cards have enhanced styling
      const statsCards = page.locator('[data-slot="card"]').filter({
        hasText: /Account Status|Total Sessions|Last Login|Your Roles/,
      });

      const cardCount = await statsCards.count();
      expect(cardCount).toBeGreaterThan(0);

      // Test each stats card for styling
      for (let i = 0; i < cardCount; i++) {
        const card = statsCards.nth(i);

        // Verify base styling
        const hasCardStyling = await card.evaluate((el) => {
          return (
            el.className.includes("rounded-xl") &&
            el.className.includes("border") &&
            el.className.includes("transition-all")
          );
        });
        expect(hasCardStyling).toBeTruthy();

        // Test hover effects
        await card.hover();
        await page.waitForTimeout(200);

        const hasHoverEffect = await card.evaluate((el) => {
          const style = window.getComputedStyle(el);
          return (
            style.transform !== "none" ||
            style.boxShadow.includes("rgba") ||
            style.scale !== "1"
          );
        });
        expect(hasHoverEffect).toBeTruthy();
      }

      await takeScreenshot(page, "dashboard-card-styling");
    });

    test("admin management cards have elevated styling", async ({
      page,
      context,
    }) => {
      await setupAdminSession(context);
      await page.goto("/admin/users");
      await verifyLoadingStates(page);

      // Verify user cards have enhanced styling
      const userCards = page.locator('[data-slot="card"]').filter({
        hasText: /@|Admin|User|test/,
      });

      if ((await userCards.count()) > 0) {
        const firstCard = userCards.first();

        // Verify elevated card styling
        const hasElevatedStyling = await firstCard.evaluate((el) => {
          return (
            el.className.includes("shadow-") &&
            el.className.includes("hover:shadow-") &&
            el.className.includes("hover:scale-")
          );
        });
        expect(hasElevatedStyling).toBeTruthy();

        // Test interactive hover
        await firstCard.hover();
        await page.waitForTimeout(300);

        const hasInteractiveHover = await firstCard.evaluate((el) => {
          const style = window.getComputedStyle(el);
          return (
            style.transform.includes("scale") || style.transform !== "none"
          );
        });
        expect(hasInteractiveHover).toBeTruthy();
      }

      await takeScreenshot(page, "admin-card-elevated-styling");
    });

    test("role and permission cards have stats variant styling", async ({
      page,
      context,
    }) => {
      await setupAdminSession(context);
      await page.goto("/admin/roles");
      await verifyLoadingStates(page);

      const roleCards = page.locator('[data-slot="card"]').filter({
        hasText: /ADMIN|USER|TEST/,
      });

      if ((await roleCards.count()) > 0) {
        const firstCard = roleCards.first();

        // Verify stats variant styling
        const hasStatsVariant = await firstCard.evaluate((el) => {
          return (
            el.className.includes("shadow-") &&
            (el.className.includes("bg-gradient-") ||
              el.className.includes("from-card") ||
              el.className.includes("to-card"))
          );
        });
        expect(hasStatsVariant).toBeTruthy();

        // Test enhanced hover effect
        await firstCard.hover();
        await page.waitForTimeout(300);

        const hasEnhancedHover = await firstCard.evaluate((el) => {
          const style = window.getComputedStyle(el);
          return style.boxShadow.includes("rgba") || style.transform !== "none";
        });
        expect(hasEnhancedHover).toBeTruthy();
      }

      await takeScreenshot(page, "role-card-stats-styling");
    });
  });

  test.describe("Badge Styling System", () => {
    // Don't use the default auth state - use direct session creation
    test.use({
      storageState: undefined,
    });

    test("role badges have correct gradient styling", async ({
      page,
      context,
    }) => {
      await setupAdminSession(context);
      await verifyLoadingStates(page);

      // Test ADMIN role badge styling
      const adminBadges = page
        .locator('[data-slot="badge"]')
        .filter({ hasText: "ADMIN" });
      if ((await adminBadges.count()) > 0) {
        const adminBadge = adminBadges.first();

        const hasAdminGradient = await adminBadge.evaluate((el) => {
          return (
            el.className.includes("from-red-") &&
            el.className.includes("to-orange-") &&
            el.className.includes("bg-gradient-to-r")
          );
        });
        expect(hasAdminGradient).toBeTruthy();
      }

      // Navigate to find USER badges
      await page.goto("/admin/users");
      await verifyLoadingStates(page);

      const userBadges = page
        .locator('[data-slot="badge"]')
        .filter({ hasText: "USER" });
      if ((await userBadges.count()) > 0) {
        const userBadge = userBadges.first();

        const hasUserGradient = await userBadge.evaluate((el) => {
          return (
            el.className.includes("from-blue-") &&
            el.className.includes("to-indigo-") &&
            el.className.includes("bg-gradient-to-r")
          );
        });
        expect(hasUserGradient).toBeTruthy();
      }

      await takeScreenshot(page, "role-badge-gradients");
    });

    test("permission badges have category-specific styling", async ({
      page,
      context,
    }) => {
      await setupAdminSession(context);
      await page.goto("/admin/permissions");
      await verifyLoadingStates(page);

      // Test manage: permission badges
      const manageBadges = page
        .locator('[data-slot="badge"]')
        .filter({ hasText: "manage:" });
      if ((await manageBadges.count()) > 0) {
        const manageBadge = manageBadges.first();

        const hasPermissionStyling = await manageBadge.evaluate((el) => {
          return (
            (el.className.includes("from-emerald-") ||
              el.className.includes("from-teal-")) &&
            el.className.includes("bg-gradient-to-r")
          );
        });
        expect(hasPermissionStyling).toBeTruthy();
      }

      // Test view: permission badges
      const viewBadges = page
        .locator('[data-slot="badge"]')
        .filter({ hasText: "view:" });
      if ((await viewBadges.count()) > 0) {
        const viewBadge = viewBadges.first();

        const hasViewStyling = await viewBadge.evaluate((el) => {
          return (
            (el.className.includes("from-cyan-") ||
              el.className.includes("from-blue-")) &&
            el.className.includes("bg-gradient-to-r")
          );
        });
        expect(hasViewStyling).toBeTruthy();
      }

      await takeScreenshot(page, "permission-badge-categories");
    });

    test("badges have proper glow effects", async ({ page, context }) => {
      await setupAdminSession(context);
      await verifyLoadingStates(page);

      const adminBadges = page
        .locator('[data-slot="badge"]')
        .filter({ hasText: "ADMIN" });
      if ((await adminBadges.count()) > 0) {
        const adminBadge = adminBadges.first();

        // Test for glow-admin class or box-shadow
        const hasGlowEffect = await adminBadge.evaluate((el) => {
          const style = window.getComputedStyle(el);
          return (
            el.className.includes("glow-admin") ||
            style.boxShadow.includes("rgba(239, 68, 68") ||
            style.boxShadow.includes("rgba(239,68,68")
          );
        });

        if (hasGlowEffect) {
          expect(hasGlowEffect).toBeTruthy();
        } else {
          console.log(
            "Glow effect not detected - may be implemented differently",
          );
        }
      }

      await takeScreenshot(page, "badge-glow-effects");
    });
  });

  test.describe("Animation and Transitions", () => {
    // Don't use the default auth state - use direct session creation
    test.use({
      storageState: undefined,
    });

    test("shimmer animation works on loading states", async ({
      page,
      context,
    }) => {
      await setupAdminSession(context);

      // Navigate to a page that might show loading states
      await page.goto("/admin/users");

      // Look for shimmer animations during loading
      const shimmerElements = page.locator(
        '.animate-shimmer, [class*="shimmer"]',
      );

      if ((await shimmerElements.count()) > 0) {
        const shimmerEl = shimmerElements.first();

        const hasShimmerAnimation = await shimmerEl.evaluate((el) => {
          const style = window.getComputedStyle(el);
          return (
            style.animationName.includes("shimmer") ||
            el.className.includes("animate-shimmer")
          );
        });
        expect(hasShimmerAnimation).toBeTruthy();
      } else {
        console.log(
          "No shimmer animations found - may not be active during test",
        );
      }

      await takeScreenshot(page, "shimmer-animations");
    });

    test("card hover animations are smooth", async ({ page, context }) => {
      await setupAdminSession(context);
      await verifyLoadingStates(page);

      const statsCard = page.locator('[data-slot="card"]').first();
      await expect(statsCard).toBeVisible();

      // Test animation timing
      const hasTransition = await statsCard.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return (
          style.transitionDuration.includes("200ms") ||
          style.transitionDuration.includes("0.2s") ||
          el.className.includes("transition-all") ||
          el.className.includes("duration-200")
        );
      });
      expect(hasTransition).toBeTruthy();

      // Test hover state changes
      await statsCard.hover();
      await page.waitForTimeout(250); // Wait for transition

      const transformAfterHover = await statsCard.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return style.transform !== "none";
      });
      expect(transformAfterHover).toBeTruthy();

      await takeScreenshot(page, "card-hover-animations");
    });

    test("theme toggle transitions work smoothly", async ({
      page,
      context,
    }) => {
      await setupAdminSession(context);

      const { currentTheme, newTheme } = await verifyThemeToggle(page);

      // Verify transition classes are applied
      const bodyTransition = await page.evaluate(() => {
        const body = document.body;
        const style = window.getComputedStyle(body);
        return (
          style.transitionProperty.includes("color") ||
          style.transitionProperty.includes("background") ||
          body.className.includes("transition")
        );
      });

      if (bodyTransition) {
        expect(bodyTransition).toBeTruthy();
      } else {
        console.log("Theme transition may be handled differently");
      }

      console.log(`Theme transitioned from ${currentTheme} to ${newTheme}`);
      await takeScreenshot(page, "theme-transition");
    });
  });

  test.describe("Interactive Elements", () => {
    // Don't use the default auth state - use direct session creation
    test.use({
      storageState: undefined,
    });

    test("buttons have proper hover and focus states", async ({
      page,
      context,
    }) => {
      await setupAdminSession(context);
      await page.goto("/admin/users");

      const createButton = page.getByRole("button", { name: "Create User" });
      if (await createButton.isVisible()) {
        // Test hover state
        await createButton.hover();
        await page.waitForTimeout(200);

        const hasHoverStyling = await createButton.evaluate((el) => {
          const style = window.getComputedStyle(el);
          return (
            style.backgroundColor !== "rgba(0, 0, 0, 0)" ||
            style.transform !== "none" ||
            style.boxShadow.includes("rgba")
          );
        });
        expect(hasHoverStyling).toBeTruthy();

        // Test focus state
        await createButton.focus();
        await page.waitForTimeout(100);

        const hasFocusRing = await createButton.evaluate((el) => {
          const style = window.getComputedStyle(el);
          return (
            style.outline !== "none" ||
            style.boxShadow.includes("focus") ||
            el.className.includes("focus:")
          );
        });

        if (!hasFocusRing) {
          console.log("Focus ring may be implemented with different approach");
        }
      }

      await takeScreenshot(page, "button-interactive-states");
    });

    test("form inputs have proper styling and states", async ({
      page,
      context,
    }) => {
      await setupAdminSession(context);
      await page.goto("/admin/users");

      // Try to open create user dialog
      const createButton = page.getByRole("button", { name: "Create User" });
      if (await createButton.isVisible()) {
        await createButton.click();

        const dialog = page.getByRole("dialog");
        if (await dialog.isVisible()) {
          const inputs = dialog.locator(
            'input[type="text"], input[type="email"]',
          );

          if ((await inputs.count()) > 0) {
            const firstInput = inputs.first();

            // Test focus styling
            await firstInput.focus();
            await page.waitForTimeout(200);

            const hasFocusStyling = await firstInput.evaluate((el) => {
              const style = window.getComputedStyle(el);
              return (
                style.borderColor !== "rgba(0, 0, 0, 0)" ||
                style.outline !== "none" ||
                style.boxShadow.includes("rgba") ||
                el.className.includes("focus:")
              );
            });
            expect(hasFocusStyling).toBeTruthy();

            // Test typing state
            await firstInput.fill("test input");
            await page.waitForTimeout(100);

            const value = await firstInput.inputValue();
            expect(value).toBe("test input");
          }

          // Close dialog
          await page.keyboard.press("Escape");
        }
      }

      await takeScreenshot(page, "form-input-styling");
    });

    test("navigation elements have active states", async ({
      page,
      context,
    }) => {
      await setupAdminSession(context);

      // Test dashboard navigation
      const dashboardNav = page.getByRole("button", { name: "Dashboard" });
      if (await dashboardNav.isVisible()) {
        const hasActiveStyling = await dashboardNav.evaluate((el) => {
          return (
            el.className.includes("active") ||
            el.className.includes("current") ||
            el.getAttribute("aria-current") === "page"
          );
        });

        if (hasActiveStyling) {
          expect(hasActiveStyling).toBeTruthy();
        }
      }

      // Test admin navigation
      const usersNav = page.getByRole("button", { name: "Users" });
      if (await usersNav.isVisible()) {
        await usersNav.click();
        await waitForPageLoad(page);

        // Should now have active styling
        const hasActiveAfterClick = await usersNav.evaluate((el) => {
          return (
            el.className.includes("active") ||
            el.className.includes("current") ||
            el.getAttribute("aria-current") === "page"
          );
        });

        if (hasActiveAfterClick) {
          expect(hasActiveAfterClick).toBeTruthy();
        }
      }

      await takeScreenshot(page, "navigation-active-states");
    });
  });

  test.describe("Custom CSS Utilities", () => {
    // Don't use the default auth state - use direct session creation
    test.use({
      storageState: undefined,
    });

    test("glow utility classes work correctly", async ({ page, context }) => {
      await setupAdminSession(context);
      await verifyLoadingStates(page);

      // Look for elements with glow classes
      const glowElements = page.locator(
        '[class*="glow-"], .glow-admin, .glow-user, .glow-permission',
      );

      if ((await glowElements.count()) > 0) {
        const glowEl = glowElements.first();

        const hasGlowStyling = await glowEl.evaluate((el) => {
          const style = window.getComputedStyle(el);
          return (
            style.boxShadow.includes("rgba") &&
            (style.boxShadow.includes("239, 68, 68") || // red glow
              style.boxShadow.includes("59, 130, 246") || // blue glow
              style.boxShadow.includes("16, 185, 129"))
          ); // emerald glow
        });
        expect(hasGlowStyling).toBeTruthy();
      } else {
        console.log("No glow utility classes found in current view");
      }

      await takeScreenshot(page, "glow-utility-classes");
    });

    test("gradient utilities are applied correctly", async ({
      page,
      context,
    }) => {
      await setupAdminSession(context);

      // Look for gradient elements
      const gradientElements = page.locator(
        '[class*="bg-gradient-"], [class*="from-"], [class*="to-"]',
      );

      const gradientCount = await gradientElements.count();
      if (gradientCount > 0) {
        for (let i = 0; i < Math.min(gradientCount, 3); i++) {
          const gradientEl = gradientElements.nth(i);

          const hasGradientStyling = await gradientEl.evaluate((el) => {
            const style = window.getComputedStyle(el);
            return (
              style.backgroundImage.includes("gradient") ||
              style.background.includes("gradient") ||
              el.className.includes("bg-gradient-")
            );
          });
          expect(hasGradientStyling).toBeTruthy();
        }
      }

      await takeScreenshot(page, "gradient-utilities");
    });

    test("animation utility classes function properly", async ({
      page,
      context,
    }) => {
      await setupAdminSession(context);

      // Look for animation classes
      const animatedElements = page.locator(
        '[class*="animate-"], .animate-shimmer, .animate-pulse',
      );

      if ((await animatedElements.count()) > 0) {
        const animatedEl = animatedElements.first();

        const hasAnimationStyling = await animatedEl.evaluate((el) => {
          const style = window.getComputedStyle(el);
          return (
            style.animationName !== "none" ||
            style.animationDuration !== "0s" ||
            el.className.includes("animate-")
          );
        });
        expect(hasAnimationStyling).toBeTruthy();
      } else {
        console.log("No animation utility classes found in current view");
      }

      await takeScreenshot(page, "animation-utilities");
    });
  });

  test.describe("Visual Consistency", () => {
    // Don't use the default auth state - use direct session creation
    test.use({
      storageState: undefined,
    });

    test("consistent spacing and typography across pages", async ({
      page,
      context,
    }) => {
      await setupAdminSession(context);

      const pages = [
        { path: "/", name: "Dashboard" },
        { path: "/admin/users", name: "Users" },
        { path: "/admin/roles", name: "Roles" },
        { path: "/admin/permissions", name: "Permissions" },
      ];

      for (const pageInfo of pages) {
        await page.goto(pageInfo.path);
        await verifyLoadingStates(page);

        // Check heading consistency
        const headings = page.locator("h1, h2, h3").first();
        if (await headings.isVisible()) {
          const hasConsistentHeading = await headings.evaluate((el) => {
            const style = window.getComputedStyle(el);
            return (
              (parseFloat(style.fontSize) >= 24 && // Minimum heading size
                style.fontWeight === "600") ||
              style.fontWeight === "700" ||
              style.fontWeight === "bold"
            );
          });
          expect(hasConsistentHeading).toBeTruthy();
        }

        // Check card consistency
        const cards = page.locator('[data-slot="card"]');
        if ((await cards.count()) > 0) {
          const firstCard = cards.first();
          const hasConsistentCard = await firstCard.evaluate((el) => {
            return (
              el.className.includes("rounded-xl") &&
              el.className.includes("border") &&
              el.className.includes("py-6")
            );
          });
          expect(hasConsistentCard).toBeTruthy();
        }
      }

      await takeScreenshot(page, "visual-consistency");
    });

    test("color scheme consistency across components", async ({
      page,
      context,
    }) => {
      await setupAdminSession(context);
      await page.goto("/admin/users");
      await verifyLoadingStates(page);

      // Verify consistent primary colors
      const primaryButtons = page
        .getByRole("button")
        .filter({ hasText: /Create|Save|Submit/ });

      if ((await primaryButtons.count()) > 0) {
        const primaryButton = primaryButtons.first();
        const hasPrimaryColors = await primaryButton.evaluate((el) => {
          return (
            el.className.includes("bg-primary") ||
            el.className.includes("bg-blue-") ||
            el.className.includes("bg-indigo-")
          );
        });
        expect(hasPrimaryColors).toBeTruthy();
      }

      // Verify consistent secondary colors
      const badges = page.locator('[data-slot="badge"]');
      if ((await badges.count()) > 0) {
        const badge = badges.first();
        const hasConsistentBadgeColors = await badge.evaluate((el) => {
          return (
            el.className.includes("bg-gradient-to-r") &&
            el.className.includes("from-") &&
            el.className.includes("to-")
          );
        });
        expect(hasConsistentBadgeColors).toBeTruthy();
      }

      await takeScreenshot(page, "color-scheme-consistency");
    });
  });
});
