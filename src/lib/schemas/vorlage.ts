import { z } from "zod";
import { ganzzahl, optDezimal, optEuro, optText, pflichtEuro, pflichtText, uuid } from "./helfer";

export const ARTIKELARTEN = [
  { wert: "verbrauch", text: "Verbrauchsmaterial" },
  { wert: "verschleiss", text: "Verschleißteil" },
  { wert: "geraet", text: "Gerät" },
] as const;
export const artikelartText = (a: string) => ARTIKELARTEN.find((x) => x.wert === a)?.text ?? a;

export const LEBENSDAUER_EINHEITEN = [
  { wert: "einsaetze", text: "Einsätze" },
  { wert: "fenster", text: "Fenster" },
  { wert: "m2", text: "m²" },
  { wert: "stunden", text: "Stunden" },
  { wert: "waeschen", text: "Wäschen" },
  { wert: "tage", text: "Tage" },
] as const;

export const BEDARFSBEZUEGE = [
  { wert: "einsatz", text: "je Einsatz" },
  { wert: "m2", text: "je m²" },
  { wert: "fenster", text: "je Fenster" },
  { wert: "stunde", text: "je Stunde" },
] as const;
export const bezugText = (b: string) => BEDARFSBEZUEGE.find((x) => x.wert === b)?.text ?? b;

export const PREISEINHEITEN = [
  { wert: "pauschal", text: "pauschal" },
  { wert: "einsatz", text: "je Einsatz" },
  { wert: "stunde", text: "je Stunde" },
  { wert: "m2", text: "je m²" },
  { wert: "fenster", text: "je Fenster" },
  { wert: "stueck", text: "je Stück" },
] as const;
export const preiseinheitText = (e: string) => PREISEINHEITEN.find((x) => x.wert === e)?.text ?? e;

export const artikelSchema = z
  .object({
    id: uuid.optional(),
    name: pflichtText("Name"),
    art: z.enum(["verbrauch", "verschleiss", "geraet"]),
    einheit: pflichtText("Einheit", 20),
    gebinde_name: optText(50),
    gebinde_menge: optDezimal(0.001, 1_000_000).refine((v) => v !== null && v > 0, "Menge > 0"),
    preis_cent: optEuro,
    lieferant: optText(),
    bestellnummer: optText(100),
    mindestbestand: optDezimal(0, 1_000_000),
    lieferzeit_tage: ganzzahl(0, 365),
    lebensdauer: optDezimal(0.01, 1_000_000),
    lebensdauer_einheit: z
      .enum(["einsaetze", "fenster", "m2", "stunden", "waeschen", "tage"])
      .nullable(),
    auto_wechsel: z.boolean(),
    pruefintervall_monate: z
      .union([z.string(), z.number(), z.null()])
      .transform((v) => (v === "" || v === null ? null : Number(v)))
      .refine((v) => v === null || (Number.isInteger(v) && v >= 1 && v <= 120), "1 bis 120 Monate"),
    notiz: optText(1000),
    aktiv: z.boolean(),
  })
  .refine((a) => a.art !== "verschleiss" || (a.lebensdauer && a.lebensdauer_einheit), {
    message: "Verschleißteile brauchen eine Lebensdauer",
    path: ["lebensdauer"],
  })
  .transform((a) => ({
    ...a,
    mindestbestand: a.mindestbestand ?? 0,
    gebinde_menge: a.gebinde_menge!,
  }));

export const vorlageSchema = z.object({
  name: pflichtText("Name"),
  branche: z.enum(["gebaeudereinigung", "hausmeister", "fensterreinigung"]).nullable(),
  beschreibung: optText(2000),
  sollzeit_minuten: ganzzahl(0, 10_000),
  minuten_pro_100m2: optDezimal(0, 10_000),
  minuten_pro_fenster: optDezimal(0, 1_000),
  aktiv: z.boolean(),
});

export const taetigkeitSchema = z.object({
  vorlage_id: uuid,
  text: pflichtText("Tätigkeit", 500),
  foto_pflicht: z.boolean(),
});

export const bedarfSchema = z.object({
  vorlage_id: uuid,
  artikel_id: z.string().uuid("Artikel wählen"),
  menge: optDezimal(0.0001, 1_000_000).refine((v) => v !== null && v > 0, "Menge > 0"),
  bezug: z.enum(["einsatz", "m2", "fenster", "stunde"]),
});

export const preisSchema = z.object({
  id: uuid.optional(),
  name: pflichtText("Bezeichnung"),
  beschreibung: optText(1000),
  einheit: z.enum(["pauschal", "stunde", "m2", "fenster", "stueck", "einsatz"]),
  preis_cent: pflichtEuro,
  ust_satz: z.coerce.number().refine((v) => [0, 7, 19].includes(v), "0, 7 oder 19 %"),
  sonderleistung: z.boolean(),
  vorlage_id: z
    .string()
    .nullable()
    .transform((v) => (v ? v : null)),
  aktiv: z.boolean(),
});
