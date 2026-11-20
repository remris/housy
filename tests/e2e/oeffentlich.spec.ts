import { expect, test } from "@playwright/test";

test("ungültiger Angebotslink zeigt Hinweis", async ({ page }) => {
  await page.goto("/angebot/00000000-0000-4000-8000-000000000000");
  await expect(page.getByText("Dieser Link ist ungültig")).toBeVisible();
});

test("unbekannte Kennung für Anfrage und Buchung ergibt 404", async ({ page }) => {
  for (const pfad of ["/anfrage/gibtesnicht", "/buchen/gibtesnicht"]) {
    const antwort = await page.goto(pfad);
    expect(antwort?.status()).toBe(404);
  }
});
