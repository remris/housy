import { expect, test } from "@playwright/test";

test("Startseite zeigt Housy", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Gebäudereinigung");
  await expect(page).toHaveTitle(/Housy/);
});
