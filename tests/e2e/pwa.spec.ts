import { expect, test } from "@playwright/test";

test("Manifest beschreibt die installierbare App", async ({ request }) => {
  const r = await request.get("/manifest.webmanifest");
  expect(r.ok()).toBe(true);
  const m = await r.json();
  expect(m.start_url).toBe("/app");
  expect(m.display).toBe("standalone");
  expect(m.icons.map((i: { sizes: string }) => i.sizes)).toEqual(
    expect.arrayContaining(["192x192", "512x512"]),
  );
});

test("Service Worker und Icons werden ausgeliefert", async ({ request }) => {
  for (const pfad of ["/sw.js", "/icons/icon-192.png", "/icons/icon-512.png"]) {
    expect((await request.get(pfad)).ok(), pfad).toBe(true);
  }
});

test("QR-Code-Link öffnet die App (ohne Login → Anmeldung)", async ({ page }) => {
  await page.goto("/qr/3f1c0f7e-0000-4000-8000-000000000001");
  await expect(page).toHaveURL(/\/login/);
});
