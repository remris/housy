# Housy – Fortschritt

Stand: 2026-11-20 · aktueller Branch: `m2-kunden-objekte`

## Wo wir stehen

| Meilenstein                      | Branch              | Status                                             |
| -------------------------------- | ------------------- | -------------------------------------------------- |
| M0 Projekt-Setup                 | `m0-setup`          | fertig (bis auf lokale DB und Vercel, siehe unten) |
| M1 Betriebe, Benutzer, Rollen    | `m1-betriebe`       | fertig                                             |
| M2 Kunden und Objekte            | `m2-kunden-objekte` | fertig                                             |
| M3 Vorlagen, Artikel, Preisliste | –                   | als Nächstes                                       |

Die Branches bauen aufeinander auf (m1 von m0, m2 von m1 …). Zum Mergen reicht es, den
jeweils neuesten Branch nach `main` zu mergen, oder der Reihe nach.

## Was du tun musst

1. **WSL installieren, damit Docker läuft** (Docker Desktop startet, aber der Daemon nicht,
   weil WSL fehlt). In einer Admin-PowerShell: `wsl --install`, neu starten, Docker Desktop öffnen.
   Danach: `npm run db:start` und `npm run db:test`.
2. **Migrationen ins gehostete Supabase-Projekt** (einmalig, dann nach jedem Meilenstein):
   `npx supabase login`, `npx supabase link --project-ref xqnnnerqpixtjkipzqlt`, `npx supabase db push`.
   Ohne das funktionieren Login/Registrierung gegen die `.env.local`-Werte noch nicht.
3. **Supabase Auth-Einstellungen** (Dashboard → Authentication → URL Configuration):
   Site URL und Redirect-URLs `http://localhost:3000/**` sowie die spätere Vercel-Domain eintragen.
4. **Vercel-Projekt** mit dem Repo verbinden, Umgebungsvariablen aus `.env.example` setzen.
   Optional `SUPABASE_SECRET_KEY` (nur Vercel/`.env.local`), dann verschickt Housy Einladungs-Mails selbst.
5. **Node 22 LTS** installieren (lokal läuft 20.11; funktioniert, aber `magic-string` ist
   per `overrides` gepinnt und supabase-js warnt).
6. Pushen und Mergen der Branches.

## Wie getestet wird

- `npm test`: Fachlogik (Vitest) **und** Datenbank-Tests in PGlite (Postgres als WASM, ohne Docker):
  Migrationen + Supabase-Nachbau (`tests/db/supabase-stub.sql`), RLS-Szenarien, und die
  pgTAP-Dateien aus `supabase/tests` über einen pgTAP-Nachbau.
- `npm run db:test`: echte pgTAP-Tests gegen lokale Supabase (braucht Docker; läuft in der CI).
- `npm run test:e2e`: Playwright (Desktop + Mobil), aktuell ohne Datenbank (Seiten, Umleitungen, Validierung).
- CI (`.github/workflows/ci.yml`): Lint, Format, Typecheck, Unit/DB, Build, E2E + DB-Job mit Supabase CLI.

Letzter lokaler Lauf: Lint, Format, Typecheck grün · 47 Unit-/DB-Tests grün · Build grün · 16 E2E grün.

**Nicht geprüft:** Abläufe mit echter Supabase (Registrierung mit Mail, Login, Speichern,
Uploads) – dafür fehlen Docker bzw. die Migrationen im gehosteten Projekt. CI ist noch nie gelaufen
(erst nach dem ersten Push).

## Offene Entscheidungen (aus dem Plan)

- [x] Neues Repo oder Rently Yours → neues Repo (ADR 0001)
- [ ] Produktname und Domain (vor M11) – Name „Housy“ steht, Domain offen
- [ ] Google Maps oder Mapbox (vor M5) – **nötig vor M5**
- [ ] Sprachen der Mitarbeiter-App zum Start (vor M6)
- [ ] Freie Positionen durch Mitarbeiter oder nur Preisliste (vor M6)
- [ ] Pilotbetriebe (vor M12)

## Technische Notizen

- Migrationen: `supabase/migrations/2026112010*` (Mandanten, Logos), `…110000` (Kunden/Objekte).
- Typen: `npm run db:types` (mit Docker, maßgeblich) oder `npm run db:types:pglite` (ohne Docker).
- Muster: jede Fachtabelle `betrieb_id` + RLS über `ist_mitglied()`/`ist_buero()`/`ist_inhaber()`;
  Kind-Tabellen mit zusammengesetztem FK `(parent_id, betrieb_id)`.
- Formulare: `useAktionsFormular` (react-hook-form + Zod) → Server Action prüft mit demselben Schema.
- Geld immer in Cent (`src/domain/geld.ts`).
