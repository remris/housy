# Housy

Verwaltungssoftware für Gebäudereinigung, Hausmeisterservice und Fensterreinigung:
Kunden und Objekte, Verträge, Einsatzplanung, Mitarbeiter-App, Leistungsnachweis,
Rechnung/E-Rechnung und Materialprognose.

- Konzept: [docs/konzept.md](docs/konzept.md)
- Entwicklungsplan: [docs/entwicklungsplan.md](docs/entwicklungsplan.md)
- Änderungen: [docs/CHANGELOG.md](docs/CHANGELOG.md)
- Aktueller Stand: [progress.md](progress.md)

## Voraussetzungen

- Node.js 22 LTS (mind. 20.11; 22 empfohlen, CI nutzt 22)
- Git, Docker Desktop (für die lokale Supabase)

## Start

```bash
npm install
cp .env.example .env.local   # Werte eintragen (siehe unten)
npm run dev                  # http://localhost:3000
```

### Lokale Datenbank

```bash
npm run db:start      # startet Supabase in Docker (erstes Mal dauert)
npx supabase status   # zeigt API-URL und Publishable Key
npm run db:reset      # Migrationen + Seed neu einspielen
npm run db:test       # pgTAP-Tests (RLS)
```

Für die Arbeit gegen die lokale Datenbank in `.env.local` die Werte aus `npx supabase status`
eintragen. Für das gehostete Projekt (Frankfurt) gelten die Werte aus dem Supabase-Dashboard.

### Gehostete Datenbank (einmalig)

```bash
npx supabase login
npx supabase link --project-ref xqnnnerqpixtjkipzqlt
npx supabase db push      # Migrationen ins gehostete Projekt
```

## Tests

```bash
npm run lint && npm run typecheck && npm test
npx playwright install chromium   # einmalig
npm run test:e2e
```

## Deployment

Vercel-Projekt mit dem GitHub-Repo verbinden, Region `fra1`, Umgebungsvariablen aus
`.env.example` setzen. Jeder Merge nach `main` deployt automatisch.
