"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { z } from "zod";
import { gueltigBis } from "@/domain/angebot";
import { formatDatum, heuteIso, plusTage } from "@/domain/datum";
import { type AktionErgebnis, dbFehler, fehler, pruefe } from "@/lib/aktion";
import { bueroKontext, inhaberKontext } from "@/lib/auth";
import { siteUrl } from "@/lib/env";
import { sendeMail } from "@/lib/mail/resend";
import { html } from "@/lib/mail/texte";
import { type AngebotInfo, angebotPdfErzeugen } from "@/lib/pdf/angebot-pdf";
import {
  anfrageSchema,
  angebotSchema,
  angebotsleistungSchema,
  buchungEinstellungenSchema,
  websiteSchema,
} from "@/lib/schemas/anfrage";

const neu = () => {
  revalidatePath("/anfragen");
  revalidatePath("/angebote", "layout");
};

// ---------------------------------------------------------------------------
// Anfragen
// ---------------------------------------------------------------------------

/** Telefonische Anfrage im Büro erfassen */
export async function anfrageAnlegen(
  eingabe: z.input<typeof anfrageSchema>,
): Promise<AktionErgebnis> {
  const p = pruefe(anfrageSchema, eingabe);
  if (!p.ok) return p.ergebnis;
  const k = await bueroKontext();
  const { error } = await k.supabase
    .from("anfrage")
    .insert({ ...p.daten, betrieb_id: k.betriebId, quelle: "telefon", status: "in_bearbeitung" });
  if (error) return fehler(dbFehler(error));
  neu();
  return { ok: true, meldung: "Anfrage erfasst." };
}

export async function anfrageStatus(
  id: string,
  status: "neu" | "in_bearbeitung" | "verloren",
): Promise<AktionErgebnis> {
  const k = await bueroKontext();
  const { error } = await k.supabase.from("anfrage").update({ status }).eq("id", id);
  if (error) return fehler(dbFehler(error));
  neu();
  return { ok: true, meldung: "Gespeichert." };
}

// ---------------------------------------------------------------------------
// Angebote
// ---------------------------------------------------------------------------

/** Neues Angebot, vorausgefüllt aus einer Anfrage oder einem Kunden. */
export async function angebotAnlegen(p: {
  anfrageId?: string;
  kundeId?: string;
}): Promise<AktionErgebnis | void> {
  const k = await bueroKontext();
  const heute = heuteIso();
  let werte: Record<string, unknown> = {
    empfaenger_name: "Neuer Kunde",
    titel: "Reinigungsangebot",
    beginn: plusTage(heute, 14),
    gueltig_bis: gueltigBis(heute),
  };
  if (p.anfrageId) {
    const { data: a } = await k.supabase.from("anfrage").select("*").eq("id", p.anfrageId).single();
    if (!a) return fehler("Anfrage nicht gefunden.");
    werte = {
      ...werte,
      anfrage_id: a.id,
      kunde_id: a.kunde_id,
      objekt_id: a.objekt_id,
      kundentyp: a.kundentyp,
      empfaenger_name: a.name,
      empfaenger_firma: a.firma,
      empfaenger_email: a.email,
      empfaenger_telefon: a.telefon,
      objekt_name: a.strasse,
      objekt_strasse: a.strasse,
      objekt_plz: a.plz,
      objekt_ort: a.ort,
      titel: a.leistung || "Reinigungsangebot",
    };
    await k.supabase
      .from("anfrage")
      .update({ status: "in_bearbeitung" })
      .eq("id", a.id)
      .eq("status", "neu");
  } else if (p.kundeId) {
    const { data: kd } = await k.supabase
      .from("kunde")
      .select("id, typ, name, email, telefon, strasse, plz, ort")
      .eq("id", p.kundeId)
      .single();
    if (!kd) return fehler("Kunde nicht gefunden.");
    werte = {
      ...werte,
      kunde_id: kd.id,
      kundentyp: kd.typ,
      empfaenger_name: kd.name,
      empfaenger_email: kd.email,
      empfaenger_telefon: kd.telefon,
      strasse: kd.strasse,
      plz: kd.plz,
      ort: kd.ort,
    };
  }
  const { data, error } = await k.supabase
    .from("angebot")
    .insert({
      ...(werte as { empfaenger_name: string; titel: string; beginn: string }),
      betrieb_id: k.betriebId,
    })
    .select("id")
    .single();
  if (error) return fehler(dbFehler(error));
  neu();
  redirect(`/angebote/${data.id}`);
}

export async function angebotSpeichern(
  id: string,
  eingabe: z.input<typeof angebotSchema>,
): Promise<AktionErgebnis> {
  const p = pruefe(angebotSchema, eingabe);
  if (!p.ok) return p.ergebnis;
  const k = await bueroKontext();
  const { error } = await k.supabase.from("angebot").update(p.daten).eq("id", id);
  if (error) return fehler(dbFehler(error));
  neu();
  return { ok: true, meldung: "Angebot gespeichert." };
}

export async function angebotLoeschen(id: string): Promise<AktionErgebnis | void> {
  const k = await bueroKontext();
  const { error } = await k.supabase.from("angebot").delete().eq("id", id).eq("status", "entwurf");
  if (error) return fehler(dbFehler(error));
  neu();
  redirect("/angebote");
}

export async function angebotsleistungSpeichern(
  eingabe: z.input<typeof angebotsleistungSchema>,
): Promise<AktionErgebnis> {
  const p = pruefe(angebotsleistungSchema, eingabe);
  if (!p.ok) return p.ergebnis;
  const k = await bueroKontext();
  const { id, ...d } = p.daten;
  if (id) {
    const { error } = await k.supabase
      .from("angebotsleistung")
      .update({ ...d, menge_je_einsatz: d.menge_je_einsatz! })
      .eq("id", id);
    if (error) return fehler(dbFehler(error));
  } else {
    const { count } = await k.supabase
      .from("angebotsleistung")
      .select("id", { count: "exact", head: true })
      .eq("angebot_id", d.angebot_id);
    const { error } = await k.supabase.from("angebotsleistung").insert({
      ...d,
      menge_je_einsatz: d.menge_je_einsatz!,
      betrieb_id: k.betriebId,
      pos: (count ?? 0) + 1,
    });
    if (error) return fehler(dbFehler(error));
  }
  revalidatePath(`/angebote/${d.angebot_id}`);
  return { ok: true, meldung: "Leistung gespeichert." };
}

export async function angebotsleistungLoeschen(
  id: string,
  angebotId: string,
): Promise<AktionErgebnis> {
  const k = await bueroKontext();
  const { error } = await k.supabase.from("angebotsleistung").delete().eq("id", id);
  if (error) return fehler(dbFehler(error));
  revalidatePath(`/angebote/${angebotId}`);
  return { ok: true, meldung: "Leistung entfernt." };
}

/** Angebot verschicken: Status „verschickt“, Mail mit Link zur Annahme und PDF. */
export async function angebotSenden(id: string): Promise<AktionErgebnis> {
  const k = await bueroKontext();
  const { data: a } = await k.supabase
    .from("angebot")
    .select(
      "id, status, empfaenger_email, empfaenger_name, freigabe_token, nummer, titel, gueltig_bis, anfrage_id, abrechnungsart, pauschale_cent, angebotsleistung(id)",
    )
    .eq("id", id)
    .single();
  if (!a) return fehler("Angebot nicht gefunden.");
  if (!["entwurf", "versendet"].includes(a.status))
    return fehler("Das Angebot ist schon beantwortet.");
  if (a.angebotsleistung.length === 0) return fehler("Bitte mindestens eine Leistung eintragen.");
  if (a.abrechnungsart === "pauschale" && a.pauschale_cent === null)
    return fehler("Bitte die Monatspauschale eintragen.");
  const { error } = await k.supabase
    .from("angebot")
    .update({ status: "versendet", versendet_am: new Date().toISOString() })
    .eq("id", id);
  if (error) return fehler(dbFehler(error));
  if (a.anfrage_id)
    await k.supabase.from("anfrage").update({ status: "angebot" }).eq("id", a.anfrage_id);
  neu();

  const link = `${siteUrl()}/angebot/${a.freigabe_token}`;
  if (!a.empfaenger_email) {
    return {
      ok: true,
      meldung: `Als verschickt markiert. Keine E-Mail-Adresse – Link zum Weitergeben: ${link}`,
    };
  }
  const { data: info } = await k.supabase.rpc("angebot_info", { p_token: a.freigabe_token });
  const d = info as AngebotInfo | null;
  const pdf = d
    ? await angebotPdfErzeugen(
        d,
        d.betrieb.logo_pfad
          ? k.supabase.storage.from("logos").getPublicUrl(d.betrieb.logo_pfad).data.publicUrl
          : null,
      )
    : null;
  const betrieb = d?.betrieb.name ?? "";
  const gueltig = a.gueltig_bis ? ` Das Angebot gilt bis ${formatDatum(a.gueltig_bis)}.` : "";
  try {
    const r = await sendeMail({
      an: [a.empfaenger_email],
      betreff: `Angebot ${a.nummer}: ${a.titel}`,
      text: `Guten Tag ${a.empfaenger_name},\n\nvielen Dank für Ihr Interesse. Anbei unser Angebot ${a.nummer}.${gueltig}\n\nSie können es hier ansehen und mit einem Klick annehmen:\n${link}\n\nViele Grüße\n${betrieb}`,
      html: `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5"><p>Guten Tag ${html(a.empfaenger_name)},</p><p>vielen Dank für Ihr Interesse. Anbei unser Angebot ${a.nummer}.${html(gueltig)}</p><p><a href="${html(link)}">Angebot ansehen und annehmen</a></p><p>Viele Grüße<br>${html(betrieb)}</p></div>`,
      absenderName: betrieb,
      antwortAn: d?.betrieb.email,
      anhaenge: pdf ? [{ dateiname: `angebot-${a.nummer}.pdf`, inhalt: new Uint8Array(pdf) }] : [],
    });
    if (r.status !== "gesendet")
      return {
        ok: true,
        meldung: `Als verschickt markiert, Mail nicht gesendet (${r.grund}). Link: ${link}`,
      };
  } catch (e) {
    return {
      ok: true,
      meldung: `Als verschickt markiert, Mail fehlgeschlagen: ${(e as Error).message}. Link: ${link}`,
    };
  }
  return { ok: true, meldung: `Angebot an ${a.empfaenger_email} verschickt.` };
}

// ---------------------------------------------------------------------------
// Website: Anfrageformular und Online-Buchung
// ---------------------------------------------------------------------------

export async function websiteSpeichern(
  eingabe: z.input<typeof websiteSchema>,
): Promise<AktionErgebnis> {
  const p = pruefe(websiteSchema, eingabe);
  if (!p.ok) return p.ergebnis;
  const k = await inhaberKontext();
  const { error } = await k.supabase.from("betrieb").update(p.daten).eq("id", k.betriebId);
  if (error) return fehler(dbFehler(error));
  revalidatePath("/einstellungen/website");
  return { ok: true, meldung: "Gespeichert." };
}

export async function buchungEinstellungenSpeichern(
  eingabe: z.input<typeof buchungEinstellungenSchema>,
): Promise<AktionErgebnis> {
  const p = pruefe(buchungEinstellungenSchema, eingabe);
  if (!p.ok) return p.ergebnis;
  const k = await inhaberKontext();
  if (p.daten.vorlageId) {
    const { data } = await k.supabase
      .from("auftragsvorlage")
      .select("id")
      .eq("id", p.daten.vorlageId)
      .maybeSingle();
    if (!data) return fehler("Vorlage nicht gefunden.");
  }
  const { error } = await k.supabase
    .from("betrieb")
    .update({ buchung: p.daten })
    .eq("id", k.betriebId);
  if (error) return fehler(dbFehler(error));
  revalidatePath("/einstellungen/website");
  return {
    ok: true,
    meldung: p.daten.aktiv ? "Online-Buchung ist aktiv." : "Gespeichert (Buchung aus).",
  };
}
