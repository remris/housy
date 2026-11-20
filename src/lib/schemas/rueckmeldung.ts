import { z } from "zod";
import { optEuro, optText, uuid } from "./helfer";

export const positionPruefenSchema = z
  .object({
    id: uuid,
    entscheidung: z.enum(["bestaetigen", "ablehnen"]),
    preis_id: z
      .string()
      .nullable()
      .transform((v) => (v ? v : null)),
    preis_cent: optEuro,
    notiz_buero: optText(1000),
  })
  .refine((d) => d.entscheidung === "ablehnen" || d.preis_id !== null || d.preis_cent !== null, {
    message: "Leistung aus der Preisliste wählen oder Preis eingeben",
    path: ["preis_cent"],
  });

const datum = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Datum wählen");
const uhrzeit = z.string().regex(/^\d{2}:\d{2}$/, "Uhrzeit wie 07:00");
const grund = z.string().trim().min(3, "Grund angeben (mind. 3 Zeichen)").max(500);

export const zeitKorrekturSchema = z.object({ id: uuid, datum, uhrzeit, grund });
export const zeitStornoSchema = z.object({ id: uuid, grund });
export const zeitNachtragSchema = z.object({
  mitglied_id: uuid,
  art: z.enum(["checkin", "checkout", "pause_beginn", "pause_ende"]),
  einsatz_id: z
    .string()
    .nullable()
    .transform((v) => (v ? v : null)),
  datum,
  uhrzeit,
  grund,
});

export const BUCHUNGSARTEN = [
  { wert: "checkin", text: "Check-in" },
  { wert: "checkout", text: "Check-out" },
  { wert: "pause_beginn", text: "Pause Beginn" },
  { wert: "pause_ende", text: "Pause Ende" },
] as const;
export const buchungsartText = (a: string) => BUCHUNGSARTEN.find((x) => x.wert === a)?.text ?? a;
