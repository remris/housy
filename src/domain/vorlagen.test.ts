import { describe, expect, it } from "vitest";
import { BRANCHENPAKETE, kombiniere, pruefePaket, type Branche } from "./branchenpakete";
import { bedarfJeEinsatz, formatMenge, sollzeit } from "./vorlagen";

describe("sollzeit", () => {
  it("Grundzeit plus Fläche und Fenster, auf 5 Minuten gerundet", () => {
    expect(
      sollzeit({ sollzeitMinuten: 15, minutenPro100m2: 20 }, { flaecheM2: 240, fenster: 0 }),
    ).toBe(65);
    expect(
      sollzeit({ sollzeitMinuten: 10, minutenProFenster: 6 }, { flaecheM2: 0, fenster: 24 }),
    ).toBe(155);
    expect(sollzeit({ sollzeitMinuten: 45 }, { flaecheM2: 999, fenster: 99 })).toBe(45);
  });
});

describe("bedarfJeEinsatz", () => {
  it("Konzept-Beispiel: 0,5 l Allzweckreiniger und 3 Müllbeutel je Einsatz", () => {
    const b = bedarfJeEinsatz(
      [
        { artikelId: "reiniger", menge: 0.5, bezug: "einsatz" },
        { artikelId: "beutel", menge: 3, bezug: "einsatz" },
      ],
      { flaecheM2: 300, fenster: 0 },
    );
    expect(Object.fromEntries(b)).toEqual({ reiniger: 0.5, beutel: 3 });
  });

  it("rechnet je Fenster, je m² und je Stunde und summiert gleiche Artikel", () => {
    const b = bedarfJeEinsatz(
      [
        { artikelId: "konzentrat", menge: 0.01, bezug: "fenster" },
        { artikelId: "konzentrat", menge: 0.1, bezug: "einsatz" },
        { artikelId: "gummi", menge: 1, bezug: "fenster" },
        { artikelId: "grundreiniger", menge: 0.05, bezug: "m2" },
        { artikelId: "handschuhe", menge: 1, bezug: "stunde" },
      ],
      { flaecheM2: 120, fenster: 24 },
      { sollzeitMinuten: 90 },
    );
    expect(b.get("konzentrat")).toBe(0.34);
    expect(b.get("gummi")).toBe(24);
    expect(b.get("grundreiniger")).toBe(6);
    expect(b.get("handschuhe")).toBe(1.5);
  });

  it("lässt Bedarf je Fenster weg, wenn das Objekt keine Fenster hat", () => {
    const b = bedarfJeEinsatz([{ artikelId: "gummi", menge: 1, bezug: "fenster" }], {
      flaecheM2: 0,
      fenster: 0,
    });
    expect(b.size).toBe(0);
  });

  it("Reichweite Konzept: 10-l-Kanister bei 0,5 l je Einsatz = 20 Einsätze", () => {
    const jeEinsatz = bedarfJeEinsatz([{ artikelId: "r", menge: 0.5, bezug: "einsatz" }], {
      flaecheM2: 0,
      fenster: 0,
    }).get("r")!;
    expect(10 / jeEinsatz).toBe(20);
  });

  it("formatiert Mengen deutsch", () => {
    expect(formatMenge(0.5, "l")).toBe("0,5 l");
    expect(formatMenge(1500, "Stk")).toBe("1.500 Stk");
  });
});

describe("Branchenpakete", () => {
  for (const b of Object.keys(BRANCHENPAKETE) as Branche[]) {
    it(`${b} ist konsistent`, () => {
      expect(pruefePaket(BRANCHENPAKETE[b].paket)).toEqual([]);
    });
  }

  it("kombiniert Pakete ohne doppelte Artikel", () => {
    const p = kombiniere(["gebaeudereinigung", "fensterreinigung", "hausmeister"]);
    const namen = p.artikel.map((a) => a.name);
    expect(new Set(namen).size).toBe(namen.length);
    expect(namen).toContain("Abziehergummi");
    expect(namen.filter((n) => n === "Mikrofasertuch")).toHaveLength(1);
    expect(pruefePaket(p)).toEqual([]);
  });

  it("Konzept-Werte: Abziehergummi 500 Fenster, Leiter jährlich prüfen", () => {
    const p = BRANCHENPAKETE.fensterreinigung.paket;
    const gummi = p.artikel.find((a) => a.name === "Abziehergummi")!;
    expect(gummi).toMatchObject({ lebensdauer: 500, lebensdauer_einheit: "fenster" });
    expect(p.artikel.find((a) => a.name === "Leiter")!.pruefintervall_monate).toBe(12);
  });

  it("erkennt Inkonsistenzen", () => {
    expect(
      pruefePaket({
        artikel: [
          {
            name: "Gummi",
            art: "verschleiss",
            einheit: "Stk",
            lebensdauer: 500,
            lebensdauer_einheit: "fenster",
          },
        ],
        vorlagen: [
          {
            name: "X",
            branche: "fensterreinigung",
            sollzeit_minuten: 10,
            taetigkeiten: [],
            bedarf: [
              { artikel: "Gummi", menge: 1, bezug: "einsatz" },
              { artikel: "Fehlt", menge: 1, bezug: "einsatz" },
            ],
          },
        ],
        preise: [{ name: "P", einheit: "fenster", preis_cent: 1, vorlage: "Y" }],
      }),
    ).toEqual([
      "X: keine Tätigkeiten",
      "X: Gummi zählt in fenster, Bedarf je einsatz",
      "X: Artikel Fehlt fehlt",
      "Preis P: Vorlage Y fehlt",
    ]);
  });
});
