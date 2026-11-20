// Service Worker der Mitarbeiter-App (Housy).
// - /app: zuerst Netz, bei fehlendem Netz die zuletzt geladene Seite aus dem Cache
// - /_next/static: Cache zuerst (Dateien sind unveränderlich)
// - Icons/Manifest: aus dem Cache, im Hintergrund aktualisiert
// Daten (Einsätze, Warteschlange) liegen nicht hier, sondern in IndexedDB (Dexie).
const VERSION = "housy-v1";
const SEITEN = `${VERSION}-seiten`;
const STATISCH = `${VERSION}-statisch`;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATISCH)
      .then((c) =>
        c.addAll([
          "/manifest.webmanifest",
          "/icons/icon-192.png",
          "/icons/icon-512.png",
          "/icons/apple-touch-icon.png",
        ]),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((namen) =>
        Promise.all(namen.filter((n) => !n.startsWith(VERSION)).map((n) => caches.delete(n))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // App-Seite: Netz zuerst, sonst Cache (ohne Query)
  if (req.mode === "navigate" && (url.pathname === "/app" || url.pathname.startsWith("/app/"))) {
    event.respondWith(
      fetch(req)
        .then((antwort) => {
          if (antwort.ok && !antwort.redirected) {
            const kopie = antwort.clone();
            caches.open(SEITEN).then((c) => c.put("/app", kopie));
          }
          return antwort;
        })
        .catch(() =>
          caches
            .match("/app", { cacheName: SEITEN })
            .then((r) => r || new Response("Offline", { status: 503 })),
        ),
    );
    return;
  }

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(STATISCH).then((c) =>
        c.match(req).then(
          (treffer) =>
            treffer ||
            fetch(req).then((antwort) => {
              if (antwort.ok) c.put(req, antwort.clone());
              return antwort;
            }),
        ),
      ),
    );
    return;
  }

  if (url.pathname.startsWith("/icons/") || url.pathname === "/manifest.webmanifest") {
    event.respondWith(
      caches.open(STATISCH).then((c) =>
        c.match(req).then((treffer) => {
          const netz = fetch(req)
            .then((antwort) => {
              if (antwort.ok) c.put(req, antwort.clone());
              return antwort;
            })
            .catch(() => treffer);
          return treffer || netz;
        }),
      ),
    );
  }
});
