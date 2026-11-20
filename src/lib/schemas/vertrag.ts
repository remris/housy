import { z } from "zod";
import { ganzzahl, optDezimal, optEuro, optText, pflichtText, uuid } from "./helfer";

export const VERTRAGSSTATUS = {
  entwurf: "Entwurf",
  aktiv: "Aktiv",
  gekuendigt: "Gekündigt",
  beendet: "Beendet",
} as const;

export const ABRECHNUNGSARTEN = [
  { wert: "pauschale", text: "Monatspauschale" },
  { wert: "aufwand", text: "nach Aufwand" },
  { wert: "einzelauftrag", text: "Einzelauftrag" },
] as const;
export const abrechnungsartText = (a: string) =>
  ABRECHNUNGSARTEN.find((x) => x.wert === a)?.text ?? a;

export const FREQUENZEN = [
  { wert: "woechentlich", text: "wöchentlich" },
  { wert: "taeglich", text: "täglich" },
  { wert: "monatlich", text: "monatlich" },
  { wert: "einmalig", text: "einmalig" },
] as const;

export const FEIERTAGREGELN = [
  { wert: "auslassen", text: "an Feiertagen auslassen" },
  { wert: "naechster_werktag", text: "auf nächsten Werktag verschieben" },
  { wert: "ignorieren", text: "auch an Feiertagen" },
] as const;

export const WOCHENTAGE = [
  { wert: "1", text: "Mo" },
  { wert: "2", text: "Di" },
  { wert: "3", text: "Mi" },
  { wert: "4", text: "Do" },
  { wert: "5", text: "Fr" },
  { wert: "6", text: "Sa" },
  { wert: "7", text: "So" },
] as const;

const datum = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Datum wählen");
const optUhrzeit = z
  .string()
  .regex(/^(\d{2}:\d{2})?$/, "Uhrzeit wie 07:00")
  .transform((v) => (v === "" ? null : v))
  .nullable();
const tage = z
  .array(z.union([z.string(), z.number()]))
  .transform((a) => [...new Set(a.map(Number))].filter((n) => n >= 1 && n <= 7).sort());

const laufzeitFelder = {
  titel: pflichtText("Bezeichnung"),
  beginn: datum,
  laufzeit_monate: ganzzahl(0, 240),
  verlaengerung_monate: ganzzahl(0, 120),
  kuendigungsfrist_monate: ganzzahl(0, 24),
  frist_zum: z.enum(["laufzeitende", "monatsende"]),
  notiz: optText(2000),
};

const abrechnungFelder = {
  abrechnungsart: z.enum(["pauschale", "aufwand", "einzelauftrag"]),
  pauschale_cent: optEuro,
};

const pauschalePflicht = <T extends { abrechnungsart: string; pauschale_cent: number | null }>(
  d: T,
) => d.abrechnungsart !== "pauschale" || d.pauschale_cent !== null;

export const vertragNeuSchema = z
  .object({
    kunde_id: z.string().uuid("Kunde wählen"),
    objekt_id: z.string().uuid("Objekt wählen"),
    ...laufzeitFelder,
    ...abrechnungFelder,
  })
  .refine(pauschalePflicht, { message: "Monatspauschale eingeben", path: ["pauschale_cent"] });

export const vertragStammSchema = z.object(laufzeitFelder);

export const versionSchema = z
  .object({
    vertrag_id: uuid,
    gueltig_ab: datum,
    grund: optText(500),
    ...abrechnungFelder,
  })
  .refine(pauschalePflicht, { message: "Monatspauschale eingeben", path: ["pauschale_cent"] });

export const versionAbrechnungSchema = z
  .object({ version_id: uuid, ...abrechnungFelder })
  .refine(pauschalePflicht, { message: "Monatspauschale eingeben", path: ["pauschale_cent"] });

export const leistungSchema = z
  .object({
    id: uuid.optional(),
    version_id: uuid,
    vorlage_id: z.string().uuid("Vorlage wählen"),
    preis_id: z
      .string()
      .nullable()
      .transform((v) => (v ? v : null)),
    bezeichnung: optText(),
    frequenz: z.enum(["taeglich", "woechentlich", "monatlich", "einmalig"]),
    intervall: ganzzahl(1, 104),
    wochentage: tage,
    monatstag: z
      .union([z.string(), z.number(), z.null()])
      .transform((v) => (v === "" || v === null ? null : Number(v)))
      .refine((v) => v === null || (Number.isInteger(v) && v >= 1 && v <= 31), "Tag 1–31"),
    startdatum: z
      .string()
      .regex(/^(\d{4}-\d{2}-\d{2})?$/)
      .transform((v) => (v === "" ? null : v))
      .nullable(),
    zeitfenster_von: optUhrzeit,
    zeitfenster_bis: optUhrzeit,
    erlaubte_wochentage: tage,
    feiertag_regel: z.enum(["auslassen", "naechster_werktag", "ignorieren"]),
    menge_m2: optDezimal(0, 1_000_000),
    menge_fenster: z
      .union([z.string(), z.number(), z.null()])
      .transform((v) => (v === "" || v === null ? null : Number(v)))
      .refine((v) => v === null || (Number.isInteger(v) && v >= 0), "ganze Zahl"),
    preis_cent: optEuro,
  })
  .refine((l) => l.frequenz !== "woechentlich" || l.wochentage.length > 0, {
    message: "Mindestens einen Wochentag wählen",
    path: ["wochentage"],
  })
  .refine((l) => l.frequenz !== "einmalig" || l.startdatum, {
    message: "Datum für den einmaligen Einsatz wählen",
    path: ["startdatum"],
  })
  .refine(
    (l) => !l.zeitfenster_von || !l.zeitfenster_bis || l.zeitfenster_von < l.zeitfenster_bis,
    {
      message: "Ende muss nach Beginn liegen",
      path: ["zeitfenster_bis"],
    },
  );

export const kuendigungSchema = z.object({ vertrag_id: uuid, eingang: datum });

export const vertragsbedingungenSchema = z.object({
  vertragsbedingungen: optText(20_000),
  bundesland: z.enum([
    "BW",
    "BY",
    "BE",
    "BB",
    "HB",
    "HH",
    "HE",
    "MV",
    "NI",
    "NW",
    "RP",
    "SL",
    "SN",
    "ST",
    "SH",
    "TH",
  ]),
});
