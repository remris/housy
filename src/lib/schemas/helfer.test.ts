import { describe, expect, it } from "vitest";
import { optEuro, pflichtEuro } from "./helfer";

describe("Euro-Eingabe", () => {
  it("Formular und Server Action prüfen nacheinander: Betrag bleibt gleich", () => {
    const imBrowser = optEuro.parse("12,50");
    expect(imBrowser).toBe(1250);
    expect(optEuro.parse(imBrowser)).toBe(1250);
    expect(pflichtEuro.parse(pflichtEuro.parse("1.234,5 €"))).toBe(123450);
    expect(optEuro.parse(optEuro.parse(""))).toBeNull();
  });
});
