import { expect, test } from "@playwright/test";

test("Büro ohne Anmeldung leitet zum Login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("button", { name: "Anmelden" })).toBeVisible();
});

test("Registrierung prüft Eingaben im Browser", async ({ page }) => {
  await page.goto("/registrieren");
  await page.getByRole("button", { name: "Kostenlos testen" }).click();
  await expect(page.getByText("Name des Betriebs eingeben")).toBeVisible();
  await expect(page.getByText("Mindestens eine Branche wählen")).toBeVisible();
  await expect(page.getByText("Gültige E-Mail-Adresse eingeben")).toBeVisible();
});

test("ungültige Einladung zeigt Hinweis", async ({ page }) => {
  await page.goto("/einladung/kein-token");
  await expect(page.getByText(/ungültig, abgelaufen/)).toBeVisible();
});

for (const pfad of [
  "/kunden",
  "/objekte/neu",
  "/kunden/import",
  "/einstellungen/team",
  "/vorlagen",
  "/artikel",
  "/preisliste",
  "/vertraege",
  "/vertraege/neu",
  "/einstellungen/vertraege",
]) {
  test(`${pfad} ist geschützt`, async ({ page }) => {
    await page.goto(pfad);
    await expect(page).toHaveURL(/\/login/);
  });
}
