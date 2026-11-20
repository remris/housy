import { z } from "zod";
import { optText, uuid } from "./helfer";

export const NACHWEISSTATUS: Record<
  string,
  { text: string; ton: "ok" | "warn" | "fehler" | "neutral" }
> = {
  in_arbeit: { text: "wird erstellt", ton: "neutral" },
  gesendet: { text: "verschickt", ton: "ok" },
  ohne_versand: { text: "nicht verschickt", ton: "warn" },
  fehler: { text: "Fehler", ton: "fehler" },
};

export const MANGELSTATUS = [
  { wert: "offen", text: "offen" },
  { wert: "in_bearbeitung", text: "in Bearbeitung" },
  { wert: "erledigt", text: "erledigt" },
] as const;

export const mangelstatusText = (s: string) => MANGELSTATUS.find((m) => m.wert === s)?.text ?? s;

const monat = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Monat wählen");

export const nachweisAnlegenSchema = z.discriminatedUnion("art", [
  z.object({ art: z.literal("einsatz"), einsatz_id: uuid, senden: z.boolean() }),
  z.object({
    art: z.literal("monat"),
    objekt_id: z.string().uuid("Objekt wählen"),
    monat,
    senden: z.boolean(),
  }),
]);

export const nachweisNeuSchema = z.object({ id: uuid, senden: z.boolean() });

export const mangelStatusSchema = z.object({
  id: uuid,
  status: z.enum(["offen", "in_bearbeitung", "erledigt"]),
  notiz_buero: optText(1000),
});

export const nachweisEinstellungenSchema = z.object({
  nachweis_kopie: z.boolean(),
  nachweis_fotos: z.boolean(),
});
