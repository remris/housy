"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { z } from "zod";
import { heuteIso } from "@/domain/datum";
import { type Vertragsstatus, darfWechseln, kuendigungZum } from "@/domain/vertrag";
import { type AktionErgebnis, dbFehler, fehler, pruefe } from "@/lib/aktion";
import { bueroKontext, inhaberKontext } from "@/lib/auth";
import {
  kuendigungSchema,
  leistungSchema,
  versionAbrechnungSchema,
  versionSchema,
  vertragNeuSchema,
  vertragStammSchema,
  vertragsbedingungenSchema,
} from "@/lib/schemas/vertrag";
import { type PlanungsErgebnis, planeEinsaetze } from "@/lib/serienplanung";

type Kontext = Awaited<ReturnType<typeof bueroKontext>>;

async function ladeVertrag(k: Kontext, id: string) {
  const { data } = await k.supabase
    .from("vertrag")
    .select(
      "id, status, beginn, laufzeit_monate, verlaengerung_monate, kuendigungsfrist_monate, frist_zum",
    )
    .eq("id", id)
    .eq("betrieb_id", k.betriebId)
    .single();
  return data;
}

function planungsMeldung(r: PlanungsErgebnis) {
  const teile = [
    r.angelegt && `${r.angelegt} angelegt`,
    r.geaendert && `${r.geaendert} angepasst`,
    r.geloescht && `${r.geloescht} entfernt`,
  ].filter(Boolean);
  return teile.length ? `Einsätze: ${teile.join(", ")}.` : "Einsätze sind aktuell.";
}

async function neuPlanen(k: Kontext, vertragId: string): Promise<string> {
  try {
    return planungsMeldung(await planeEinsaetze(k.supabase, vertragId));
  } catch (e) {
    return `Planung fehlgeschlagen: ${(e as Error).message}`;
  }
}

/** Version darf bearbeitet werden, solange der Vertrag Entwurf ist oder die Version in der Zukunft gilt. */
async function versionBearbeitbar(k: Kontext, versionId: string) {
  const { data } = await k.supabase
    .from("vertragsversion")
    .select("id, vertrag_id, gueltig_ab, vertrag(status)")
    .eq("id", versionId)
    .eq("betrieb_id", k.betriebId)
    .single();
  if (!data) return { ok: false as const, fehler: "Version nicht gefunden." };
  if (data.vertrag?.status !== "entwurf" && data.gueltig_ab <= heuteIso()) {
    return {
      ok: false as const,
      fehler:
        "Diese Version gilt bereits. Für Änderungen bitte eine neue Version ab einem Stichtag anlegen.",
    };
  }
  return { ok: true as const, vertragId: data.vertrag_id };
}

// ---------------------------------------------------------------------------
export async function vertragAnlegen(
  eingabe: z.input<typeof vertragNeuSchema>,
): Promise<AktionErgebnis | void> {
  const p = pruefe(vertragNeuSchema, eingabe);
  if (!p.ok) return p.ergebnis;
  const k = await bueroKontext();
  const { abrechnungsart, pauschale_cent, ...vertrag } = p.daten;
  const { data, error } = await k.supabase
    .from("vertrag")
    .insert({ ...vertrag, betrieb_id: k.betriebId })
    .select("id")
    .single();
  if (error) return fehler(dbFehler(error));
  const { error: e2 } = await k.supabase.from("vertragsversion").insert({
    betrieb_id: k.betriebId,
    vertrag_id: data.id,
    version: 1,
    gueltig_ab: vertrag.beginn,
    abrechnungsart,
    pauschale_cent,
    erstellt_von: k.user.id,
  });
  if (e2) {
    await k.supabase.from("vertrag").delete().eq("id", data.id);
    return fehler(dbFehler(e2));
  }
  revalidatePath("/vertraege");
  redirect(`/vertraege/${data.id}`);
}

export async function vertragStammSpeichern(
  id: string,
  eingabe: z.input<typeof vertragStammSchema>,
): Promise<AktionErgebnis> {
  const p = pruefe(vertragStammSchema, eingabe);
  if (!p.ok) return p.ergebnis;
  const k = await bueroKontext();
  const v = await ladeVertrag(k, id);
  if (!v) return fehler("Vertrag nicht gefunden.");
  const daten =
    v.status === "entwurf"
      ? p.daten
      : // Nach Aktivierung bleiben Beginn und Laufzeitregeln fest; nur Titel und Notiz
        { titel: p.daten.titel, notiz: p.daten.notiz };
  const { error } = await k.supabase.from("vertrag").update(daten).eq("id", id);
  if (error) return fehler(dbFehler(error));
  if (v.status === "entwurf" && p.daten.beginn !== v.beginn) {
    // Version 1 beginnt mit dem Vertrag
    await k.supabase
      .from("vertragsversion")
      .update({ gueltig_ab: p.daten.beginn })
      .eq("vertrag_id", id)
      .eq("version", 1);
  }
  revalidatePath(`/vertraege/${id}`);
  return {
    ok: true,
    meldung:
      v.status === "entwurf"
        ? "Vertrag gespeichert."
        : "Gespeichert. Beginn und Laufzeit sind nach der Aktivierung fest.",
  };
}

export async function vertragLoeschen(id: string): Promise<AktionErgebnis | void> {
  const k = await inhaberKontext();
  const v = await ladeVertrag(k, id);
  if (!v) return fehler("Vertrag nicht gefunden.");
  if (v.status !== "entwurf")
    return fehler("Nur Entwürfe können gelöscht werden. Bitte kündigen oder beenden.");
  const { error } = await k.supabase.from("vertrag").delete().eq("id", id);
  if (error) return fehler(dbFehler(error));
  revalidatePath("/vertraege");
  redirect("/vertraege");
}

// ---------------------------------------------------------------------------
// Status-Workflow
// ---------------------------------------------------------------------------
async function statusSetzen(
  k: Kontext,
  id: string,
  nach: Vertragsstatus,
  felder: Record<string, unknown> = {},
): Promise<AktionErgebnis> {
  const v = await ladeVertrag(k, id);
  if (!v) return fehler("Vertrag nicht gefunden.");
  if (!darfWechseln(v.status, nach))
    return fehler(`Wechsel von ${v.status} nach ${nach} ist nicht möglich.`);
  const { error } = await k.supabase
    .from("vertrag")
    .update({ status: nach, ...felder })
    .eq("id", id);
  if (error) return fehler(dbFehler(error));
  const planung = await neuPlanen(k, id);
  revalidatePath(`/vertraege/${id}`);
  revalidatePath("/vertraege");
  return { ok: true, meldung: planung };
}

export async function vertragAktivieren(id: string): Promise<AktionErgebnis> {
  const k = await bueroKontext();
  const { count } = await k.supabase
    .from("vertragsleistung")
    .select("id, vertragsversion!inner(vertrag_id)", { count: "exact", head: true })
    .eq("vertragsversion.vertrag_id", id);
  if (!count) return fehler("Bitte zuerst mindestens eine Leistung eintragen.");
  const v = await ladeVertrag(k, id);
  if (v?.status === "gekuendigt") {
    // Kündigung zurücknehmen
    return statusSetzen(k, id, "aktiv", { gekuendigt_am: null, endet_am: null });
  }
  return statusSetzen(k, id, "aktiv");
}

export async function kuendigungsVorschau(eingabe: z.input<typeof kuendigungSchema>) {
  const p = pruefe(kuendigungSchema, eingabe);
  if (!p.ok) return null;
  const k = await bueroKontext();
  const v = await ladeVertrag(k, p.daten.vertrag_id);
  if (!v) return null;
  return kuendigungZum(
    {
      beginn: v.beginn,
      laufzeitMonate: v.laufzeit_monate,
      verlaengerungMonate: v.verlaengerung_monate,
      kuendigungsfristMonate: v.kuendigungsfrist_monate,
      fristZum: v.frist_zum as "laufzeitende" | "monatsende",
    },
    p.daten.eingang,
  );
}

export async function vertragKuendigen(
  eingabe: z.input<typeof kuendigungSchema>,
): Promise<AktionErgebnis> {
  const p = pruefe(kuendigungSchema, eingabe);
  if (!p.ok) return p.ergebnis;
  const k = await inhaberKontext();
  const ende = await kuendigungsVorschau(p.daten);
  if (!ende) return fehler("Vertrag nicht gefunden.");
  return statusSetzen(k, p.daten.vertrag_id, "gekuendigt", {
    gekuendigt_am: p.daten.eingang,
    endet_am: ende,
  });
}

export async function vertragBeenden(id: string): Promise<AktionErgebnis> {
  const k = await inhaberKontext();
  const heute = heuteIso();
  const { data } = await k.supabase.from("vertrag").select("endet_am").eq("id", id).single();
  return statusSetzen(k, id, "beendet", {
    endet_am: data?.endet_am && data.endet_am < heute ? data.endet_am : heute,
  });
}

export async function einsaetzeNeuPlanen(id: string): Promise<AktionErgebnis> {
  const k = await bueroKontext();
  const meldung = await neuPlanen(k, id);
  revalidatePath(`/vertraege/${id}`);
  return meldung.startsWith("Planung fehlgeschlagen") ? fehler(meldung) : { ok: true, meldung };
}

// ---------------------------------------------------------------------------
// Versionen und Leistungen
// ---------------------------------------------------------------------------
export async function versionAnlegen(
  eingabe: z.input<typeof versionSchema>,
): Promise<AktionErgebnis> {
  const p = pruefe(versionSchema, eingabe);
  if (!p.ok) return p.ergebnis;
  const k = await bueroKontext();
  if (p.daten.gueltig_ab <= heuteIso())
    return fehler("Neue Versionen gelten frühestens ab morgen.");
  const { error } = await k.supabase.rpc("vertragsversion_anlegen", {
    p_vertrag_id: p.daten.vertrag_id,
    p_gueltig_ab: p.daten.gueltig_ab,
    p_abrechnungsart: p.daten.abrechnungsart,
    p_pauschale_cent: p.daten.pauschale_cent as unknown as number,
    p_grund: p.daten.grund as unknown as string,
  });
  if (error) {
    return fehler(
      error.code === "23505" ? "Zu diesem Datum gibt es schon eine Version." : dbFehler(error),
    );
  }
  revalidatePath(`/vertraege/${p.daten.vertrag_id}`);
  return {
    ok: true,
    meldung: "Neue Version angelegt. Leistungen wurden übernommen und können angepasst werden.",
  };
}

export async function versionAbrechnungSpeichern(
  eingabe: z.input<typeof versionAbrechnungSchema>,
): Promise<AktionErgebnis> {
  const p = pruefe(versionAbrechnungSchema, eingabe);
  if (!p.ok) return p.ergebnis;
  const k = await bueroKontext();
  const b = await versionBearbeitbar(k, p.daten.version_id);
  if (!b.ok) return fehler(b.fehler);
  const { error } = await k.supabase
    .from("vertragsversion")
    .update({ abrechnungsart: p.daten.abrechnungsart, pauschale_cent: p.daten.pauschale_cent })
    .eq("id", p.daten.version_id);
  if (error) return fehler(dbFehler(error));
  revalidatePath(`/vertraege/${b.vertragId}`);
  return { ok: true, meldung: "Abrechnung gespeichert." };
}

export async function versionLoeschen(versionId: string): Promise<AktionErgebnis> {
  const k = await bueroKontext();
  const b = await versionBearbeitbar(k, versionId);
  if (!b.ok) return fehler(b.fehler);
  const { data: v } = await k.supabase
    .from("vertragsversion")
    .select("version")
    .eq("id", versionId)
    .single();
  if (v?.version === 1) return fehler("Version 1 kann nicht gelöscht werden.");
  const { error } = await k.supabase.from("vertragsversion").delete().eq("id", versionId);
  if (error) return fehler(dbFehler(error));
  const planung = await neuPlanen(k, b.vertragId);
  revalidatePath(`/vertraege/${b.vertragId}`);
  return { ok: true, meldung: `Version gelöscht. ${planung}` };
}

export async function leistungSpeichern(
  eingabe: z.input<typeof leistungSchema>,
): Promise<AktionErgebnis> {
  const p = pruefe(leistungSchema, eingabe);
  if (!p.ok) return p.ergebnis;
  const k = await bueroKontext();
  const b = await versionBearbeitbar(k, p.daten.version_id);
  if (!b.ok) return fehler(b.fehler);
  const { id, ...daten } = p.daten;
  const { error } = id
    ? await k.supabase.from("vertragsleistung").update(daten).eq("id", id)
    : await k.supabase.from("vertragsleistung").insert({ ...daten, betrieb_id: k.betriebId });
  if (error) return fehler(dbFehler(error));
  const planung = await neuPlanen(k, b.vertragId);
  revalidatePath(`/vertraege/${b.vertragId}`);
  return { ok: true, meldung: `Leistung gespeichert. ${planung}` };
}

export async function leistungLoeschen(id: string, versionId: string): Promise<AktionErgebnis> {
  const k = await bueroKontext();
  const b = await versionBearbeitbar(k, versionId);
  if (!b.ok) return fehler(b.fehler);
  const { error } = await k.supabase.from("vertragsleistung").delete().eq("id", id);
  if (error) return fehler(dbFehler(error));
  const planung = await neuPlanen(k, b.vertragId);
  revalidatePath(`/vertraege/${b.vertragId}`);
  return { ok: true, meldung: `Leistung entfernt. ${planung}` };
}

// ---------------------------------------------------------------------------
// Unterschrift und Vertragsbedingungen
// ---------------------------------------------------------------------------
export async function imBueroUnterschreiben(
  vertragId: string,
  name: string,
  bild: string,
): Promise<AktionErgebnis> {
  const k = await bueroKontext();
  const { data: v } = await k.supabase
    .from("vertrag")
    .select("freigabe_token")
    .eq("id", vertragId)
    .single();
  if (!v) return fehler("Vertrag nicht gefunden.");
  const { error } = await k.supabase.rpc("vertrag_unterschreiben", {
    p_token: v.freigabe_token,
    p_name: name,
    p_bild: bild,
  });
  if (error) return fehler(dbFehler(error));
  revalidatePath(`/vertraege/${vertragId}`);
  return { ok: true, meldung: "Unterschrift gespeichert." };
}

export async function vertragsbedingungenSpeichern(
  eingabe: z.input<typeof vertragsbedingungenSchema>,
): Promise<AktionErgebnis> {
  const p = pruefe(vertragsbedingungenSchema, eingabe);
  if (!p.ok) return p.ergebnis;
  const k = await inhaberKontext();
  const { error } = await k.supabase.from("betrieb").update(p.daten).eq("id", k.betriebId);
  if (error) return fehler(dbFehler(error));
  revalidatePath("/einstellungen/vertraege");
  return { ok: true, meldung: "Gespeichert." };
}
