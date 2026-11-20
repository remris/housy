"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { istMonat } from "@/domain/nachweis";
import { type Rechnungsposition, position, summen } from "@/domain/rechnung";
import { type AktionErgebnis, dbFehler, fehler, pruefe } from "@/lib/aktion";
import { bueroKontext, inhaberKontext } from "@/lib/auth";
import { festschreiben } from "@/lib/rechnung/dokument";
import { monatslauf } from "@/lib/rechnung/lauf";
import { rechnungSenden } from "@/lib/rechnung/versand";
import { positionSchema, rechnungEinstellungenSchema, stornoSchema } from "@/lib/schemas/rechnung";

const neuLaden = () => revalidatePath("/rechnungen", "layout");

/** Summen eines Entwurfs nach Änderung der Positionen neu berechnen. */
async function summenNeu(k: Awaited<ReturnType<typeof bueroKontext>>, id: string) {
  const { data: r } = await k.supabase
    .from("rechnung")
    .select("kleinunternehmer, rechnungsposition(netto_cent, ust_satz)")
    .eq("id", id)
    .single();
  if (!r) return;
  const s = summen(
    r.rechnungsposition.map(
      (p) => ({ nettoCent: p.netto_cent, ustSatz: Number(p.ust_satz) }) as Rechnungsposition,
    ),
    r.kleinunternehmer,
  );
  await k.supabase
    .from("rechnung")
    .update({ netto_cent: s.nettoCent, ust_cent: s.steuerCent, brutto_cent: s.bruttoCent })
    .eq("id", id)
    .eq("status", "entwurf");
}

export async function monatslaufStarten(monat: string): Promise<AktionErgebnis> {
  if (!istMonat(monat)) return fehler("Ungültiger Monat.");
  const k = await bueroKontext();
  try {
    const r = await monatslauf(k.supabase, k.betriebId, monat);
    neuLaden();
    return {
      ok: true,
      meldung:
        r.rechnungen === 0
          ? "Nichts abzurechnen."
          : `${r.rechnungen} Entwürfe erstellt${r.hinweise.length ? ` (${r.hinweise.length} Hinweise)` : ""}.`,
    };
  } catch (e) {
    return fehler((e as Error).message);
  }
}

export async function entwurfLoeschen(id: string): Promise<AktionErgebnis> {
  const k = await bueroKontext();
  const { error } = await k.supabase.from("rechnung").delete().eq("id", id).eq("status", "entwurf");
  if (error) return fehler(dbFehler(error));
  neuLaden();
  return { ok: true, meldung: "Entwurf gelöscht. Die Leistungen sind wieder abrechenbar." };
}

export async function positionHinzufuegen(
  eingabe: z.input<typeof positionSchema>,
): Promise<AktionErgebnis> {
  const p = pruefe(positionSchema, eingabe);
  if (!p.ok) return p.ergebnis;
  const k = await bueroKontext();
  const d = p.daten;
  const { data: letzte } = await k.supabase
    .from("rechnungsposition")
    .select("pos")
    .eq("rechnung_id", d.rechnung_id)
    .order("pos", { ascending: false })
    .limit(1);
  const pos = position({
    bezeichnung: d.bezeichnung,
    beschreibung: d.beschreibung,
    menge: d.menge,
    einheit: d.einheit,
    einzelpreisCent: d.einzelpreis!,
    ustSatz: d.ust_satz,
    quelle: { art: "manuell" },
  });
  const { error } = await k.supabase.from("rechnungsposition").insert({
    betrieb_id: k.betriebId,
    rechnung_id: d.rechnung_id,
    pos: (letzte?.[0]?.pos ?? 0) + 1,
    bezeichnung: pos.bezeichnung,
    beschreibung: pos.beschreibung,
    menge: pos.menge,
    einheit: pos.einheit,
    einzelpreis_cent: pos.einzelpreisCent,
    netto_cent: pos.nettoCent,
    ust_satz: pos.ustSatz,
    quelle: "manuell",
  });
  if (error) return fehler(dbFehler(error));
  await summenNeu(k, d.rechnung_id);
  neuLaden();
  return { ok: true, meldung: "Position ergänzt." };
}

/** Position eines Entwurfs entfernen; Pauschalen und Nachträge werden wieder abrechenbar. */
export async function positionEntfernen(id: string): Promise<AktionErgebnis> {
  const k = await bueroKontext();
  const { data: p } = await k.supabase
    .from("rechnungsposition")
    .select("id, rechnung_id, quelle, version_id, einsatz_position_id, rechnung(status, monat)")
    .eq("id", id)
    .maybeSingle();
  if (!p || p.rechnung?.status !== "entwurf") return fehler("Nur in Entwürfen möglich.");
  if (p.quelle === "aufwand") {
    return fehler("Aufwandspositionen hängen an Einsätzen: Entwurf löschen und neu laufen lassen.");
  }
  const { error } = await k.supabase.from("rechnungsposition").delete().eq("id", id);
  if (error) return fehler(dbFehler(error));
  if (p.einsatz_position_id) {
    await k.supabase
      .from("abrechnung")
      .delete()
      .eq("rechnung_id", p.rechnung_id)
      .eq("einsatz_position_id", p.einsatz_position_id);
  }
  if (p.quelle === "pauschale" && p.version_id && p.rechnung?.monat) {
    await k.supabase
      .from("abrechnung")
      .delete()
      .eq("rechnung_id", p.rechnung_id)
      .eq("version_id", p.version_id)
      .eq("monat", p.rechnung.monat);
  }
  await summenNeu(k, p.rechnung_id);
  neuLaden();
  return { ok: true, meldung: "Position entfernt." };
}

/** Festschreiben (Nummer, PDF, XRechnung) und optional sofort senden. */
export async function rechnungenFestschreiben(
  ids: string[],
  senden: boolean,
): Promise<AktionErgebnis> {
  const k = await bueroKontext();
  const fehlerListe: string[] = [];
  let fest = 0;
  let gesendet = 0;
  for (const id of ids) {
    const r = await festschreiben(k.supabase, id);
    if (!r.ok) {
      fehlerListe.push(r.fehler);
      continue;
    }
    fest++;
    if (senden) {
      const s = await rechnungSenden(k.supabase, id);
      if (s.ok) gesendet++;
      else fehlerListe.push(`${r.nummer}: ${s.fehler}`);
    }
  }
  neuLaden();
  const teile = [`${fest} festgeschrieben`, ...(senden ? [`${gesendet} verschickt`] : [])].join(
    ", ",
  );
  if (fehlerListe.length > 0) {
    return fest > 0
      ? { ok: true, meldung: `${teile}. Probleme: ${fehlerListe.join(" · ")}` }
      : fehler(fehlerListe.join(" · "));
  }
  return { ok: true, meldung: `${teile}.` };
}

export async function rechnungSendenAktion(id: string): Promise<AktionErgebnis> {
  const k = await bueroKontext();
  const r = await rechnungSenden(k.supabase, id);
  neuLaden();
  return r.ok ? { ok: true, meldung: `Verschickt an ${r.an}.` } : fehler(r.fehler);
}

/** Fehlt nach dem Festschreiben die Ablage (z. B. Netzfehler), wird sie hier nachgeholt. */
export async function dateienNachholen(id: string): Promise<AktionErgebnis> {
  const k = await bueroKontext();
  const r = await festschreiben(k.supabase, id);
  neuLaden();
  return r.ok ? { ok: true, meldung: "PDF und XRechnung abgelegt." } : fehler(r.fehler);
}

export async function bezahltSetzen(id: string, datum: string | null): Promise<AktionErgebnis> {
  const k = await bueroKontext();
  if (datum !== null && !/^\d{4}-\d{2}-\d{2}$/.test(datum)) return fehler("Datum wählen.");
  const { error } = await k.supabase
    .from("rechnung")
    .update({ status: datum ? "bezahlt" : "offen", bezahlt_am: datum })
    .eq("id", id)
    .in("status", ["offen", "bezahlt"]);
  if (error) return fehler(dbFehler(error));
  neuLaden();
  return { ok: true, meldung: datum ? "Als bezahlt markiert." : "Wieder offen." };
}

/** Storno: Gutschrift mit eigener Nummer; die Leistungen werden wieder abrechenbar. */
export async function stornieren(eingabe: z.input<typeof stornoSchema>): Promise<AktionErgebnis> {
  const p = pruefe(stornoSchema, eingabe);
  if (!p.ok) return p.ergebnis;
  const k = await bueroKontext();
  const { data: stornoId, error } = await k.supabase.rpc("rechnung_stornieren", {
    p_id: p.daten.id,
    p_grund: p.daten.grund,
  });
  if (error) return fehler(dbFehler(error));
  const r = await festschreiben(k.supabase, stornoId);
  if (!r.ok) {
    neuLaden();
    return fehler(`Storno angelegt, aber nicht festgeschrieben: ${r.fehler}`);
  }
  let meldung = `Storniert mit ${r.nummer}.`;
  if (p.daten.senden) {
    const s = await rechnungSenden(k.supabase, stornoId);
    meldung += s.ok ? ` An ${s.an} verschickt.` : ` Nicht verschickt: ${s.fehler}`;
  }
  neuLaden();
  return { ok: true, meldung };
}

export async function rechnungEinstellungenSpeichern(
  eingabe: z.input<typeof rechnungEinstellungenSchema>,
): Promise<AktionErgebnis> {
  const p = pruefe(rechnungEinstellungenSchema, eingabe);
  if (!p.ok) return p.ergebnis;
  const k = await inhaberKontext();
  const { error } = await k.supabase.from("betrieb").update(p.daten).eq("id", k.betriebId);
  if (error) return fehler(dbFehler(error));
  revalidatePath("/einstellungen/rechnungen");
  return { ok: true, meldung: "Gespeichert." };
}
