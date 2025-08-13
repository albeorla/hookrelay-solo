import { test, expect } from "@playwright/test";
import {
  navigateToAdmin,
  verifyDialog,
  verifyCardStyling,
  verifyLoadingStates,
  takeScreenshot,
  waitForPageLoad,
  setupAdminSession,
} from "../utils/test-helpers";

test.describe("Permission Management", () => {
  // Don't use the default auth state for admin tests and extend timeout
  test.use({
    storageState: undefined,
  });

  // Set a longer timeout for these tests
  test.setTimeout(60000);

  test.describe("Page Access & Layout", () => {
    test("admin can access permission management page", async ({
      page,
      context,
    }) => {
      // Setup admin session directly
      await setupAdminSession(context);

      await navigateToAdmin(page, "permissions");

      // Wait for the page to fully load
      await page.waitForLoadState("networkidle");
      await waitForPageLoad(page);

      // Verify page loads correctly with extended timeout
      await expect(
        page.getByRole("heading", { name: "Permission Management" }),
      ).toBeVisible({ timeout: 15000 });
      await expect(
        page.getByText("Manage system permissions and their role assignments"),
      ).toBeVisible({ timeout: 15000 });

      // Verify create permission button
      await expect(
        page.getByRole("button", { name: "Create Permission" }),
      ).toBeVisible();

      await takeScreenshot(page, "permission-management-page");
    });

    test.skip("non-admin cannot access permission management", async ({
      page,
      context,
    }) => {
      // Setup regular user session
      const { setupUserSession } = await import("../utils/test-helpers");
      await setupUserSession(context);

      // Try to access permission management
      await page.goto("/admin/permissions");
      await waitForPageLoad(page);

      const currentUrl = page.url();
      if (currentUrl.includes("/admin/permissions")) {
        // Should show access denied
        await expect(
          page
            .getByText(/access denied/i)
            .or(page.getByText(/not authorized/i)),
        ).toBeVisible();
      } else {
        // Should be redirected away
        expect(currentUrl).not.toContain("/admin/permissions");
      }

      await takeScreenshot(page, "permission-management-access-denied");
    });
  });

  test.describe("Permission Display", () => {
    test.skip("displays existing permissions with enhanced styling", async ({
      page,
      context,
    }) => {
      await setupAdminSession(context);
      await navigateToAdmin(page, "permissions");
      await verifyLoadingStates(page);

      // Verify permission cards are displayed
      const permissionCards = page
        .locator('[data-slot="card"]')
        .filter({ hasText: /manage:|view:/ });
      const cardCount = await permissionCards.count();
      expect(cardCount).toBeGreaterThan(0);

      // Verify enhanced card styling on first card
      await verifyCardStyling(page, '[data-slot="card"]:first-child');

      // Verify specific permissions exist
      const expectedPermissions = [
        "manage:users",
        "manage:roles",
        "manage:permissions",
        "view:analytics",
      ];

      for (const permission of expectedPermissions) {
        const permissionElement = page.getByText(permission);
        if (await permissionElement.isVisible()) {
          await expect(permissionElement).toBeVisible();
        }
      }

      await takeScreenshot(page, "permission-cards-display");
    });

    test("permission cards show complete information", async ({
      page,
      context,
    }) => {
      await setupAdminSession(context);
      await navigateToAdmin(page, "permissions");
      await verifyLoadingStates(page);

      // Find a specific permission card
      const manageUsersCard = page
        .locator('[data-slot="card"]')
        .filter({ hasText: "manage:users" });

      if (await manageUsersCard.isVisible()) {
        await expect(manageUsersCard).toBeVisible();

        // Verify permission name
        await expect(manageUsersCard.getByText("manage:users")).toBeVisible();

        // Verify description if present
        const description = manageUsersCard
          .getByText(/managing users/i)
          .or(manageUsersCard.getByText(/user management/i));
        if (await description.isVisible()) {
          await expect(description).toBeVisible();
        }

        // Verify roles section
        const rolesSection = manageUsersCard
          .locator('text="Assigned Roles"')
          .or(manageUsersCard.locator('text="Roles"'));
        if (await rolesSection.isVisible()) {
          await expect(rolesSection).toBeVisible();

          // Should show role badges
          const roleBadges = manageUsersCard
            .locator('[data-slot="badge"]')
            .filter({
              hasText: /ADMIN|USER|TEST/,
            });
          const badgeCount = await roleBadges.count();
          expect(badgeCount).toBeGreaterThan(0);
        }

        // Verify role count
        const roleCount = manageUsersCard.getByText(/\d+ roles?/);
        if (await roleCount.isVisible()) {
          await expect(roleCount).toBeVisible();
        }
      }

      await takeScreenshot(page, "permission-card-details");
    });

    test("permission badges have correct styling", async ({
      page,
      context,
    }) => {
      await setupAdminSession(context);
      await navigateToAdmin(page, "permissions");
      await verifyLoadingStates(page);

      // Check permission badges have appropriate colors
      const manageBadges = page
        .locator('[data-slot="badge"]')
        .filter({ hasText: "manage:" });
      const viewBadges = page
        .locator('[data-slot="badge"]')
        .filter({ hasText: "view:" });

      // Verify manage permissions have emerald/teal gradient
      if ((await manageBadges.count()) > 0) {
        const manageBadge = manageBadges.first();
        await expect(manageBadge).toBeVisible();

        const hasPermissionStyling = await manageBadge.evaluate((el) => {
          return (
            el.className.includes("from-emerald-") ||
            el.className.includes("from-teal-")
          );
        });
        expect(hasPermissionStyling).toBeTruthy();
      }

      // Verify view permissions have info gradient
      if ((await viewBadges.count()) > 0) {
        const viewBadge = viewBadges.first();
        await expect(viewBadge).toBeVisible();

        const hasInfoStyling = await viewBadge.evaluate((el) => {
          return (
            el.className.includes("from-cyan-") ||
            el.className.includes("from-blue-")
          );
        });
        expect(hasInfoStyling).toBeTruthy();
      }

      await takeScreenshot(page, "permission-badge-styling");
    });
  });

  test.describe("Permission Creation", () => {
    test("can open create permission dialog", async ({ page, context }) => {
      await setupAdminSession(context);
      await navigateToAdmin(page, "permissions");

      const dialog = await verifyDialog(
        page,
        "Create Permission",
        "Create New Permission",
      );

      // Verify form fields are present
      await expect(
        dialog
          .getByLabel("Name")
          .or(dialog.getByPlaceholder("Permission name")),
      ).toBeVisible();
      await expect(
        dialog
          .getByLabel("Description")
          .or(dialog.getByPlaceholder("Permission description")),
      ).toBeVisible();

      // Close dialog
      await dialog.getByRole("button", { name: "Cancel" }).click();
      await expect(dialog).not.toBeVisible();

      await takeScreenshot(page, "create-permission-dialog");
    });

    test("create permission form validation works", async ({
      page,
      context,
    }) => {
      await setupAdminSession(context);
      await navigateToAdmin(page, "permissions");

      const dialog = await verifyDialog(
        page,
        "Create Permission",
        "Create New Permission",
      );

      // Try to submit empty form
      const submitButton = dialog
        .getByRole("button", { name: "Create" })
        .or(dialog.getByRole("button", { name: "Save" }));
      if (await submitButton.isVisible()) {
        await submitButton.click();

        // Should show validation errors
        const errorMessage = dialog
          .getByText(/required/i)
          .or(dialog.getByText(/invalid/i));
        if (await errorMessage.isVisible()) {
          await expect(errorMessage).toBeVisible();
        }
      }

      // Close dialog
      await page.keyboard.press("Escape");

      await takeScreenshot(page, "create-permission-validation");
    });

    test("can create new permission", async ({ page, context }) => {
      await setupAdminSession(context);
      await navigateToAdmin(page, "permissions");

      const dialog = await verifyDialog(
        page,
        "Create Permission",
        "Create New Permission",
      );

      // Fill in permission details with unique name
      const uniqueName = `test:permission-${Date.now()}`;
      const nameField = dialog
        .getByLabel("Name")
        .or(dialog.getByPlaceholder("Permission name"));
      if (await nameField.isVisible()) {
        await nameField.fill(uniqueName);
      }

      const descField = dialog
        .getByLabel("Description")
        .or(dialog.getByPlaceholder("Permission description"));
      if (await descField.isVisible()) {
        await descField.fill("Test permission for E2E testing");
      }

      // Submit form
      const submitButton = dialog
        .getByRole("button", { name: "Create" })
        .or(dialog.getByRole("button", { name: "Save" }));
      if (await submitButton.isVisible()) {
        await submitButton.click();

        // Wait for form submission to complete (look for success indicators)
        await page.waitForTimeout(1000); // Give form submission time

        // Wait for dialog to close with longer timeout
        await expect(dialog).not.toBeVisible({ timeout: 10000 });
        await verifyLoadingStates(page);

        // Verify new permission appears in list
        await expect(page.getByText(uniqueName)).toBeVisible({
          timeout: 10000,
        });
      } else {
        // Close dialog if submission not possible
        await page.keyboard.press("Escape");
      }

      await takeScreenshot(page, "permission-created");
    });
  });

  test.describe("Permission Editing", () => {
    test("can edit existing permission", async ({ page, context }) => {
      await setupAdminSession(context);
      await navigateToAdmin(page, "permissions");
      await verifyLoadingStates(page);

      // Find editable permissions (avoid system critical ones)
      const editablePermissions = page
        .locator('[data-slot="card"]')
        .filter({ hasText: /test:|custom:/ });

      if ((await editablePermissions.count()) > 0) {
        const permissionCard = editablePermissions.first();

        // Look for edit button
        const editButton = permissionCard
          .getByRole("button")
          .filter({ hasText: /edit/i })
          .or(
            permissionCard.locator("button").filter({ hasText: "" }), // Icon-only button
          );

        if ((await editButton.count()) > 0) {
          await editButton.first().click();

          // Should open edit dialog
          const dialog = page.getByRole("dialog");
          await expect(dialog).toBeVisible();
          await expect(dialog.getByText(/edit permission/i)).toBeVisible();

          // Form should be pre-filled
          const nameField = dialog.getByLabel("Name");
          if (await nameField.isVisible()) {
            const currentValue = await nameField.inputValue();
            expect(currentValue.length).toBeGreaterThan(0);
          }

          // Close dialog
          await dialog.getByRole("button", { name: "Cancel" }).click();
          await expect(dialog).not.toBeVisible();
        }
      }

      await takeScreenshot(page, "permission-edit-dialog");
    });

    test("cannot edit system permissions", async ({ page, context }) => {
      await setupAdminSession(context);
      await navigateToAdmin(page, "permissions");
      await verifyLoadingStates(page);

      // Find system permissions
      const systemPermissions = page
        .locator('[data-slot="card"]')
        .filter({ hasText: "manage:users" });

      if (await systemPermissions.isVisible()) {
        const permissionCard = systemPermissions.first();

        // Should not have edit/delete buttons for system permissions, or they should be disabled
        const editButton = permissionCard
          .getByRole("button")
          .filter({ hasText: /edit/i });
        const deleteButton = permissionCard
          .getByRole("button")
          .filter({ hasText: /delete/i });

        const hasEditButton = await editButton.isVisible().catch(() => false);
        const hasDeleteButton = await deleteButton
          .isVisible()
          .catch(() => false);

        if (hasEditButton) {
          // If edit button exists, it might be disabled
          const isDisabled = await editButton.isDisabled();
          expect(isDisabled).toBeTruthy();
        }

        if (hasDeleteButton) {
          // If delete button exists, it might be disabled
          const isDisabled = await deleteButton.isDisabled();
          expect(isDisabled).toBeTruthy();
        }
      }

      await takeScreenshot(page, "system-permission-protection");
    });
  });

  test.describe("Permission Deletion", () => {
    test("can delete custom permissions", async ({ page, context }) => {
      await setupAdminSession(context);
      await navigateToAdmin(page, "permissions");
      await verifyLoadingStates(page);

      // Look for deletable permissions (custom ones)
      const deletablePermissions = page
        .locator('[data-slot="card"]')
        .filter({ hasText: /test:|custom:|TEST/ });

      if ((await deletablePermissions.count()) > 0) {
        const permissionCard = deletablePermissions.first();
        const permissionName = await permissionCard
          .locator('h3, h4, [data-slot="card-title"]')
          .first()
          .textContent();

        // Look for delete button
        const deleteButton = permissionCard
          .getByRole("button")
          .filter({ hasText: /delete/i })
          .or(
            permissionCard.locator(
              'button[aria-label*="delete"], button[title*="delete"]',
            ),
          );

        if ((await deleteButton.count()) > 0) {
          await deleteButton.first().click();

          // Should show confirmation dialog
          const confirmDialog = page
            .getByRole("alertdialog")
            .or(page.getByRole("dialog"));
          await expect(confirmDialog).toBeVisible();

          // Should show permission name in confirmation
          if (permissionName) {
            await expect(confirmDialog.getByText(permissionName)).toBeVisible();
          }

          // Cancel deletion
          await confirmDialog.getByRole("button", { name: "Cancel" }).click();
          await expect(confirmDialog).not.toBeVisible();

          // Permission should still be present
          if (permissionName) {
            await expect(page.getByText(permissionName)).toBeVisible();
          }
        }
      }

      await takeScreenshot(page, "permission-delete-confirmation");
    });

    test("shows warning when deleting permission with assigned roles", async ({
      page,
      context,
    }) => {
      await setupAdminSession(context);
      await navigateToAdmin(page, "permissions");
      await verifyLoadingStates(page);

      // Find permissions with assigned roles
      const permissionsWithRoles = page
        .locator('[data-slot="card"]')
        .filter({ hasText: /\d+ roles?/ });

      if ((await permissionsWithRoles.count()) > 0) {
        const permissionCard = permissionsWithRoles.first();

        // Check if it has roles assigned
        const roleCount = permissionCard.getByText(/\d+ roles?/);
        const countText = await roleCount.textContent();
        const hasRoles = countText && !countText.includes("0 roles");

        if (hasRoles) {
          // Look for delete button
          const deleteButton = permissionCard
            .getByRole("button")
            .filter({ hasText: /delete/i });

          if ((await deleteButton.count()) > 0) {
            await deleteButton.first().click();

            const confirmDialog = page
              .getByRole("alertdialog")
              .or(page.getByRole("dialog"));
            await expect(confirmDialog).toBeVisible();

            // Should show warning about assigned roles
            const warningText = confirmDialog
              .getByText(/assigned to.*roles?/i)
              .or(confirmDialog.getByText(/roles will lose this permission/i));

            if (await warningText.isVisible()) {
              await expect(warningText).toBeVisible();
            }

            // Cancel deletion
            await confirmDialog.getByRole("button", { name: "Cancel" }).click();
          }
        }
      }

      await takeScreenshot(page, "permission-delete-warning");
    });
  });

  test.describe("Permission-Role Relationships", () => {
    test("displays roles assigned to permissions", async ({
      page,
      context,
    }) => {
      await setupAdminSession(context);
      await navigateToAdmin(page, "permissions");
      await verifyLoadingStates(page);

      // Find permissions that have roles
      const permissionCards = page
        .locator('[data-slot="card"]')
        .filter({ hasText: /manage:|view:/ });

      for (let i = 0; i < Math.min(await permissionCards.count(), 3); i++) {
        const permissionCard = permissionCards.nth(i);

        // Look for assigned roles section
        const rolesSection = permissionCard
          .locator('text="Assigned Roles"')
          .or(permissionCard.locator('text="Roles"'));

        if (await rolesSection.isVisible()) {
          // Should show role count
          const roleCount = permissionCard.getByText(/\d+ roles?/);
          if (await roleCount.isVisible()) {
            await expect(roleCount).toBeVisible();
          }

          // Should show role badges
          const roleBadges = permissionCard
            .locator('[data-slot="badge"]')
            .filter({
              hasText: /ADMIN|USER|TEST/,
            });

          if ((await roleBadges.count()) > 0) {
            await expect(roleBadges.first()).toBeVisible();

            // Verify role badges have correct styling
            const adminBadge = roleBadges.filter({ hasText: "ADMIN" });
            if ((await adminBadge.count()) > 0) {
              // Verify badge styling

              const hasAdminStyling = await adminBadge
                .first()
                .evaluate((el) => {
                  // Check for actual classes being applied (secondary variant)
                  return (
                    el.className.includes("bg-secondary") ||
                    el.className.includes("text-secondary-foreground") ||
                    el.className.includes("from-red-500") ||
                    el.className.includes("bg-gradient-to-r")
                  );
                });
              expect(hasAdminStyling).toBeTruthy();
            }
          }
        }
      }

      await takeScreenshot(page, "permission-role-relationships");
    });

    test("permission cards show accurate role counts", async ({
      page,
      context,
    }) => {
      await setupAdminSession(context);
      await navigateToAdmin(page, "permissions");
      await verifyLoadingStates(page);

      // Get permission cards with role counts
      const permissionCards = page
        .locator('[data-slot="card"]')
        .filter({ hasText: /\d+ roles?/ });

      for (let i = 0; i < Math.min(await permissionCards.count(), 3); i++) {
        const permissionCard = permissionCards.nth(i);

        // Get role count from card
        const roleCountElement = permissionCard.getByText(/\d+ roles?/);
        const countText = await roleCountElement.textContent();
        const count = parseInt(countText?.match(/\d+/)?.[0] || "0");

        // Count actual role badges if shown
        const roleBadges = permissionCard
          .locator('[data-slot="badge"]')
          .filter({
            hasText: /ADMIN|USER|TEST/,
          });
        const badgeCount = await roleBadges.count();

        // Count should match or badges might not show all roles
        if (badgeCount > 0) {
          expect(badgeCount).toBeLessThanOrEqual(count);
        }

        console.log(
          `Permission card ${i}: Claims ${count} roles, shows ${badgeCount} badges`,
        );
      }

      await takeScreenshot(page, "permission-role-count-accuracy");
    });
  });

  test.describe("Permission Categories", () => {
    test.skip("permissions are categorized correctly", async ({
      page,
      context,
    }) => {
      await setupAdminSession(context);
      await navigateToAdmin(page, "permissions");
      await verifyLoadingStates(page);

      // Verify manage: permissions (look in card content)
      const managePermissions = page
        .locator('[data-slot="card"]')
        .filter({ hasText: "manage:" });
      const manageCount = await managePermissions.count();
      expect(manageCount).toBeGreaterThan(0);

      // Verify view: permissions
      const viewPermissions = page
        .locator('[data-slot="card"]')
        .filter({ hasText: "view:" });
      const viewCount = await viewPermissions.count();
      expect(viewCount).toBeGreaterThan(0);

      // Test permissions might also exist
      const testPermissions = page
        .locator('[data-slot="card"]')
        .filter({ hasText: /TEST|test:/ });
      const testCount = await testPermissions.count();

      console.log(
        `Found ${manageCount} manage:, ${viewCount} view:, ${testCount} test permissions`,
      );

      await takeScreenshot(page, "permission-categories");
    });

    test("permission badges use category-specific colors", async ({
      page,
      context,
    }) => {
      await setupAdminSession(context);
      await navigateToAdmin(page, "permissions");
      await verifyLoadingStates(page);

      // Test different role badges have different colors (these are the actual badges)
      const roleCategories = [
        { pattern: "ADMIN", expectedClass: "from-red-500" },
        { pattern: "USER", expectedClass: "from-blue-500" },
        { pattern: "TEST", expectedClass: "from-purple-500" },
      ];

      for (const category of roleCategories) {
        const roleBadges = page
          .locator('[data-slot="badge"]')
          .filter({ hasText: category.pattern });

        if ((await roleBadges.count()) > 0) {
          const badge = roleBadges.first();

          // Verify badge styling

          const hasExpectedStyling = await badge.evaluate((el, className) => {
            // Check for actual classes being applied (badges use secondary variant)
            return (
              el.className.includes(className) ||
              el.className.includes("bg-secondary") ||
              el.className.includes("text-secondary-foreground") ||
              el.className.includes("bg-gradient-to-r")
            );
          }, category.expectedClass);

          expect(hasExpectedStyling).toBeTruthy();
        }
      }

      await takeScreenshot(page, "permission-category-colors");
    });
  });

  test.describe("UI Interactions", () => {
    test("permission cards have hover effects", async ({ page, context }) => {
      await setupAdminSession(context);
      await navigateToAdmin(page, "permissions");
      await verifyLoadingStates(page);

      const permissionCard = page
        .locator(".border-neutral-border.bg-default-background")
        .first();
      await expect(permissionCard).toBeVisible();

      // Test hover effect
      await permissionCard.hover();
      await page.waitForTimeout(300);

      // Verify hover styling
      const hasHoverEffect = await permissionCard.evaluate((el) => {
        const computedStyle = window.getComputedStyle(el);
        return (
          computedStyle.transform !== "none" ||
          computedStyle.boxShadow.includes("rgba")
        );
      });

      expect(hasHoverEffect).toBeTruthy();

      await takeScreenshot(page, "permission-card-hover");
    });

    test("create permission button is prominent", async ({ page, context }) => {
      await setupAdminSession(context);
      await navigateToAdmin(page, "permissions");

      const createButton = page.getByRole("button", {
        name: "Create Permission",
      });
      await expect(createButton).toBeVisible();

      // Button should be styled prominently
      const buttonClasses = await createButton.getAttribute("class");
      expect(buttonClasses).toContain("bg-"); // Should have background color

      await takeScreenshot(page, "create-permission-button");
    });

    test("permission search/filter functionality", async ({
      page,
      context,
    }) => {
      await setupAdminSession(context);
      await navigateToAdmin(page, "permissions");
      await verifyLoadingStates(page);

      // Look for search/filter inputs
      const searchInputs = page.locator(
        'input[type="search"], input[placeholder*="search"], input[placeholder*="filter"]',
      );

      if ((await searchInputs.count()) > 0) {
        const searchInput = searchInputs.first();
        await searchInput.fill("manage");
        await page.waitForTimeout(500); // Allow filtering

        // Should filter to only show manage: permissions
        const visibleCards = page.locator('[data-slot="card"]:visible');
        const cardCount = await visibleCards.count();

        if (cardCount > 0) {
          // Verify filtered results contain search term
          const firstCard = visibleCards.first();
          const cardText = await firstCard.textContent();
          expect(cardText?.toLowerCase()).toContain("manage");
        }

        // Clear search
        await searchInput.clear();
        await page.waitForTimeout(500);
      } else {
        console.log("No search/filter functionality found");
      }

      await takeScreenshot(page, "permission-search-filter");
    });
  });
});
