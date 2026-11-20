import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendeMail } from "@/lib/mail/resend";
import { rechnungMail } from "@/lib/mail/texte";
import type { Database } from "@/lib/supabase/database.types";
import { ladeRechnung } from "./dokument";

type Client = SupabaseClient<Database>;

/**
 * Verschickt eine festgeschriebene Rechnung: ZUGFeRD-PDF an die Rechnungsadresse des Kunden,
 * bei XRechnung (öffentliche Auftraggeber oder Kundeneinstellung) zusätzlich das XML.
 */
export async function rechnungSenden(
  c: Client,
  id: string,
): Promise<{ ok: true; an: string } | { ok: false; fehler: string }> {
  const g = await ladeRechnung(c, id);
  if (!g) return { ok: false, fehler: "Rechnung nicht gefunden." };
  const { r, doc, daten } = g;
  if (r.status === "entwurf") return { ok: false, fehler: "Erst festschreiben." };
  if (!r.pdf_pfad) return { ok: false, fehler: "PDF fehlt – bitte „Dateien erzeugen“." };
  const an = doc.kaeufer.email;
  if (!an) return { ok: false, fehler: "Der Kunde hat keine (Rechnungs-)E-Mail-Adresse." };

  const pdf = await c.storage.from("rechnungen").download(r.pdf_pfad);
  if (!pdf.data) return { ok: false, fehler: "PDF nicht lesbar." };
  const mitXml = daten.erechnung === "xrechnung" && r.xml_pfad;
  const xml = mitXml ? await c.storage.from("rechnungen").download(r.xml_pfad!) : null;

  const inhalt = rechnungMail({
    art: doc.art,
    nummer: doc.nummer,
    bruttoCent: doc.summen.bruttoCent,
    faelligAm: doc.faelligAm,
    objekt: daten.objekt,
    betrieb: {
      name: doc.verkaeufer.name,
      telefon: doc.verkaeufer.telefon,
      email: doc.verkaeufer.email,
    },
    xrechnung: !!xml?.data,
  });
  try {
    const ergebnis = await sendeMail({
      an: [an],
      ...inhalt,
      absenderName: doc.verkaeufer.name,
      antwortAn: doc.verkaeufer.email,
      anhaenge: [
        { dateiname: `${doc.nummer}.pdf`, inhalt: new Uint8Array(await pdf.data.arrayBuffer()) },
        ...(xml?.data
          ? [
              {
                dateiname: `${doc.nummer}.xml`,
                inhalt: new Uint8Array(await xml.data.arrayBuffer()),
              },
            ]
          : []),
      ],
      idempotenzSchluessel: `rechnung-${id}-${r.gesendet_an.length}`,
    });
    if (ergebnis.status !== "gesendet") return { ok: false, fehler: ergebnis.grund };
    await c
      .from("rechnung")
      .update({ gesendet_am: new Date().toISOString(), gesendet_an: [an] })
      .eq("id", id);
    await c.from("mail_protokoll").insert({
      betrieb_id: r.betrieb_id,
      art: "rechnung",
      bezug_id: id,
      empfaenger: [an],
      betreff: inhalt.betreff,
      anbieter_id: ergebnis.id,
    });
    return { ok: true, an };
  } catch (e) {
    return { ok: false, fehler: (e as Error).message };
  }
}
