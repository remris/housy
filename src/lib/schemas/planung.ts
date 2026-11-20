import { z } from "zod";
import { optText, pflichtText, uuid } from "./helfer";

const datum = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Datum wählen");
const uhrzeit = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Uhrzeit wie 07:00");

export const ABWESENHEITSARTEN = [
  { wert: "urlaub", text: "Urlaub" },
  { wert: "krank", text: "Krank" },
  { wert: "sonstiges", text: "Sonstiges" },
] as const;
export const abwesenheitText = (a: string) =>
  ABWESENHEITSARTEN.find((x) => x.wert === a)?.text ?? a;

export const fahrzeugSchema = z.object({
  name: pflichtText("Bezeichnung", 100),
  kennzeichen: optText(20),
  notiz: optText(1000),
  aktiv: z.boolean(),
  // Standardfahrer: sein Fahrzeug ist Lagerort für Abbuchung und Packliste
  mitglied_id: z
    .string()
    .nullable()
    .transform((v) => (v ? v : null))
    .pipe(z.string().uuid().nullable()),
});

export const arbeitszeitenSchema = z.object({
  mitglied_id: uuid,
  tage: z
    .array(z.object({ aktiv: z.boolean(), von: z.string(), bis: z.string() }))
    .length(7)
    .superRefine((tage, ctx) => {
      tage.forEach((t, i) => {
        if (!t.aktiv) return;
        if (!uhrzeit.safeParse(t.von).success || !uhrzeit.safeParse(t.bis).success) {
          ctx.addIssue({ code: "custom", path: [i, "von"], message: "Uhrzeit wie 07:00" });
        } else if (t.von >= t.bis) {
          ctx.addIssue({ code: "custom", path: [i, "bis"], message: "Ende nach Beginn" });
        }
      });
    }),
});

export const abwesenheitSchema = z
  .object({
    mitglied_id: z.string().uuid("Mitarbeiter wählen"),
    art: z.enum(["urlaub", "krank", "sonstiges"]),
    von: datum,
    bis: datum,
    notiz: optText(500),
  })
  .refine((a) => a.von <= a.bis, { message: "Ende vor Beginn", path: ["bis"] });

export const tourStartSchema = z.object({ tour_start: uhrzeit });

export const tourEinstellungSchema = z.object({
  mitarbeiter_id: uuid,
  datum,
  startzeit: uhrzeit,
  fahrzeug_id: z
    .string()
    .nullable()
    .transform((v) => (v ? v : null)),
});

export const zuweisungSchema = z.object({
  id: uuid,
  mitarbeiter_id: uuid.nullable(),
  datum,
});
