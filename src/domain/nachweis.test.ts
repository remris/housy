import { describe, expect, it } from "vitest";
import {
  arbeitszeitCsv,
  arbeitszeitliste,
  dezimalStunden,
  stundenMinuten,
} from "./arbeitszeitliste";
import { parseCsv, schreibeCsv } from "./csv";
import {
  einsatzNachweisFaellig,
  einsatzZeit,
  faelligerMonat,
  monatsZeitraum,
  monatsname,
  nachweisDateiname,
  nachweisEmpfaenger,
  plusMonat,
} from "./nachweis";
import { type Buchung, berlinZuIso } from "./zeiterfassung";

let n = 0;
const b = (
  datum: string,
  uhr: string,
  art: Buchung["art"],
  einsatzId: string | null = "e1",
  extra: Partial<Buchung> = {},
): Buchung => ({
  id: `b${++n}`,
  art,
  zeitpunkt: berlinZuIso(datum, uhr),
  einsatzId: art.startsWith("pause") ? null : einsatzId,
  ...extra,
});

describe("Monate", () => {
  it("Zeitraum, Schaltjahr, Name, Vormonat über den Jahreswechsel", () => {
    expect(monatsZeitraum("2028-02")).toEqual({ von: "2028-02-01", bis: "2028-02-29" });
    expect(monatsZeitraum("2026-11")).toEqual({ von: "2026-11-01", bis: "2026-11-30" });
    expect(monatsname("2026-03")).toBe("März 2026");
    expect(faelligerMonat("2027-01-01")).toBe("2026-12");
    expect(plusMonat("2026-12", 1)).toBe("2027-01");
    expect(() => monatsZeitraum("2026-13")).toThrow();
  });
});

describe("Fälligkeit und Empfänger", () => {
  it("Einsatznachweis nur bei erledigtem Einsatz und Versand je Einsatz", () => {
    expect(einsatzNachweisFaellig({ status: "erledigt", versand: "einsatz" })).toBe(true);
    expect(einsatzNachweisFaellig({ status: "begonnen", versand: "einsatz" })).toBe(false);
    expect(einsatzNachweisFaellig({ status: "erledigt", versand: "monat" })).toBe(false);
  });

  it("Nachweis-Adresse vor Kunden-E-Mail, Kopie an den Betrieb ohne Dopplung", () => {
    expect(
      nachweisEmpfaenger({
        versand: "einsatz",
        kundeEmail: "info@kunde.de",
        nachweisEmail: " Objekte@Kunde.de ",
        betriebEmail: "buero@betrieb.de",
        kopie: true,
      }),
    ).toEqual({ an: ["objekte@kunde.de"], kopie: ["buero@betrieb.de"] });
    expect(
      nachweisEmpfaenger({
        versand: "monat",
        kundeEmail: "kaputt",
        nachweisEmail: null,
        betriebEmail: "buero@betrieb.de",
        kopie: false,
      }),
    ).toEqual({ an: [], kopie: [] });
    expect(
      nachweisEmpfaenger({
        versand: "keiner",
        kundeEmail: "info@kunde.de",
        nachweisEmail: null,
        betriebEmail: "info@kunde.de",
        kopie: true,
      }),
    ).toEqual({ an: [], kopie: ["info@kunde.de"] });
  });

  it("Dateiname ohne Umlaute und Sonderzeichen", () => {
    expect(nachweisDateiname("monat", "2026-11-01", "Hauptstraße 12 / Büro")).toBe(
      "nachweis-2026-11-hauptstrasse-12-buero.pdf",
    );
    expect(nachweisDateiname("einsatz", "2026-11-20", "")).toBe("nachweis-2026-11-20.pdf");
  });
});

describe("Zeiten je Einsatz", () => {
  it("addiert mehrere Check-in/-out-Paare und ignoriert Stornos und andere Einsätze", () => {
    const liste = [
      b("2026-11-20", "08:00", "checkin"),
      b("2026-11-20", "09:00", "checkout"),
      b("2026-11-20", "09:10", "checkin", "e2"),
      b("2026-11-20", "10:00", "checkout", "e2"),
      b("2026-11-20", "14:00", "checkin"),
      b("2026-11-20", "14:30", "checkout"),
      b("2026-11-20", "15:00", "checkout", "e1", { storniert: true }),
    ];
    const z = einsatzZeit(liste, "e1");
    expect(z.minuten).toBe(90);
    expect(z.von).toBe(berlinZuIso("2026-11-20", "08:00"));
    expect(z.bis).toBe(berlinZuIso("2026-11-20", "14:30"));
  });

  it("ohne Check-out bleibt das Ende offen", () => {
    const z = einsatzZeit([b("2026-11-20", "08:00", "checkin")], "e1");
    expect(z).toEqual({ von: berlinZuIso("2026-11-20", "08:00"), bis: null, minuten: 0 });
  });
});

describe("Arbeitszeitliste", () => {
  const buchungen = [
    // Montag 02.11.: 07:00–15:45 mit 45 min Pause → 8:00
    b("2026-11-02", "07:00", "checkin"),
    b("2026-11-02", "11:00", "pause_beginn"),
    b("2026-11-02", "11:45", "pause_ende"),
    b("2026-11-02", "15:45", "checkout"),
    // Dienstag 03.11.: 7 Stunden ohne Pause → Hinweis
    b("2026-11-03", "06:00", "checkin", "e2"),
    b("2026-11-03", "13:00", "checkout", "e2"),
    // Mittwoch: nur stornierte Buchung, vom Büro korrigiert → Tag erscheint mit 0
    b("2026-11-04", "08:00", "checkin", "e3", { id: "korr", storniert: true }),
    // Oktober und Dezember gehören nicht dazu (31.10. 23:30 Berlin ist noch Oktober)
    b("2026-10-31", "23:30", "checkin", "e4"),
    b("2026-12-01", "00:30", "checkin", "e5"),
  ];
  const liste = arbeitszeitliste(buchungen, "2026-11", new Set(["korr"]));

  it("bildet Tage nach Ortszeit mit Beginn, Ende, Pause und Dauer", () => {
    expect(liste.tage.map((t) => t.datum)).toEqual(["2026-11-02", "2026-11-03", "2026-11-04"]);
    const [mo, di, mi] = liste.tage;
    expect(mo).toMatchObject({ pauseMinuten: 45, arbeitMinuten: 480, hinweise: [] });
    expect(di!.hinweise).toContain("pause_zu_kurz");
    expect(mi).toMatchObject({ arbeitMinuten: 0, korrigiert: true });
    expect(liste.summeMinuten).toBe(900);
    expect(liste.arbeitstage).toBe(2);
    expect(liste.tageMitHinweis).toBe(1);
  });

  it("formatiert Stunden für Anzeige und Lohnprogramm", () => {
    expect(stundenMinuten(465)).toBe("7:45");
    expect(dezimalStunden(465)).toBe("7,75");
    expect(dezimalStunden(20)).toBe("0,33");
  });

  it("CSV lässt sich wieder einlesen und enthält Beginn, Ende und Dauer", () => {
    const csv = arbeitszeitCsv([{ name: "Ayşe Yılmaz", liste }]);
    expect(csv.startsWith("﻿")).toBe(true);
    const t = parseCsv(csv);
    expect(t.kopf[0]).toBe("Mitarbeiter");
    expect(t.zeilen[0]).toEqual([
      "Ayşe Yılmaz",
      "02.11.2026",
      "Mo",
      "07:00",
      "15:45",
      "45",
      "8:00",
      "8,00",
      "1",
      "",
      "",
    ]);
    expect(t.zeilen[1]![9]).toBe("Pause zu kurz (§ 4 ArbZG)");
  });
});

describe("CSV schreiben", () => {
  it("setzt Anführungszeichen und entschärft Formeln", () => {
    const csv = schreibeCsv([["a;b", 'sag "hi"', "=SUMME(A1)", 5, "Zeile\nzwei"]]);
    expect(csv).toBe('﻿"a;b";"sag ""hi""";\'=SUMME(A1);5;"Zeile\nzwei"\r\n');
  });
});
