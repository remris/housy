import { z } from "zod";
import { pruefeIban } from "@/domain/iban";

const optional = (max = 200) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable();

export const firmendatenSchema = z.object({
  name: z.string().trim().min(2, "Name eingeben").max(200),
  firmenname: optional(),
  strasse: optional(),
  plz: z
    .string()
    .trim()
    .regex(/^(\d{5})?$/, "PLZ hat 5 Ziffern")
    .transform((v) => (v === "" ? null : v))
    .nullable(),
  ort: optional(),
  telefon: optional(50),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .refine((v) => v === "" || z.string().email().safeParse(v).success, "Gültige E-Mail eingeben")
    .transform((v) => (v === "" ? null : v))
    .nullable(),
  website: optional(),
  steuernummer: optional(50),
  ust_id: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^(DE\d{9})?$/, "USt-IdNr. im Format DE123456789")
    .transform((v) => (v === "" ? null : v))
    .nullable(),
  kleinunternehmer: z.boolean(),
  kontoinhaber: optional(),
  iban: z
    .string()
    .transform((v) => v.replace(/\s+/g, "").toUpperCase())
    .refine((v) => v === "" || pruefeIban(v), "IBAN ist ungültig")
    .transform((v) => (v === "" ? null : v))
    .nullable(),
  bic: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^([A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?)?$/, "BIC ist ungültig")
    .transform((v) => (v === "" ? null : v))
    .nullable(),
  bank_name: optional(),
  branchen: z.array(z.enum(["gebaeudereinigung", "hausmeister", "fensterreinigung"])),
});

export type FirmendatenEingabe = z.input<typeof firmendatenSchema>;
