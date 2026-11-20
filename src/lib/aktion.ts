import { z } from "zod";

/** Einheitliches Ergebnis von Server Actions. */
export type AktionErgebnis<T = undefined> =
  | { ok: true; daten?: T; meldung?: string }
  | { ok: false; fehler: string; feldfehler?: Record<string, string[] | undefined> };

export function fehler(text: string): AktionErgebnis<never> {
  return { ok: false, fehler: text };
}

/** Validiert Eingaben mit Zod und liefert Feldfehler im Aktionsformat. */
export function pruefe<S extends z.ZodType>(
  schema: S,
  eingabe: unknown,
): { ok: true; daten: z.infer<S> } | { ok: false; ergebnis: AktionErgebnis<never> } {
  const r = schema.safeParse(eingabe);
  if (r.success) return { ok: true, daten: r.data };
  return {
    ok: false,
    ergebnis: {
      ok: false,
      fehler: "Bitte Eingaben prüfen.",
      feldfehler: z.flattenError(r.error).fieldErrors as Record<string, string[] | undefined>,
    },
  };
}

/** Übersetzt typische Postgres-/Supabase-Fehler in verständliche Meldungen. */
export function dbFehler(e: { message?: string; code?: string } | null | undefined): string {
  if (!e) return "Unbekannter Fehler.";
  switch (e.code) {
    case "42501":
      return e.message?.includes("row-level security")
        ? "Keine Berechtigung für diese Aktion."
        : (e.message ?? "Keine Berechtigung.");
    case "23505":
      return "Eintrag existiert bereits.";
    case "23503":
      return "Eintrag wird noch verwendet oder Bezug fehlt.";
    default:
      return e.message ?? "Unbekannter Fehler.";
  }
}
