import { test, expect } from "@playwright/test";

test.describe("Admin Dashboard", () => {
  test.use({ storageState: "e2e/.auth/user.json" });

  test("should access admin dashboard as authenticated admin", async ({
    page,
  }) => {
    await page.goto("/admin");

    // Should be able to access admin area
    await expect(page.locator("text=Admin Dashboard")).toBeVisible();
  });

  test("should access user management", async ({ page }) => {
    await page.goto("/admin/users");

    // Should be able to access user management
    await expect(page.locator("text=User Management")).toBeVisible();

    // Should see the albeorla user
    await expect(page.locator("text=albeorla")).toBeVisible();
    await expect(page.locator("text=albertjorlando@gmail.com")).toBeVisible();
  });

  test("should access role management", async ({ page }) => {
    await page.goto("/admin/roles");

    // Should be able to access role management
    await expect(page.locator("text=Role Management")).toBeVisible();

    // Should see the ADMIN and USER roles
    await expect(page.locator("text=ADMIN")).toBeVisible();
    await expect(page.locator("text=USER")).toBeVisible();
  });

  test("should access permission management", async ({ page }) => {
    await page.goto("/admin/permissions");

    // Should be able to access permission management
    await expect(page.locator("text=Permission Management")).toBeVisible();

    // Should see various permissions
    await expect(page.locator("text=manage:users")).toBeVisible();
    await expect(page.locator("text=view:dashboard")).toBeVisible();
  });

  test("should access webhook management", async ({ page }) => {
    await page.goto("/admin/webhooks");

    // Should be able to access webhook management
    await expect(page.locator("text=Webhook Management")).toBeVisible();
  });
});
