import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type AppArtikel,
  type AppEinsatz,
  type PacklistenEinsatz,
  type Tagesdaten,
  packliste,
} from "@/domain/app";
import { plusTage } from "@/domain/datum";
import type { Bedarfsbezug } from "@/domain/vorlagen";
import { bedarfFuerObjekt } from "@/domain/prognose";
import { tagBerlin } from "@/domain/zeiterfassung";
import { ladeAppInventar } from "@/lib/inventar";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

const hhmm = (t: string | null) => (t ? t.slice(0, 5) : null);

/**
 * Lädt alles, was die Mitarbeiter-App für einen Tag braucht. Läuft im Server (erster Aufruf)
 * und im Browser (Aktualisieren); die Zugriffsrechte regelt RLS.
 */
export async function ladeTagesdaten(
  supabase: Client,
  ctx: { betriebId: string; mitgliedId: string },
  datum: string,
): Promise<Tagesdaten> {
  const [einsaetze, buchungen, preise, artikel] = await Promise.all([
    supabase
      .from("einsatz")
      .select(
        `id, datum, status, reihenfolge, geplanter_beginn, zeitfenster_von, zeitfenster_bis,
         sollzeit_minuten, notiz_mitarbeiter, notiz_mitarbeiter_am, abnahme_name, abnahme_am,
         objekt(id, name, strasse, plz, ort, breitengrad, laengengrad, zugangshinweise, qr_kennung,
           fensteraufmass(id, bezeichnung, anzahl), bereich(flaeche_m2),
           objekt_bedarf(artikel_id, menge, bezug)),
         auftragsvorlage(name, sollzeit_minuten, minuten_pro_100m2, minuten_pro_fenster,
           vorlage_taetigkeit(id, text, foto_pflicht, reihenfolge),
           vorlage_bedarf(artikel_id, menge, bezug)),
         einsatz_aufgabe(taetigkeit_id, erledigt, geaendert_am),
         einsatz_position(id, bezeichnung, menge, preis_cent, status, dauer),
         einsatz_meldung(id, art, text, artikel_id),
         einsatz_foto(id)`,
      )
      .eq("betrieb_id", ctx.betriebId)
      .eq("mitarbeiter_id", ctx.mitgliedId)
      .eq("datum", datum)
      .neq("status", "abgesagt")
      .order("reihenfolge", { ascending: true, nullsFirst: false })
      .order("zeitfenster_von", { ascending: true, nullsFirst: false }),
    supabase
      .from("zeitbuchung")
      .select("id, art, zeitpunkt, einsatz_id, storniert_am")
      .eq("mitglied_id", ctx.mitgliedId)
      .gte("zeitpunkt", `${plusTage(datum, -1)}T12:00:00Z`)
      .lte("zeitpunkt", `${plusTage(datum, 1)}T12:00:00Z`)
      .order("zeitpunkt"),
    supabase
      .from("preisliste")
      .select("id, name, einheit, preis_cent")
      .eq("betrieb_id", ctx.betriebId)
      .eq("aktiv", true)
      .order("name"),
    supabase
      .from("artikel")
      .select("id, name, einheit, art, gebinde_name, gebinde_menge")
      .eq("betrieb_id", ctx.betriebId)
      .eq("aktiv", true)
      .order("name"),
  ]);
  for (const r of [einsaetze, buchungen, preise, artikel]) {
    if (r.error) throw new Error(r.error.message);
  }

  const artikelListe: AppArtikel[] = (artikel.data ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    einheit: a.einheit,
    art: a.art,
    gebindeName: a.gebinde_name,
    gebindeMenge: Number(a.gebinde_menge),
  }));
  const inventar = await ladeAppInventar(supabase, ctx, datum).catch(() => null);
  const fuerPackliste: PacklistenEinsatz[] = [];

  const liste: AppEinsatz[] = (einsaetze.data ?? []).map((e) => {
    const o = e.objekt;
    const v = e.auftragsvorlage;
    const umfang = {
      flaecheM2: (o?.bereich ?? []).reduce((s, b) => s + Number(b.flaeche_m2 ?? 0), 0),
      fenster: (o?.fensteraufmass ?? []).reduce((s, f) => s + f.anzahl, 0),
      stunden: e.sollzeit_minuten / 60,
    };
    if (v && e.status !== "erledigt") {
      fuerPackliste.push({
        vorlage: {
          sollzeitMinuten: v.sollzeit_minuten,
          minutenPro100m2: v.minuten_pro_100m2 === null ? null : Number(v.minuten_pro_100m2),
          minutenProFenster: v.minuten_pro_fenster === null ? null : Number(v.minuten_pro_fenster),
        },
        umfang,
        bedarfe: bedarfFuerObjekt(
          v.vorlage_bedarf.map((b) => ({
            artikelId: b.artikel_id,
            menge: Number(b.menge),
            bezug: b.bezug as Bedarfsbezug,
          })),
          (o?.objekt_bedarf ?? []).map((b) => ({
            artikelId: b.artikel_id,
            menge: Number(b.menge),
            bezug: b.bezug as Bedarfsbezug,
          })),
        ),
      });
    }
    const haken = new Map(e.einsatz_aufgabe.map((a) => [a.taetigkeit_id, a]));
    return {
      id: e.id,
      datum: e.datum,
      status: e.status,
      reihenfolge: e.reihenfolge,
      geplanterBeginn: hhmm(e.geplanter_beginn),
      zeitfensterVon: hhmm(e.zeitfenster_von),
      zeitfensterBis: hhmm(e.zeitfenster_bis),
      sollzeitMinuten: e.sollzeit_minuten,
      vorlage: v?.name ?? "",
      objekt: {
        id: o?.id ?? "",
        name: o?.name ?? "",
        strasse: o?.strasse ?? null,
        plz: o?.plz ?? null,
        ort: o?.ort ?? null,
        lat: o?.breitengrad == null ? null : Number(o.breitengrad),
        lng: o?.laengengrad == null ? null : Number(o.laengengrad),
        zugangshinweise: o?.zugangshinweise ?? null,
        qrKennung: o?.qr_kennung ?? "",
        fenster: (o?.fensteraufmass ?? []).map((f) => ({
          id: f.id,
          bezeichnung: f.bezeichnung,
          anzahl: f.anzahl,
        })),
      },
      aufgaben: [...(v?.vorlage_taetigkeit ?? [])]
        .sort((a, b) => a.reihenfolge - b.reihenfolge)
        .map((t) => ({
          taetigkeitId: t.id,
          text: t.text,
          fotoPflicht: t.foto_pflicht,
          erledigt: haken.get(t.id)?.erledigt ?? false,
          geaendertAm: haken.get(t.id)?.geaendert_am ?? null,
        })),
      notiz: e.notiz_mitarbeiter,
      notizAm: e.notiz_mitarbeiter_am,
      positionen: e.einsatz_position.map((p) => ({
        id: p.id,
        bezeichnung: p.bezeichnung,
        menge: Number(p.menge),
        preisCent: p.preis_cent,
        status: p.status,
        dauer: p.dauer as "heute" | "dauerhaft",
      })),
      meldungen: e.einsatz_meldung.map((m) => ({
        id: m.id,
        art: m.art,
        text: m.text,
        artikelId: m.artikel_id,
      })),
      fotos: e.einsatz_foto.length,
      abnahme: e.abnahme_name && e.abnahme_am ? { name: e.abnahme_name, am: e.abnahme_am } : null,
      warnungen: [
        ...new Set(
          (v?.vorlage_bedarf ?? []).flatMap(
            (b) => inventar?.pruefungUeberfaellig.get(b.artikel_id) ?? [],
          ),
        ),
      ],
    };
  });

  return {
    geladenAm: new Date().toISOString(),
    datum,
    betriebId: ctx.betriebId,
    mitgliedId: ctx.mitgliedId,
    einsaetze: liste,
    buchungen: (buchungen.data ?? [])
      .filter((b) => tagBerlin(b.zeitpunkt) === datum)
      .map((b) => ({
        id: b.id,
        art: b.art,
        zeitpunkt: b.zeitpunkt,
        einsatzId: b.einsatz_id,
        storniert: !!b.storniert_am,
      })),
    preisliste: (preise.data ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      einheit: p.einheit,
      preisCent: p.preis_cent,
    })),
    artikel: artikelListe,
    packliste: packliste(fuerPackliste, artikelListe, inventar?.fahrzeugBestand),
    fahrzeug: inventar?.fahrzeug ?? null,
    werkzeuge: inventar?.werkzeuge ?? [],
  };
}
