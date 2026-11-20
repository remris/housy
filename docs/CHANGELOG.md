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
