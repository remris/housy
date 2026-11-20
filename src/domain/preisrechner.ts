/**
 * Online-Preisrechner für Fensterreinigung bei Privatkunden.
 * Preise sind netto je Fenster bzw. Stück; angezeigt wird der Endpreis inkl. USt (PAngV).
 * Die Datenbank (buchung_anlegen) rechnet nach derselben Regel nach – Tests halten beides gleich.
 *
 * Regel: Summe (Anzahl × Preis) + Rahmen-Aufschlag (Prozent, gerundet) + Anfahrt,
 * mindestens der Mindestpreis; USt auf den Nettobetrag (außer Kleinunternehmer).
 */
import { type Cent, rundeCent } from "./geld";

export type RechnerPosition = {
  id: string;
  name: string;
  /** netto je Stück */
  preisCent: Cent;
  /** Arbeitszeit je Stück in Minuten */
  minuten: number;
};

export type BuchungsEinstellungen = {
  aktiv: boolean;
  /** Auftragsvorlage für den Einsatz (z. B. „Fensterreinigung privat“) */
  vorlageId: string | null;
  positionen: RechnerPosition[];
  /** Aufschlag in Prozent, wenn Rahmen mitgereinigt werden */
  rahmenProzent: number;
  anfahrtCent: Cent;
  mindestpreisCent: Cent;
  ustSatz: 19 | 7;
  /** frühestens so viele Tage ab heute buchbar */
  vorlaufTage: number;
  /** bis so viele Tage im Voraus */
  horizontTage: number;
  /** Rüstzeit je Einsatz in Minuten */
  ruestMinuten: number;
};

export const STANDARD_BUCHUNG: BuchungsEinstellungen = {
  aktiv: false,
  vorlageId: null,
  positionen: [
    { id: "normal", name: "Fenster (Standard, bis 1,5 m²)", preisCent: 600, minuten: 6 },
    { id: "gross", name: "Großes Fenster / Balkontür", preisCent: 1000, minuten: 10 },
    { id: "dach", name: "Dachfenster", preisCent: 900, minuten: 9 },
    { id: "sprossen", name: "Sprossenfenster", preisCent: 1400, minuten: 15 },
  ],
  rahmenProzent: 30,
  anfahrtCent: 1500,
  mindestpreisCent: 6900,
  ustSatz: 19,
  vorlaufTage: 2,
  horizontTage: 28,
  ruestMinuten: 15,
};

export type Auswahl = { anzahl: Record<string, number>; rahmen: boolean };

export type Preis = {
  posten: { id: string; name: string; anzahl: number; summeCent: Cent }[];
  arbeitCent: Cent;
  rahmenCent: Cent;
  anfahrtCent: Cent;
  mindestAufschlagCent: Cent;
  nettoCent: Cent;
  ustCent: Cent;
  bruttoCent: Cent;
  fenster: number;
  minuten: number;
};

export function preisBerechnen(
  e: BuchungsEinstellungen,
  auswahl: Auswahl,
  kleinunternehmer: boolean,
): Preis {
  const posten = e.positionen
    .map((p) => {
      const anzahl = Math.max(0, Math.min(500, Math.floor(auswahl.anzahl[p.id] ?? 0)));
      return {
        id: p.id,
        name: p.name,
        anzahl,
        summeCent: anzahl * p.preisCent,
        minuten: anzahl * p.minuten,
      };
    })
    .filter((p) => p.anzahl > 0);
  const arbeitCent = posten.reduce((s, p) => s + p.summeCent, 0);
  const rahmenCent = auswahl.rahmen ? rundeCent((arbeitCent * e.rahmenProzent) / 100) : 0;
  const vorMindest = arbeitCent + rahmenCent + e.anfahrtCent;
  const mindestAufschlagCent = arbeitCent > 0 ? Math.max(0, e.mindestpreisCent - vorMindest) : 0;
  const nettoCent = arbeitCent > 0 ? vorMindest + mindestAufschlagCent : 0;
  const ustCent = kleinunternehmer ? 0 : rundeCent((nettoCent * e.ustSatz) / 100);
  const arbeitMinuten = posten.reduce((s, p) => s + p.minuten, 0);
  return {
    posten: posten.map((p) => ({
      id: p.id,
      name: p.name,
      anzahl: p.anzahl,
      summeCent: p.summeCent,
    })),
    arbeitCent,
    rahmenCent,
    anfahrtCent: arbeitCent > 0 ? e.anfahrtCent : 0,
    mindestAufschlagCent,
    nettoCent,
    ustCent,
    bruttoCent: nettoCent + ustCent,
    fenster: posten.reduce((s, p) => s + p.anzahl, 0),
    minuten:
      arbeitMinuten > 0
        ? Math.ceil((arbeitMinuten * (auswahl.rahmen ? 1.3 : 1) + e.ruestMinuten) / 15) * 15
        : 0,
  };
}
