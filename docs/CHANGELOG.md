# Changelog

Alle nennenswerten Änderungen je Meilenstein. Format angelehnt an „Keep a Changelog“.

## [M0] Projekt-Setup – 2026-11-20

### Hinzugefügt

- Next.js 15 (App Router, TypeScript strict, `noUncheckedIndexedAccess`), Tailwind CSS 4, shadcn/ui
- ESLint (+ Prettier-Kompatibilität), Prettier mit Tailwind-Plugin, `.gitattributes` (LF)
- Supabase CLI als Dev-Dependency, `supabase/config.toml`, Supabase-Clients für Browser, Server und Middleware
- Vitest (Fachlogik, erstes Modul `src/domain/geld.ts`), Playwright (Desktop + Mobil), pgTAP-Grundtest
- GitHub Actions: Lint, Format, Typecheck, Unit-Tests, Build, E2E sowie DB-Job (Migrationen + pgTAP)
- `vercel.json` (Region fra1), `.env.example`, README mit Startanleitung, `CLAUDE.md` mit Projektregeln
- Startseite „Housy“ (deutsch)

### Hinweise

- Lokal läuft Node 20.11; dafür ist `magic-string` per `overrides` auf 0.30.x gepinnt. Empfehlung: Node 22 LTS.

## [M1] Betriebe, Benutzer, Rollen – 2026-11-20

### Hinzugefügt
- Migration `mandanten`: Tabellen `betrieb`, `mitglied` (Rolle Inhaber/Disponent/Mitarbeiter, Sprache), `einladung`
- RLS-Grundmuster mit `ist_mitglied()`, `hat_rolle()`, `ist_buero()`, `ist_inhaber()` (SECURITY DEFINER)
- Registrierung per Trigger auf `auth.users`: legt Betrieb + Inhaber an oder nimmt eine Einladung an
- Schutz: Rollen ändert nur der Inhaber, der letzte aktive Inhaber bleibt erhalten
- Einladungen: Link zum Kopieren; mit `SUPABASE_SECRET_KEY` verschickt Supabase die Einladungs-Mail
- Storage-Bucket `logos` mit Policies (nur Inhaber des Betriebs schreibt in seinen Ordner)
- Seiten: Login, Registrierung, Passwort vergessen/neu, Einladung annehmen, Betrieb anlegen, `/auth/confirm`
- Büro-Layout mit Navigation (Desktop + Mobil), Übersicht, Einstellungen (Firmendaten, Steuer, Bank, Logo), Team
- Formular-Baukasten (react-hook-form + Zod, gleiche Prüfung in der Server Action), IBAN-Prüfung in `src/domain/iban.ts`
- Tests: pgTAP `001_mandanten`, lokale DB-Tests mit PGlite (`tests/db`), E2E für Login-Umleitung und Validierung
- `scripts/db-types-pglite.mjs`: erzeugt `database.types.ts` ohne Docker
