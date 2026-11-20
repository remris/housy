import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type Monat,
  type Versandart,
  monatsZeitraum,
  nachweisDateiname,
  nachweisEmpfaenger,
} from "@/domain/nachweis";
import { sendeMail } from "@/lib/mail/resend";
import { nachweisMail } from "@/lib/mail/texte";
import { nachweisPdfErzeugen } from "@/lib/pdf/nachweis-pdf";
import type { Database } from "@/lib/supabase/database.types";
import { ladeNachweisDokument } from "./daten";

type Admin = SupabaseClient<Database>;

export type NachweisAuftrag =
  { art: "einsatz"; einsatzId: string } | { art: "monat"; objektId: string; monat: Monat };

export type NachweisOptionen = {
  /** an Kunden (und Kopie) verschicken; sonst nur erzeugen */
  senden: boolean;
  /** vorhandenen Nachweis neu erzeugen (und ggf. erneut senden) */
  neu?: boolean;
};

export type NachweisErgebnis = {
  id: string;
  status: Database["public"]["Enums"]["nachweisstatus"];
  fehler: string | null;
  uebersprungen?: boolean;
};

/** Ein anderer Lauf arbeitet gerade daran, wenn die Sperre jünger ist. */
const SPERRE_MS = 15 * 60_000;

async function kontext(admin: Admin, betriebId: string, auftrag: NachweisAuftrag) {
  if (auftrag.art === "einsatz") {
    const { data, error } = await admin
      .from("einsatz")
      .select("id, datum, objekt_id, objekt(kunde_id)")
      .eq("id", auftrag.einsatzId)
      .eq("betrieb_id", betriebId)
      .single();
    if (error || !data.objekt) throw new Error("Einsatz nicht gefunden");
    return {
      objektId: data.objekt_id,
      kundeId: data.objekt.kunde_id,
      von: data.datum,
      bis: data.datum,
      einsatzId: data.id,
    };
  }
  const { data, error } = await admin
    .from("objekt")
    .select("id, kunde_id")
    .eq("id", auftrag.objektId)
    .eq("betrieb_id", betriebId)
    .single();
  if (error) throw new Error("Objekt nicht gefunden");
  const { von, bis } = monatsZeitraum(auftrag.monat);
  return { objektId: data.id, kundeId: data.kunde_id, von, bis, einsatzId: null };
}

/**
 * Belegt den Nachweis-Datensatz für diesen Lauf. Gibt null zurück, wenn es nichts zu tun gibt
 * (schon erledigt oder ein anderer Lauf ist dran).
 */
async function belegen(
  admin: Admin,
  betriebId: string,
  auftrag: NachweisAuftrag,
  k: Awaited<ReturnType<typeof kontext>>,
  neu: boolean,
): Promise<{ id: string; versuche: number } | NachweisErgebnis> {
  const jetzt = new Date().toISOString();
  const eingefuegt = await admin
    .from("nachweis")
    .insert({
      betrieb_id: betriebId,
      art: auftrag.art,
      kunde_id: k.kundeId,
      objekt_id: k.objektId,
      einsatz_id: k.einsatzId,
      von: k.von,
      bis: k.bis,
      status: "in_arbeit",
      versuche: 1,
      bearbeitet_am: jetzt,
    })
    .select("id")
    .single();
  if (!eingefuegt.error) return { id: eingefuegt.data.id, versuche: 1 };
  if (eingefuegt.error.code !== "23505") throw new Error(eingefuegt.error.message);

  let vorhanden = admin
    .from("nachweis")
    .select("id, status, fehler, versuche, bearbeitet_am")
    .eq("betrieb_id", betriebId)
    .eq("art", auftrag.art);
  vorhanden =
    auftrag.art === "einsatz"
      ? vorhanden.eq("einsatz_id", auftrag.einsatzId)
      : vorhanden.eq("objekt_id", k.objektId).eq("von", k.von);
  const { data: n, error } = await vorhanden.single();
  if (error) throw new Error(error.message);

  const gesperrt =
    n.status === "in_arbeit" &&
    n.bearbeitet_am !== null &&
    Date.now() - Date.parse(n.bearbeitet_am) < SPERRE_MS;
  if (gesperrt || (!neu && n.status !== "fehler")) {
    return { id: n.id, status: n.status, fehler: n.fehler, uebersprungen: true };
  }
  // optimistische Sperre: nur wenn seitdem niemand anders übernommen hat
  let uebernahme = admin
    .from("nachweis")
    .update({ status: "in_arbeit", versuche: n.versuche + 1, bearbeitet_am: jetzt })
    .eq("id", n.id);
  uebernahme =
    n.bearbeitet_am === null
      ? uebernahme.is("bearbeitet_am", null)
      : uebernahme.eq("bearbeitet_am", n.bearbeitet_am);
  const { data: uebernommen } = await uebernahme.select("id");
  if (!uebernommen || uebernommen.length === 0) {
    return { id: n.id, status: "in_arbeit", fehler: null, uebersprungen: true };
  }
  return { id: n.id, versuche: n.versuche + 1 };
}

/**
 * Erzeugt einen Nachweis (PDF im Bucket „nachweise“) und verschickt ihn. Wiederholungen sind
 * harmlos: je Einsatz bzw. Objekt und Monat gibt es genau einen Datensatz.
 */
export async function nachweisErstellen(
  admin: Admin,
  betriebId: string,
  auftrag: NachweisAuftrag,
  opt: NachweisOptionen,
): Promise<NachweisErgebnis> {
  const k = await kontext(admin, betriebId, auftrag);
  const beleg = await belegen(admin, betriebId, auftrag, k, opt.neu ?? false);
  if ("status" in beleg) return beleg;
  const { id, versuche } = beleg;

  try {
    const [dokument, kunde, betrieb] = await Promise.all([
      ladeNachweisDokument(admin, { betriebId, art: auftrag.art, ...k }),
      admin
        .from("kunde")
        .select("email, nachweis_email, nachweis_versand")
        .eq("id", k.kundeId)
        .single(),
      admin
        .from("betrieb")
        .select("name, firmenname, telefon, email, nachweis_kopie")
        .eq("id", betriebId)
        .single(),
    ]);
    if (kunde.error || betrieb.error) throw new Error("Kunde oder Betrieb nicht lesbar");

    const pdf = await nachweisPdfErzeugen(dokument);
    const pfad = `${betriebId}/${id}.pdf`;
    const hoch = await admin.storage
      .from("nachweise")
      .upload(pfad, pdf, { contentType: "application/pdf", upsert: true });
    if (hoch.error) throw new Error(`Ablage: ${hoch.error.message}`);

    const erzeugt = { pdf_pfad: pfad, erzeugt_am: new Date().toISOString() };
    if (!opt.senden) {
      await admin
        .from("nachweis")
        .update({ ...erzeugt, status: "ohne_versand", fehler: null, empfaenger: [] })
        .eq("id", id);
      return { id, status: "ohne_versand", fehler: null };
    }

    // manuell verschickte Nachweise gehen auch an Kunden ohne automatischen Versand
    const versand: Versandart =
      kunde.data.nachweis_versand === "keiner" ? "einsatz" : kunde.data.nachweis_versand;
    const empfaenger = nachweisEmpfaenger({
      versand,
      kundeEmail: kunde.data.email,
      nachweisEmail: kunde.data.nachweis_email,
      betriebEmail: betrieb.data.email,
      kopie: betrieb.data.nachweis_kopie,
    });
    const betriebName = betrieb.data.firmenname || betrieb.data.name;
    const inhalt = nachweisMail({
      art: auftrag.art,
      von: k.von,
      objekt: dokument.objekt.name,
      betrieb: { name: betriebName, telefon: betrieb.data.telefon, email: betrieb.data.email },
      einsaetze: dokument.einsaetze.length,
    });
    const ergebnis = await sendeMail({
      an: empfaenger.an,
      kopie: empfaenger.kopie,
      ...inhalt,
      absenderName: betriebName,
      antwortAn: betrieb.data.email,
      anhaenge: [
        {
          dateiname: nachweisDateiname(auftrag.art, k.von, dokument.objekt.name),
          inhalt: pdf,
        },
      ],
      idempotenzSchluessel: `nachweis-${id}-${versuche}`,
    });

    const alle = [...empfaenger.an, ...empfaenger.kopie];
    if (ergebnis.status === "gesendet") {
      await admin.from("mail_protokoll").insert({
        betrieb_id: betriebId,
        art: "nachweis",
        bezug_id: id,
        empfaenger: alle,
        betreff: inhalt.betreff,
        anbieter_id: ergebnis.id,
      });
    }
    const status =
      ergebnis.status === "gesendet" && empfaenger.an.length > 0 ? "gesendet" : "ohne_versand";
    const fehler =
      ergebnis.status === "ohne_versand"
        ? ergebnis.grund
        : empfaenger.an.length === 0
          ? "Kunde hat keine E-Mail-Adresse (nur Kopie an den Betrieb)"
          : null;
    await admin
      .from("nachweis")
      .update({
        ...erzeugt,
        status,
        fehler,
        empfaenger: ergebnis.status === "gesendet" ? alle : [],
        gesendet_am: ergebnis.status === "gesendet" ? new Date().toISOString() : null,
      })
      .eq("id", id);
    return { id, status, fehler };
  } catch (e) {
    const fehler = (e as Error).message.slice(0, 500);
    await admin
      .from("nachweis")
      .update({ status: "fehler", fehler, bearbeitet_am: null })
      .eq("id", id);
    return { id, status: "fehler", fehler };
  }
}
