import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { einsatzZeit } from "@/domain/nachweis";
import type { Buchung } from "@/domain/zeiterfassung";
import type { NachweisDokument, NachweisEinsatz, PdfBild } from "@/lib/pdf/nachweis-pdf";
import type { Database } from "@/lib/supabase/database.types";

type Admin = SupabaseClient<Database>;

/** Fotos je Einsatz im Einzelnachweis (Größe der Mail). */
export const MAX_FOTOS = 6;

/** Erkennt JPEG/PNG an den ersten Bytes; andere Formate kann react-pdf nicht einbetten. */
export function bildformat(b: Uint8Array): "jpg" | "png" | null {
  if (b[0] === 0xff && b[1] === 0xd8) return "jpg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "png";
  return null;
}

async function ladeBild(admin: Admin, bucket: string, pfad: string): Promise<PdfBild | null> {
  const { data } = await admin.storage.from(bucket).download(pfad);
  if (!data) return null;
  const bytes = Buffer.from(await data.arrayBuffer());
  const format = bildformat(bytes);
  return format ? { data: bytes, format } : null;
}

const vorname = (name: string | null | undefined) => name?.trim().split(/\s+/)[0] ?? null;

/**
 * Lädt alles für einen Nachweis: Betrieb, Kunde, Objekt und die erledigten Einsätze
 * (bei Monatsnachweisen alle erledigten Einsätze des Objekts im Zeitraum).
 */
export async function ladeNachweisDokument(
  admin: Admin,
  p: {
    betriebId: string;
    art: "einsatz" | "monat";
    objektId: string;
    von: string;
    bis: string;
    einsatzId: string | null;
  },
): Promise<NachweisDokument> {
  let abfrage = admin
    .from("einsatz")
    .select(
      `id, datum, status, abnahme_name, abnahme_bild, abnahme_am,
       mitglied(anzeigename),
       auftragsvorlage(name, vorlage_taetigkeit(id, text, reihenfolge)),
       einsatz_aufgabe(taetigkeit_id, erledigt),
       einsatz_position(bezeichnung, menge, dauer, status, zustimmung, unterschrift_name, erstellt_am),
       einsatz_meldung(art, text, status, erstellt_am),
       einsatz_foto(pfad, meldung_id, erstellt_am)`,
    )
    .eq("betrieb_id", p.betriebId)
    .eq("objekt_id", p.objektId)
    .order("datum")
    .order("zeitfenster_von", { ascending: true, nullsFirst: false });
  abfrage = p.einsatzId
    ? abfrage.eq("id", p.einsatzId)
    : abfrage.eq("status", "erledigt").gte("datum", p.von).lte("datum", p.bis);

  const [betrieb, objekt, einsaetze] = await Promise.all([
    admin
      .from("betrieb")
      .select(
        "name, firmenname, strasse, plz, ort, telefon, email, steuernummer, ust_id, logo_pfad, nachweis_fotos",
      )
      .eq("id", p.betriebId)
      .single(),
    admin
      .from("objekt")
      .select("name, strasse, plz, ort, kunde(name, zusatz, strasse, plz, ort, kundennummer)")
      .eq("id", p.objektId)
      .eq("betrieb_id", p.betriebId)
      .single(),
    abfrage,
  ]);
  if (betrieb.error) throw new Error(`Betrieb: ${betrieb.error.message}`);
  if (objekt.error || !objekt.data.kunde) throw new Error(`Objekt: ${objekt.error?.message}`);
  if (einsaetze.error) throw new Error(`Einsätze: ${einsaetze.error.message}`);

  const ids = einsaetze.data.map((e) => e.id);
  const buchungen: Buchung[] = [];
  if (ids.length > 0) {
    const { data, error } = await admin
      .from("zeitbuchung")
      .select("id, art, zeitpunkt, einsatz_id, storniert_am")
      .in("einsatz_id", ids);
    if (error) throw new Error(`Zeiten: ${error.message}`);
    for (const z of data) {
      buchungen.push({
        id: z.id,
        art: z.art,
        zeitpunkt: z.zeitpunkt,
        einsatzId: z.einsatz_id,
        storniert: !!z.storniert_am,
      });
    }
  }

  const mitFotos = p.art === "einsatz" && betrieb.data.nachweis_fotos;
  const liste: NachweisEinsatz[] = [];
  for (const e of einsaetze.data) {
    const haken = new Map(e.einsatz_aufgabe.map((a) => [a.taetigkeit_id, a.erledigt]));
    const fotoPfade = e.einsatz_foto
      .filter((f) => !f.meldung_id)
      .sort((a, b) => a.erstellt_am.localeCompare(b.erstellt_am));
    const fotos: PdfBild[] = [];
    if (mitFotos) {
      for (const f of fotoPfade.slice(0, MAX_FOTOS)) {
        const bild = await ladeBild(admin, "einsatzfotos", f.pfad);
        if (bild) fotos.push(bild);
      }
    }
    const zeit = einsatzZeit(buchungen, e.id);
    liste.push({
      datum: e.datum,
      leistung: e.auftragsvorlage?.name ?? "",
      mitarbeiter: vorname(e.mitglied?.anzeigename),
      von: zeit.von,
      bis: zeit.bis,
      minuten: zeit.minuten,
      aufgaben: [...(e.auftragsvorlage?.vorlage_taetigkeit ?? [])]
        .sort((a, b) => a.reihenfolge - b.reihenfolge)
        .map((t) => ({ text: t.text, erledigt: haken.get(t.id) ?? false })),
      positionen: [...e.einsatz_position]
        .sort((a, b) => a.erstellt_am.localeCompare(b.erstellt_am))
        .map((x) => ({
          bezeichnung: x.bezeichnung,
          menge: Number(x.menge),
          dauer: x.dauer as "heute" | "dauerhaft",
          status: x.status,
          zustimmung: x.zustimmung as "unterschrift" | "muendlich",
          unterschriftName: x.unterschrift_name,
        })),
      maengel: e.einsatz_meldung
        .filter((m) => m.art === "mangel")
        .sort((a, b) => a.erstellt_am.localeCompare(b.erstellt_am))
        .map((m) => ({ text: m.text ?? "", status: m.status })),
      fotoAnzahl: fotoPfade.length,
      fotos,
      abnahme:
        e.abnahme_name && e.abnahme_bild && e.abnahme_am
          ? { name: e.abnahme_name, am: e.abnahme_am, bild: e.abnahme_bild }
          : null,
    });
  }

  const b = betrieb.data;
  const k = objekt.data.kunde;
  return {
    art: p.art,
    von: p.von,
    bis: p.bis,
    betrieb: {
      name: b.firmenname || b.name,
      strasse: b.strasse,
      plz: b.plz,
      ort: b.ort,
      telefon: b.telefon,
      email: b.email,
      steuernummer: b.steuernummer,
      ust_id: b.ust_id,
    },
    logo: b.logo_pfad ? await ladeBild(admin, "logos", b.logo_pfad) : null,
    kunde: {
      name: k.name,
      zusatz: k.zusatz,
      strasse: k.strasse,
      plz: k.plz,
      ort: k.ort,
      kundennummer: Number(k.kundennummer),
    },
    objekt: {
      name: objekt.data.name,
      strasse: objekt.data.strasse,
      plz: objekt.data.plz,
      ort: objekt.data.ort,
    },
    einsaetze: liste,
    erstelltAm: new Date().toISOString(),
  };
}
