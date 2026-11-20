/**
 * DATEV-Export „Buchungsstapel“ (EXTF, Formatversion 700, Kategorie 21) für den Steuerberater.
 * Je Rechnung und Steuersatz eine Buchung: Debitor (10000 + Kundennummer) an Erlöskonto
 * (Automatikkonto, daher ohne BU-Schlüssel). Stornos werden im Haben gebucht.
 * Kodierung: Windows-1252, Trennzeichen Semikolon, Dezimalkomma (DATEV-Vorgabe).
 * Hinweis: Kontenwahl mit dem Steuerberater abstimmen; Import vor dem Echtbetrieb testen.
 */
import type { Iso } from "./datum";

export type Kontenrahmen = "skr03" | "skr04";

/** Erlöskonten (Automatikkonten) je Steuersatz; 0 = Kleinunternehmer § 19 UStG */
export const ERLOESKONTEN: Record<Kontenrahmen, Record<number, number>> = {
  skr03: { 19: 8400, 7: 8300, 0: 8195 },
  skr04: { 19: 4400, 7: 4300, 0: 4185 },
};

export const debitor = (kundennummer: number) => 10000 + kundennummer;

export type DatevRechnung = {
  nummer: string;
  datum: Iso;
  storno: boolean;
  kundennummer: number;
  kunde: string;
  /** brutto je Steuersatz in Cent */
  gruppen: { satz: number; bruttoCent: number }[];
};

export type DatevKopf = {
  beraternummer: number;
  mandantennummer: number;
  kontenrahmen: Kontenrahmen;
  von: Iso;
  bis: Iso;
  /** Zeitpunkt der Erzeugung (für den Kopf) */
  erzeugt: Date;
  bezeichnung: string;
};

const feld = (s: string) => `"${s.replace(/"/g, '""')}"`;
const jjjjmmtt = (iso: Iso) => iso.replaceAll("-", "");
const ttmm = (iso: Iso) => `${iso.slice(8, 10)}${iso.slice(5, 7)}`;
const betrag = (cent: number) => (cent / 100).toFixed(2).replace(".", ",");

function zeitstempel(d: Date): string {
  const z = (n: number, l = 2) => String(n).padStart(l, "0");
  return `${d.getUTCFullYear()}${z(d.getUTCMonth() + 1)}${z(d.getUTCDate())}${z(d.getUTCHours())}${z(d.getUTCMinutes())}${z(d.getUTCSeconds())}${z(d.getUTCMilliseconds(), 3)}`;
}

export const DATEV_SPALTEN = [
  "Umsatz (ohne Soll/Haben-Kz)",
  "Soll/Haben-Kennzeichen",
  "WKZ Umsatz",
  "Kurs",
  "Basis-Umsatz",
  "WKZ Basis-Umsatz",
  "Konto",
  "Gegenkonto (ohne BU-Schlüssel)",
  "BU-Schlüssel",
  "Belegdatum",
  "Belegfeld 1",
  "Belegfeld 2",
  "Skonto",
  "Buchungstext",
];

export function datevBuchungsstapel(kopf: DatevKopf, rechnungen: DatevRechnung[]): string {
  const wjBeginn = `${kopf.von.slice(0, 4)}0101`;
  const kopfzeile = [
    feld("EXTF"),
    "700",
    "21",
    feld("Buchungsstapel"),
    "13",
    zeitstempel(kopf.erzeugt),
    "",
    feld("HY"),
    feld(""),
    feld(""),
    String(kopf.beraternummer),
    String(kopf.mandantennummer),
    wjBeginn,
    "4",
    jjjjmmtt(kopf.von),
    jjjjmmtt(kopf.bis),
    feld(kopf.bezeichnung.slice(0, 30)),
    feld(""),
    "1",
    "0",
    "0",
    feld("EUR"),
    "",
    feld(""),
    "",
    "",
    feld(""),
    "",
    "",
    feld(""),
    feld(""),
  ].join(";");
  const zeilen = rechnungen.flatMap((r) =>
    r.gruppen
      .filter((g) => g.bruttoCent !== 0)
      .map((g) =>
        [
          betrag(Math.abs(g.bruttoCent)),
          feld(r.storno ? "H" : "S"),
          feld("EUR"),
          "",
          "",
          feld(""),
          String(debitor(r.kundennummer)),
          String(ERLOESKONTEN[kopf.kontenrahmen][g.satz] ?? ERLOESKONTEN[kopf.kontenrahmen][19]),
          feld(""),
          ttmm(r.datum),
          feld(r.nummer.slice(0, 36)),
          feld(""),
          "",
          feld(`${r.storno ? "Storno " : ""}${r.kunde}`.slice(0, 60)),
        ].join(";"),
      ),
  );
  return [kopfzeile, DATEV_SPALTEN.map(feld).join(";"), ...zeilen].join("\r\n") + "\r\n";
}

/** Windows-1252 für den DATEV-Import (Zeichen außerhalb werden zu „?“). */
export function alsWindows1252(text: string): Uint8Array {
  const sonder: Record<string, number> = {
    "€": 0x80,
    "‚": 0x82,
    ƒ: 0x83,
    "„": 0x84,
    "…": 0x85,
    "†": 0x86,
    "‡": 0x87,
    ˆ: 0x88,
    "‰": 0x89,
    Š: 0x8a,
    "‹": 0x8b,
    Œ: 0x8c,
    Ž: 0x8e,
    "‘": 0x91,
    "’": 0x92,
    "“": 0x93,
    "”": 0x94,
    "•": 0x95,
    "–": 0x96,
    "—": 0x97,
    "˜": 0x98,
    "™": 0x99,
    š: 0x9a,
    "›": 0x9b,
    œ: 0x9c,
    ž: 0x9e,
    Ÿ: 0x9f,
  };
  const bytes: number[] = [];
  for (const z of text) {
    const code = z.codePointAt(0)!;
    if (sonder[z] !== undefined) bytes.push(sonder[z]);
    else if (code < 0x80 || (code >= 0xa0 && code <= 0xff)) bytes.push(code);
    else bytes.push(0x3f);
  }
  return new Uint8Array(bytes);
}
