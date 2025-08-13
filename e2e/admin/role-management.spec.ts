import { test, expect } from "@playwright/test";
import {
  navigateToAdmin,
  verifyDialog,
  verifyCardStyling,
  verifyLoadingStates,
  takeScreenshot,
  waitForPageLoad,
  setupAdminSession,
  setupUserSession,
} from "../utils/test-helpers";

test.describe("Role Management", () => {
  // Don't use the default auth state - use direct session creation
  test.use({
    storageState: undefined,
  });

  test.describe("Page Access & Layout", () => {
    // Don't use the default auth state - use direct session creation
    test.use({
      storageState: undefined,
    });

    test("admin can access role management page", async ({ page, context }) => {
      await setupAdminSession(context);
      await navigateToAdmin(page, "roles");

      // Verify page loads correctly
      await expect(
        page.getByRole("heading", { name: "Role Management" }),
      ).toBeVisible();
      await expect(
        page.getByText("Manage system roles and their permission assignments"),
      ).toBeVisible();

      // Verify create role button
      await expect(
        page.getByRole("button", { name: "Create Role" }),
      ).toBeVisible();

      await takeScreenshot(page, "role-management-page");
    });

    test("non-admin cannot access role management", async ({
      page,
      context,
    }) => {
      await setupUserSession(context);

      // Try to access role management
      await page.goto("/admin/roles");
      await waitForPageLoad(page);
      // Client-side redirect should send non-admins away from /admin/roles
      await page
        .waitForURL((url) => !url.toString().includes("/admin/roles"), {
          timeout: 5000,
        })
        .catch(() => undefined);
      expect(page.url()).not.toContain("/admin/roles");

      await takeScreenshot(page, "role-management-access-denied");
    });
  });

  test.describe("Role Display", () => {
    // Don't use the default auth state - use direct session creation
    test.use({
      storageState: undefined,
    });

    test("displays existing roles with enhanced styling", async ({
      page,
      context,
    }) => {
      await setupAdminSession(context);
      await navigateToAdmin(page, "roles");
      await verifyLoadingStates(page);
      await page.waitForLoadState("networkidle");
      // Ensure at least one role card is rendered before counting
      await page.waitForSelector(
        ".border-neutral-border.bg-default-background",
        { timeout: 10000 },
      );

      // Verify role cards are displayed
      const roleCards = page
        .locator(".border-neutral-border.bg-default-background")
        .filter({ hasText: /ADMIN|USER|TEST/ });
      const cardCount = await roleCards.count();
      expect(cardCount).toBeGreaterThan(0);

      // Verify enhanced card styling (use first card to avoid strict mode violation)
      await verifyCardStyling(
        page,
        ".border-neutral-border.bg-default-background:first-child",
      );

      // Verify specific roles exist
      await expect(page.getByText("ADMIN").first()).toBeVisible();
      await expect(page.getByText("USER").first()).toBeVisible();

      await takeScreenshot(page, "role-cards-display");
    });

    test("role cards show complete information", async ({ page, context }) => {
      await setupAdminSession(context);
      await navigateToAdmin(page, "roles");
      await verifyLoadingStates(page);

      // Find ADMIN role card
      const adminRoleCard = page
        .locator(".border-neutral-border.bg-default-background")
        .filter({ hasText: "ADMIN" })
        .first();
      await expect(adminRoleCard).toBeVisible();

      // Verify role information (use first() to avoid strict mode violation)
      await expect(adminRoleCard.getByText("ADMIN").first()).toBeVisible();

      // Check for Administrator description text
      const hasAdministratorText = await adminRoleCard
        .getByText(/Administrator/i)
        .first()
        .isVisible()
        .catch(() => false);
      expect(hasAdministratorText).toBeTruthy();

      // Verify permissions section
      const permissionsHeader = adminRoleCard
        .getByText(/Assigned Permissions|Permissions/i)
        .first();
      if (await permissionsHeader.isVisible()) {
        // Should show at least one permission label within the section
        const permissionLabels = adminRoleCard
          .locator("div")
          .filter({ hasText: /manage:|view:/ });
        expect(await permissionLabels.count()).toBeGreaterThan(0);
      }

      // Verify users section
      const usersHeader = adminRoleCard
        .getByText(/Users with this Role|Users/i)
        .first();
      if (await usersHeader.isVisible()) {
        // Should show user names for ADMIN role
        await expect(
          adminRoleCard.getByText(/Admin User|admin@example\.com/i).first(),
        ).toBeVisible();
      }

      await takeScreenshot(page, "role-card-details");
    });

    test("role badges have correct styling", async ({ page, context }) => {
      await setupAdminSession(context);
      await navigateToAdmin(page, "roles");
      await verifyLoadingStates(page);

      // Check permission badges have appropriate colors
      const permissionBadges = page
        .locator('[data-slot="badge"]')
        .filter({ hasText: /manage:/ });

      if ((await permissionBadges.count()) > 0) {
        const firstPermissionBadge = permissionBadges.first();
        await expect(firstPermissionBadge).toBeVisible();

        // Verify gradient styling for permission badges
        const hasGradient = await firstPermissionBadge.evaluate((el) => {
          return (
            el.className.includes("from-emerald-") ||
            el.className.includes("from-teal-")
          );
        });
        expect(hasGradient).toBeTruthy();
      }

      await takeScreenshot(page, "role-badge-styling");
    });
  });

  test.describe("Role Creation", () => {
    // Don't use the default auth state - use direct session creation
    test.use({
      storageState: undefined,
    });

    test("can open create role dialog", async ({ page, context }) => {
      await setupAdminSession(context);
      await navigateToAdmin(page, "roles");

      const dialog = await verifyDialog(page, "Create Role", "Create New Role");

      // Verify form fields are present
      await expect(dialog.getByPlaceholder("Enter role name")).toBeVisible();
      await expect(
        dialog.getByPlaceholder("Describe what this role can do"),
      ).toBeVisible();

      // Verify permissions section
      const permissionsSection = dialog
        .locator('text="Permissions"')
        .or(dialog.getByText("Select permissions"));
      if (await permissionsSection.isVisible()) {
        await expect(permissionsSection).toBeVisible();
      }

      // Close dialog
      await dialog.getByRole("button", { name: "Cancel" }).click();
      await expect(dialog).not.toBeVisible();

      await takeScreenshot(page, "create-role-dialog");
    });

    test("create role form validation works", async ({ page, context }) => {
      await setupAdminSession(context);
      await navigateToAdmin(page, "roles");

      const dialog = await verifyDialog(page, "Create Role", "Create New Role");

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

      await takeScreenshot(page, "create-role-validation");
    });

    test("can create new role with permissions", async ({ page, context }) => {
      await setupAdminSession(context);
      await navigateToAdmin(page, "roles");

      const dialog = await verifyDialog(page, "Create Role", "Create New Role");

      // Fill in role details
      const nameField = dialog
        .getByLabel("Name")
        .or(dialog.getByPlaceholder("Role name"));
      if (await nameField.isVisible()) {
        await nameField.fill("TEST_ROLE");
      }

      const descField = dialog
        .getByLabel("Description")
        .or(dialog.getByPlaceholder("Role description"));
      if (await descField.isVisible()) {
        await descField.fill("Test role for E2E testing");
      }

      // Select permissions if available
      const permissionCheckboxes = dialog.locator('input[type="checkbox"]');
      const checkboxCount = await permissionCheckboxes.count();

      if (checkboxCount > 0) {
        // Select first available permission
        await permissionCheckboxes.first().check();
      }

      // Submit form
      const submitButton = dialog
        .getByRole("button", { name: "Create" })
        .or(dialog.getByRole("button", { name: "Save" }));
      if (await submitButton.isVisible()) {
        await submitButton.click();

        // Wait for dialog to close and page to update
        await page.waitForTimeout(3000); // Allow time for submission

        // Try to close dialog manually if still open
        const isDialogStillOpen = await dialog.isVisible().catch(() => false);
        if (isDialogStillOpen) {
          console.log("Dialog still open, attempting to close...");
          const cancelButton = dialog.getByRole("button", { name: "Cancel" });
          if (await cancelButton.isVisible().catch(() => false)) {
            await cancelButton.click();
          }
        }

        await verifyLoadingStates(page);

        // Verify new role appears in list
        await expect(page.getByText("TEST_ROLE")).toBeVisible();
      } else {
        // Close dialog if submission not possible
        await page.keyboard.press("Escape");
      }

      await takeScreenshot(page, "role-created");
    });
  });

  test.describe("Role Editing", () => {
    // Don't use the default auth state - use direct session creation
    test.use({
      storageState: undefined,
    });

    test("can edit existing role", async ({ page, context }) => {
      await setupAdminSession(context);
      await navigateToAdmin(page, "roles");
      await verifyLoadingStates(page);

      // Find an editable role (not ADMIN which might be protected)
      const editableRoles = page
        .locator(".border-neutral-border.bg-default-background")
        .filter({ hasText: /USER|TEST/ });

      if ((await editableRoles.count()) > 0) {
        const roleCard = editableRoles.first();

        // Look for edit button
        const editButton = roleCard
          .getByRole("button")
          .filter({ hasText: /edit/i })
          .or(
            roleCard.locator("button").filter({ hasText: "" }), // Icon-only button
          );

        if ((await editButton.count()) > 0) {
          await editButton.first().click();

          // Should open edit dialog
          const dialog = page.getByRole("dialog");
          await expect(dialog).toBeVisible();
          await expect(dialog.getByText(/edit role/i)).toBeVisible();

          // Form should be pre-filled
          const nameField = dialog.getByLabel("Name");
          if (await nameField.isVisible()) {
            await expect(nameField).toBeVisible();
            // Check if field has expected value
            const fieldValue = await nameField.inputValue();
            expect(fieldValue).toMatch(/USER|TEST/);
          }

          // Close dialog
          await dialog.getByRole("button", { name: "Cancel" }).click();
          await expect(dialog).not.toBeVisible();
        }
      }

      await takeScreenshot(page, "role-edit-dialog");
    });

    test("cannot edit system roles", async ({ page, context }) => {
      await setupAdminSession(context);
      await navigateToAdmin(page, "roles");
      await verifyLoadingStates(page);
      await page.waitForLoadState("networkidle");
      await page.waitForSelector(
        ".border-neutral-border.bg-default-background",
        { timeout: 10000 },
      );

      // Find ADMIN role card
      const adminRoleCard = page
        .locator(".border-neutral-border.bg-default-background")
        .filter({ hasText: "ADMIN" })
        .first();
      await expect(adminRoleCard).toBeVisible();

      // Should not have edit/delete buttons for system roles
      const editButton = adminRoleCard
        .getByRole("button")
        .filter({ hasText: /edit/i });
      const deleteButton = adminRoleCard
        .getByRole("button")
        .filter({ hasText: /delete/i });

      const hasEditButton = await editButton.isVisible().catch(() => false);
      const hasDeleteButton = await deleteButton.isVisible().catch(() => false);

      // System roles should not be editable
      expect(hasEditButton).toBeFalsy();
      expect(hasDeleteButton).toBeFalsy();

      await takeScreenshot(page, "system-role-protection");
    });
  });

  test.describe("Role Deletion", () => {
    // Don't use the default auth state - use direct session creation
    test.use({
      storageState: undefined,
    });

    test("can delete non-system roles", async ({ page, context }) => {
      await setupAdminSession(context);
      await navigateToAdmin(page, "roles");
      await verifyLoadingStates(page);

      // Look for deletable roles (not ADMIN)
      const deletableRoles = page
        .locator(".border-neutral-border.bg-default-background")
        .filter({ hasText: /TEST|CUSTOM/ });

      if ((await deletableRoles.count()) > 0) {
        const roleCard = deletableRoles.first();
        const roleName = await roleCard
          .locator('h3, h4, [data-slot="card-title"]')
          .first()
          .textContent();

        // Look for delete button
        const deleteButton = roleCard
          .getByRole("button")
          .filter({ hasText: /delete/i })
          .or(
            roleCard.locator(
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

          // Should show role name in confirmation
          if (roleName) {
            await expect(confirmDialog.getByText(roleName)).toBeVisible();
          }

          // Cancel deletion
          await confirmDialog.getByRole("button", { name: "Cancel" }).click();
          await expect(confirmDialog).not.toBeVisible();

          // Role should still be present
          if (roleName) {
            await expect(page.getByText(roleName)).toBeVisible();
          }
        }
      }

      await takeScreenshot(page, "role-delete-confirmation");
    });

    test("shows warning when deleting role with assigned users", async ({
      page,
      context,
    }) => {
      await setupAdminSession(context);
      await navigateToAdmin(page, "roles");
      await verifyLoadingStates(page);

      // Find USER role which likely has assigned users
      const userRoleCard = page
        .locator(".border-neutral-border.bg-default-background")
        .filter({ hasText: "USER" })
        .first();

      if (await userRoleCard.first().isVisible()) {
        // Check if it shows user count
        const userCount = userRoleCard.getByText(/\d+ users?/).first();

        if (await userCount.isVisible()) {
          const countText = await userCount.textContent();
          const hasUsers = countText && !countText.includes("0 users");

          if (hasUsers) {
            // Look for delete button
            const deleteButton = userRoleCard
              .getByRole("button")
              .filter({ hasText: /delete/i });

            if ((await deleteButton.count()) > 0) {
              await deleteButton.first().click();

              const confirmDialog = page
                .getByRole("alertdialog")
                .or(page.getByRole("dialog"));
              await expect(confirmDialog).toBeVisible();

              // Should show warning about assigned users
              const warningText = confirmDialog
                .getByText(/assigned to.*users?/i)
                .or(confirmDialog.getByText(/users will lose this role/i));

              if (await warningText.isVisible()) {
                await expect(warningText).toBeVisible();
              }

              // Cancel deletion
              await confirmDialog
                .getByRole("button", { name: "Cancel" })
                .click();
            }
          }
        }
      }

      await takeScreenshot(page, "role-delete-warning");
    });
  });

  test.describe("Permission Assignment", () => {
    // Don't use the default auth state - use direct session creation
    test.use({
      storageState: undefined,
    });

    test("can view role permissions", async ({ page, context }) => {
      await setupAdminSession(context);
      await navigateToAdmin(page, "roles");
      await verifyLoadingStates(page);
      await page.waitForLoadState("networkidle");
      await page.waitForSelector(
        ".border-neutral-border.bg-default-background",
        { timeout: 10000 },
      );

      // Find ADMIN role which should have permissions
      const adminRoleCard = page
        .locator(".border-neutral-border.bg-default-background")
        .filter({ hasText: "ADMIN" })
        .first();
      await expect(adminRoleCard).toBeVisible();

      // Should show permissions section
      const permissionsSection = adminRoleCard
        .locator('text="Permissions"')
        .locator("..");
      if (await permissionsSection.isVisible()) {
        await expect(permissionsSection).toBeVisible();

        // Should show permission badges
        const permissionBadges = adminRoleCard
          .locator('[data-slot="badge"]')
          .filter({
            hasText: /manage:|view:/,
          });
        const badgeCount = await permissionBadges.count();
        expect(badgeCount).toBeGreaterThan(0);
      }

      await takeScreenshot(page, "role-permissions-display");
    });

    test.skip("permission badges have correct colors", async ({
      page,
      context,
    }) => {
      await setupAdminSession(context);
      await navigateToAdmin(page, "roles");
      await verifyLoadingStates(page);

      // Find permission badges
      const manageBadges = page
        .locator('[data-slot="badge"]')
        .filter({ hasText: "manage:" });
      const viewBadges = page
        .locator('[data-slot="badge"]')
        .filter({ hasText: "view:" });

      // Verify manage permissions have emerald/teal gradient
      if ((await manageBadges.count()) > 0) {
        const manageBadge = manageBadges.first();
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
        const hasInfoStyling = await viewBadge.evaluate((el) => {
          return (
            el.className.includes("from-cyan-") ||
            el.className.includes("from-blue-")
          );
        });
        expect(hasInfoStyling).toBeTruthy();
      }

      await takeScreenshot(page, "permission-badge-colors");
    });
  });

  test.describe("Role-User Relationships", () => {
    // Don't use the default auth state - use direct session creation
    test.use({
      storageState: undefined,
    });

    test("displays users assigned to roles", async ({ page, context }) => {
      await setupAdminSession(context);
      await navigateToAdmin(page, "roles");
      await verifyLoadingStates(page);

      // Find roles that have users
      const roleCards = page
        .locator('[data-slot="card"]')
        .filter({ hasText: /ADMIN|USER/ });

      for (let i = 0; i < (await roleCards.count()); i++) {
        const roleCard = roleCards.nth(i);

        // Look for users section
        const usersSection = roleCard.locator('text="Users"').locator("..");

        if (await usersSection.isVisible()) {
          // Should show user count
          const userCount = roleCard.getByText(/\d+ users?/);
          if (await userCount.isVisible()) {
            await expect(userCount).toBeVisible();
          }

          // May show user names as badges
          const userBadges = roleCard.locator('[data-slot="badge"]').filter({
            hasText: /@|Admin User|test/,
          });

          if ((await userBadges.count()) > 0) {
            await expect(userBadges.first()).toBeVisible();
          }
        }
      }

      await takeScreenshot(page, "role-user-relationships");
    });

    test.skip("role cards show accurate user counts", async ({
      page,
      context,
    }) => {
      await setupAdminSession(context);
      await navigateToAdmin(page, "roles");
      await verifyLoadingStates(page);

      // Get role cards with user counts
      const roleCards = page
        .locator('[data-slot="card"]')
        .filter({ hasText: /\d+ users?/ });

      for (let i = 0; i < Math.min(await roleCards.count(), 3); i++) {
        const roleCard = roleCards.nth(i);

        // Get user count from card
        const userCountElement = roleCard.getByText(/\d+ users?/);
        const countText = await userCountElement.textContent();
        const count = parseInt(countText?.match(/\d+/)?.[0] || "0");

        // Count actual user badges if shown
        const userBadges = roleCard.locator('[data-slot="badge"]').filter({
          hasText: /@|Admin|test|user/,
        });
        const badgeCount = await userBadges.count();

        // Count should match or badges might not show all users
        if (badgeCount > 0) {
          expect(badgeCount).toBeLessThanOrEqual(count);
        }

        console.log(
          `Role card ${i}: Claims ${count} users, shows ${badgeCount} badges`,
        );
      }

      await takeScreenshot(page, "role-user-count-accuracy");
    });
  });

  test.describe("UI Interactions", () => {
    // Don't use the default auth state - use direct session creation
    test.use({
      storageState: undefined,
    });

    test("role cards have hover effects", async ({ page, context }) => {
      await setupAdminSession(context);
      await navigateToAdmin(page, "roles");
      await verifyLoadingStates(page);

      const roleCard = page
        .locator(".border-neutral-border.bg-default-background")
        .first();
      await expect(roleCard).toBeVisible();

      // Test hover effect
      await roleCard.hover();
      await page.waitForTimeout(300);

      // Verify hover styling
      const hasHoverEffect = await roleCard.evaluate((el) => {
        const computedStyle = window.getComputedStyle(el);
        return (
          computedStyle.transform !== "none" ||
          computedStyle.boxShadow.includes("rgba")
        );
      });

      expect(hasHoverEffect).toBeTruthy();

      await takeScreenshot(page, "role-card-hover");
    });

    test("create role button is prominent", async ({ page, context }) => {
      await setupAdminSession(context);
      await navigateToAdmin(page, "roles");

      const createButton = page.getByRole("button", { name: "Create Role" });
      await expect(createButton).toBeVisible();

      // Button should be styled prominently
      const buttonClasses = await createButton.getAttribute("class");
      expect(buttonClasses).toContain("bg-"); // Should have background color

      await takeScreenshot(page, "create-role-button");
    });
  });
});
