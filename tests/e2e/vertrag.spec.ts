import { expect, test } from "@playwright/test";

test("ungültiger Vertragslink zeigt Hinweis", async ({ page }) => {
  await page.goto("/vertrag/kein-token");
  await expect(page.getByText("Dieser Link ist ungültig.")).toBeVisible();
});

test("Vertrags-PDF mit ungültigem Token ist 404", async ({ request }) => {
  const r = await request.get("/vertrag/kein-token/pdf");
  expect(r.status()).toBe(404);
});

test("Cron-Job ohne Geheimnis wird abgewiesen", async ({ request }) => {
  const r = await request.get("/api/jobs/serien");
  expect(r.status()).toBe(401);
});
