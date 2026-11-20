import { z } from "zod";
import {
  ganzzahl,
  optDezimal,
  optEmail,
  optEuro,
  optPlz,
  optText,
  pflichtText,
  uuid,
} from "./helfer";

export const ANFRAGESTATUS: Record<
  string,
  { text: string; ton: "ok" | "warn" | "fehler" | "neutral" }
> = {
  neu: { text: "neu", ton: "warn" },
  in_bearbeitung: { text: "in Bearbeitung", ton: "neutral" },
  angebot: { text: "Angebot verschickt", ton: "neutral" },
  gewonnen: { text: "gewonnen", ton: "ok" },
  verloren: { text: "verloren", ton: "fehler" },
};

export const ANGEBOTSSTATUS: Record<
  string,
  { text: string; ton: "ok" | "warn" | "fehler" | "neutral" }
> = {
  entwurf: { text: "Entwurf", ton: "neutral" },
  versendet: { text: "verschickt", ton: "warn" },
  angenommen: { text: "angenommen", ton: "ok" },
  abgelehnt: { text: "abgelehnt", ton: "fehler" },
};

export const QUELLE_TEXT: Record<string, string> = {
  formular: "Website",
  telefon: "Telefon",
  buchung: "Online-Buchung",
};

const kundentyp = z.enum(["firma", "verwaltung", "privat", "oeffentlich"]);

/** Öffentliches Anfrageformular und telefonische Anfrage im Büro */
export const anfrageSchema = z
  .object({
    kundentyp,
    name: pflichtText("Name").refine((v) => v.length >= 2, "Name eingeben"),
    firma: optText(),
    email: optEmail,
    telefon: optText(50),
    strasse: optText(),
    plz: optPlz,
    ort: optText(100),
    leistung: optText(300),
    nachricht: optText(4000),
    wunschtermin: optText(200),
  })
  .refine((d) => d.email || d.telefon, {
    message: "E-Mail oder Telefon angeben",
    path: ["email"],
  });

export const oeffentlicheAnfrageSchema = z
  .object({
    kundentyp,
    name: pflichtText("Name").refine((v) => v.length >= 2, "Name eingeben"),
    firma: optText(),
    email: optEmail,
    telefon: optText(50),
    strasse: optText(),
    plz: optPlz,
    ort: optText(100),
    leistung: optText(300),
    nachricht: optText(4000),
    wunschtermin: optText(200),
    datenschutz: z.literal(true, { error: "Bitte zustimmen" }),
    /** Honigtopf gegen Bots: muss leer bleiben */
    website: z.string().max(0).optional(),
  })
  .refine((d) => d.email || d.telefon, {
    message: "E-Mail oder Telefon angeben",
    path: ["email"],
  });

const datum = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Datum wählen");
const optDatum = z
  .union([z.string(), z.null()])
  .transform((v) => (v ? v : null))
  .pipe(
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable(),
  );
const optUuid = z
  .union([z.string(), z.null()])
  .transform((v) => (v ? v : null))
  .pipe(z.string().uuid().nullable());

export const angebotSchema = z
  .object({
    kunde_id: optUuid,
    objekt_id: optUuid,
    kundentyp,
    empfaenger_name: pflichtText("Name des Empfängers"),
    empfaenger_firma: optText(),
    empfaenger_email: optEmail,
    empfaenger_telefon: optText(50),
    strasse: optText(),
    plz: optPlz,
    ort: optText(100),
    objekt_name: optText(),
    objekt_strasse: optText(),
    objekt_plz: optPlz,
    objekt_ort: optText(100),
    titel: pflichtText("Titel"),
    einleitung: optText(4000),
    beginn: datum,
    gueltig_bis: optDatum,
    abrechnungsart: z.enum(["pauschale", "aufwand", "einzelauftrag"]),
    pauschale_cent: optEuro,
    laufzeit_monate: ganzzahl(0, 240),
    kuendigungsfrist_monate: ganzzahl(0, 24),
  })
  .refine((d) => d.abrechnungsart !== "pauschale" || d.pauschale_cent !== null, {
    message: "Monatspauschale eingeben",
    path: ["pauschale_cent"],
  });

const tage = z
  .array(z.union([z.string(), z.number()]))
  .transform((a) => [...new Set(a.map(Number))].filter((n) => n >= 1 && n <= 7).sort());

export const angebotsleistungSchema = z
  .object({
    id: uuid.optional(),
    angebot_id: uuid,
    vorlage_id: z.string().uuid("Vorlage wählen"),
    preis_id: optUuid,
    bezeichnung: pflichtText("Bezeichnung"),
    beschreibung: optText(1000),
    frequenz: z.enum(["taeglich", "woechentlich", "monatlich", "einmalig"]),
    intervall: ganzzahl(1, 104),
    wochentage: tage,
    menge_je_einsatz: optDezimal(0.001, 100_000).refine((v) => v !== null, "Menge eingeben"),
    einheit: z.enum(["pauschal", "stunde", "m2", "fenster", "stueck", "einsatz"]),
    preis_cent: optEuro,
  })
  .refine((l) => l.frequenz !== "woechentlich" || l.wochentage.length > 0, {
    message: "Mindestens einen Wochentag wählen",
    path: ["wochentage"],
  });

/** Online-Buchung (öffentlich) */
export const buchungSchema = z.object({
  name: pflichtText("Name").refine((v) => v.length >= 2, "Name eingeben"),
  email: z.string().trim().toLowerCase().email("Gültige E-Mail eingeben"),
  telefon: optText(50),
  strasse: pflichtText("Straße"),
  plz: z
    .string()
    .trim()
    .regex(/^\d{5}$/, "PLZ hat 5 Ziffern"),
  ort: pflichtText("Ort", 100),
  nachricht: optText(1000),
  anzahl: z.record(z.string(), z.number().int().min(0).max(500)),
  rahmen: z.boolean(),
  datum,
  halbtag: z.enum(["vormittag", "nachmittag"]),
  datenschutz: z.literal(true, { error: "Bitte zustimmen" }),
  website: z.string().max(0).optional(),
});

export const websiteSchema = z.object({
  anfrage_aktiv: z.boolean(),
  datenschutz_url: z
    .union([z.string(), z.null()])
    .transform((v) => (v?.trim() ? v.trim() : null))
    .pipe(z.string().url("Adresse wie https://…").nullable()),
  impressum_url: z
    .union([z.string(), z.null()])
    .transform((v) => (v?.trim() ? v.trim() : null))
    .pipe(z.string().url("Adresse wie https://…").nullable()),
});

export const buchungEinstellungenSchema = z
  .object({
    aktiv: z.boolean(),
    vorlageId: z
      .union([z.string(), z.null()])
      .transform((v) => (v ? v : null))
      .pipe(z.string().uuid().nullable()),
    positionen: z
      .array(
        z.object({
          id: z.string().regex(/^[a-z0-9-]{1,30}$/),
          name: pflichtText("Bezeichnung", 100),
          preisCent: z.number().int().min(0).max(1_000_000),
          minuten: z.number().min(0).max(600),
        }),
      )
      .min(1, "Mindestens eine Fensterart")
      .max(12),
    rahmenProzent: z.number().min(0).max(200),
    anfahrtCent: z.number().int().min(0).max(100_000),
    mindestpreisCent: z.number().int().min(0).max(1_000_000),
    ustSatz: z.union([z.literal(19), z.literal(7)]),
    vorlaufTage: z.number().int().min(1).max(60),
    horizontTage: z.number().int().min(7).max(60),
    ruestMinuten: z.number().int().min(0).max(240),
  })
  .refine((e) => !e.aktiv || e.vorlageId, {
    message: "Für die Buchung eine Auftragsvorlage wählen",
    path: ["vorlageId"],
  });
