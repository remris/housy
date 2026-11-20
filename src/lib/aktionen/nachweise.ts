"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { type AktionErgebnis, dbFehler, fehler, pruefe } from "@/lib/aktion";
import { bueroKontext, inhaberKontext } from "@/lib/auth";
import { bestaetigungenSenden } from "@/lib/nachweise/bestaetigung";
import { type NachweisErgebnis, nachweisErstellen } from "@/lib/nachweise/erstellen";
import {
  mangelStatusSchema,
  nachweisAnlegenSchema,
  nachweisEinstellungenSchema,
  nachweisNeuSchema,
} from "@/lib/schemas/nachweis";
import { createAdminClient } from "@/lib/supabase/admin";

const OHNE_ADMIN =
  "Nachweise brauchen den Server-Schlüssel SUPABASE_SECRET_KEY (siehe .env.example).";

function ergebnisMeldung(r: NachweisErgebnis, senden: boolean): AktionErgebnis {
  if (r.status === "fehler") return fehler(`Nachweis fehlgeschlagen: ${r.fehler}`);
  if (r.uebersprungen && r.status === "in_arbeit") {
    return fehler("Der Nachweis wird gerade erstellt. Bitte gleich noch einmal versuchen.");
  }
  if (r.status === "gesendet") return { ok: true, meldung: "Nachweis erstellt und verschickt." };
  if (!senden) return { ok: true, meldung: "Nachweis erstellt." };
  return { ok: true, meldung: `Nachweis erstellt, nicht verschickt: ${r.fehler ?? ""}` };
}

/** Nachweis für einen Einsatz oder ein Objekt und einen Monat erstellen (und verschicken). */
export async function nachweisAnlegen(
  eingabe: z.input<typeof nachweisAnlegenSchema>,
): Promise<AktionErgebnis> {
  const p = pruefe(nachweisAnlegenSchema, eingabe);
  if (!p.ok) return p.ergebnis;
  const k = await bueroKontext();
  const admin = createAdminClient();
  if (!admin) return fehler(OHNE_ADMIN);
  const d = p.daten;
  // Zugriff prüfen (RLS des Büros), bevor der Admin-Client arbeitet
  const sichtbar =
    d.art === "einsatz"
      ? await k.supabase.from("einsatz").select("id").eq("id", d.einsatz_id).maybeSingle()
      : await k.supabase.from("objekt").select("id").eq("id", d.objekt_id).maybeSingle();
  if (!sichtbar.data) return fehler("Nicht gefunden.");
  const r = await nachweisErstellen(
    admin,
    k.betriebId,
    d.art === "einsatz"
      ? { art: "einsatz", einsatzId: d.einsatz_id }
      : { art: "monat", objektId: d.objekt_id, monat: d.monat },
    { senden: d.senden, neu: true },
  );
  revalidatePath("/nachweise");
  return ergebnisMeldung(r, d.senden);
}

/** Vorhandenen Nachweis neu erzeugen, z. B. nach einer Zeitkorrektur, und ggf. erneut senden. */
export async function nachweisNeu(
  eingabe: z.input<typeof nachweisNeuSchema>,
): Promise<AktionErgebnis> {
  const p = pruefe(nachweisNeuSchema, eingabe);
  if (!p.ok) return p.ergebnis;
  const k = await bueroKontext();
  const admin = createAdminClient();
  if (!admin) return fehler(OHNE_ADMIN);
  const { data: n } = await k.supabase
    .from("nachweis")
    .select("id, art, einsatz_id, objekt_id, von")
    .eq("id", p.daten.id)
    .maybeSingle();
  if (!n) return fehler("Nachweis nicht gefunden.");
  const r = await nachweisErstellen(
    admin,
    k.betriebId,
    n.art === "einsatz" && n.einsatz_id
      ? { art: "einsatz", einsatzId: n.einsatz_id }
      : { art: "monat", objektId: n.objekt_id, monat: n.von.slice(0, 7) },
    { senden: p.daten.senden, neu: true },
  );
  revalidatePath("/nachweise");
  return ergebnisMeldung(r, p.daten.senden);
}

/** Bestätigungs-Mail für eine mündlich vereinbarte Leistung jetzt verschicken. */
export async function bestaetigungJetztSenden(positionId: string): Promise<AktionErgebnis> {
  const k = await bueroKontext();
  const admin = createAdminClient();
  if (!admin) return fehler(OHNE_ADMIN);
  const { data } = await k.supabase
    .from("einsatz_position")
    .select("id")
    .eq("id", positionId)
    .maybeSingle();
  if (!data) return fehler("Leistung nicht gefunden.");
  const r = await bestaetigungenSenden(admin, { positionId });
  revalidatePath("/rueckmeldungen");
  if (r.fehler.length > 0) return fehler(r.fehler.join("; "));
  return r.gesendet > 0
    ? { ok: true, meldung: "Bestätigung verschickt." }
    : fehler("Nicht verschickt: Kunde ohne E-Mail-Adresse oder Mail-Versand nicht eingerichtet.");
}

export async function mangelStatusSetzen(
  eingabe: z.input<typeof mangelStatusSchema>,
): Promise<AktionErgebnis> {
  const p = pruefe(mangelStatusSchema, eingabe);
  if (!p.ok) return p.ergebnis;
  const k = await bueroKontext();
  const { data, error } = await k.supabase
    .from("einsatz_meldung")
    .update({ status: p.daten.status, notiz_buero: p.daten.notiz_buero })
    .eq("id", p.daten.id)
    .select("objekt_id")
    .single();
  if (error) return fehler(dbFehler(error));
  revalidatePath("/rueckmeldungen");
  revalidatePath(`/objekte/${data.objekt_id}`);
  return { ok: true, meldung: "Mangel aktualisiert." };
}

export async function nachweisEinstellungenSpeichern(
  eingabe: z.input<typeof nachweisEinstellungenSchema>,
): Promise<AktionErgebnis> {
  const p = pruefe(nachweisEinstellungenSchema, eingabe);
  if (!p.ok) return p.ergebnis;
  const k = await inhaberKontext();
  const { error } = await k.supabase.from("betrieb").update(p.daten).eq("id", k.betriebId);
  if (error) return fehler(dbFehler(error));
  revalidatePath("/einstellungen/nachweise");
  return { ok: true, meldung: "Gespeichert." };
}
