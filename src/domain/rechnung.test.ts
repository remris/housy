/**
 * Abnahme M9: Der Monatslauf erzeugt für drei Testkunden korrekte Rechnungen.
 */
import { describe, expect, it } from "vitest";
import {
  AUFBEWAHRUNG_HINWEIS,
  KLEINUNTERNEHMER_HINWEIS,
  type EinsatzFuerLauf,
  type VertragFuerLauf,
  abschnitte,
  faelligAm,
  nachtragsPositionen,
  pflichthinweise,
  rechnungsnummer,
  stundenAusMinuten,
  summen,
  vertragsPositionen,
} from "./rechnung";

const NOV = "2026-11";

describe("Testkunde 1: Hausverwaltung Müller – Pauschale mit Versionswechsel und Nachtrag", () => {
  const vertrag: VertragFuerLauf = {
    id: "v1",
    titel: "Treppenhaus Hauptstraße 12",
    beginn: "2026-01-01",
    endetAm: null,
    versionen: [
      {
        id: "v1-1",
        version: 1,
        gueltigAb: "2026-01-01",
        abrechnungsart: "pauschale",
        pauschaleCent: 42000,
        leistungen: [],
      },
      // ab 15.11. Kellerfenster dazu: 480 €
      {
        id: "v1-2",
        version: 2,
        gueltigAb: "2026-11-15",
        abrechnungsart: "pauschale",
        pauschaleCent: 48000,
        leistungen: [],
      },
    ],
  };

  it("Pauschale anteilig nach Tagen: 14/30 × 420 € + 16/30 × 480 €", () => {
    const { positionen, hinweise } = vertragsPositionen({ monat: NOV, vertrag, einsaetze: [] });
    expect(hinweise).toEqual([]);
    expect(positionen.map((p) => [p.nettoCent, p.beschreibung])).toEqual([
      [19600, "anteilig 01.11.–14.11.2026 (14 von 30 Tagen)"],
      [25600, "anteilig 15.11.–30.11.2026 (16 von 30 Tagen)"],
    ]);
  });

  it("mit Nachtrag 4 × Kellerfenster à 4,50 €: netto 470,00, USt 89,30, brutto 559,30", () => {
    const pauschale = vertragsPositionen({ monat: NOV, vertrag, einsaetze: [] }).positionen;
    const nachtraege = nachtragsPositionen([
      {
        id: "n1",
        einsatzId: "e1",
        datum: "2026-11-20",
        bezeichnung: "Kellerfenster putzen",
        menge: 4,
        einheit: "fenster",
        preisCent: 450,
        ustSatz: 19,
      },
    ]);
    const s = summen([...pauschale, ...nachtraege], false);
    expect(s).toEqual({
      nettoCent: 47000,
      steuerCent: 8930,
      bruttoCent: 55930,
      gruppen: [{ satz: 19, nettoCent: 47000, steuerCent: 8930 }],
    });
  });

  it("voller Monat ohne Wechsel: genau die Pauschale; schon abgerechnet: nichts", () => {
    const { positionen } = vertragsPositionen({ monat: "2026-10", vertrag, einsaetze: [] });
    expect(positionen).toHaveLength(1);
    expect(positionen[0]).toMatchObject({ nettoCent: 42000, beschreibung: "Oktober 2026" });
    expect(
      vertragsPositionen({
        monat: "2026-10",
        vertrag,
        einsaetze: [],
        abgerechnet: {
          einsatzIds: new Set(),
          nachtragIds: new Set(),
          pauschalen: new Set(["v1-1|2026-10"]),
        },
      }).positionen,
    ).toEqual([]);
  });
});

describe("Testkunde 2: Büro Schmidt GmbH – Aufwand nach Stunden und Fenstern, Beginn im Monat", () => {
  const vertrag: VertragFuerLauf = {
    id: "v2",
    titel: "Büroreinigung",
    beginn: "2026-11-04",
    endetAm: null,
    versionen: [
      {
        id: "v2-1",
        version: 1,
        gueltigAb: "2026-11-04",
        abrechnungsart: "aufwand",
        pauschaleCent: null,
        leistungen: [
          {
            id: "l-std",
            bezeichnung: "Unterhaltsreinigung",
            einheit: "stunde",
            preisCent: 3500,
            ustSatz: 19,
          },
          {
            id: "l-fen",
            bezeichnung: "Fensterreinigung",
            einheit: "fenster",
            preisCent: 250,
            ustSatz: 19,
          },
          {
            id: "l-ohne",
            bezeichnung: "Teppichreinigung",
            einheit: "m2",
            preisCent: null,
            ustSatz: 19,
          },
        ],
      },
    ],
  };
  const e = (
    id: string,
    datum: string,
    leistung: string | null,
    minuten: number,
    fenster = 0,
  ): EinsatzFuerLauf => ({
    id,
    datum,
    vertragsleistungId: leistung,
    minuten,
    fenster,
    m2: 0,
  });
  const einsaetze = [
    e("a", "2026-11-04", "l-std", 150),
    e("b", "2026-11-11", "l-std", 145), // 2:25 → zusammen mit den anderen gerundet
    e("c", "2026-11-18", "l-std", 155),
    e("d", "2026-11-25", "l-std", 150),
    e("f", "2026-11-12", "l-fen", 90, 40),
    e("t", "2026-11-13", "l-ohne", 60),
    e("x", "2026-11-14", null, 60),
    e("alt", "2026-10-28", "l-std", 150), // Vormonat
  ];

  it("10 Stunden à 35 € und 40 Fenster à 2,50 €; fehlender Preis und Einsätze ohne Leistung als Hinweis", () => {
    const { positionen, hinweise } = vertragsPositionen({ monat: NOV, vertrag, einsaetze });
    expect(positionen.map((p) => [p.bezeichnung, p.menge, p.einheit, p.nettoCent])).toEqual([
      ["Unterhaltsreinigung", 10, "stunde", 35000],
      ["Fensterreinigung", 40, "fenster", 10000],
    ]);
    expect(positionen[0]!.beschreibung).toBe("4 Einsätze: 04.11., 11.11., 18.11., 25.11.");
    expect(positionen[0]!.quelle).toMatchObject({
      art: "aufwand",
      einsatzIds: ["a", "b", "c", "d"],
    });
    expect(hinweise).toEqual([
      "Teppichreinigung: kein Preis hinterlegt (1 Einsätze nicht berechnet)",
      "1 Einsätze ohne Vertragsleistung (von Hand angelegt) nicht berechnet",
    ]);
    expect(summen(positionen, false)).toMatchObject({
      nettoCent: 45000,
      steuerCent: 8550,
      bruttoCent: 53550,
    });
  });

  it("schon abgerechnete Einsätze erscheinen nicht noch einmal", () => {
    const { positionen } = vertragsPositionen({
      monat: NOV,
      vertrag,
      einsaetze,
      abgerechnet: {
        einsatzIds: new Set(["a", "b", "c", "d"]),
        nachtragIds: new Set(),
        pauschalen: new Set(),
      },
    });
    expect(positionen.map((p) => p.bezeichnung)).toEqual(["Fensterreinigung"]);
  });

  it("Vertragsende im Monat: Abschnitt endet am letzten Leistungstag", () => {
    expect(abschnitte({ ...vertrag, endetAm: "2026-11-20" }, NOV)).toEqual([
      { version: vertrag.versionen[0], von: "2026-11-04", bis: "2026-11-20" },
    ]);
    expect(abschnitte({ ...vertrag, endetAm: "2026-10-31" }, NOV)).toEqual([]);
  });
});

describe("Testkunde 3: Privatkunde Fensterputz – Einzelauftrag beim Kleinunternehmer", () => {
  const vertrag: VertragFuerLauf = {
    id: "v3",
    titel: "Fensterputz Einfamilienhaus",
    beginn: "2026-11-01",
    endetAm: "2026-11-30",
    versionen: [
      {
        id: "v3-1",
        version: 1,
        gueltigAb: "2026-11-01",
        abrechnungsart: "einzelauftrag",
        pauschaleCent: null,
        leistungen: [
          {
            id: "l-p",
            bezeichnung: "Fensterreinigung komplett",
            einheit: "pauschal",
            preisCent: 8900,
            ustSatz: 19,
          },
        ],
      },
    ],
  };

  it("ein Einsatz zum Pauschalpreis, keine Umsatzsteuer, Hinweise nach § 19 und § 14b UStG", () => {
    const { positionen } = vertragsPositionen({
      monat: NOV,
      vertrag,
      einsaetze: [
        {
          id: "p1",
          datum: "2026-11-07",
          vertragsleistungId: "l-p",
          minuten: 120,
          fenster: 18,
          m2: 0,
        },
      ],
    });
    expect(positionen).toHaveLength(1);
    expect(positionen[0]).toMatchObject({ menge: 1, einheit: "einsatz", nettoCent: 8900 });
    expect(summen(positionen, true)).toEqual({
      nettoCent: 8900,
      steuerCent: 0,
      bruttoCent: 8900,
      gruppen: [{ satz: 0, nettoCent: 8900, steuerCent: 0 }],
    });
    expect(pflichthinweise({ kleinunternehmer: true, privatkunde: true })).toEqual([
      KLEINUNTERNEHMER_HINWEIS,
      AUFBEWAHRUNG_HINWEIS,
    ]);
  });
});

describe("Rundung, Steuersätze, Nummern", () => {
  it("Viertelstunden kaufmännisch", () => {
    expect(stundenAusMinuten(67)).toBe(1);
    expect(stundenAusMinuten(68)).toBe(1.25);
    expect(stundenAusMinuten(600)).toBe(10);
  });

  it("Steuer je Satz auf die Summe, nicht je Position", () => {
    const pos = nachtragsPositionen([
      {
        id: "1",
        einsatzId: "e",
        datum: "2026-11-02",
        bezeichnung: "A",
        menge: 1,
        einheit: "stueck",
        preisCent: 105,
        ustSatz: 19,
      },
      {
        id: "2",
        einsatzId: "e",
        datum: "2026-11-02",
        bezeichnung: "B",
        menge: 1,
        einheit: "stueck",
        preisCent: 105,
        ustSatz: 19,
      },
      {
        id: "3",
        einsatzId: "e",
        datum: "2026-11-03",
        bezeichnung: "C",
        menge: 3,
        einheit: "stueck",
        preisCent: 333,
        ustSatz: 7,
      },
    ]);
    // 2 × 1,05 = 2,10 → 19 % = 0,399 → 0,40 (je Position wären es 2 × 0,20 = 0,40, hier gleich);
    // 3 × 3,33 = 9,99 → 7 % = 0,6993 → 0,70
    expect(summen(pos, false).gruppen).toEqual([
      { satz: 19, nettoCent: 210, steuerCent: 40 },
      { satz: 7, nettoCent: 999, steuerCent: 70 },
    ]);
  });

  it("Nummer und Fälligkeit", () => {
    expect(rechnungsnummer("RE-", 2026, 42)).toBe("RE-2026-0042");
    expect(faelligAm("2026-11-30", 14)).toBe("2026-12-14");
  });
});
