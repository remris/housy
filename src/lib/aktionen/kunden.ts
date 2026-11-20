"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { z } from "zod";
import { type AktionErgebnis, dbFehler, fehler, pruefe } from "@/lib/aktion";
import { bueroKontext } from "@/lib/auth";
import { koordinatenErgaenzen } from "@/lib/karten/koordinaten";
import {
  ansprechpartnerSchema,
  bereichSchema,
  fensterSchema,
  kundeSchema,
  objektSchema,
} from "@/lib/schemas/kunde";

// ---------------------------------------------------------------------------
// Kunde
// ---------------------------------------------------------------------------
export async function kundeSpeichern(
  id: string | null,
  eingabe: z.input<typeof kundeSchema>,
): Promise<AktionErgebnis | void> {
  const p = pruefe(kundeSchema, eingabe);
  if (!p.ok) return p.ergebnis;
  const k = await bueroKontext();
  if (id) {
    const { error } = await k.supabase
      .from("kunde")
      .update(p.daten)
      .eq("id", id)
      .eq("betrieb_id", k.betriebId);
    if (error) return fehler(dbFehler(error));
    revalidatePath(`/kunden/${id}`);
    return { ok: true, meldung: "Kunde gespeichert." };
  }
  const { data, error } = await k.supabase
    .from("kunde")
    .insert({ ...p.daten, betrieb_id: k.betriebId })
    .select("id")
    .single();
  if (error) return fehler(dbFehler(error));
  revalidatePath("/kunden");
  redirect(`/kunden/${data.id}`);
}

export async function kundeLoeschen(id: string): Promise<AktionErgebnis | void> {
  const k = await bueroKontext();
  const { error } = await k.supabase
    .from("kunde")
    .delete()
    .eq("id", id)
    .eq("betrieb_id", k.betriebId);
  if (error) {
    return fehler(
      error.code === "23503"
        ? "Der Kunde hat noch Objekte. Bitte zuerst die Objekte löschen oder den Kunden deaktivieren."
        : dbFehler(error),
    );
  }
  revalidatePath("/kunden");
  redirect("/kunden");
}

export async function ansprechpartnerSpeichern(
  eingabe: z.input<typeof ansprechpartnerSchema>,
): Promise<AktionErgebnis> {
  const p = pruefe(ansprechpartnerSchema, eingabe);
  if (!p.ok) return p.ergebnis;
  const k = await bueroKontext();
  const { id, ...daten } = p.daten;
  const { error } = id
    ? await k.supabase.from("ansprechpartner").update(daten).eq("id", id)
    : await k.supabase.from("ansprechpartner").insert({ ...daten, betrieb_id: k.betriebId });
  if (error) return fehler(dbFehler(error));
  revalidatePath(`/kunden/${daten.kunde_id}`);
  return { ok: true, meldung: "Ansprechpartner gespeichert." };
}

export async function ansprechpartnerLoeschen(
  id: string,
  kundeId: string,
): Promise<AktionErgebnis> {
  const k = await bueroKontext();
  const { error } = await k.supabase.from("ansprechpartner").delete().eq("id", id);
  if (error) return fehler(dbFehler(error));
  revalidatePath(`/kunden/${kundeId}`);
  return { ok: true, meldung: "Gelöscht." };
}

// ---------------------------------------------------------------------------
// Objekt
// ---------------------------------------------------------------------------
export async function objektSpeichern(
  id: string | null,
  eingabe: z.input<typeof objektSchema>,
): Promise<AktionErgebnis | void> {
  const p = pruefe(objektSchema, eingabe);
  if (!p.ok) return p.ergebnis;
  const k = await bueroKontext();
  if (id) {
    const { data: alt } = await k.supabase
      .from("objekt")
      .select("strasse, plz, ort, land, breitengrad, laengengrad")
      .eq("id", id)
      .single();
    const { daten, hinweis } = await koordinatenErgaenzen(p.daten, alt);
    const { error } = await k.supabase
      .from("objekt")
      .update(daten)
      .eq("id", id)
      .eq("betrieb_id", k.betriebId);
    if (error) return fehler(dbFehler(error));
    revalidatePath(`/objekte/${id}`);
    return { ok: true, meldung: hinweis ?? "Objekt gespeichert." };
  }
  const { daten } = await koordinatenErgaenzen(p.daten);
  const { data, error } = await k.supabase
    .from("objekt")
    .insert({ ...daten, betrieb_id: k.betriebId })
    .select("id")
    .single();
  if (error) return fehler(dbFehler(error));
  revalidatePath("/objekte");
  redirect(`/objekte/${data.id}`);
}

/** Ergänzt fehlende Koordinaten (z. B. nach CSV-Import), höchstens 50 Objekte je Aufruf. */
export async function fehlendeKoordinatenErgaenzen(): Promise<AktionErgebnis> {
  const k = await bueroKontext();
  if (!process.env.MAPBOX_TOKEN)
    return fehler("Kartendienst ist nicht eingerichtet (MAPBOX_TOKEN).");
  const { data: objekte, error } = await k.supabase
    .from("objekt")
    .select("id, strasse, plz, ort, land, breitengrad, laengengrad")
    .eq("betrieb_id", k.betriebId)
    .or("breitengrad.is.null,laengengrad.is.null")
    .not("ort", "is", null)
    .limit(50);
  if (error) return fehler(dbFehler(error));
  let gefunden = 0;
  for (const o of objekte ?? []) {
    const { daten } = await koordinatenErgaenzen({
      ...o,
      breitengrad: null,
      laengengrad: null,
    });
    if (daten.breitengrad === null) continue;
    const { error: e } = await k.supabase
      .from("objekt")
      .update({ breitengrad: daten.breitengrad, laengengrad: daten.laengengrad })
      .eq("id", o.id);
    if (!e) gefunden++;
  }
  revalidatePath("/objekte");
  revalidatePath("/planung", "layout");
  const rest = (objekte?.length ?? 0) - gefunden;
  return {
    ok: true,
    meldung: `${gefunden} Objekte verortet${rest ? `, ${rest} Adressen nicht gefunden` : ""}.`,
  };
}

export async function objektLoeschen(id: string): Promise<AktionErgebnis | void> {
  const k = await bueroKontext();
  const { data: fotos } = await k.supabase.from("objekt_foto").select("pfad").eq("objekt_id", id);
  const { error } = await k.supabase
    .from("objekt")
    .delete()
    .eq("id", id)
    .eq("betrieb_id", k.betriebId);
  if (error) {
    return fehler(
      error.code === "23503"
        ? "Das Objekt wird noch verwendet (z. B. in Verträgen). Bitte stattdessen deaktivieren."
        : dbFehler(error),
    );
  }
  if (fotos?.length) await k.supabase.storage.from("objektfotos").remove(fotos.map((f) => f.pfad));
  revalidatePath("/objekte");
  redirect("/objekte");
}

export async function bereichSpeichern(
  eingabe: z.input<typeof bereichSchema>,
): Promise<AktionErgebnis> {
  const p = pruefe(bereichSchema, eingabe);
  if (!p.ok) return p.ergebnis;
  const k = await bueroKontext();
  const { id, ...daten } = p.daten;
  const { error } = id
    ? await k.supabase.from("bereich").update(daten).eq("id", id)
    : await k.supabase.from("bereich").insert({ ...daten, betrieb_id: k.betriebId });
  if (error) return fehler(dbFehler(error));
  revalidatePath(`/objekte/${daten.objekt_id}`);
  return { ok: true, meldung: "Bereich gespeichert." };
}

export async function bereichLoeschen(id: string, objektId: string): Promise<AktionErgebnis> {
  const k = await bueroKontext();
  const { error } = await k.supabase.from("bereich").delete().eq("id", id);
  if (error) return fehler(dbFehler(error));
  revalidatePath(`/objekte/${objektId}`);
  return { ok: true, meldung: "Gelöscht." };
}

export async function fensterSpeichern(
  eingabe: z.input<typeof fensterSchema>,
): Promise<AktionErgebnis> {
  const p = pruefe(fensterSchema, eingabe);
  if (!p.ok) return p.ergebnis;
  const k = await bueroKontext();
  const { id, ...daten } = p.daten;
  const { error } = id
    ? await k.supabase.from("fensteraufmass").update(daten).eq("id", id)
    : await k.supabase.from("fensteraufmass").insert({ ...daten, betrieb_id: k.betriebId });
  if (error) return fehler(dbFehler(error));
  revalidatePath(`/objekte/${daten.objekt_id}`);
  return { ok: true, meldung: "Fensteraufmaß gespeichert." };
}

export async function fensterLoeschen(id: string, objektId: string): Promise<AktionErgebnis> {
  const k = await bueroKontext();
  const { error } = await k.supabase.from("fensteraufmass").delete().eq("id", id);
  if (error) return fehler(dbFehler(error));
  revalidatePath(`/objekte/${objektId}`);
  return { ok: true, meldung: "Gelöscht." };
}

const FOTO_TYPEN = ["image/png", "image/jpeg", "image/webp", "image/heic"];

export async function objektFotoHochladen(
  objektId: string,
  formData: FormData,
): Promise<AktionErgebnis> {
  const k = await bueroKontext();
  const dateien = formData
    .getAll("fotos")
    .filter((d): d is File => d instanceof File && d.size > 0);
  if (!dateien.length) return fehler("Bitte mindestens ein Foto wählen.");
  for (const datei of dateien) {
    if (!FOTO_TYPEN.includes(datei.type)) return fehler(`${datei.name}: nur JPG, PNG, WebP, HEIC.`);
    if (datei.size > 10 * 1024 * 1024) return fehler(`${datei.name}: höchstens 10 MB.`);
  }
  const beschreibung = String(formData.get("beschreibung") ?? "").trim() || null;
  for (const datei of dateien) {
    const endung = datei.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const pfad = `${k.betriebId}/${objektId}/${crypto.randomUUID()}.${endung}`;
    const { error } = await k.supabase.storage
      .from("objektfotos")
      .upload(pfad, datei, { contentType: datei.type });
    if (error) return fehler(`Upload fehlgeschlagen: ${error.message}`);
    const { error: e2 } = await k.supabase.from("objekt_foto").insert({
      betrieb_id: k.betriebId,
      objekt_id: objektId,
      pfad,
      beschreibung,
      erstellt_von: k.user.id,
    });
    if (e2) return fehler(dbFehler(e2));
  }
  revalidatePath(`/objekte/${objektId}`);
  return { ok: true, meldung: dateien.length === 1 ? "Foto gespeichert." : "Fotos gespeichert." };
}

export async function objektFotoLoeschen(id: string, objektId: string): Promise<AktionErgebnis> {
  const k = await bueroKontext();
  const { data, error } = await k.supabase
    .from("objekt_foto")
    .delete()
    .eq("id", id)
    .select("pfad")
    .single();
  if (error) return fehler(dbFehler(error));
  await k.supabase.storage.from("objektfotos").remove([data.pfad]);
  revalidatePath(`/objekte/${objektId}`);
  return { ok: true, meldung: "Foto gelöscht." };
}
