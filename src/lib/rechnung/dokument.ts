import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { heuteIso } from "@/domain/datum";
import {
  type RechnungDokument,
  pruefeERechnung,
  xrechnungUbl,
  zugferdCii,
} from "@/domain/erechnung";
import { type Preiseinheit, type Rechnungsposition, faelligAm, summen } from "@/domain/rechnung";
import { bildformat } from "@/lib/nachweise/daten";
import type { PdfBild } from "@/lib/pdf/nachweis-pdf";
import { rechnungPdfErzeugen } from "@/lib/pdf/rechnung-pdf";
import { zugferdEinbetten } from "@/lib/pdf/zugferd";
import type { Database, Tables } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

/** Beim Festschreiben eingefrorene Angaben (rechnung.daten) */
export type Stammdaten = {
  verkaeufer: RechnungDokument["verkaeufer"];
  kaeufer: RechnungDokument["kaeufer"];
  bezug: RechnungDokument["bezug"];
  objekt: string | null;
  fusstext: string | null;
  bank: string | null;
  logoPfad: string | null;
  erechnung: "zugferd" | "xrechnung";
};

/** Aktuelle Stammdaten von Betrieb und Kunde (für Entwürfe und zum Einfrieren). */
export async function stammdaten(
  c: Client,
  r: Pick<Tables<"rechnung">, "betrieb_id" | "kunde_id" | "objekt_id" | "storno_von_id">,
): Promise<Stammdaten> {
  const [b, k, o, vorher] = await Promise.all([
    c
      .from("betrieb")
      .select(
        "name, firmenname, strasse, plz, ort, land, telefon, email, steuernummer, ust_id, iban, bic, kontoinhaber, bank_name, logo_pfad, rechnung_kontakt, rechnung_fusstext",
      )
      .eq("id", r.betrieb_id)
      .single(),
    c
      .from("kunde")
      .select(
        "name, zusatz, strasse, plz, ort, land, email, rechnungs_email, leitweg_id, ust_id, kundennummer, typ, erechnung",
      )
      .eq("id", r.kunde_id)
      .single(),
    r.objekt_id
      ? c.from("objekt").select("name").eq("id", r.objekt_id).single()
      : Promise.resolve({ data: null, error: null }),
    r.storno_von_id
      ? c.from("rechnung").select("nummer, rechnungsdatum").eq("id", r.storno_von_id).single()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (b.error || k.error) throw new Error(b.error?.message ?? k.error?.message);
  const kd = k.data;
  return {
    verkaeufer: {
      name: b.data.firmenname || b.data.name,
      strasse: b.data.strasse,
      plz: b.data.plz,
      ort: b.data.ort,
      land: b.data.land || "DE",
      steuernummer: b.data.steuernummer,
      ustId: b.data.ust_id,
      email: b.data.email,
      telefon: b.data.telefon,
      kontakt: b.data.rechnung_kontakt,
      iban: b.data.iban,
      bic: b.data.bic,
      kontoinhaber: b.data.kontoinhaber,
    },
    kaeufer: {
      name: [kd.name, kd.zusatz].filter(Boolean).join(", "),
      strasse: kd.strasse,
      plz: kd.plz,
      ort: kd.ort,
      land: kd.land || "DE",
      kundennummer: Number(kd.kundennummer),
      email: kd.rechnungs_email || kd.email,
      leitwegId: kd.leitweg_id,
      ustId: kd.ust_id,
      privat: kd.typ === "privat",
    },
    bezug:
      vorher.data?.nummer && vorher.data.rechnungsdatum
        ? { nummer: vorher.data.nummer, datum: vorher.data.rechnungsdatum }
        : null,
    objekt: o.data?.name ?? null,
    fusstext: b.data.rechnung_fusstext,
    bank: b.data.bank_name,
    logoPfad: b.data.logo_pfad,
    erechnung: kd.typ === "oeffentlich" ? "xrechnung" : (kd.erechnung as "zugferd" | "xrechnung"),
  };
}

type Zeile = Tables<"rechnungsposition">;

export function zuPositionen(zeilen: Zeile[]): Rechnungsposition[] {
  return [...zeilen]
    .sort((a, b) => a.pos - b.pos)
    .map((p) => ({
      bezeichnung: p.bezeichnung,
      beschreibung: p.beschreibung,
      menge: Number(p.menge),
      einheit: p.einheit as Preiseinheit,
      einzelpreisCent: p.einzelpreis_cent,
      nettoCent: p.netto_cent,
      ustSatz: Number(p.ust_satz),
      von: p.von,
      bis: p.bis,
      quelle: { art: "manuell" },
    }));
}

export function zuDokument(
  r: Tables<"rechnung">,
  zeilen: Zeile[],
  d: Stammdaten,
): RechnungDokument {
  const datum = r.rechnungsdatum ?? heuteIso();
  const positionen = zuPositionen(zeilen);
  return {
    art: r.art as "rechnung" | "storno",
    nummer: r.nummer ?? "ENTWURF",
    datum,
    faelligAm: r.faellig_am ?? faelligAm(datum, r.zahlungsziel_tage),
    leistungVon: r.leistung_von,
    leistungBis: r.leistung_bis,
    bezug: d.bezug,
    verkaeufer: d.verkaeufer,
    kaeufer: d.kaeufer,
    positionen,
    summen: summen(positionen, r.kleinunternehmer),
    kleinunternehmer: r.kleinunternehmer,
    zahlungszielTage: r.zahlungsziel_tage,
    hinweise: r.hinweise,
  };
}

export async function ladeRechnung(c: Client, id: string) {
  const { data, error } = await c
    .from("rechnung")
    .select("*, rechnungsposition(*)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const { rechnungsposition, ...r } = data;
  const daten = (r.daten as Stammdaten | null) ?? (await stammdaten(c, r));
  return {
    r: r as Tables<"rechnung">,
    zeilen: rechnungsposition,
    daten,
    doc: zuDokument(r as Tables<"rechnung">, rechnungsposition, daten),
  };
}

async function logo(c: Client, pfad: string | null): Promise<PdfBild | null> {
  if (!pfad) return null;
  const { data } = await c.storage.from("logos").download(pfad);
  if (!data) return null;
  const bytes = Buffer.from(await data.arrayBuffer());
  const format = bildformat(bytes);
  return format ? { data: bytes, format } : null;
}

/** PDF (bei festgeschriebenen Rechnungen mit eingebettetem ZUGFeRD-XML) und XRechnung. */
export async function dateienErzeugen(
  c: Client,
  geladen: NonNullable<Awaited<ReturnType<typeof ladeRechnung>>>,
): Promise<{ pdf: Uint8Array; xml: string }> {
  const { r, doc, daten } = geladen;
  const entwurf = r.status === "entwurf";
  const pdf = await rechnungPdfErzeugen({
    doc,
    logo: await logo(c, daten.logoPfad),
    entwurf,
    fusstext: daten.fusstext,
    bank: daten.bank,
  });
  const xml = xrechnungUbl(doc);
  if (entwurf) return { pdf, xml };
  const mitXml = await zugferdEinbetten(pdf, zugferdCii(doc), {
    titel: `${doc.art === "storno" ? "Stornorechnung" : "Rechnung"} ${doc.nummer}`,
    autor: doc.verkaeufer.name,
    nummer: doc.nummer,
    datum: new Date(r.festgeschrieben_am ?? Date.now()),
  });
  return { pdf: mitXml, xml };
}

/**
 * Festschreiben: Pflichtangaben prüfen, Stammdaten einfrieren, Nummer vergeben, PDF und
 * XRechnung ablegen (nur anlegen, nie überschreiben).
 */
export async function festschreiben(
  c: Client,
  id: string,
): Promise<{ ok: true; nummer: string } | { ok: false; fehler: string }> {
  const geladen = await ladeRechnung(c, id);
  if (!geladen) return { ok: false, fehler: "Rechnung nicht gefunden." };
  if (geladen.r.status === "entwurf") {
    const daten = await stammdaten(c, geladen.r);
    const probe = zuDokument({ ...geladen.r, rechnungsdatum: heuteIso() }, geladen.zeilen, daten);
    const fehlt = pruefeERechnung(probe);
    if (fehlt.length > 0)
      return { ok: false, fehler: `Pflichtangaben fehlen: ${fehlt.join("; ")}` };
    const { error } = await c.rpc("rechnung_festschreiben", {
      p_id: id,
      p_datum: heuteIso(),
      p_daten: daten as unknown as Database["public"]["Tables"]["rechnung"]["Row"]["daten"],
    });
    if (error) return { ok: false, fehler: error.message };
  }
  const fest = (await ladeRechnung(c, id))!;
  if (!fest.r.pdf_pfad) {
    const { pdf, xml } = await dateienErzeugen(c, fest);
    const basis = `${fest.r.betrieb_id}/${fest.r.rechnungsdatum!.slice(0, 4)}/${fest.r.nummer}`;
    const a = await c.storage
      .from("rechnungen")
      .upload(`${basis}.pdf`, pdf, { contentType: "application/pdf", upsert: false });
    const b = await c.storage
      .from("rechnungen")
      .upload(`${basis}.xml`, new TextEncoder().encode(xml), {
        contentType: "application/xml",
        upsert: false,
      });
    const vorhanden = (e: { message: string } | null) => !e || /exist|duplicate/i.test(e.message);
    if (!vorhanden(a.error) || !vorhanden(b.error)) {
      return {
        ok: false,
        fehler: `Ablage fehlgeschlagen: ${a.error?.message ?? b.error?.message}`,
      };
    }
    await c
      .from("rechnung")
      .update({ pdf_pfad: `${basis}.pdf`, xml_pfad: `${basis}.xml` })
      .eq("id", id);
  }
  return { ok: true, nummer: fest.r.nummer! };
}
