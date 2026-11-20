import { z } from "zod";

/** Optionaler Text: leer → null. */
export const optText = (max = 200) =>
  z
    .string()
    .trim()
    .max(max, `Höchstens ${max} Zeichen`)
    .transform((v) => (v === "" ? null : v))
    .nullable();

export const pflichtText = (feld: string, max = 200) =>
  z.string().trim().min(1, `${feld} eingeben`).max(max, `Höchstens ${max} Zeichen`);

export const optPlz = z
  .string()
  .trim()
  .regex(/^(\d{5})?$/, "PLZ hat 5 Ziffern")
  .transform((v) => (v === "" ? null : v))
  .nullable();

export const optEmail = z
  .string()
  .trim()
  .toLowerCase()
  .refine((v) => v === "" || z.string().email().safeParse(v).success, "Gültige E-Mail eingeben")
  .transform((v) => (v === "" ? null : v))
  .nullable();

/** Dezimalzahl aus deutscher Eingabe ("85,5"); leer → null. */
export const optDezimal = (min = 0, max = 1_000_000) =>
  z
    .union([z.string(), z.number()])
    .transform((v, ctx) => {
      if (typeof v === "number") return v;
      const t = v.trim().replace(/\./g, "").replace(",", ".");
      if (t === "") return null;
      const n = Number(t);
      if (Number.isNaN(n)) {
        ctx.addIssue({ code: "custom", message: "Zahl eingeben" });
        return z.NEVER;
      }
      return n;
    })
    .refine((v) => v === null || (v >= min && v <= max), `Wert zwischen ${min} und ${max}`)
    .nullable();

export const ganzzahl = (min: number, max: number) =>
  z.coerce
    .number({ message: "Zahl eingeben" })
    .int("Ganze Zahl eingeben")
    .min(min, `Mindestens ${min}`)
    .max(max, `Höchstens ${max}`);

export const uuid = z.string().uuid();
