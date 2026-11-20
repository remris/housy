import { z } from "zod";
import { optText, pflichtText, uuid } from "./helfer";

/** Menge mit Komma oder Punkt, > 0 */
const menge = z
  .union([z.string(), z.number()])
  .transform((v) => (typeof v === "number" ? v : Number(v.trim().replace(",", "."))))
  .pipe(z.number({ error: "Zahl eingeben" }).positive("Menge größer 0").max(1_000_000));

const optUuid = z
  .string()
  .nullable()
  .transform((v) => (v ? v : null))
  .pipe(z.string().uuid().nullable());

export const LAGERORTARTEN = [
  { wert: "lager", text: "Lager" },
  { wert: "fahrzeug", text: "Fahrzeug" },
  { wert: "objekt", text: "Putzkammer im Objekt" },
] as const;
export const lagerortartText = (a: string) => LAGERORTARTEN.find((x) => x.wert === a)?.text ?? a;

export const BUCHUNGSARTEN = [
  { wert: "zugang", text: "Zugang (Wareneingang)" },
  { wert: "umbuchung", text: "Umbuchung" },
  { wert: "inventur", text: "Inventur (gezählte Menge)" },
] as const;

export const BEWEGUNGSART_TEXT: Record<string, string> = {
  zugang: "Zugang",
  abgang_einsatz: "Einsatz",
  umbuchung: "Umbuchung",
  korrektur: "Korrektur",
  wechsel: "Wechsel",
};

export const bewegungSchema = z
  .object({
    art: z.enum(["zugang", "umbuchung", "inventur"]),
    artikel_id: z.string().uuid("Artikel wählen"),
    menge: z.string(),
    von_lagerort_id: optUuid,
    nach_lagerort_id: optUuid,
    notiz: optText(500),
  })
  .superRefine((d, ctx) => {
    const zahl = Number(d.menge.trim().replace(",", "."));
    const ok = d.art === "inventur" ? zahl >= 0 : zahl > 0;
    if (!Number.isFinite(zahl) || !ok || d.menge.trim() === "") {
      ctx.addIssue({ code: "custom", path: ["menge"], message: "Menge eingeben" });
    }
    if (d.art !== "zugang" && !d.von_lagerort_id && d.art !== "inventur") {
      ctx.addIssue({ code: "custom", path: ["von_lagerort_id"], message: "Lagerort wählen" });
    }
    if ((d.art === "zugang" || d.art === "umbuchung") && !d.nach_lagerort_id) {
      ctx.addIssue({ code: "custom", path: ["nach_lagerort_id"], message: "Lagerort wählen" });
    }
    if (d.art === "inventur" && !d.nach_lagerort_id) {
      ctx.addIssue({ code: "custom", path: ["nach_lagerort_id"], message: "Lagerort wählen" });
    }
    if (d.art === "umbuchung" && d.von_lagerort_id === d.nach_lagerort_id) {
      ctx.addIssue({
        code: "custom",
        path: ["nach_lagerort_id"],
        message: "anderen Lagerort wählen",
      });
    }
  });

export const bestellungSchema = z.object({
  artikel_id: uuid,
  menge,
  lieferant: optText(200),
});

export const lagerortSchema = z
  .object({
    name: pflichtText("Name", 100),
    art: z.enum(["lager", "objekt"]),
    objekt_id: optUuid,
    aktiv: z.boolean(),
  })
  .refine((d) => d.art !== "objekt" || d.objekt_id, {
    message: "Objekt wählen",
    path: ["objekt_id"],
  });

export const werkzeugSchema = z.object({
  artikel_id: z.string().uuid("Artikel wählen"),
  bezeichnung: pflichtText("Bezeichnung", 100),
  mitglied_id: optUuid,
  fahrzeug_id: optUuid,
  // Server prüft die schon umgewandelten Werte erneut: Zahl bzw. null zulassen
  startstand: z
    .union([z.string(), z.number()])
    .transform((v) =>
      typeof v === "number" ? v : v.trim() === "" ? 0 : Number(v.trim().replace(",", ".")),
    )
    .pipe(z.number({ error: "Zahl eingeben" }).min(0)),
  naechste_pruefung: z
    .union([z.string(), z.null()])
    .transform((v) => (v ? v : null))
    .pipe(z.string().date().nullable()),
});

export const wechselSchema = z.object({
  werkzeug_id: uuid,
  /** Ortszeit "JJJJ-MM-TTTHH:MM" (datetime-local) */
  am: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Zeitpunkt wählen"),
  grund: z.enum(["verschleiss", "defekt"]),
  lagerort_id: optUuid,
});

export const pruefungSchema = z.object({
  werkzeug_id: uuid,
  am: z.string().date("Datum wählen"),
  bestanden: z.boolean(),
  notiz: optText(500),
});

export const objektBedarfSchema = z.object({
  objekt_id: uuid,
  artikel_id: z.string().uuid("Artikel wählen"),
  menge,
  bezug: z.enum(["einsatz", "m2", "fenster", "stunde"]),
});
