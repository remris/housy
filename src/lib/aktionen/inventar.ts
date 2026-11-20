"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { heuteIso, plusTage } from "@/domain/datum";
import { inventurKorrektur } from "@/domain/lager";
import { berlinZuIso } from "@/domain/zeiterfassung";
import { type AktionErgebnis, dbFehler, fehler, pruefe } from "@/lib/aktion";
import { bueroKontext, inhaberKontext } from "@/lib/auth";
import { ladeBedarfsEinsaetze, ladeIstKorrekturen, nutztArtikel, nutzung } from "@/lib/inventar";
import {
  bestellungSchema,
  bewegungSchema,
  lagerortSchema,
  objektBedarfSchema,
  pruefungSchema,
  wechselSchema,
  werkzeugSchema,
} from "@/lib/schemas/inventar";

const neuLaden = () => revalidatePath("/inventar", "layout");
const zahl = (s: string) => Number(s.trim().replace(",", "."));

// ---------------------------------------------------------------------------
// Bewegungen
// ---------------------------------------------------------------------------

/** Zugang, Umbuchung oder Inventur (gezählte Menge → Korrektur mit der Differenz). */
export async function bewegungBuchen(
  eingabe: z.input<typeof bewegungSchema>,
): Promise<AktionErgebnis> {
  const p = pruefe(bewegungSchema, eingabe);
  if (!p.ok) return p.ergebnis;
  const k = await bueroKontext();
  const d = p.daten;
  const menge = zahl(d.menge);
  if (d.art === "inventur") {
    const ort = d.nach_lagerort_id!;
    const { data: b } = await k.supabase
      .from("bestand")
      .select("menge")
      .eq("lagerort_id", ort)
      .eq("artikel_id", d.artikel_id)
      .maybeSingle();
    const korrektur = inventurKorrektur(ort, d.artikel_id, Number(b?.menge ?? 0), menge);
    if (!korrektur) return { ok: true, meldung: "Bestand stimmt, nichts zu buchen." };
    const { error } = await k.supabase.from("lagerbewegung").insert({
      betrieb_id: k.betriebId,
      artikel_id: d.artikel_id,
      art: "korrektur",
      menge: korrektur.menge,
      von_lagerort_id: korrektur.von,
      nach_lagerort_id: korrektur.nach,
      notiz: d.notiz ?? "Inventur",
    });
    if (error) return fehler(dbFehler(error));
    neuLaden();
    return { ok: true, meldung: "Inventur gebucht." };
  }
  const { error } = await k.supabase.from("lagerbewegung").insert({
    betrieb_id: k.betriebId,
    artikel_id: d.artikel_id,
    art: d.art,
    menge,
    von_lagerort_id: d.art === "zugang" ? null : d.von_lagerort_id,
    nach_lagerort_id: d.nach_lagerort_id,
    notiz: d.notiz,
  });
  if (error) return fehler(dbFehler(error));
  neuLaden();
  return { ok: true, meldung: d.art === "zugang" ? "Zugang gebucht." : "Umgebucht." };
}

// ---------------------------------------------------------------------------
// Einkauf
// ---------------------------------------------------------------------------

export async function bestellungAnlegen(
  eingabe: z.input<typeof bestellungSchema>,
): Promise<AktionErgebnis> {
  const p = pruefe(bestellungSchema, eingabe);
  if (!p.ok) return p.ergebnis;
  const k = await bueroKontext();
  const { error } = await k.supabase
    .from("bestellung")
    .insert({ ...p.daten, betrieb_id: k.betriebId });
  if (error) return fehler(dbFehler(error));
  neuLaden();
  return { ok: true, meldung: "Als bestellt vermerkt." };
}

/** Wareneingang: offene Bestellung ins Zentrallager buchen. */
export async function bestellungGeliefert(id: string): Promise<AktionErgebnis> {
  const k = await bueroKontext();
  const [{ data: b }, { data: lager }] = await Promise.all([
    k.supabase
      .from("bestellung")
      .select("id, artikel_id, menge, status")
      .eq("id", id)
      .maybeSingle(),
    k.supabase
      .from("lagerort")
      .select("id")
      .eq("betrieb_id", k.betriebId)
      .eq("standard", true)
      .maybeSingle(),
  ]);
  if (!b || b.status !== "offen") return fehler("Bestellung nicht offen.");
  if (!lager) return fehler("Kein Zentrallager angelegt.");
  const { error } = await k.supabase.from("lagerbewegung").insert({
    betrieb_id: k.betriebId,
    artikel_id: b.artikel_id,
    art: "zugang",
    menge: b.menge,
    nach_lagerort_id: lager.id,
    bestellung_id: b.id,
    notiz: "Wareneingang",
  });
  if (error) return fehler(dbFehler(error));
  await k.supabase
    .from("bestellung")
    .update({ status: "geliefert", geliefert_am: new Date().toISOString() })
    .eq("id", id);
  neuLaden();
  return { ok: true, meldung: "Wareneingang gebucht." };
}

export async function bestellungStornieren(id: string): Promise<AktionErgebnis> {
  const k = await bueroKontext();
  const { error } = await k.supabase
    .from("bestellung")
    .update({ status: "storniert" })
    .eq("id", id)
    .eq("status", "offen");
  if (error) return fehler(dbFehler(error));
  neuLaden();
  return { ok: true, meldung: "Bestellung storniert." };
}

// ---------------------------------------------------------------------------
// Lagerorte
// ---------------------------------------------------------------------------

export async function lagerortSpeichern(
  id: string | null,
  eingabe: z.input<typeof lagerortSchema>,
): Promise<AktionErgebnis> {
  const p = pruefe(lagerortSchema, eingabe);
  if (!p.ok) return p.ergebnis;
  const k = await bueroKontext();
  const d = { ...p.daten, objekt_id: p.daten.art === "objekt" ? p.daten.objekt_id : null };
  const { error } = id
    ? await k.supabase.from("lagerort").update({ name: d.name, aktiv: d.aktiv }).eq("id", id)
    : await k.supabase.from("lagerort").insert({ ...d, betrieb_id: k.betriebId });
  if (error) return fehler(dbFehler(error));
  neuLaden();
  return { ok: true, meldung: "Lagerort gespeichert." };
}

// ---------------------------------------------------------------------------
// Werkzeuge
// ---------------------------------------------------------------------------

export async function werkzeugSpeichern(
  id: string | null,
  eingabe: z.input<typeof werkzeugSchema>,
): Promise<AktionErgebnis> {
  const p = pruefe(werkzeugSchema, eingabe);
  if (!p.ok) return p.ergebnis;
  const k = await bueroKontext();
  const { error } = id
    ? await k.supabase.from("werkzeug").update(p.daten).eq("id", id)
    : await k.supabase.from("werkzeug").insert({ ...p.daten, betrieb_id: k.betriebId });
  if (error) return fehler(dbFehler(error));
  neuLaden();
  return { ok: true, meldung: "Werkzeug gespeichert." };
}

export async function werkzeugAusmustern(id: string): Promise<AktionErgebnis> {
  const k = await bueroKontext();
  const { error } = await k.supabase.from("werkzeug").update({ aktiv: false }).eq("id", id);
  if (error) return fehler(dbFehler(error));
  neuLaden();
  return { ok: true, meldung: "Ausgemustert." };
}

/**
 * Wechsel melden, auch nachträglich datiert. Der Zählerstand beim Wechsel wird aus den Einsätzen
 * bis zu diesem Zeitpunkt berechnet (Grundlage für „Lebensdauer lernt mit“).
 */
export async function werkzeugGewechselt(
  eingabe: z.input<typeof wechselSchema>,
): Promise<AktionErgebnis> {
  const p = pruefe(wechselSchema, eingabe);
  if (!p.ok) return p.ergebnis;
  const k = await bueroKontext();
  const d = p.daten;
  const am = berlinZuIso(d.am.slice(0, 10), d.am.slice(11, 16));
  if (Date.parse(am) > Date.now() + 10 * 60_000) return fehler("Zeitpunkt liegt in der Zukunft.");
  const { data: w } = await k.supabase
    .from("werkzeug")
    .select(
      "id, artikel_id, bezeichnung, mitglied_id, fahrzeug_id, startstand, erstellt_am, artikel(lebensdauer_einheit), fahrzeug(mitglied_id)",
    )
    .eq("id", d.werkzeug_id)
    .maybeSingle();
  if (!w) return fehler("Werkzeug nicht gefunden.");
  const { data: vorher } = await k.supabase
    .from("werkzeug_wechsel")
    .select("am")
    .eq("werkzeug_id", w.id)
    .lt("am", am)
    .order("am", { ascending: false })
    .limit(1);
  const ab = vorher?.[0]?.am ?? w.erstellt_am;
  const besitzer = w.mitglied_id ?? w.fahrzeug?.mitglied_id ?? undefined;
  const einsaetze = await ladeBedarfsEinsaetze(k.supabase, {
    betriebId: k.betriebId,
    von: plusTage(ab.slice(0, 10), -1),
    bis: am.slice(0, 10),
    erledigt: true,
    mitarbeiterId: besitzer,
  });
  const stand =
    (vorher?.[0] ? 0 : Number(w.startstand)) +
    einsaetze
      .filter((e) => e.abschluss > ab && e.abschluss <= am && nutztArtikel(e, w.artikel_id))
      .reduce((s, e) => s + nutzung(e, w.artikel?.lebensdauer_einheit ?? null), 0);
  const { error } = await k.supabase.from("werkzeug_wechsel").insert({
    betrieb_id: k.betriebId,
    werkzeug_id: w.id,
    am,
    stand: Math.round(stand * 100) / 100,
    grund: d.grund,
  });
  if (error) return fehler(dbFehler(error));
  if (d.lagerort_id) {
    await k.supabase.from("lagerbewegung").insert({
      betrieb_id: k.betriebId,
      artikel_id: w.artikel_id,
      art: "wechsel",
      menge: 1,
      von_lagerort_id: d.lagerort_id,
      notiz: `Wechsel ${w.bezeichnung}`,
    });
  }
  neuLaden();
  return { ok: true, meldung: `Wechsel gespeichert (Zähler stand bei ${Math.round(stand)}).` };
}

export async function pruefungErfassen(
  eingabe: z.input<typeof pruefungSchema>,
): Promise<AktionErgebnis> {
  const p = pruefe(pruefungSchema, eingabe);
  if (!p.ok) return p.ergebnis;
  const k = await bueroKontext();
  const { error } = await k.supabase
    .from("werkzeug_pruefung")
    .insert({ ...p.daten, betrieb_id: k.betriebId });
  if (error) return fehler(dbFehler(error));
  neuLaden();
  return {
    ok: true,
    meldung: p.daten.bestanden ? "Prüfung erfasst, nächster Termin gesetzt." : "Prüfung erfasst.",
  };
}

/** „Lebensdauer lernt mit“: Vorschlag aus den echten Wechseln übernehmen (Inhaber entscheidet). */
export async function lebensdauerUebernehmen(
  artikelId: string,
  wert: number,
): Promise<AktionErgebnis> {
  const k = await inhaberKontext();
  if (!(wert > 0)) return fehler("Ungültiger Wert.");
  const { error } = await k.supabase
    .from("artikel")
    .update({ lebensdauer: wert })
    .eq("id", artikelId)
    .eq("betrieb_id", k.betriebId);
  if (error) return fehler(dbFehler(error));
  neuLaden();
  return { ok: true, meldung: "Lebensdauer angepasst." };
}

// ---------------------------------------------------------------------------
// Ist-Korrektur aus „leer“-Meldungen
// ---------------------------------------------------------------------------

/**
 * Übernimmt den Ist-Verbrauch für die betroffenen Objekte (Faktor auf die Vorlagenzeilen),
 * setzt das Fahrzeug auf 0 und schließt die Meldung. Mit `uebernehmen = false` nur Letzteres.
 */
export async function istKorrekturAnwenden(
  meldungId: string,
  uebernehmen: boolean,
): Promise<AktionErgebnis> {
  const k = await bueroKontext();
  const v = (await ladeIstKorrekturen(k.supabase, k.betriebId, heuteIso())).find(
    (x) => x.meldungId === meldungId,
  );
  if (!v) return fehler("Vorschlag nicht mehr aktuell.");
  if (uebernehmen) {
    const faktor = v.korrektur.istJeEinsatz / v.korrektur.sollJeEinsatz;
    const { data: einsaetze } = await k.supabase
      .from("einsatz")
      .select("objekt_id, auftragsvorlage(vorlage_bedarf(artikel_id, menge, bezug))")
      .in("id", v.einsatzIds);
    const zeilen = new Map<string, { objekt_id: string; menge: number; bezug: string }>();
    for (const e of einsaetze ?? []) {
      for (const b of e.auftragsvorlage?.vorlage_bedarf ?? []) {
        if (b.artikel_id !== v.artikel.id) continue;
        zeilen.set(`${e.objekt_id}|${b.bezug}`, {
          objekt_id: e.objekt_id,
          bezug: b.bezug,
          menge: Math.round(Number(b.menge) * faktor * 10_000) / 10_000,
        });
      }
    }
    for (const z of zeilen.values()) {
      const { error } = await k.supabase.from("objekt_bedarf").upsert(
        {
          betrieb_id: k.betriebId,
          objekt_id: z.objekt_id,
          artikel_id: v.artikel.id,
          bezug: z.bezug as "einsatz",
          menge: z.menge,
          notiz: `Ist-Korrektur aus Leer-Meldung vom ${v.gemeldetAm.slice(0, 10)}`,
        },
        { onConflict: "objekt_id,artikel_id,bezug" },
      );
      if (error) return fehler(dbFehler(error));
    }
  }
  if (v.korrektur.rechnerischRest > 0) {
    await k.supabase.from("lagerbewegung").insert({
      betrieb_id: k.betriebId,
      artikel_id: v.artikel.id,
      art: "korrektur",
      menge: v.korrektur.rechnerischRest,
      von_lagerort_id: v.lagerortId,
      notiz: "Leer gemeldet",
    });
  }
  await k.supabase
    .from("einsatz_meldung")
    .update({ erledigt_am: new Date().toISOString(), erledigt_von: k.user.id })
    .eq("id", meldungId);
  neuLaden();
  revalidatePath("/rueckmeldungen");
  return {
    ok: true,
    meldung: uebernehmen
      ? `Verbrauch für ${v.objekte.length} Objekt(e) angepasst, Fahrzeug auf 0 gesetzt.`
      : "Fahrzeug auf 0 gesetzt.",
  };
}

// ---------------------------------------------------------------------------
// Verbrauch je Objekt (überschreibt die Vorlage)
// ---------------------------------------------------------------------------

export async function objektBedarfSpeichern(
  eingabe: z.input<typeof objektBedarfSchema>,
): Promise<AktionErgebnis> {
  const p = pruefe(objektBedarfSchema, eingabe);
  if (!p.ok) return p.ergebnis;
  const k = await bueroKontext();
  const { error } = await k.supabase
    .from("objekt_bedarf")
    .upsert(
      { ...p.daten, betrieb_id: k.betriebId, notiz: "von Hand" },
      { onConflict: "objekt_id,artikel_id,bezug" },
    );
  if (error) return fehler(dbFehler(error));
  revalidatePath(`/objekte/${p.daten.objekt_id}`);
  return { ok: true, meldung: "Verbrauch gespeichert." };
}

export async function objektBedarfLoeschen(id: string): Promise<AktionErgebnis> {
  const k = await bueroKontext();
  const { data, error } = await k.supabase
    .from("objekt_bedarf")
    .delete()
    .eq("id", id)
    .select("objekt_id")
    .maybeSingle();
  if (error) return fehler(dbFehler(error));
  if (data) revalidatePath(`/objekte/${data.objekt_id}`);
  return { ok: true, meldung: "Wieder Wert der Vorlage." };
}
