import { describe, expect, it } from "vitest";
import { de } from "./de";
import { WOERTERBUECHER, uebersetzer } from "./index";

describe("Übersetzungen", () => {
  it("alle Sprachen haben dieselben Schlüssel und Platzhalter wie Deutsch", () => {
    const platzhalter = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const [sprache, w] of Object.entries(WOERTERBUECHER)) {
      expect(Object.keys(w).sort(), sprache).toEqual(Object.keys(de).sort());
      for (const [k, text] of Object.entries(de)) {
        const uebersetzt = w[k as keyof typeof de];
        expect(uebersetzt.trim().length, `${sprache}.${k}`).toBeGreaterThan(0);
        expect(platzhalter(uebersetzt), `${sprache}.${k}`).toEqual(platzhalter(text));
      }
    }
  });

  it("setzt Werte ein und fällt auf Deutsch zurück", () => {
    expect(uebersetzer("tr")("hallo", { name: "Ayşe" })).toBe("Merhaba Ayşe");
    expect(uebersetzer("ar")("heute")).toBe("Heute");
    expect(uebersetzer(null)("wartend", { n: 3 })).toBe("Noch zu übertragen: 3");
  });
});
