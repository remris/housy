import { z } from "zod";
import { ganzzahl, optDezimal, optEmail, optPlz, optText, pflichtText, uuid } from "./helfer";

export const KUNDENTYPEN = [
  { wert: "firma", text: "Firma" },
  { wert: "verwaltung", text: "Hausverwaltung" },
  { wert: "privat", text: "Privat" },
  { wert: "oeffentlich", text: "Öffentlicher Auftraggeber" },
] as const;

export const NACHWEISVERSAND = [
  { wert: "einsatz", text: "nach jedem Einsatz" },
  { wert: "monat", text: "einmal im Monat" },
  { wert: "keiner", text: "nicht automatisch" },
] as const;

export const kundentypText = (t: string) => KUNDENTYPEN.find((k) => k.wert === t)?.text ?? t;

export const kundeSchema = z
  .object({
    typ: z.enum(["firma", "verwaltung", "privat", "oeffentlich"]),
    name: pflichtText("Name"),
    zusatz: optText(),
    strasse: optText(),
    plz: optPlz,
    ort: optText(),
    email: optEmail,
    telefon: optText(50),
    rechnungs_email: optEmail,
    leitweg_id: z
      .string()
      .trim()
      .regex(
        /^([0-9]{2,12}(-[0-9A-Za-z]{1,30})?-[0-9]{2})?$/,
        "Format z. B. 04011000-1234512345-06",
      )
      .transform((v) => (v === "" ? null : v))
      .nullable(),
    ust_id: optText(20),
    zahlungsziel_tage: ganzzahl(0, 365),
    nachweis_versand: z.enum(["einsatz", "monat", "keiner"]),
    nachweis_email: optEmail,
    notiz: optText(2000),
    aktiv: z.boolean(),
  })
  .refine((k) => k.typ !== "oeffentlich" || k.leitweg_id, {
    message: "Für öffentliche Auftraggeber ist die Leitweg-ID Pflicht (XRechnung)",
    path: ["leitweg_id"],
  });

export const ansprechpartnerSchema = z.object({
  id: uuid.optional(),
  kunde_id: uuid,
  name: pflichtText("Name"),
  funktion: optText(),
  email: optEmail,
  telefon: optText(50),
  ist_hauptkontakt: z.boolean(),
});

export const objektSchema = z.object({
  kunde_id: z.string().uuid("Kunde wählen"),
  name: pflichtText("Objektname"),
  strasse: optText(),
  plz: optPlz,
  ort: optText(),
  breitengrad: optDezimal(-90, 90),
  laengengrad: optDezimal(-180, 180),
  zugangshinweise: optText(2000),
  schluessel: optText(500),
  notiz: optText(2000),
  aktiv: z.boolean(),
});

export const BODENARTEN = [
  "Fliesen",
  "Linoleum",
  "PVC",
  "Teppich",
  "Parkett",
  "Laminat",
  "Naturstein",
  "Beton",
  "Sonstiges",
] as const;

export const bereichSchema = z.object({
  id: uuid.optional(),
  objekt_id: uuid,
  name: pflichtText("Name"),
  flaeche_m2: optDezimal(0, 1_000_000),
  bodenart: optText(50),
  etage: optText(50),
  notiz: optText(500),
});

export const FENSTERTYPEN = [
  { wert: "standard", text: "Standardfenster" },
  { wert: "sprossen", text: "Sprossenfenster" },
  { wert: "dachfenster", text: "Dachfenster" },
  { wert: "schaufenster", text: "Schaufenster" },
  { wert: "glastuer", text: "Glastür" },
  { wert: "wintergarten", text: "Wintergarten" },
  { wert: "sonstiges", text: "Sonstiges" },
] as const;

export const HILFSMITTEL = [
  { wert: "leiter", text: "Leiter" },
  { wert: "teleskopstange", text: "Teleskopstange" },
  { wert: "osmose", text: "Osmose" },
  { wert: "hubsteiger", text: "Hubsteiger" },
  { wert: "geruest", text: "Gerüst" },
] as const;

export const fensterSchema = z.object({
  id: uuid.optional(),
  objekt_id: uuid,
  bezeichnung: optText(),
  typ: z.enum([
    "standard",
    "sprossen",
    "dachfenster",
    "schaufenster",
    "glastuer",
    "wintergarten",
    "sonstiges",
  ]),
  anzahl: ganzzahl(1, 10_000),
  etage: optText(50),
  mit_rahmen: z.boolean(),
  hilfsmittel: z.array(z.enum(["leiter", "teleskopstange", "osmose", "hubsteiger", "geruest"])),
  notiz: optText(500),
});
