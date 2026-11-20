"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { type AktionErgebnis, dbFehler, fehler, pruefe } from "@/lib/aktion";
import { ROLLEN_TEXT, type Rolle, betriebKontext, inhaberKontext } from "@/lib/auth";
import { siteUrl } from "@/lib/env";
import { koordinatenErgaenzen } from "@/lib/karten/koordinaten";
import { firmendatenSchema } from "@/lib/schemas/betrieb";
import { einladungSchema } from "@/lib/schemas/konto";
import { createAdminClient } from "@/lib/supabase/admin";

export async function firmendatenSpeichern(
  eingabe: z.input<typeof firmendatenSchema>,
): Promise<AktionErgebnis> {
  const p = pruefe(firmendatenSchema, eingabe);
  if (!p.ok) return p.ergebnis;
  const k = await inhaberKontext();
  const { data: alt } = await k.supabase
    .from("betrieb")
    .select("strasse, plz, ort, breitengrad, laengengrad")
    .eq("id", k.betriebId)
    .single();
  // Firmensitz ist Start und Ziel der Touren
  const { daten } = await koordinatenErgaenzen(
    {
      strasse: p.daten.strasse,
      plz: p.daten.plz,
      ort: p.daten.ort,
      breitengrad: alt?.breitengrad ?? null,
      laengengrad: alt?.laengengrad ?? null,
    },
    alt,
  );
  const { error } = await k.supabase
    .from("betrieb")
    .update({ ...p.daten, breitengrad: daten.breitengrad, laengengrad: daten.laengengrad })
    .eq("id", k.betriebId);
  if (error) return fehler(dbFehler(error));
  revalidatePath("/", "layout");
  return { ok: true, meldung: "Firmendaten gespeichert." };
}

const LOGO_TYPEN = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"];

export async function logoHochladen(formData: FormData): Promise<AktionErgebnis> {
  const k = await inhaberKontext();
  const datei = formData.get("logo");
  if (!(datei instanceof File) || datei.size === 0) return fehler("Bitte eine Bilddatei wählen.");
  if (!LOGO_TYPEN.includes(datei.type)) return fehler("Erlaubt sind PNG, JPG, SVG oder WebP.");
  if (datei.size > 2 * 1024 * 1024) return fehler("Das Logo darf höchstens 2 MB groß sein.");

  const endung = datei.name.split(".").pop()?.toLowerCase() ?? "png";
  const pfad = `${k.betriebId}/logo-${Date.now()}.${endung}`;
  const { error } = await k.supabase.storage
    .from("logos")
    .upload(pfad, datei, { contentType: datei.type, upsert: false });
  if (error) return fehler(`Upload fehlgeschlagen: ${error.message}`);

  const { data: alt } = await k.supabase
    .from("betrieb")
    .select("logo_pfad")
    .eq("id", k.betriebId)
    .single();
  const { error: e2 } = await k.supabase
    .from("betrieb")
    .update({ logo_pfad: pfad })
    .eq("id", k.betriebId);
  if (e2) return fehler(dbFehler(e2));
  if (alt?.logo_pfad) await k.supabase.storage.from("logos").remove([alt.logo_pfad]);

  revalidatePath("/einstellungen");
  return { ok: true, meldung: "Logo gespeichert." };
}

export async function logoEntfernen(): Promise<AktionErgebnis> {
  const k = await inhaberKontext();
  const { data } = await k.supabase
    .from("betrieb")
    .select("logo_pfad")
    .eq("id", k.betriebId)
    .single();
  if (data?.logo_pfad) await k.supabase.storage.from("logos").remove([data.logo_pfad]);
  await k.supabase.from("betrieb").update({ logo_pfad: null }).eq("id", k.betriebId);
  revalidatePath("/einstellungen");
  return { ok: true, meldung: "Logo entfernt." };
}

export async function einladen(
  eingabe: z.input<typeof einladungSchema>,
): Promise<AktionErgebnis<{ link: string; mailVerschickt: boolean }>> {
  const p = pruefe(einladungSchema, eingabe);
  if (!p.ok) return p.ergebnis;
  const k = await inhaberKontext();

  const { data, error } = await k.supabase
    .from("einladung")
    .insert({ ...p.daten, betrieb_id: k.betriebId, eingeladen_von: k.user.id })
    .select("token")
    .single();
  if (error) return fehler(dbFehler(error));

  const link = `${siteUrl()}/einladung/${data.token}`;
  let mailVerschickt = false;
  const admin = createAdminClient();
  if (admin) {
    // Neuer Benutzer: Supabase verschickt die Einladungs-Mail; der DB-Trigger nimmt die Einladung an.
    const { error: mailFehler } = await admin.auth.admin.inviteUserByEmail(p.daten.email, {
      redirectTo: `${siteUrl()}/auth/confirm?next=/passwort-neu`,
      data: { einladung_token: data.token },
    });
    mailVerschickt = !mailFehler;
  }

  revalidatePath("/einstellungen/team");
  return {
    ok: true,
    daten: { link, mailVerschickt },
    meldung: mailVerschickt
      ? `Einladung an ${p.daten.email} verschickt.`
      : "Einladung angelegt. Link kopieren und weitergeben.",
  };
}

export async function einladungLoeschen(id: string): Promise<AktionErgebnis> {
  const k = await inhaberKontext();
  const { error } = await k.supabase
    .from("einladung")
    .delete()
    .eq("id", id)
    .eq("betrieb_id", k.betriebId);
  if (error) return fehler(dbFehler(error));
  revalidatePath("/einstellungen/team");
  return { ok: true, meldung: "Einladung gelöscht." };
}

export async function mitgliedAendern(
  id: string,
  aenderung: { rolle?: Rolle; aktiv?: boolean },
): Promise<AktionErgebnis> {
  const k = await inhaberKontext();
  if (aenderung.rolle && !(aenderung.rolle in ROLLEN_TEXT)) return fehler("Unbekannte Rolle.");
  const { error } = await k.supabase
    .from("mitglied")
    .update(aenderung)
    .eq("id", id)
    .eq("betrieb_id", k.betriebId);
  if (error) return fehler(dbFehler(error));
  revalidatePath("/einstellungen/team");
  return { ok: true, meldung: "Gespeichert." };
}

export async function spracheAendern(sprache: string): Promise<AktionErgebnis> {
  const k = await betriebKontext();
  const { error } = await k.supabase.from("mitglied").update({ sprache }).eq("id", k.mitglied.id);
  if (error) return fehler(dbFehler(error));
  return { ok: true };
}
