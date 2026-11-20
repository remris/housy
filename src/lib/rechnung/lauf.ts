import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { type Monat, einsatzZeit, monatsZeitraum } from "@/domain/nachweis";
import {
  type Abgerechnet,
  type EinsatzFuerLauf,
  type NachtragFuerLauf,
  type Preiseinheit,
  type Rechnungsposition,
  type VertragFuerLauf,
  nachtragsPositionen,
  pflichthinweise,
  summen,
  vertragsPositionen,
} from "@/domain/rechnung";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

export type LaufErgebnis = { rechnungen: number; hinweise: string[] };

const einheit = (e: string | null | undefined): Preiseinheit =>
  (e as Preiseinheit | null) ?? "einsatz";

/**
 * Monatslauf: legt je Kunde und Objekt einen Rechnungsentwurf an (Pauschalen, Aufwand,
 * Nachträge). Vorhandene Entwürfe dieses Monats werden ersetzt; Festgeschriebenes und
 * schon Abgerechnetes bleibt unberührt.
 */
export async function monatslauf(
  c: Client,
  betriebId: string,
  monat: Monat,
): Promise<LaufErgebnis> {
  const { von, bis } = monatsZeitraum(monat);

  // alte Entwürfe dieses Laufs entfernen (Positionen und Verknüpfungen kaskadieren)
  const weg = await c
    .from("rechnung")
    .delete()
    .eq("betrieb_id", betriebId)
    .eq("monat", monat)
    .eq("status", "entwurf")
    .eq("art", "rechnung");
  if (weg.error) throw new Error(weg.error.message);

  const [betrieb, vertraege, abgerechnet, nachtraege] = await Promise.all([
    c.from("betrieb").select("kleinunternehmer").eq("id", betriebId).single(),
    c
      .from("vertrag")
      .select(
        `id, titel, kunde_id, objekt_id, beginn, endet_am, status,
         vertragsversion(id, version, gueltig_ab, abrechnungsart, pauschale_cent,
           vertragsleistung(id, bezeichnung, preis_cent, menge_fenster, menge_m2,
             auftragsvorlage(name), preisliste(name, einheit, preis_cent, ust_satz)))`,
      )
      .eq("betrieb_id", betriebId)
      .in("status", ["aktiv", "gekuendigt", "beendet"])
      .lte("beginn", bis),
    c
      .from("abrechnung")
      .select("einsatz_id, einsatz_position_id, version_id, monat")
      .eq("betrieb_id", betriebId)
      .eq("aktiv", true),
    c
      .from("einsatz_position")
      .select(
        "id, bezeichnung, menge, einheit, preis_cent, ust_satz, einsatz!inner(id, datum, status, objekt_id, objekt(kunde_id))",
      )
      .eq("betrieb_id", betriebId)
      .eq("status", "bestaetigt")
      .not("preis_cent", "is", null)
      .gte("einsatz.datum", von)
      .lte("einsatz.datum", bis),
  ]);
  for (const r of [betrieb, vertraege, abgerechnet, nachtraege]) {
    if (r.error) throw new Error(r.error.message);
  }
  const schon: Abgerechnet = {
    einsatzIds: new Set(abgerechnet.data!.flatMap((a) => (a.einsatz_id ? [a.einsatz_id] : []))),
    nachtragIds: new Set(
      abgerechnet.data!.flatMap((a) => (a.einsatz_position_id ? [a.einsatz_position_id] : [])),
    ),
    pauschalen: new Set(
      abgerechnet.data!.flatMap((a) => (a.version_id ? [`${a.version_id}|${a.monat}`] : [])),
    ),
  };
  const aktiv = vertraege.data!.filter((v) => !v.endet_am || v.endet_am >= von);

  // erledigte Einsätze der Verträge im Monat, mit Ist-Zeit
  const ids = aktiv.map((v) => v.id);
  const { data: einsaetze, error } = ids.length
    ? await c
        .from("einsatz")
        .select(
          "id, datum, vertrag_id, vertragsleistung_id, sollzeit_minuten, objekt(fensteraufmass(anzahl), bereich(flaeche_m2)), zeitbuchung(id, art, zeitpunkt, einsatz_id, storniert_am)",
        )
        .in("vertrag_id", ids)
        .eq("status", "erledigt")
        .gte("datum", von)
        .lte("datum", bis)
    : { data: [], error: null };
  if (error) throw new Error(error.message);

  type Gruppe = {
    kundeId: string;
    objektId: string;
    positionen: Rechnungsposition[];
    hinweise: string[];
  };
  const gruppen = new Map<string, Gruppe>();
  const gruppe = (kundeId: string, objektId: string) => {
    const k = `${kundeId}|${objektId}`;
    if (!gruppen.has(k)) gruppen.set(k, { kundeId, objektId, positionen: [], hinweise: [] });
    return gruppen.get(k)!;
  };

  for (const v of aktiv) {
    const leistungen = new Map(
      v.vertragsversion.flatMap((x) => x.vertragsleistung.map((l) => [l.id, l] as const)),
    );
    const vertrag: VertragFuerLauf = {
      id: v.id,
      titel: v.titel,
      beginn: v.beginn,
      endetAm: v.endet_am,
      versionen: v.vertragsversion.map((x) => ({
        id: x.id,
        version: x.version,
        gueltigAb: x.gueltig_ab,
        abrechnungsart: x.abrechnungsart,
        pauschaleCent: x.pauschale_cent,
        leistungen: x.vertragsleistung.map((l) => ({
          id: l.id,
          bezeichnung: l.bezeichnung || l.preisliste?.name || l.auftragsvorlage?.name || "Leistung",
          einheit: einheit(l.preisliste?.einheit),
          preisCent: l.preis_cent ?? l.preisliste?.preis_cent ?? null,
          ustSatz: Number(l.preisliste?.ust_satz ?? 19),
        })),
      })),
    };
    const fuerLauf: EinsatzFuerLauf[] = (einsaetze ?? [])
      .filter((e) => e.vertrag_id === v.id)
      .map((e) => {
        const ist = einsatzZeit(
          e.zeitbuchung.map((z) => ({
            id: z.id,
            art: z.art,
            zeitpunkt: z.zeitpunkt,
            einsatzId: z.einsatz_id,
            storniert: !!z.storniert_am,
          })),
          e.id,
        );
        const l = e.vertragsleistung_id ? leistungen.get(e.vertragsleistung_id) : undefined;
        return {
          id: e.id,
          datum: e.datum,
          vertragsleistungId: e.vertragsleistung_id,
          minuten: ist.minuten > 0 ? ist.minuten : e.sollzeit_minuten,
          fenster:
            l?.menge_fenster ?? (e.objekt?.fensteraufmass ?? []).reduce((s, f) => s + f.anzahl, 0),
          m2:
            l?.menge_m2 != null
              ? Number(l.menge_m2)
              : (e.objekt?.bereich ?? []).reduce((s, b) => s + Number(b.flaeche_m2 ?? 0), 0),
        };
      });
    const r = vertragsPositionen({ monat, vertrag, einsaetze: fuerLauf, abgerechnet: schon });
    const g = gruppe(v.kunde_id, v.objekt_id);
    g.positionen.push(...r.positionen);
    g.hinweise.push(...r.hinweise.map((h) => `${v.titel}: ${h}`));
  }

  for (const n of nachtraege.data!) {
    const e = n.einsatz;
    if (!e || e.status === "abgesagt" || !e.objekt) continue;
    const nachtrag: NachtragFuerLauf = {
      id: n.id,
      einsatzId: e.id,
      datum: e.datum,
      bezeichnung: n.bezeichnung,
      menge: Number(n.menge),
      einheit: n.einheit as Preiseinheit | null,
      preisCent: n.preis_cent!,
      ustSatz: Number(n.ust_satz ?? 19),
    };
    gruppe(e.objekt.kunde_id, e.objekt_id).positionen.push(
      ...nachtragsPositionen([nachtrag], schon),
    );
  }

  // Kundendaten für Zahlungsziel und Pflichthinweise
  const kundenIds = [...new Set([...gruppen.values()].map((g) => g.kundeId))];
  const { data: kunden } = kundenIds.length
    ? await c.from("kunde").select("id, typ, zahlungsziel_tage").in("id", kundenIds)
    : { data: [] };
  const ku = betrieb.data!.kleinunternehmer;
  const ergebnis: LaufErgebnis = { rechnungen: 0, hinweise: [] };

  for (const g of gruppen.values()) {
    if (g.positionen.length === 0) {
      ergebnis.hinweise.push(...g.hinweise);
      continue;
    }
    const kunde = kunden?.find((k) => k.id === g.kundeId);
    const s = summen(g.positionen, ku);
    const { data: r, error: e1 } = await c
      .from("rechnung")
      .insert({
        betrieb_id: betriebId,
        kunde_id: g.kundeId,
        objekt_id: g.objektId,
        monat,
        leistung_von: von,
        leistung_bis: bis,
        zahlungsziel_tage: kunde?.zahlungsziel_tage ?? 14,
        kleinunternehmer: ku,
        netto_cent: s.nettoCent,
        ust_cent: s.steuerCent,
        brutto_cent: s.bruttoCent,
        hinweise: pflichthinweise({ kleinunternehmer: ku, privatkunde: kunde?.typ === "privat" }),
        lauf_hinweise: g.hinweise,
      })
      .select("id")
      .single();
    if (e1) throw new Error(e1.message);
    const { error: e2 } = await c.from("rechnungsposition").insert(
      g.positionen.map((p, i) => ({
        betrieb_id: betriebId,
        rechnung_id: r.id,
        pos: i + 1,
        bezeichnung: p.bezeichnung,
        beschreibung: p.beschreibung,
        menge: p.menge,
        einheit: p.einheit,
        einzelpreis_cent: p.einzelpreisCent,
        netto_cent: p.nettoCent,
        ust_satz: p.ustSatz,
        von: p.von,
        bis: p.bis,
        quelle: p.quelle.art,
        vertrag_id: "vertragId" in p.quelle ? p.quelle.vertragId : null,
        version_id: "versionId" in p.quelle ? p.quelle.versionId : null,
        einsatz_position_id: p.quelle.art === "nachtrag" ? p.quelle.einsatzPositionId : null,
      })),
    );
    if (e2) throw new Error(e2.message);
    type Link = {
      einsatz_id?: string;
      einsatz_position_id?: string;
      version_id?: string;
      monat?: string;
    };
    const links = g.positionen.flatMap((p): Link[] =>
      p.quelle.art === "pauschale"
        ? [{ version_id: p.quelle.versionId, monat }]
        : p.quelle.art === "aufwand"
          ? p.quelle.einsatzIds.map((id) => ({ einsatz_id: id }))
          : p.quelle.art === "nachtrag"
            ? [{ einsatz_position_id: p.quelle.einsatzPositionId }]
            : [],
    );
    if (links.length > 0) {
      const { error: e3 } = await c
        .from("abrechnung")
        .insert(links.map((l) => ({ ...l, betrieb_id: betriebId, rechnung_id: r.id })));
      if (e3) throw new Error(e3.message);
    }
    ergebnis.rechnungen++;
    ergebnis.hinweise.push(...g.hinweise);
  }
  return ergebnis;
}
