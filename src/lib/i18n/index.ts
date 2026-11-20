import { type Schluessel, type Woerterbuch, de } from "./de";
import { en } from "./en";
import { pl } from "./pl";
import { ro } from "./ro";
import { tr } from "./tr";

/**
 * Übersetzungen der Mitarbeiter-App. Neue Sprache: Datei nach dem Muster von en.ts anlegen,
 * hier eintragen und in SPRACHEN (lib/schemas/konto.ts) sowie im DB-Check von mitglied.sprache.
 * Nicht übersetzte Sprachen (z. B. Arabisch) fallen auf Deutsch zurück.
 */
export const WOERTERBUECHER: Record<string, Woerterbuch> = { de, en, tr, pl, ro };
export const APP_SPRACHEN = ["de", "en", "tr", "pl", "ro"] as const;

export type Uebersetzer = (
  schluessel: Schluessel,
  werte?: Record<string, string | number>,
) => string;

export function uebersetzer(sprache: string | null | undefined): Uebersetzer {
  const w = WOERTERBUECHER[sprache ?? "de"] ?? de;
  return (schluessel, werte) => {
    let text = w[schluessel] ?? de[schluessel];
    if (werte) {
      for (const [k, v] of Object.entries(werte)) text = text.replaceAll(`{${k}}`, String(v));
    }
    return text;
  };
}

export type { Schluessel };
