# ADR 0001: Neues Repository und Tech-Stack

- Status: angenommen
- Datum: 2026-11-20

## Kontext

Offene Entscheidung aus dem Plan: neues Repo oder Teile aus „Rently Yours“ übernehmen.

## Entscheidung

Neues Repository `remris/housy`. Stack wie im Entwicklungsplan: Next.js (App Router) auf Vercel fra1,
Supabase (Frankfurt) mit RLS über `betrieb_id`, Fachlogik in `src/domain` mit Vitest.
Bausteine aus Rently Yours (z. B. Buchung) werden bei Bedarf neu und passend implementiert, nicht kopiert.

## Folgen

- Keine Altlasten, aber Online-Buchung (M10) wird neu gebaut.
- Geldbeträge durchgehend in Cent (integer).
