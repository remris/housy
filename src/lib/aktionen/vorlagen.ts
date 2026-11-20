"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { z } from "zod";
import { type Branche, kombiniere, pruefePaket } from "@/domain/branchenpakete";
import { type AktionErgebnis, dbFehler, fehler, pruefe } from "@/lib/aktion";
import { bueroKontext } from "@/lib/auth";
import type { Json } from "@/lib/supabase/database.types";
import {
  artikelSchema,
  bedarfSchema,
  preisSchema,
  taetigkeitSchema,
  vorlageSchema,
} from "@/lib/schemas/vorlage";

// ---------------------------------------------------------------------------
// Artikel
// ---------------------------------------------------------------------------
export async function artikelSpeichern(
  eingabe: z.input<typeof artikelSchema>,
): Promise<AktionErgebnis> {
  const p = pruefe(artikelSchema, eingabe);
  if (!p.ok) return p.ergebnis;
  const k = await bueroKontext();
  const { id, ...daten } = p.daten;
  const { error } = id
    ? await k.supabase.from("artikel").update(daten).eq("id", id).eq("betrieb_id", k.betriebId)
    : await k.supabase.from("artikel").insert({ ...daten, betrieb_id: k.betriebId });
  if (error) return fehler(dbFehler(error));
  revalidatePath("/artikel");
  return { ok: true, meldung: "Artikel gespeichert." };
}

export async function artikelLoeschen(id: string): Promise<AktionErgebnis> {
  const k = await bueroKontext();
  const { error } = await k.supabase
    .from("artikel")
    .delete()
    .eq("id", id)
    .eq("betrieb_id", k.betriebId);
  if (error) {
    return fehler(
      error.code === "23503"
        ? "Der Artikel wird in Vorlagen verwendet. Bitte dort entfernen oder den Artikel deaktivieren."
        : dbFehler(error),
    );
  }
  revalidatePath("/artikel");
  return { ok: true, meldung: "Artikel gelöscht." };
}

// ---------------------------------------------------------------------------
// Auftragsvorlagen
// ---------------------------------------------------------------------------
export async function vorlageSpeichern(
  id: string | null,
  eingabe: z.input<typeof vorlageSchema>,
): Promise<AktionErgebnis | void> {
  const p = pruefe(vorlageSchema, eingabe);
  if (!p.ok) return p.ergebnis;
  const k = await bueroKontext();
  if (id) {
    const { error } = await k.supabase
      .from("auftragsvorlage")
      .update(p.daten)
      .eq("id", id)
      .eq("betrieb_id", k.betriebId);
    if (error) return fehler(dbFehler(error));
    revalidatePath(`/vorlagen/${id}`);
    return { ok: true, meldung: "Vorlage gespeichert." };
  }
  const { data, error } = await k.supabase
    .from("auftragsvorlage")
    .insert({ ...p.daten, betrieb_id: k.betriebId })
    .select("id")
    .single();
  if (error) return fehler(dbFehler(error));
  redirect(`/vorlagen/${data.id}`);
}

export async function vorlageLoeschen(id: string): Promise<AktionErgebnis | void> {
  const k = await bueroKontext();
  const { error } = await k.supabase
    .from("auftragsvorlage")
    .delete()
    .eq("id", id)
    .eq("betrieb_id", k.betriebId);
  if (error) {
    return fehler(
      error.code === "23503"
        ? "Die Vorlage wird noch verwendet (z. B. in Verträgen). Bitte stattdessen deaktivieren."
        : dbFehler(error),
    );
  }
  revalidatePath("/vorlagen");
  redirect("/vorlagen");
}

export async function vorlageKopieren(id: string): Promise<AktionErgebnis | void> {
  const k = await bueroKontext();
  const { data: v } = await k.supabase
    .from("auftragsvorlage")
    .select(
      "*, vorlage_taetigkeit(text, reihenfolge, foto_pflicht), vorlage_bedarf(artikel_id, menge, bezug)",
    )
    .eq("id", id)
    .single();
  if (!v) return fehler("Vorlage nicht gefunden.");
  const { data: neu, error } = await k.supabase
    .from("auftragsvorlage")
    .insert({
      betrieb_id: k.betriebId,
      name: `${v.name} (Kopie ${new Date().toLocaleTimeString("de-DE")})`,
      branche: v.branche,
      beschreibung: v.beschreibung,
      sollzeit_minuten: v.sollzeit_minuten,
      minuten_pro_100m2: v.minuten_pro_100m2,
      minuten_pro_fenster: v.minuten_pro_fenster,
    })
    .select("id")
    .single();
  if (error) return fehler(dbFehler(error));
  if (v.vorlage_taetigkeit.length) {
    await k.supabase
      .from("vorlage_taetigkeit")
      .insert(
        v.vorlage_taetigkeit.map((t) => ({ ...t, betrieb_id: k.betriebId, vorlage_id: neu.id })),
      );
  }
  if (v.vorlage_bedarf.length) {
    await k.supabase
      .from("vorlage_bedarf")
      .insert(v.vorlage_bedarf.map((b) => ({ ...b, betrieb_id: k.betriebId, vorlage_id: neu.id })));
  }
  redirect(`/vorlagen/${neu.id}`);
}

export async function taetigkeitHinzufuegen(
  eingabe: z.input<typeof taetigkeitSchema>,
): Promise<AktionErgebnis> {
  const p = pruefe(taetigkeitSchema, eingabe);
  if (!p.ok) return p.ergebnis;
  const k = await bueroKontext();
  const { data: letzte } = await k.supabase
    .from("vorlage_taetigkeit")
    .select("reihenfolge")
    .eq("vorlage_id", p.daten.vorlage_id)
    .order("reihenfolge", { ascending: false })
    .limit(1);
  const { error } = await k.supabase.from("vorlage_taetigkeit").insert({
    ...p.daten,
    betrieb_id: k.betriebId,
    reihenfolge: (letzte?.[0]?.reihenfolge ?? 0) + 1,
  });
  if (error) return fehler(dbFehler(error));
  revalidatePath(`/vorlagen/${p.daten.vorlage_id}`);
  return { ok: true };
}

export async function taetigkeitLoeschen(id: string, vorlageId: string): Promise<AktionErgebnis> {
  const k = await bueroKontext();
  const { error } = await k.supabase.from("vorlage_taetigkeit").delete().eq("id", id);
  if (error) return fehler(dbFehler(error));
  revalidatePath(`/vorlagen/${vorlageId}`);
  return { ok: true, meldung: "Tätigkeit entfernt." };
}

/** Verschiebt eine Tätigkeit um eine Position nach oben oder unten. */
export async function taetigkeitVerschieben(
  id: string,
  vorlageId: string,
  richtung: -1 | 1,
): Promise<AktionErgebnis> {
  const k = await bueroKontext();
  const { data: liste } = await k.supabase
    .from("vorlage_taetigkeit")
    .select("id, reihenfolge")
    .eq("vorlage_id", vorlageId)
    .order("reihenfolge");
  if (!liste) return fehler("Nicht gefunden.");
  const i = liste.findIndex((t) => t.id === id);
  const j = i + richtung;
  if (i < 0 || j < 0 || j >= liste.length) return { ok: true };
  const neu = [...liste];
  [neu[i], neu[j]] = [neu[j]!, neu[i]!];
  for (const [index, t] of neu.entries()) {
    if (t.reihenfolge !== index + 1) {
      await k.supabase
        .from("vorlage_taetigkeit")
        .update({ reihenfolge: index + 1 })
        .eq("id", t.id);
    }
  }
  revalidatePath(`/vorlagen/${vorlageId}`);
  return { ok: true };
}

export async function bedarfHinzufuegen(
  eingabe: z.input<typeof bedarfSchema>,
): Promise<AktionErgebnis> {
  const p = pruefe(bedarfSchema, eingabe);
  if (!p.ok) return p.ergebnis;
  const k = await bueroKontext();
  const { error } = await k.supabase
    .from("vorlage_bedarf")
    .upsert(
      { ...p.daten, menge: p.daten.menge!, betrieb_id: k.betriebId },
      { onConflict: "vorlage_id,artikel_id,bezug" },
    );
  if (error) return fehler(dbFehler(error));
  revalidatePath(`/vorlagen/${p.daten.vorlage_id}`);
  return { ok: true, meldung: "Bedarf gespeichert." };
}

export async function bedarfLoeschen(id: string, vorlageId: string): Promise<AktionErgebnis> {
  const k = await bueroKontext();
  const { error } = await k.supabase.from("vorlage_bedarf").delete().eq("id", id);
  if (error) return fehler(dbFehler(error));
  revalidatePath(`/vorlagen/${vorlageId}`);
  return { ok: true, meldung: "Bedarf entfernt." };
}

// ---------------------------------------------------------------------------
// Preisliste
// ---------------------------------------------------------------------------
export async function preisSpeichern(
  eingabe: z.input<typeof preisSchema>,
): Promise<AktionErgebnis> {
  const p = pruefe(preisSchema, eingabe);
  if (!p.ok) return p.ergebnis;
  const k = await bueroKontext();
  const { id, ...rest } = p.daten;
  const daten = { ...rest, preis_cent: rest.preis_cent! };
  const { error } = id
    ? await k.supabase.from("preisliste").update(daten).eq("id", id).eq("betrieb_id", k.betriebId)
    : await k.supabase.from("preisliste").insert({ ...daten, betrieb_id: k.betriebId });
  if (error) return fehler(dbFehler(error));
  revalidatePath("/preisliste");
  return { ok: true, meldung: "Preis gespeichert." };
}

export async function preisLoeschen(id: string): Promise<AktionErgebnis> {
  const k = await bueroKontext();
  const { error } = await k.supabase
    .from("preisliste")
    .delete()
    .eq("id", id)
    .eq("betrieb_id", k.betriebId);
  if (error) return fehler(dbFehler(error));
  revalidatePath("/preisliste");
  return { ok: true, meldung: "Gelöscht." };
}

// ---------------------------------------------------------------------------
// Branchenpakete
// ---------------------------------------------------------------------------
const BRANCHEN: Branche[] = ["gebaeudereinigung", "hausmeister", "fensterreinigung"];

export async function branchenpaketInstallieren(
  branchen: string[],
): Promise<AktionErgebnis<{ artikel: number; vorlagen: number; preise: number }>> {
  const auswahl = BRANCHEN.filter((b) => branchen.includes(b));
  if (!auswahl.length) return fehler("Bitte mindestens eine Branche wählen.");
  const paket = kombiniere(auswahl);
  const probleme = pruefePaket(paket);
  if (probleme.length) return fehler(`Paket fehlerhaft: ${probleme.join("; ")}`);
  const k = await bueroKontext();
  const { data, error } = await k.supabase.rpc("paket_installieren", {
    p_betrieb_id: k.betriebId,
    p_paket: paket as unknown as Json,
  });
  if (error) return fehler(dbFehler(error));
  const r = data as { artikel: number; vorlagen: number; preise: number };
  revalidatePath("/", "layout");
  return {
    ok: true,
    daten: r,
    meldung: `${r.vorlagen} Vorlagen, ${r.artikel} Artikel und ${r.preise} Preise übernommen.`,
  };
}
