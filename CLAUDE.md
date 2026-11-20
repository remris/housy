# Housy – Projektregeln

SaaS für Gebäudereinigung, Hausmeisterservice und Fensterreinigung (1–25 Mitarbeiter).
Fachliche Grundlage: `docs/konzept.md`. **Verbindlich:** `docs/entwicklungsplan.md`.
Aktueller Stand: `progress.md`.

## Stack

- Next.js 15 (App Router, TypeScript strict + `noUncheckedIndexedAccess`), React 19
- Tailwind CSS 4, shadcn/ui (Base-UI-Variante, `src/components/ui`), Formulare mit react-hook-form + Zod
- Supabase: Postgres, Auth, Storage, RLS über `betrieb_id`; CLI als Dev-Dependency (`npx supabase …`)
- Tests: Vitest (`src/**/*.test.ts`), pgTAP (`supabase/tests`), Playwright (`tests/e2e`)
- Hosting: Vercel (fra1), Supabase-Projekt in Frankfurt

## Ordnerstruktur

```
src/app/(buero)/       Büro-Oberfläche (eingeloggt, Rollen Inhaber/Disponent)
src/app/app/           Mitarbeiter-PWA
src/app/(public)/      öffentliche Seiten: Login, Registrierung, Buchung, Freigaben
src/domain/            reine Fachlogik ohne DB/IO, immer mit Vitest-Tests
src/lib/               Supabase-Clients, Auth-Helfer, PDF, E-Mail
src/components/ui/     shadcn-Komponenten (generiert, nur gezielt anpassen)
supabase/migrations/   SQL-Migrationen inkl. RLS (nur vorwärts!)
supabase/tests/        pgTAP-Tests
tests/e2e/             Playwright
docs/                  Konzept, Plan, CHANGELOG, ADRs (docs/adr/)
```

## Regeln

- Sprache im Code: Fachbegriffe deutsch (`betrieb`, `kunde`, `einsatz`), technische Begriffe englisch ok.
- Geld immer als ganze Cent (`integer`), Helfer in `src/domain/geld.ts`.
- Jede Fachtabelle hat `betrieb_id uuid not null` + RLS (`ist_mitglied(betrieb_id)`) + pgTAP-Test.
- Migrationen nie ändern, nur neue anlegen (`npx supabase migration new <name>`).
- Fachlogik gehört nach `src/domain` und ist DB-frei testbar; UI und Server Actions rufen sie auf.
- Keine Secrets committen. `.env.local` ist ignoriert, Namen stehen in `.env.example`.
- Je Meilenstein ein Branch `m<Nr>-<thema>`, kleine Commits. Pushen und Mergen macht der Inhaber.
- Nur bei „Offenen Entscheidungen“ im Plan oder Irreversiblem nachfragen.

## Befehle

```bash
npm run dev          # Entwicklung
npm run lint         # ESLint
npm run format       # Prettier
npm run typecheck    # tsc
npm test             # Vitest
npm run test:e2e     # Playwright
npm run db:start     # lokale Supabase (Docker)
npm run db:reset     # Migrationen + seed neu einspielen
npm run db:test      # pgTAP
npm run db:types     # TS-Typen aus lokaler DB generieren
```

## Definition of Done

- [ ] Lint, Format, Typecheck, Unit-, DB- und E2E-Tests grün (CI)
- [ ] Neue Tabellen: `betrieb_id`, RLS, pgTAP-Test „Betrieb B sieht nichts von Betrieb A“
- [ ] Fachlogik mit Szenario-Tests in `src/domain`
- [ ] UI geprüft: Büro auf Laptop-Breite, Mitarbeiter-App auf Handy-Breite
- [ ] `docs/CHANGELOG.md` ergänzt, Haken in `docs/entwicklungsplan.md`, `progress.md` aktualisiert
