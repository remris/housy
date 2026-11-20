import { z } from "zod";

export const BRANCHEN = [
  { wert: "gebaeudereinigung", text: "Gebäudereinigung" },
  { wert: "hausmeister", text: "Hausmeisterservice" },
  { wert: "fensterreinigung", text: "Fensterreinigung" },
] as const;
export type Branche = (typeof BRANCHEN)[number]["wert"];

export const SPRACHEN = [
  { wert: "de", text: "Deutsch" },
  { wert: "en", text: "English" },
  { wert: "tr", text: "Türkçe" },
  { wert: "pl", text: "Polski" },
  { wert: "ro", text: "Română" },
  { wert: "ar", text: "العربية" },
] as const;

const email = z.string().trim().toLowerCase().email("Gültige E-Mail-Adresse eingeben");
const passwort = z.string().min(8, "Mindestens 8 Zeichen");

export const loginSchema = z.object({
  email,
  passwort: z.string().min(1, "Passwort eingeben"),
});

export const registrierungSchema = z.object({
  betriebName: z.string().trim().min(2, "Name des Betriebs eingeben").max(200),
  anzeigename: z.string().trim().min(1, "Deinen Namen eingeben").max(100),
  email,
  passwort,
  branchen: z
    .array(z.enum(["gebaeudereinigung", "hausmeister", "fensterreinigung"]))
    .min(1, "Mindestens eine Branche wählen"),
});

export const einladungRegistrierungSchema = z.object({
  token: z.string().uuid(),
  anzeigename: z.string().trim().min(1, "Deinen Namen eingeben").max(100),
  email,
  passwort,
});

export const passwortVergessenSchema = z.object({ email });

export const passwortNeuSchema = z
  .object({ passwort, wiederholung: z.string() })
  .refine((d) => d.passwort === d.wiederholung, {
    message: "Passwörter stimmen nicht überein",
    path: ["wiederholung"],
  });

export const betriebAnlegenSchema = z.object({
  betriebName: z.string().trim().min(2, "Name des Betriebs eingeben").max(200),
  branchen: z.array(z.enum(["gebaeudereinigung", "hausmeister", "fensterreinigung"])),
});

export const einladungSchema = z.object({
  email,
  rolle: z.enum(["inhaber", "disponent", "mitarbeiter"]),
  sprache: z.enum(["de", "en", "tr", "pl", "ro", "ar"]),
});
