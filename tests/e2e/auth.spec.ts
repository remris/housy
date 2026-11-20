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
  "/planung",
  "/planung/offen",
  "/planung/mitarbeiter",
  "/planung/fahrzeuge",
  "/rueckmeldungen",
  "/zeiten",
  "/zeiten/monat",
  "/nachweise",
  "/einstellungen/nachweise",
  "/app",
]) {
  test(`${pfad} ist geschützt`, async ({ page }) => {
    await page.goto(pfad);
    await expect(page).toHaveURL(/\/login/);
  });
}

test("Nachweis-Job ohne Cron-Geheimnis wird abgewiesen", async ({ request }) => {
  const r = await request.get("/api/jobs/nachweise");
  expect(r.status()).toBe(401);
});

test("App-Meldung nach dem Auschecken braucht eine Anmeldung", async ({ request }) => {
  const r = await request.post("/api/app/abgeschlossen", {
    data: { einsatzIds: ["5f1c2f8e-7a0b-4c55-9b1e-2d3c4b5a6f70"] },
    maxRedirects: 0,
  });
  expect(r.status()).not.toBe(202);
  expect(r.status()).toBeGreaterThanOrEqual(300);
});
