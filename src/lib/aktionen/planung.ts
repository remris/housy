"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { type AktionErgebnis, dbFehler, fehler, pruefe } from "@/lib/aktion";
import { bueroKontext } from "@/lib/auth";
import {
  abwesenheitSchema,
  arbeitszeitenSchema,
  fahrzeugSchema,
  tourEinstellungSchema,
  tourStartSchema,
  zuweisungSchema,
} from "@/lib/schemas/planung";
import { type TourModus, berechneUndSpeichereTour } from "@/lib/touren";

const neuLaden = () => revalidatePath("/planung", "layout");

// ---------------------------------------------------------------------------
// Fahrzeuge und Tourstart
// ---------------------------------------------------------------------------
export async function fahrzeugSpeichern(
  id: string | null,
  eingabe: z.input<typeof fahrzeugSchema>,
): Promise<AktionErgebnis> {
  const p = pruefe(fahrzeugSchema, eingabe);
  if (!p.ok) return p.ergebnis;
  const k = await bueroKontext();
  const { error } = id
    ? await k.supabase.from("fahrzeug").update(p.daten).eq("id", id)
    : await k.supabase.from("fahrzeug").insert({ ...p.daten, betrieb_id: k.betriebId });
  if (error) return fehler(dbFehler(error));
  neuLaden();
  return { ok: true, meldung: "Fahrzeug gespeichert." };
}

export async function fahrzeugLoeschen(id: string): Promise<AktionErgebnis> {
  const k = await bueroKontext();
  const { error } = await k.supabase.from("fahrzeug").delete().eq("id", id);
  if (error) return fehler(dbFehler(error));
  neuLaden();
  return { ok: true, meldung: "Fahrzeug gelöscht." };
}

export async function tourStartSpeichern(
  eingabe: z.input<typeof tourStartSchema>,
): Promise<AktionErgebnis> {
  const p = pruefe(tourStartSchema, eingabe);
  if (!p.ok) return p.ergebnis;
  const k = await bueroKontext();
  const { error } = await k.supabase
    .from("betrieb")
    .update({ tour_start: p.daten.tour_start })
    .eq("id", k.betriebId);
  if (error) return fehler(dbFehler(error));
  neuLaden();
  return { ok: true, meldung: "Tourstart gespeichert." };
}

// ---------------------------------------------------------------------------
// Arbeitszeiten und Abwesenheiten
// ---------------------------------------------------------------------------
export async function arbeitszeitenSpeichern(
  eingabe: z.input<typeof arbeitszeitenSchema>,
): Promise<AktionErgebnis> {
  const p = pruefe(arbeitszeitenSchema, eingabe);
  if (!p.ok) return p.ergebnis;
  const k = await bueroKontext();
  const { mitglied_id, tage } = p.daten;
  const { error: e1 } = await k.supabase
    .from("mitarbeiter_verfuegbarkeit")
    .delete()
    .eq("mitglied_id", mitglied_id);
  if (e1) return fehler(dbFehler(e1));
  const zeilen = tage.flatMap((t, i) =>
    t.aktiv
      ? [{ betrieb_id: k.betriebId, mitglied_id, wochentag: i + 1, von: t.von, bis: t.bis }]
      : [],
  );
  if (zeilen.length) {
    const { error } = await k.supabase.from("mitarbeiter_verfuegbarkeit").insert(zeilen);
    if (error) return fehler(dbFehler(error));
  }
  neuLaden();
  return { ok: true, meldung: "Arbeitszeiten gespeichert." };
}

export async function abwesenheitSpeichern(
  eingabe: z.input<typeof abwesenheitSchema>,
): Promise<AktionErgebnis> {
  const p = pruefe(abwesenheitSchema, eingabe);
  if (!p.ok) return p.ergebnis;
  const k = await bueroKontext();
  const { error } = await k.supabase
    .from("abwesenheit")
    .insert({ ...p.daten, betrieb_id: k.betriebId });
  if (error) return fehler(dbFehler(error));
  const { count } = await k.supabase
    .from("einsatz")
    .select("id", { count: "exact", head: true })
    .eq("mitarbeiter_id", p.daten.mitglied_id)
    .gte("datum", p.daten.von)
    .lte("datum", p.daten.bis)
    .in("status", ["geplant", "zugewiesen"]);
  neuLaden();
  return {
    ok: true,
    meldung: count
      ? `Abwesenheit eingetragen. ${count} Einsätze in diesem Zeitraum müssen neu verteilt werden.`
      : "Abwesenheit eingetragen.",
  };
}

export async function abwesenheitLoeschen(id: string): Promise<AktionErgebnis> {
  const k = await bueroKontext();
  const { error } = await k.supabase.from("abwesenheit").delete().eq("id", id);
  if (error) return fehler(dbFehler(error));
  neuLaden();
  return { ok: true, meldung: "Abwesenheit gelöscht." };
}

// ---------------------------------------------------------------------------
// Einsätze zuweisen und Touren
// ---------------------------------------------------------------------------

/** Weist einen Einsatz einem Mitarbeiter (oder niemandem) an einem Tag zu und rechnet Touren neu. */
export async function einsatzZuweisen(
  eingabe: z.input<typeof zuweisungSchema>,
): Promise<AktionErgebnis> {
  const p = pruefe(zuweisungSchema, eingabe);
  if (!p.ok) return p.ergebnis;
  const k = await bueroKontext();
  const { id, mitarbeiter_id, datum } = p.daten;
  const { data: alt, error: e0 } = await k.supabase
    .from("einsatz")
    .select("mitarbeiter_id, datum, status")
    .eq("id", id)
    .single();
  if (e0 || !alt) return fehler("Einsatz nicht gefunden.");
  if (!["geplant", "zugewiesen"].includes(alt.status)) {
    return fehler("Der Einsatz hat schon begonnen und kann nicht mehr verschoben werden.");
  }
  if (alt.mitarbeiter_id === mitarbeiter_id && alt.datum === datum) return { ok: true };

  const { error } = await k.supabase
    .from("einsatz")
    .update({
      mitarbeiter_id,
      datum,
      reihenfolge: null,
      fahrzeit_minuten: null,
      geplanter_beginn: null,
    })
    .eq("id", id);
  if (error) return fehler(dbFehler(error));

  try {
    if (alt.mitarbeiter_id) {
      await berechneUndSpeichereTour(k.supabase, k.betriebId, alt.mitarbeiter_id, alt.datum);
    }
    if (mitarbeiter_id) {
      await berechneUndSpeichereTour(k.supabase, k.betriebId, mitarbeiter_id, datum);
    }
  } catch (e) {
    neuLaden();
    return { ok: true, meldung: `Zugewiesen, Tour aber nicht berechnet: ${(e as Error).message}` };
  }
  neuLaden();
  return { ok: true };
}

export async function tourNeuBerechnen(
  mitarbeiterId: string,
  datum: string,
  modus: TourModus,
): Promise<AktionErgebnis> {
  const k = await bueroKontext();
  try {
    const { tour, quelle } = await berechneUndSpeichereTour(
      k.supabase,
      k.betriebId,
      mitarbeiterId,
      datum,
      modus,
    );
    neuLaden();
    if (!tour) return { ok: true, meldung: "Keine Einsätze an diesem Tag." };
    const hinweis = quelle === "schaetzung" ? " (Fahrzeiten geschätzt)" : "";
    return {
      ok: true,
      meldung: tour.warnungen
        ? `Tour berechnet, ${tour.warnungen} Zeitfenster nicht einzuhalten${hinweis}.`
        : `Tour berechnet, Rückkehr ${tour.rueckkehr} Uhr${hinweis}.`,
    };
  } catch (e) {
    return fehler((e as Error).message);
  }
}

export async function tourEinstellen(
  eingabe: z.input<typeof tourEinstellungSchema>,
): Promise<AktionErgebnis> {
  const p = pruefe(tourEinstellungSchema, eingabe);
  if (!p.ok) return p.ergebnis;
  const k = await bueroKontext();
  const { error } = await k.supabase
    .from("tour")
    .upsert({ ...p.daten, betrieb_id: k.betriebId }, { onConflict: "mitarbeiter_id,datum" });
  if (error) return fehler(dbFehler(error));
  return tourNeuBerechnen(p.daten.mitarbeiter_id, p.daten.datum, "behalten");
}
