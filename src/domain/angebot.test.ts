import { describe, expect, it } from "vitest";
import { angebotAbgelaufen, angebotsSumme, einsaetzeProMonat } from "./angebot";
import { STANDARD_BUCHUNG, preisBerechnen } from "./preisrechner";
import { freieTermine } from "./termine";

describe("Angebot", () => {
  it("Einsätze pro Monat aus dem Rhythmus", () => {
    expect(
      einsaetzeProMonat({ frequenz: "woechentlich", intervall: 1, wochentage: [1, 4] }),
    ).toBeCloseTo(8.667, 3);
    expect(
      einsaetzeProMonat({ frequenz: "woechentlich", intervall: 2, wochentage: [3] }),
    ).toBeCloseTo(2.167, 3);
    expect(einsaetzeProMonat({ frequenz: "monatlich", intervall: 3, wochentage: [] })).toBeCloseTo(
      0.333,
      3,
    );
    expect(einsaetzeProMonat({ frequenz: "einmalig", intervall: 1, wochentage: [] })).toBe(0);
  });

  it("Aufwand: Monat geschätzt, Einmaliges getrennt; Pauschale nimmt den festen Betrag", () => {
    const leistungen = [
      {
        bezeichnung: "Unterhaltsreinigung",
        frequenz: "woechentlich" as const,
        intervall: 1,
        wochentage: [1, 4],
        mengeJeEinsatz: 2.5,
        einheit: "stunde" as const,
        preisCent: 3500,
      },
      {
        bezeichnung: "Grundreinigung",
        frequenz: "einmalig" as const,
        intervall: 1,
        wochentage: [],
        mengeJeEinsatz: 1,
        einheit: "pauschal" as const,
        preisCent: 45000,
      },
    ];
    const s = angebotsSumme(leistungen, "aufwand", null);
    expect(s.zeilen[0]).toEqual({
      bezeichnung: "Unterhaltsreinigung",
      jeEinsatzCent: 8750,
      monatCent: 75833,
      einmaligCent: 0,
    });
    expect(s).toMatchObject({ monatNettoCent: 75833, einmaligNettoCent: 45000 });
    expect(angebotsSumme(leistungen, "pauschale", 70000).monatNettoCent).toBe(70000);
  });

  it("Gültigkeit", () => {
    expect(angebotAbgelaufen("2026-11-30", "2026-12-01")).toBe(true);
    expect(angebotAbgelaufen("2026-11-30", "2026-11-30")).toBe(false);
    expect(angebotAbgelaufen(null, "2030-01-01")).toBe(false);
  });
});

describe("Preisrechner Fensterreinigung", () => {
  it("12 Fenster + 2 Balkontüren mit Rahmen: Arbeit, 30 % Rahmen, Anfahrt, USt", () => {
    const p = preisBerechnen(
      STANDARD_BUCHUNG,
      { anzahl: { normal: 12, gross: 2 }, rahmen: true },
      false,
    );
    expect(p).toMatchObject({
      arbeitCent: 9200,
      rahmenCent: 2760,
      anfahrtCent: 1500,
      mindestAufschlagCent: 0,
      nettoCent: 13460,
      ustCent: 2557,
      bruttoCent: 16017,
      fenster: 14,
      // (72 + 20) × 1,3 + 15 = 134,6 → 135 Minuten
      minuten: 135,
    });
  });

  it("kleiner Auftrag wird auf den Mindestpreis angehoben; Kleinunternehmer ohne USt", () => {
    const p = preisBerechnen(STANDARD_BUCHUNG, { anzahl: { normal: 3 }, rahmen: false }, true);
    expect(p).toMatchObject({
      arbeitCent: 1800,
      mindestAufschlagCent: 3600,
      nettoCent: 6900,
      ustCent: 0,
      bruttoCent: 6900,
    });
  });

  it("nichts gewählt kostet nichts; Unsinn wird begrenzt", () => {
    expect(preisBerechnen(STANDARD_BUCHUNG, { anzahl: {}, rahmen: true }, false).bruttoCent).toBe(
      0,
    );
    expect(
      preisBerechnen(STANDARD_BUCHUNG, { anzahl: { normal: -5, gross: 2.7 }, rahmen: false }, false)
        .fenster,
    ).toBe(2);
  });
});

describe("Freie Termine", () => {
  // Mo 2026-11-23; Mitarbeiter A Mo–Fr 7–16, B nur Mo 8–12
  const mitarbeiter = [
    {
      id: "A",
      arbeitszeiten: [1, 2, 3, 4, 5].map((t) => ({ wochentag: t, von: "07:00", bis: "16:00" })),
      abwesend: ["2026-11-25"],
    },
    { id: "B", arbeitszeiten: [{ wochentag: 1, von: "08:00", bis: "12:00" }], abwesend: [] },
  ];

  it("Vorlauf, Feiertage, Abwesenheit, Wochenende und Belegung werden berücksichtigt", () => {
    const t = freieTermine({
      heute: "2026-11-21",
      vorlaufTage: 2,
      horizontTage: 6,
      dauerMinuten: 120,
      mitarbeiter,
      belegt: [
        // Di vormittags ist A voll
        { mitarbeiterId: "A", datum: "2026-11-24", beginn: "08:00", minuten: 240 },
        // Do: ein nicht zugewiesener langer Einsatz ohne Uhrzeit
        { mitarbeiterId: null, datum: "2026-11-26", beginn: null, minuten: 400 },
      ],
      feiertage: new Set(["2026-11-27"]),
    });
    expect(t).toEqual([
      { datum: "2026-11-23", halbtag: "vormittag" },
      { datum: "2026-11-23", halbtag: "nachmittag" },
      { datum: "2026-11-24", halbtag: "nachmittag" },
      // Mi: A abwesend, B arbeitet nicht → nichts; Do: Team durch offenen Einsatz zu knapp
      // Fr: Feiertag, Sa/So: keine Arbeitszeit
    ]);
  });

  it("Nachmittag 12–16 reicht für 3 Stunden nicht, wenn 1,5 Stunden belegt sind", () => {
    const t = freieTermine({
      heute: "2026-11-22",
      vorlaufTage: 1,
      horizontTage: 1,
      dauerMinuten: 180,
      mitarbeiter: [mitarbeiter[0]!],
      belegt: [{ mitarbeiterId: "A", datum: "2026-11-23", beginn: "13:00", minuten: 90 }],
      feiertage: new Set(),
    });
    expect(t).toEqual([{ datum: "2026-11-23", halbtag: "vormittag" }]);
  });
});
