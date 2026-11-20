"use server";

import type { z } from "zod";
import { formatDatum, heuteIso, plusTage } from "@/domain/datum";
import type { Bundesland } from "@/domain/feiertage";
import { feiertageImZeitraum } from "@/domain/feiertage";
import { formatEuro } from "@/domain/geld";
import { type BuchungsEinstellungen, preisBerechnen } from "@/domain/preisrechner";
import {
  type Belegung,
  type FreierTermin,
  HALBTAGE,
  type KalenderMitarbeiter,
  freieTermine,
} from "@/domain/termine";
import { type AktionErgebnis, fehler, pruefe } from "@/lib/aktion";
import { sendeMail } from "@/lib/mail/resend";
import { html } from "@/lib/mail/texte";
import { buchungSchema, oeffentlicheAnfrageSchema } from "@/lib/schemas/anfrage";
import { createClient } from "@/lib/supabase/server";

export type OeffentlicherBetrieb = {
  name: string;
  logo_pfad: string | null;
  email: string | null;
  telefon: string | null;
  ort: string | null;
  kleinunternehmer: boolean;
  bundesland: Bundesland;
  anfrage_aktiv: boolean;
  buchung: BuchungsEinstellungen | null;
  datenschutz_url: string | null;
  impressum_url: string | null;
};

export async function ladeOeffentlichenBetrieb(
  kennung: string,
): Promise<OeffentlicherBetrieb | null> {
  if (!/^[a-z0-9-]{6,40}$/i.test(kennung)) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("betrieb_oeffentlich", { p_kennung: kennung });
  return (data as OeffentlicherBetrieb | null) ?? null;
}

/** Kurze Info-Mail an den Betrieb (ohne Mail-Konfiguration passiert nichts). */
async function benachrichtigen(an: string | null, betreff: string, zeilen: string[]) {
  if (!an) return;
  try {
    await sendeMail({
      an: [an],
      betreff,
      text: zeilen.join("\n"),
      html: `<div style="font-family:Arial,sans-serif;font-size:14px">${zeilen.map((z) => html(z)).join("<br>")}</div>`,
    });
  } catch {
    // Benachrichtigung ist ein Zusatz; die Anfrage ist gespeichert
  }
}

export async function anfrageSenden(
  kennung: string,
  eingabe: z.input<typeof oeffentlicheAnfrageSchema>,
): Promise<AktionErgebnis> {
  const p = pruefe(oeffentlicheAnfrageSchema, eingabe);
  if (!p.ok) return p.ergebnis;
  // Honigtopf: Bots füllen das versteckte Feld aus → so tun, als wäre alles gut
  if (p.daten.website) return { ok: true };
  const betrieb = await ladeOeffentlichenBetrieb(kennung);
  if (!betrieb?.anfrage_aktiv) return fehler("Anfragen sind derzeit nicht möglich.");
  const daten = { ...p.daten };
  delete daten.website;
  const supabase = await createClient();
  const { error } = await supabase.rpc("anfrage_stellen", { p_kennung: kennung, p_daten: daten });
  if (error) return fehler(error.message);
  await benachrichtigen(betrieb.email, `Neue Anfrage von ${daten.name}`, [
    `Neue Anfrage über die Website:`,
    `${daten.name}${daten.firma ? ` (${daten.firma})` : ""}`,
    [daten.email, daten.telefon].filter(Boolean).join(" · "),
    daten.leistung ? `Leistung: ${daten.leistung}` : "",
    daten.nachricht ?? "",
    "Details in Housy unter „Anfragen“.",
  ]);
  return { ok: true, meldung: "Vielen Dank! Wir melden uns schnellstmöglich." };
}

/** Freie Halbtage für eine Buchung mit der angegebenen Dauer. */
export async function termineLaden(kennung: string, dauerMinuten: number): Promise<FreierTermin[]> {
  const betrieb = await ladeOeffentlichenBetrieb(kennung);
  const e = betrieb?.buchung;
  if (!betrieb || !e || !(dauerMinuten > 0) || dauerMinuten > 600) return [];
  const heute = heuteIso();
  const bis = plusTage(heute, Math.min(60, e.horizontTage));
  const supabase = await createClient();
  const { data } = await supabase.rpc("buchung_kalender", {
    p_kennung: kennung,
    p_von: heute,
    p_bis: bis,
  });
  const kalender = data as { mitarbeiter: KalenderMitarbeiter[]; belegt: Belegung[] } | null;
  if (!kalender) return [];
  return freieTermine({
    heute,
    vorlaufTage: e.vorlaufTage,
    horizontTage: e.horizontTage,
    dauerMinuten,
    mitarbeiter: kalender.mitarbeiter,
    belegt: kalender.belegt,
    feiertage: new Set(feiertageImZeitraum(heute, bis, betrieb.bundesland).keys()),
  });
}

export type BuchungsErgebnis = {
  vertragsnummer: number;
  datum: string;
  halbtag: "vormittag" | "nachmittag";
  brutto_cent: number;
  leistung: string;
};

export async function buchungSenden(
  kennung: string,
  eingabe: z.input<typeof buchungSchema>,
): Promise<AktionErgebnis<BuchungsErgebnis>> {
  const p = pruefe(buchungSchema, eingabe);
  if (!p.ok) return p.ergebnis;
  if (p.daten.website) return fehler("Buchung nicht möglich.");
  const betrieb = await ladeOeffentlichenBetrieb(kennung);
  if (!betrieb?.buchung) return fehler("Online-Buchung ist derzeit nicht möglich.");
  const preis = preisBerechnen(betrieb.buchung, p.daten, betrieb.kleinunternehmer);
  // Termin muss (noch) frei sein
  const frei = await termineLaden(kennung, preis.minuten);
  if (!frei.some((t) => t.datum === p.daten.datum && t.halbtag === p.daten.halbtag)) {
    return fehler("Dieser Termin ist leider nicht mehr frei. Bitte einen anderen wählen.");
  }
  const daten = { ...p.daten };
  delete daten.website;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("buchung_anlegen", {
    p_kennung: kennung,
    p_daten: daten,
  });
  if (error) return fehler(error.message);
  const r = data as unknown as BuchungsErgebnis;
  const termin = `${formatDatum(r.datum)} ${HALBTAGE[r.halbtag].text}`;
  const preisText = `${formatEuro(r.brutto_cent)}${betrieb.kleinunternehmer ? "" : " inkl. USt."}`;
  try {
    await sendeMail({
      an: [daten.email],
      betreff: `Ihre Buchung: Fensterreinigung am ${formatDatum(r.datum)}`,
      text: [
        `Guten Tag ${daten.name},`,
        "",
        `vielen Dank für Ihre Buchung (Nr. ${r.vertragsnummer}).`,
        `Termin: ${termin}`,
        `Adresse: ${daten.strasse}, ${daten.plz} ${daten.ort}`,
        `Umfang: ${r.leistung}`,
        `Preis: ${preisText}`,
        "",
        "Die Rechnung erhalten Sie nach der Reinigung. Falls etwas nicht passt, antworten Sie einfach auf diese E-Mail.",
        "",
        "Viele Grüße",
        betrieb.name,
      ].join("\n"),
      html: `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5"><p>Guten Tag ${html(daten.name)},</p><p>vielen Dank für Ihre Buchung (Nr. ${r.vertragsnummer}).<br>Termin: <b>${html(termin)}</b><br>Adresse: ${html(`${daten.strasse}, ${daten.plz} ${daten.ort}`)}<br>Umfang: ${html(r.leistung)}<br>Preis: ${html(preisText)}</p><p>Die Rechnung erhalten Sie nach der Reinigung. Falls etwas nicht passt, antworten Sie einfach auf diese E-Mail.</p><p>Viele Grüße<br>${html(betrieb.name)}</p></div>`,
      absenderName: betrieb.name,
      antwortAn: betrieb.email,
    });
  } catch {
    // Buchung steht; Bestätigung ist Zusatz
  }
  await benachrichtigen(betrieb.email, `Neue Online-Buchung: ${termin}`, [
    `${daten.name}, ${daten.strasse}, ${daten.plz} ${daten.ort}`,
    [daten.email, daten.telefon].filter(Boolean).join(" · "),
    `Termin: ${termin} · ${r.leistung} · ${preisText}`,
    "Der Einsatz steht unter Planung → Offene Einsätze zur Zuweisung bereit.",
  ]);
  return { ok: true, daten: r, meldung: "Gebucht." };
}

export async function angebotBeantworten(
  token: string,
  antwort:
    { annehmen: true; name: string; bild: string | null } | { annehmen: false; grund: string },
): Promise<AktionErgebnis> {
  if (!/^[0-9a-f-]{36}$/i.test(token)) return fehler("Ungültiger Link.");
  const supabase = await createClient();
  const { data: info } = await supabase.rpc("angebot_info", { p_token: token });
  const a = info as {
    angebot: { nummer: number; titel: string };
    betrieb: { name: string; email: string | null };
  } | null;
  if (!a) return fehler("Angebot nicht gefunden.");
  const { error } = antwort.annehmen
    ? await supabase.rpc("angebot_annehmen", {
        p_token: token,
        p_name: antwort.name,
        p_bild: antwort.bild ?? "",
      })
    : await supabase.rpc("angebot_ablehnen", { p_token: token, p_grund: antwort.grund });
  if (error) return fehler(error.message);
  await benachrichtigen(
    a.betrieb.email,
    `Angebot ${a.angebot.nummer} ${antwort.annehmen ? "angenommen" : "abgelehnt"}`,
    [
      `Angebot ${a.angebot.nummer} „${a.angebot.titel}“ wurde ${antwort.annehmen ? `von ${antwort.name} angenommen. Kunde, Objekt und Vertragsentwurf sind angelegt – bitte den Vertrag prüfen und aktivieren.` : "abgelehnt."}`,
      !antwort.annehmen && antwort.grund ? `Grund: ${antwort.grund}` : "",
    ],
  );
  return {
    ok: true,
    meldung: antwort.annehmen
      ? "Vielen Dank für Ihren Auftrag!"
      : "Schade – vielen Dank für Ihre Rückmeldung.",
  };
}
