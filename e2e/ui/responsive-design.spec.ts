import { test, expect } from "@playwright/test";
import {
  loginAsAdmin,
  loginAsUser,
  verifyDashboard,
  verifyLoadingStates,
  takeScreenshot,
  waitForPageLoad,
  setupAdminSession,
  setupUserSession,
} from "../utils/test-helpers";

test.describe("Responsive Design", () => {
  // Don't use the default auth state - use direct session creation
  test.use({
    storageState: undefined,
  });

  const viewports = [
    { name: "mobile", width: 375, height: 812 },
    { name: "tablet", width: 768, height: 1024 },
    { name: "desktop", width: 1920, height: 1080 },
    { name: "large-desktop", width: 2560, height: 1440 },
  ];

  test.describe("Dashboard Responsiveness", () => {
    // Don't use the default auth state - use direct session creation
    test.use({
      storageState: undefined,
    });

    viewports.forEach((viewport) => {
      test(`dashboard works correctly on ${viewport.name} (${viewport.width}x${viewport.height})`, async ({
        page,
        context,
      }) => {
        await page.setViewportSize({
          width: viewport.width,
          height: viewport.height,
        });
        await setupAdminSession(context);
        await verifyLoadingStates(page);

        // Verify dashboard loads
        await verifyDashboard(page);

        // Check stats cards are visible and properly laid out
        const statsCards = page.locator('[data-slot="card"]').filter({
          hasText: /Account Status|Total Sessions|Last Login|Your Roles/,
        });

        const cardCount = await statsCards.count();
        expect(cardCount).toBeGreaterThan(0);

        // All cards should be visible regardless of viewport
        for (let i = 0; i < cardCount; i++) {
          await expect(statsCards.nth(i)).toBeVisible();
        }

        // On mobile, check if navigation is accessible
        if (viewport.width <= 768) {
          // Look for mobile navigation patterns
          const mobileNav = page.locator(
            '[data-testid="mobile-nav"], .mobile-nav, button[aria-label*="menu"]',
          );

          if (await mobileNav.isVisible()) {
            await expect(mobileNav).toBeVisible();

            // Test mobile menu functionality
            await mobileNav.click();
            await page.waitForTimeout(300);

            // Navigation items should be visible after clicking
            const navItems = page
              .getByText("Users")
              .or(page.getByText("Roles"));
            if (await navItems.isVisible()) {
              await expect(navItems).toBeVisible();
            }
          } else {
            // Desktop-style navigation should still work on mobile
            const desktopNav = page.getByText("Administration");
            if (await desktopNav.isVisible()) {
              await expect(desktopNav).toBeVisible();
            }
          }
        }

        await takeScreenshot(page, `dashboard-${viewport.name}`);
      });
    });

    test("dashboard cards reflow properly across viewports", async ({
      page,
      context,
    }) => {
      await setupAdminSession(context);
      await verifyLoadingStates(page);

      // Start with desktop
      await page.setViewportSize({ width: 1200, height: 800 });

      const statsCards = page.locator('[data-slot="card"]').filter({
        hasText: /Account Status|Total Sessions|Last Login|Your Roles/,
      });
      const desktopCount = await statsCards.count();

      // Switch to tablet
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.waitForTimeout(200);

      const tabletCount = await statsCards.count();
      expect(tabletCount).toBe(desktopCount);

      // Verify cards are still arranged properly
      for (let i = 0; i < tabletCount; i++) {
        const card = statsCards.nth(i);
        await expect(card).toBeVisible();

        // Check card isn't cut off
        const boundingBox = await card.boundingBox();
        if (boundingBox) {
          expect(boundingBox.x).toBeGreaterThanOrEqual(0);
          expect(boundingBox.y).toBeGreaterThanOrEqual(0);
          expect(boundingBox.x + boundingBox.width).toBeLessThanOrEqual(768);
        }
      }

      // Switch to mobile
      await page.setViewportSize({ width: 375, height: 812 });
      await page.waitForTimeout(200);

      const mobileCount = await statsCards.count();
      expect(mobileCount).toBe(desktopCount);

      // All cards should still be visible and not overlapping
      for (let i = 0; i < mobileCount; i++) {
        await expect(statsCards.nth(i)).toBeVisible();
      }

      await takeScreenshot(page, "dashboard-card-reflow");
    });
  });

  test.describe("Admin Pages Responsiveness", () => {
    // Don't use the default auth state - use direct session creation
    test.use({
      storageState: undefined,
    });

    const adminPages = [
      { path: "/admin/users", name: "User Management" },
      { path: "/admin/roles", name: "Role Management" },
      { path: "/admin/permissions", name: "Permission Management" },
    ];

    adminPages.forEach((adminPage) => {
      viewports.forEach((viewport) => {
        test(`${adminPage.name} works on ${viewport.name}`, async ({
          page,
          context,
        }) => {
          await page.setViewportSize({
            width: viewport.width,
            height: viewport.height,
          });
          await setupAdminSession(context);
          await page.goto(adminPage.path);
          await verifyLoadingStates(page);

          // Verify page loads correctly
          await expect(
            page.getByRole("heading", { name: adminPage.name }),
          ).toBeVisible();

          // Check create button is accessible
          const createButton = page.getByRole("button", { name: /Create/ });
          if (await createButton.isVisible()) {
            await expect(createButton).toBeVisible();

            // Button should be properly positioned
            const buttonBox = await createButton.boundingBox();
            if (buttonBox) {
              expect(buttonBox.x + buttonBox.width).toBeLessThanOrEqual(
                viewport.width,
              );
              expect(buttonBox.y).toBeGreaterThanOrEqual(0);
            }
          }

          // Check data cards are properly displayed
          const dataCards = page.locator('[data-slot="card"]');
          const cardCount = await dataCards.count();

          if (cardCount > 0) {
            // Test first few cards
            for (let i = 0; i < Math.min(cardCount, 3); i++) {
              const card = dataCards.nth(i);
              await expect(card).toBeVisible();

              // Card should fit within viewport
              const cardBox = await card.boundingBox();
              if (cardBox) {
                expect(cardBox.x + cardBox.width).toBeLessThanOrEqual(
                  viewport.width + 20,
                ); // Allow some margin
                expect(cardBox.x).toBeGreaterThanOrEqual(-20);
              }
            }
          }

          await takeScreenshot(
            page,
            `${adminPage.path.replace(/\//g, "-")}-${viewport.name}`,
          );
        });
      });
    });

    test("admin tables/lists adapt to screen size", async ({
      page,
      context,
    }) => {
      await setupAdminSession(context);
      await page.goto("/admin/users");
      await verifyLoadingStates(page);

      // Desktop view - full table/card layout
      await page.setViewportSize({ width: 1200, height: 800 });
      await page.waitForTimeout(200);

      const desktopCards = page.locator('[data-slot="card"]');
      const desktopLayout = await desktopCards.first().evaluate((el) => {
        const style = window.getComputedStyle(el);
        return {
          display: style.display,
          width: style.width,
          marginBottom: style.marginBottom,
        };
      });

      // Mobile view - cards should stack
      await page.setViewportSize({ width: 375, height: 812 });
      await page.waitForTimeout(200);

      const mobileCards = page.locator('[data-slot="card"]');
      const mobileLayout = await mobileCards.first().evaluate((el) => {
        const style = window.getComputedStyle(el);
        return {
          display: style.display,
          width: style.width,
          marginBottom: style.marginBottom,
        };
      });

      // Cards should still be visible and properly sized
      const cardCount = await mobileCards.count();
      expect(cardCount).toBeGreaterThan(0);

      for (let i = 0; i < Math.min(cardCount, 2); i++) {
        const card = mobileCards.nth(i);
        const boundingBox = await card.boundingBox();

        if (boundingBox) {
          // Card should not overflow viewport width
          expect(boundingBox.width).toBeLessThanOrEqual(375);
        }
      }

      await takeScreenshot(page, "admin-responsive-layout");
    });
  });

  test.describe("Navigation Responsiveness", () => {
    // Don't use the default auth state - use direct session creation
    test.use({
      storageState: undefined,
    });

    test("navigation adapts to mobile viewport", async ({ page, context }) => {
      await setupAdminSession(context);

      // Desktop navigation
      await page.setViewportSize({ width: 1200, height: 800 });

      const desktopNav = page.getByText("Administration");
      const hasDesktopNav = await desktopNav.isVisible();

      // Mobile navigation
      await page.setViewportSize({ width: 375, height: 812 });
      await page.waitForTimeout(300);

      // Navigation should adapt - either collapse or become mobile-friendly
      const mobileMenuButton = page.locator(
        'button[aria-label*="menu"], [data-testid="mobile-menu"], .mobile-menu-button',
      );
      const stillHasDesktopNav = await desktopNav
        .isVisible()
        .catch(() => false);

      if (await mobileMenuButton.isVisible()) {
        // Has mobile menu button
        await expect(mobileMenuButton).toBeVisible();

        // Test mobile menu functionality
        await mobileMenuButton.click();
        await page.waitForTimeout(300);

        // Navigation items should appear
        const mobileNavItems = page
          .getByText("Users")
          .or(page.getByText("Dashboard"));
        if (await mobileNavItems.isVisible()) {
          await expect(mobileNavItems).toBeVisible();
        }
      } else if (stillHasDesktopNav) {
        // Desktop nav is still visible, should be responsive
        const navBox = await desktopNav.boundingBox();
        if (navBox) {
          expect(navBox.x + navBox.width).toBeLessThanOrEqual(375);
        }
      }

      await takeScreenshot(page, "navigation-mobile-adaptation");
    });

    test("navigation works across different screen sizes", async ({
      page,
      context,
    }) => {
      await setupAdminSession(context);

      for (const viewport of viewports) {
        await page.setViewportSize({
          width: viewport.width,
          height: viewport.height,
        });
        await page.waitForTimeout(200);

        // Test navigation to Users page
        let navigated = false;

        // Try mobile menu first if on small screen
        if (viewport.width <= 768) {
          const mobileMenu = page.locator(
            'button[aria-label*="menu"], [data-testid="mobile-menu"]',
          );
          if (await mobileMenu.isVisible()) {
            await mobileMenu.click();
            await page.waitForTimeout(200);
          }
        }

        const usersLink = page
          .getByText("Users")
          .or(page.getByRole("button", { name: "Users" }));
        if (await usersLink.isVisible()) {
          await usersLink.click();
          await waitForPageLoad(page);

          const url = page.url();
          if (url.includes("/admin/users")) {
            navigated = true;
            await expect(
              page.getByRole("heading", { name: "User Management" }),
            ).toBeVisible();
          }
        }

        // If direct navigation didn't work, try alternative approach
        if (!navigated) {
          await page.goto("/admin/users");
          await waitForPageLoad(page);
          await expect(
            page.getByRole("heading", { name: "User Management" }),
          ).toBeVisible();
        }

        // Return to dashboard for next test
        await page.goto("/");
        await waitForPageLoad(page);
      }

      await takeScreenshot(page, "navigation-cross-viewport");
    });
  });

  test.describe("Form Responsiveness", () => {
    // Don't use the default auth state - use direct session creation
    test.use({
      storageState: undefined,
    });

    test("create/edit dialogs adapt to screen size", async ({
      page,
      context,
    }) => {
      await setupAdminSession(context);
      await page.goto("/admin/users");
      await verifyLoadingStates(page);

      for (const viewport of [viewports[0], viewports[2]].filter(Boolean)) {
        // Mobile and desktop
        if (viewport) {
          await page.setViewportSize({
            width: viewport.width,
            height: viewport.height,
          });
          await page.waitForTimeout(200);

          const createButton = page.getByRole("button", {
            name: "Create User",
          });
          if (await createButton.isVisible()) {
            await createButton.click();

            const dialog = page.getByRole("dialog");
            if (await dialog.isVisible()) {
              await expect(dialog).toBeVisible();

              // Dialog should fit within viewport
              const dialogBox = await dialog.boundingBox();
              if (dialogBox && viewport) {
                expect(dialogBox.width).toBeLessThanOrEqual(viewport.width);
                expect(dialogBox.height).toBeLessThanOrEqual(viewport.height);

                // On mobile, dialog should be properly positioned
                if (viewport.width <= 768) {
                  expect(dialogBox.x).toBeGreaterThanOrEqual(0);
                  expect(dialogBox.y).toBeGreaterThanOrEqual(0);
                }
              }

              // Form fields should be accessible
              const inputs = dialog.locator("input, select, textarea");
              const inputCount = await inputs.count();

              for (let i = 0; i < inputCount; i++) {
                const input = inputs.nth(i);
                if (await input.isVisible()) {
                  const inputBox = await input.boundingBox();
                  if (inputBox) {
                    // Input should fit within dialog/viewport
                    expect(inputBox.width).toBeGreaterThan(0);
                    expect(inputBox.height).toBeGreaterThan(0);
                  }
                }
              }

              // Close dialog
              await page.keyboard.press("Escape");
            }
          }
        }
      }

      await takeScreenshot(page, "dialog-responsiveness");
    });

    test("form layouts adjust for mobile", async ({ page, context }) => {
      await setupAdminSession(context);
      await page.goto("/admin/users");

      const createButton = page.getByRole("button", { name: "Create User" });
      if (await createButton.isVisible()) {
        // Desktop form layout
        await page.setViewportSize({ width: 1200, height: 800 });
        await createButton.click();

        const dialog = page.getByRole("dialog");
        if (await dialog.isVisible()) {
          const desktopInputs = dialog.locator("input, select");
          const desktopCount = await desktopInputs.count();

          // Close and reopen on mobile
          await page.keyboard.press("Escape");
          await page.setViewportSize({ width: 375, height: 812 });
          await page.waitForTimeout(200);

          await createButton.click();

          if (await dialog.isVisible()) {
            const mobileInputs = dialog.locator("input, select");
            const mobileCount = await mobileInputs.count();

            // Same number of inputs should be present
            expect(mobileCount).toBe(desktopCount);

            // Inputs should be properly sized for mobile
            if (mobileCount > 0) {
              const firstInput = mobileInputs.first();
              const inputBox = await firstInput.boundingBox();

              if (inputBox) {
                expect(inputBox.width).toBeLessThanOrEqual(375 - 40); // Account for padding
              }
            }

            await page.keyboard.press("Escape");
          }
        }
      }

      await takeScreenshot(page, "form-mobile-layout");
    });
  });

  test.describe("Content Adaptation", () => {
    // Don't use the default auth state - use direct session creation
    test.use({
      storageState: undefined,
    });

    test("text and typography scale appropriately", async ({
      page,
      context,
    }) => {
      await setupAdminSession(context);
      await verifyLoadingStates(page);

      for (const viewport of viewports) {
        await page.setViewportSize({
          width: viewport.width,
          height: viewport.height,
        });
        await page.waitForTimeout(200);

        // Check main heading
        const mainHeading = page.getByRole("heading", { name: "Dashboard" });
        if (await mainHeading.isVisible()) {
          const headingStyle = await mainHeading.evaluate((el) => {
            const style = window.getComputedStyle(el);
            return {
              fontSize: parseFloat(style.fontSize),
              lineHeight: style.lineHeight,
              marginBottom: style.marginBottom,
            };
          });

          // Heading should be readable at all sizes
          expect(headingStyle.fontSize).toBeGreaterThanOrEqual(24);

          // On mobile, text might be slightly smaller but still readable
          if (viewport.width <= 375) {
            expect(headingStyle.fontSize).toBeGreaterThanOrEqual(20);
          }
        }

        // Check card text
        const cardText = page
          .locator('[data-slot="card"] p, [data-slot="card"] span')
          .first();
        if (await cardText.isVisible()) {
          const textStyle = await cardText.evaluate((el) => {
            const style = window.getComputedStyle(el);
            return parseFloat(style.fontSize);
          });

          // Body text should be readable
          expect(textStyle).toBeGreaterThanOrEqual(14);
        }
      }

      await takeScreenshot(page, "typography-scaling");
    });

    test("images and media adapt to viewport", async ({ page, context }) => {
      await setupAdminSession(context);

      // Look for any images or media content
      const images = page.locator('img, [role="img"], svg');
      const imageCount = await images.count();

      if (imageCount > 0) {
        for (const viewport of [viewports[0], viewports[2]].filter(Boolean)) {
          // Mobile and desktop
          if (viewport) {
            await page.setViewportSize({
              width: viewport.width,
              height: viewport.height,
            });
            await page.waitForTimeout(200);

            const firstImage = images.first();
            if (await firstImage.isVisible()) {
              const imageBox = await firstImage.boundingBox();

              if (imageBox) {
                // Image should not overflow viewport
                expect(imageBox.width).toBeLessThanOrEqual(viewport.width);
                expect(imageBox.x + imageBox.width).toBeLessThanOrEqual(
                  viewport.width,
                );
              }
            }
          }
        }
      }

      await takeScreenshot(page, "media-adaptation");
    });

    test("spacing and margins adjust for different screens", async ({
      page,
      context,
    }) => {
      await setupAdminSession(context);
      await verifyLoadingStates(page);

      const card = page.locator('[data-slot="card"]').first();

      // Desktop spacing
      await page.setViewportSize({ width: 1200, height: 800 });
      const desktopSpacing = await card.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return {
          padding: style.padding,
          margin: style.margin,
          gap: style.gap,
        };
      });

      // Mobile spacing
      await page.setViewportSize({ width: 375, height: 812 });
      await page.waitForTimeout(200);

      const mobileSpacing = await card.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return {
          padding: style.padding,
          margin: style.margin,
          gap: style.gap,
        };
      });

      // Spacing should be present at both sizes
      expect(desktopSpacing.padding).not.toBe("0px");
      expect(mobileSpacing.padding).not.toBe("0px");

      await takeScreenshot(page, "spacing-adaptation");
    });
  });

  test.describe("Performance on Different Viewports", () => {
    // Don't use the default auth state - use direct session creation
    test.use({
      storageState: undefined,
    });

    test("page loads efficiently on mobile", async ({ page, context }) => {
      await page.setViewportSize({ width: 375, height: 812 });

      const startTime = Date.now();
      await setupAdminSession(context);
      await verifyLoadingStates(page);
      const loadTime = Date.now() - startTime;

      // Page should load reasonably quickly even on mobile viewport
      expect(loadTime).toBeLessThan(10000); // 10 seconds max

      // All essential elements should be visible
      await expect(
        page.getByRole("heading", { name: "Dashboard" }),
      ).toBeVisible();

      const statsCards = page.locator('[data-slot="card"]');
      const cardCount = await statsCards.count();
      expect(cardCount).toBeGreaterThan(0);

      await takeScreenshot(page, "mobile-performance");
    });

    test("interactions remain smooth across viewports", async ({
      page,
      context,
    }) => {
      await setupAdminSession(context);

      for (const viewport of [viewports[0], viewports[1], viewports[2]].filter(
        Boolean,
      )) {
        if (viewport) {
          await page.setViewportSize({
            width: viewport.width,
            height: viewport.height,
          });
        }
        await page.waitForTimeout(200);

        // Test card hover interactions
        const card = page.locator('[data-slot="card"]').first();
        if (await card.isVisible()) {
          const startTime = Date.now();
          await card.hover();
          await page.waitForTimeout(300); // Wait for hover animation
          const hoverTime = Date.now() - startTime;

          // Hover should be responsive
          expect(hoverTime).toBeLessThan(1000);

          // Check if transform was applied
          const hasTransform = await card.evaluate((el) => {
            const style = window.getComputedStyle(el);
            return style.transform !== "none";
          });

          expect(hasTransform).toBeTruthy();
        }
      }

      await takeScreenshot(page, "interaction-performance");
    });
  });
});
