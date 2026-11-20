import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { nachweisEmpfaenger } from "@/domain/nachweis";
import { sendeMail } from "@/lib/mail/resend";
import { bestaetigungMail } from "@/lib/mail/texte";
import { preiseinheitText } from "@/lib/schemas/vorlage";
import type { Database } from "@/lib/supabase/database.types";

type Admin = SupabaseClient<Database>;

/**
 * Bestätigungs-Mail an den Kunden für mündlich vereinbarte Zusatzleistungen, sobald ein Preis
 * feststeht (aus der Preisliste sofort, freie Positionen nach Prüfung im Büro).
 * Ohne Mail-Konfiguration bleibt die Position offen und wird später verschickt.
 */
export async function bestaetigungenSenden(
  admin: Admin,
  filter: { einsatzIds?: string[]; positionId?: string; seit?: string },
): Promise<{ gesendet: number; fehler: string[] }> {
  let abfrage = admin
    .from("einsatz_position")
    .select(
      `id, betrieb_id, bezeichnung, menge, einheit, preis_cent, dauer,
       einsatz(datum, objekt(name, kunde(email, nachweis_email)))`,
    )
    .eq("zustimmung", "muendlich")
    .eq("status", "bestaetigt")
    .is("bestaetigung_gesendet_am", null)
    .not("preis_cent", "is", null)
    .limit(200);
  if (filter.positionId) abfrage = abfrage.eq("id", filter.positionId);
  if (filter.einsatzIds) abfrage = abfrage.in("einsatz_id", filter.einsatzIds);
  if (filter.seit) abfrage = abfrage.gte("erstellt_am", filter.seit);
  const { data, error } = await abfrage;
  if (error) return { gesendet: 0, fehler: [error.message] };

  const betriebe = new Map<
    string,
    {
      name: string;
      telefon: string | null;
      email: string | null;
      kopie: boolean;
      kleinunternehmer: boolean;
    } | null
  >();
  const ergebnis = { gesendet: 0, fehler: [] as string[] };

  for (const p of data) {
    const objekt = p.einsatz?.objekt;
    if (!p.einsatz || !objekt?.kunde || p.preis_cent === null) continue;
    if (!betriebe.has(p.betrieb_id)) {
      const { data: b } = await admin
        .from("betrieb")
        .select("name, firmenname, telefon, email, nachweis_kopie, kleinunternehmer")
        .eq("id", p.betrieb_id)
        .single();
      betriebe.set(
        p.betrieb_id,
        b
          ? {
              name: b.firmenname || b.name,
              telefon: b.telefon,
              email: b.email,
              kopie: b.nachweis_kopie,
              kleinunternehmer: b.kleinunternehmer,
            }
          : null,
      );
    }
    const b = betriebe.get(p.betrieb_id);
    if (!b) continue;
    const empfaenger = nachweisEmpfaenger({
      versand: "einsatz",
      kundeEmail: objekt.kunde.email,
      nachweisEmail: objekt.kunde.nachweis_email,
      betriebEmail: b.email,
      kopie: b.kopie,
    });
    // ohne Kunden-Adresse keine Bestätigung (Büro sieht es unter Rückmeldungen)
    if (empfaenger.an.length === 0) continue;
    const inhalt = bestaetigungMail({
      datum: p.einsatz.datum,
      objekt: objekt.name,
      bezeichnung: p.bezeichnung,
      menge: Number(p.menge),
      einheit: p.einheit ? preiseinheitText(p.einheit) : null,
      preisCent: p.preis_cent,
      dauer: p.dauer as "heute" | "dauerhaft",
      betrieb: b,
      kleinunternehmer: b.kleinunternehmer,
    });
    try {
      const r = await sendeMail({
        an: empfaenger.an,
        kopie: empfaenger.kopie,
        ...inhalt,
        absenderName: b.name,
        antwortAn: b.email,
        idempotenzSchluessel: `bestaetigung-${p.id}`,
      });
      if (r.status !== "gesendet") continue;
      await admin
        .from("einsatz_position")
        .update({ bestaetigung_gesendet_am: new Date().toISOString() })
        .eq("id", p.id);
      await admin.from("mail_protokoll").insert({
        betrieb_id: p.betrieb_id,
        art: "bestaetigung",
        bezug_id: p.id,
        empfaenger: [...empfaenger.an, ...empfaenger.kopie],
        betreff: inhalt.betreff,
        anbieter_id: r.id,
      });
      ergebnis.gesendet++;
    } catch (e) {
      ergebnis.fehler.push(`${p.id}: ${(e as Error).message}`);
    }
  }
  return ergebnis;
}
