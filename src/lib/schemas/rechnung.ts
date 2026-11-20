import { z } from "zod";
import { optText, pflichtEuro, pflichtText, uuid } from "./helfer";

export const PREISEINHEITEN_RECHNUNG = [
  { wert: "stueck", text: "Stück" },
  { wert: "stunde", text: "Stunde" },
  { wert: "einsatz", text: "Einsatz" },
  { wert: "pauschal", text: "pauschal" },
  { wert: "fenster", text: "Fenster" },
  { wert: "m2", text: "m²" },
  { wert: "monat", text: "Monat" },
] as const;

export const RECHNUNGSSTATUS: Record<
  string,
  { text: string; ton: "ok" | "warn" | "fehler" | "neutral" }
> = {
  entwurf: { text: "Entwurf", ton: "neutral" },
  offen: { text: "offen", ton: "warn" },
  bezahlt: { text: "bezahlt", ton: "ok" },
  storniert: { text: "storniert", ton: "fehler" },
};

const menge = z
  .union([z.string(), z.number()])
  .transform((v) => (typeof v === "number" ? v : Number(v.trim().replace(",", "."))))
  .pipe(z.number({ error: "Zahl eingeben" }).positive("Menge größer 0").max(1_000_000));

export const positionSchema = z.object({
  rechnung_id: uuid,
  bezeichnung: pflichtText("Bezeichnung", 300),
  beschreibung: optText(1000),
  menge,
  einheit: z.enum(["stueck", "stunde", "einsatz", "pauschal", "fenster", "m2", "monat"]),
  einzelpreis: pflichtEuro,
  ust_satz: z.coerce.number().pipe(z.union([z.literal(19), z.literal(7), z.literal(0)])),
});

export const stornoSchema = z.object({
  id: uuid,
  grund: pflichtText("Grund", 500).refine((g) => g.trim().length >= 3, "mindestens 3 Zeichen"),
  senden: z.boolean(),
});

export const rechnungEinstellungenSchema = z.object({
  rechnung_praefix: z.string().trim().max(10, "höchstens 10 Zeichen"),
  rechnung_kontakt: optText(100),
  rechnung_fusstext: optText(1000),
  datev_beraternummer: z
    .union([z.string(), z.number(), z.null()])
    .transform((v) => (v === null || v === "" ? null : Number(v)))
    .pipe(z.number().int().min(1000).max(9_999_999).nullable()),
  datev_mandantennummer: z
    .union([z.string(), z.number(), z.null()])
    .transform((v) => (v === null || v === "" ? null : Number(v)))
    .pipe(z.number().int().min(1).max(99_999).nullable()),
  kontenrahmen: z.enum(["skr03", "skr04"]),
});
