import { describe, expect, it } from "vitest";
import { kalenderwoche } from "./datum";
import {
  type PlanEinsatz,
  type PlanMitarbeiter,
  type TourStopp,
  berechneTour,
  entfernungKm,
  fahrzeitenEntlang,
  findeKonflikte,
  optimiereReihenfolge,
  schaetzeFahrzeit,
  schaetzeMatrix,
  tourFuer,
  zuDauer,
  zuMinuten,
  zuUhrzeit,
} from "./planung";
import { type IstEinsatz, type SollEinsatz, gleicheAb } from "./serien";

describe("Uhrzeiten", () => {
  it("rechnet hin und her", () => {
    expect(zuMinuten("07:30")).toBe(450);
    expect(zuMinuten("07:30:00")).toBe(450);
    expect(zuUhrzeit(450)).toBe("07:30");
    expect(zuUhrzeit(24 * 60 + 15)).toBe("24:15");
    expect(zuDauer(135)).toBe("2:15 h");
  });

  it("Kalenderwoche nach ISO", () => {
    expect(kalenderwoche("2026-11-20")).toEqual({ jahr: 2026, woche: 47 });
    expect(kalenderwoche("2027-01-01")).toEqual({ jahr: 2026, woche: 53 });
    expect(kalenderwoche("2026-01-01")).toEqual({ jahr: 2026, woche: 1 });
    expect(kalenderwoche("2024-12-30")).toEqual({ jahr: 2025, woche: 1 });
  });
});

describe("Fahrzeit-Schätzung", () => {
  const stuttgart = { lat: 48.7758, lng: 9.1829 };
  const esslingen = { lat: 48.7406, lng: 9.3108 };
  it("Luftlinie Stuttgart–Esslingen ca. 10 km", () => {
    expect(entfernungKm(stuttgart, esslingen)).toBeGreaterThan(9.5);
    expect(entfernungKm(stuttgart, esslingen)).toBeLessThan(10.5);
  });
  it("schätzt Minuten mit Umwegfaktor", () => {
    const min = schaetzeFahrzeit(stuttgart, esslingen);
    expect(min).toBeGreaterThan(20);
    expect(min).toBeLessThan(30);
    expect(schaetzeFahrzeit(stuttgart, stuttgart)).toBe(0);
    expect(schaetzeFahrzeit(null, esslingen)).toBe(15);
  });
  it("Matrix ist symmetrisch mit Nullen auf der Diagonale", () => {
    const m = schaetzeMatrix([stuttgart, esslingen, null]);
    expect(m[0]![0]).toBe(0);
    expect(m[0]![1]).toBe(m[1]![0]);
    expect(m[2]![0]).toBe(15);
  });
});

const stopp = (id: string, soll: number, von?: string, bis?: string): TourStopp => ({
  id,
  sollzeitMinuten: soll,
  zeitfensterVon: von ?? null,
  zeitfensterBis: bis ?? null,
});

describe("Tagestour", () => {
  it("rechnet Ankunft, Beginn, Ende und Rückkehr", () => {
    const t = berechneTour(
      "07:00",
      [stopp("a", 60), stopp("b", 30, "09:00", "12:00")],
      [20, 10, 25],
    );
    expect(t.stopps.map((s) => [s.ankunft, s.beginn, s.ende, s.warteMinuten])).toEqual([
      ["07:20", "07:20", "08:20", 0],
      ["08:30", "09:00", "09:30", 30],
    ]);
    expect(t.rueckkehr).toBe("09:55");
    expect(t.fahrzeitGesamt).toBe(55);
    expect(t.arbeitszeitGesamt).toBe(90);
    expect(t.warnungen).toBe(0);
  });

  it("warnt bei verpasstem und zu knappem Reinigungsfenster", () => {
    const t = berechneTour(
      "07:00",
      [stopp("a", 120, undefined, "08:30"), stopp("b", 30, "06:00", "09:00")],
      [10, 10, 10],
    );
    expect(t.stopps[0]!.warnung).toBe("fenster_zu_knapp"); // 07:10–09:10, Fenster bis 08:30
    expect(t.stopps[1]!.warnung).toBe("fenster_verpasst"); // Ankunft 09:20
    expect(t.warnungen).toBe(2);
  });

  it("Fahrzeiten entlang einer Reihenfolge", () => {
    // 0 = Start, 1 = A, 2 = B
    const m = [
      [0, 10, 30],
      [10, 0, 25],
      [30, 25, 0],
    ];
    expect(fahrzeitenEntlang(m, [0, 1])).toEqual([10, 25, 30]);
    expect(fahrzeitenEntlang(m, [1, 0])).toEqual([30, 25, 10]);
    expect(fahrzeitenEntlang(m, [])).toEqual([0]);
  });

  it("leere Tour", () => {
    const t = berechneTour("07:00", [], [0]);
    expect(t.rueckkehr).toBe("07:00");
    expect(t.fahrzeitGesamt).toBe(0);
  });
});

describe("Reihenfolge-Vorschlag", () => {
  // Punkte auf einer Linie: Start 0, Objekte bei 30, 10, 20 km → Fahrtzeit = Abstand
  const pos = [0, 30, 10, 20];
  const m = pos.map((a) => pos.map((b) => Math.abs(a - b)));
  const stopps = [stopp("x30", 30), stopp("x10", 30), stopp("x20", 30)];

  it("fährt die Punkte der Reihe nach ab", () => {
    const r = optimiereReihenfolge("07:00", stopps, m);
    expect(r.map((i) => stopps[i]!.id)).toEqual(["x10", "x20", "x30"]);
  });

  it("Zeitfenster gehen vor kurzen Wegen", () => {
    const mitFenster = [stopp("x30", 30, "07:00", "08:00"), stopp("x10", 30), stopp("x20", 30)];
    const r = optimiereReihenfolge("07:00", mitFenster, m);
    expect(mitFenster[r[0]!]!.id).toBe("x30");
    expect(tourFuer("07:00", mitFenster, m, r).warnungen).toBe(0);
  });

  it("ein oder kein Stopp", () => {
    expect(optimiereReihenfolge("07:00", [], [[0]])).toEqual([]);
    expect(
      optimiereReihenfolge(
        "07:00",
        [stopp("a", 10)],
        [
          [0, 5],
          [5, 0],
        ],
      ),
    ).toEqual([0]);
  });
});

describe("Konflikte", () => {
  const anna: PlanMitarbeiter = {
    id: "anna",
    name: "Anna",
    arbeitszeiten: [1, 2, 3, 4, 5].map((wochentag) => ({ wochentag, von: "06:00", bis: "12:00" })),
    abwesenheiten: [{ von: "2026-11-25", bis: "2026-11-27", art: "urlaub" }],
  };
  const ben: PlanMitarbeiter = { id: "ben", name: "Ben", arbeitszeiten: [], abwesenheiten: [] };
  const e = (id: string, p: Partial<PlanEinsatz>): PlanEinsatz => ({
    id,
    datum: "2026-11-23",
    mitarbeiterId: "anna",
    sollzeitMinuten: 60,
    zeitfensterVon: null,
    zeitfensterBis: null,
    geplanterBeginn: null,
    fahrzeitMinuten: null,
    bezeichnung: id,
    ...p,
  });

  it("konfliktfreier Plan", () => {
    const k = findeKonflikte(
      [
        e("a", { geplanterBeginn: "06:30", fahrzeitMinuten: 30 }),
        e("b", { geplanterBeginn: "08:00", zeitfensterVon: "07:00", zeitfensterBis: "10:00" }),
        e("c", { mitarbeiterId: null }),
      ],
      [anna, ben],
    );
    expect(k).toEqual([]);
  });

  it("Urlaub", () => {
    const k = findeKonflikte([e("a", { datum: "2026-11-26" })], [anna]);
    expect(k).toHaveLength(1);
    expect(k[0]!.art).toBe("abwesend");
    expect(k[0]!.text).toContain("Urlaub");
  });

  it("kein Arbeitstag (Samstag), ohne Arbeitszeiten keine Prüfung", () => {
    expect(findeKonflikte([e("a", { datum: "2026-11-28" })], [anna])[0]!.art).toBe(
      "kein_arbeitstag",
    );
    expect(findeKonflikte([e("a", { datum: "2026-11-28", mitarbeiterId: "ben" })], [ben])).toEqual(
      [],
    );
  });

  it("Überlastung inklusive Fahrzeit", () => {
    const k = findeKonflikte(
      [
        e("a", { sollzeitMinuten: 180, fahrzeitMinuten: 30 }),
        e("b", { sollzeitMinuten: 150, fahrzeitMinuten: 15 }),
      ],
      [anna],
    );
    expect(k.map((x) => x.art)).toEqual(["ueberlastet"]);
    expect(k[0]!.text).toBe("Anna: 6:15 h geplant, 6:00 h Arbeitszeit");
  });

  it("Überschneidung und außerhalb der Arbeitszeit", () => {
    const k = findeKonflikte(
      [
        e("a", { geplanterBeginn: "07:00", sollzeitMinuten: 90 }),
        e("b", { geplanterBeginn: "08:00" }),
        e("c", { geplanterBeginn: "11:30" }),
      ],
      [anna],
    );
    expect(k.map((x) => x.art).sort()).toEqual(["ausserhalb_arbeitszeit", "ueberschneidung"]);
    expect(k.find((x) => x.art === "ueberschneidung")!.einsatzIds).toEqual(["a", "b"]);
    expect(k.find((x) => x.art === "ausserhalb_arbeitszeit")!.einsatzIds).toEqual(["c"]);
  });

  it("Reinigungsfenster verletzt oder zu kurz", () => {
    const k = findeKonflikte(
      [
        e("spaet", { geplanterBeginn: "09:30", zeitfensterVon: "07:00", zeitfensterBis: "10:00" }),
        e("kurz", { sollzeitMinuten: 120, zeitfensterVon: "07:00", zeitfensterBis: "08:00" }),
      ],
      [ben],
    );
    expect(k.map((x) => [x.art, x.einsatzIds[0]])).toEqual([
      ["zeitfenster", "spaet"],
      ["fenster_zu_kurz", "kurz"],
    ]);
  });
});

describe("Serienabgleich nach Verschieben von Hand", () => {
  const soll: SollEinsatz = {
    datum: "2026-11-23",
    versionId: "v",
    leistungId: "l",
    vorlageId: "t",
    zeitfensterVon: null,
    zeitfensterBis: null,
    sollzeitMinuten: 60,
    verschobenVon: null,
  };
  const ist: IstEinsatz = {
    id: "e1",
    datum: "2026-11-24", // von Montag auf Dienstag gelegt
    serienDatum: "2026-11-23",
    vorlageId: "t",
    leistungId: "l",
    status: "zugewiesen",
    zeitfensterVon: null,
    zeitfensterBis: null,
    sollzeitMinuten: 60,
  };

  it("legt den Montag nicht neu an und löscht den Dienstag nicht", () => {
    expect(gleicheAb([soll], [ist], "2026-11-20")).toEqual({
      anlegen: [],
      aktualisieren: [],
      loeschen: [],
    });
  });

  it("entfällt der Serientermin, wird auch der verschobene Einsatz entfernt", () => {
    expect(gleicheAb([], [ist], "2026-11-20").loeschen).toEqual(["e1"]);
  });
});
