/**
 * Datumshelfer auf Basis von ISO-Strings "YYYY-MM-DD" (ohne Zeitzone).
 * Intern wird mit UTC-Mitternacht gerechnet, damit Sommerzeit keine Tage verschiebt.
 */
export type Iso = string;

const TAG_MS = 86_400_000;

export function zuDatum(iso: Iso): Date {
  const [j, m, t] = iso.split("-").map(Number);
  return new Date(Date.UTC(j!, m! - 1, t!));
}

export function zuIso(d: Date): Iso {
  return d.toISOString().slice(0, 10);
}

export function plusTage(iso: Iso, tage: number): Iso {
  return zuIso(new Date(zuDatum(iso).getTime() + tage * TAG_MS));
}

export function tageZwischen(von: Iso, bis: Iso): number {
  return Math.round((zuDatum(bis).getTime() - zuDatum(von).getTime()) / TAG_MS);
}

/** Wochentag nach ISO: 1 = Montag … 7 = Sonntag */
export function wochentag(iso: Iso): number {
  const t = zuDatum(iso).getUTCDay();
  return t === 0 ? 7 : t;
}

/** Montag der Woche */
export function wochenbeginn(iso: Iso): Iso {
  return plusTage(iso, 1 - wochentag(iso));
}

export function letzterTagImMonat(jahr: number, monat1: number): number {
  return new Date(Date.UTC(jahr, monat1, 0)).getUTCDate();
}

/** Addiert Monate; Tag wird auf das Monatsende begrenzt (31.01. + 1 Monat = 28./29.02.). */
export function plusMonate(iso: Iso, monate: number): Iso {
  const d = zuDatum(iso);
  const gesamt = d.getUTCFullYear() * 12 + d.getUTCMonth() + monate;
  const jahr = Math.floor(gesamt / 12);
  const monat0 = gesamt % 12;
  const tag = Math.min(d.getUTCDate(), letzterTagImMonat(jahr, monat0 + 1));
  return zuIso(new Date(Date.UTC(jahr, monat0, tag)));
}

export function monatsende(iso: Iso): Iso {
  const d = zuDatum(iso);
  return zuIso(
    new Date(
      Date.UTC(
        d.getUTCFullYear(),
        d.getUTCMonth(),
        letzterTagImMonat(d.getUTCFullYear(), d.getUTCMonth() + 1),
      ),
    ),
  );
}

export function* tageImBereich(von: Iso, bis: Iso): Generator<Iso> {
  for (let d = von; d <= bis; d = plusTage(d, 1)) yield d;
}

export function heuteIso(zeitzone = "Europe/Berlin"): Iso {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: zeitzone }).format(new Date());
}

export function formatDatum(iso: Iso | null | undefined): string {
  if (!iso) return "–";
  const [j, m, t] = iso.slice(0, 10).split("-");
  return `${t}.${m}.${j}`;
}

export const WOCHENTAGE_KURZ = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"] as const;

/** ISO-Kalenderwoche (KW beginnt montags, KW 1 enthält den 4. Januar). */
export function kalenderwoche(iso: Iso): { jahr: number; woche: number } {
  const donnerstag = plusTage(iso, 4 - wochentag(iso));
  const jahr = zuDatum(donnerstag).getUTCFullYear();
  const woche = Math.floor(tageZwischen(`${jahr}-01-01`, donnerstag) / 7) + 1;
  return { jahr, woche };
}
