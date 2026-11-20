/**
 * Texte der Kunden-Mails (Nachweis, Bestätigung von Zusatzleistungen) als Text und HTML.
 * Ohne Abhängigkeiten, damit sie im Test geprüft werden können.
 */
import { formatDatum } from "@/domain/datum";
import { formatEuro } from "@/domain/geld";
import { monatsname } from "@/domain/nachweis";

export type MailInhalt = { betreff: string; text: string; html: string };

export function html(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type Betrieb = { name: string; telefon: string | null; email: string | null };

function signatur(b: Betrieb): string[] {
  return [
    "Viele Grüße",
    b.name,
    ...[b.telefon && `Tel. ${b.telefon}`, b.email].filter((x): x is string => !!x),
  ];
}

function zuHtml(absaetze: string[][]): string {
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#1a1a1a">${absaetze
    .map((a) => `<p>${a.map(html).join("<br>")}</p>`)
    .join("")}</div>`;
}

function baue(betreff: string, absaetze: string[][]): MailInhalt {
  return {
    betreff,
    text: absaetze.map((a) => a.join("\n")).join("\n\n"),
    html: zuHtml(absaetze),
  };
}

export function nachweisMail(p: {
  art: "einsatz" | "monat";
  von: string;
  objekt: string;
  betrieb: Betrieb;
  einsaetze: number;
}): MailInhalt {
  const wann = p.art === "monat" ? monatsname(p.von.slice(0, 7)) : `vom ${formatDatum(p.von)}`;
  const betreff = `Leistungsnachweis ${wann} – ${p.objekt}`;
  const kern =
    p.art === "monat"
      ? `anbei der Leistungsnachweis für ${p.objekt} für ${wann} (${p.einsaetze} ${p.einsaetze === 1 ? "Einsatz" : "Einsätze"}).`
      : `anbei der Leistungsnachweis für unseren Einsatz in ${p.objekt} ${wann}.`;
  return baue(betreff, [
    ["Guten Tag,"],
    [kern, "Darin finden Sie die Zeiten, die erledigten Arbeiten und gegebenenfalls Fotos."],
    ["Bei Fragen antworten Sie einfach auf diese E-Mail."],
    signatur(p.betrieb),
  ]);
}

export function bestaetigungMail(p: {
  datum: string;
  objekt: string;
  bezeichnung: string;
  menge: number;
  einheit: string | null;
  preisCent: number;
  dauer: "heute" | "dauerhaft";
  betrieb: Betrieb;
  kleinunternehmer: boolean;
}): MailInhalt {
  const menge = p.menge.toLocaleString("de-DE");
  const preis = `${formatEuro(p.preisCent)}${p.einheit ? ` ${p.einheit}` : ""}${p.kleinunternehmer ? "" : " zzgl. USt."}`;
  return baue(`Bestätigung Zusatzleistung – ${p.objekt}`, [
    ["Guten Tag,"],
    [
      `wie am ${formatDatum(p.datum)} vor Ort mündlich vereinbart, bestätigen wir folgende Zusatzleistung für ${p.objekt}:`,
    ],
    [
      `${menge} × ${p.bezeichnung}`,
      `Preis: ${preis}`,
      p.dauer === "dauerhaft"
        ? "Umfang: ab sofort dauerhaft bei jedem Einsatz (wir passen den Vertrag an)"
        : "Umfang: einmalig",
    ],
    [
      "Falls das nicht Ihrer Absprache entspricht, antworten Sie bitte innerhalb von 7 Tagen auf diese E-Mail.",
    ],
    signatur(p.betrieb),
  ]);
}
