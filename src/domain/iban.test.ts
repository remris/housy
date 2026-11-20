import { describe, expect, it } from "vitest";
import { formatiereIban, pruefeIban } from "./iban";

describe("iban", () => {
  it("akzeptiert gültige IBANs", () => {
    expect(pruefeIban("DE89 3704 0044 0532 0130 00")).toBe(true);
    expect(pruefeIban("de89370400440532013000")).toBe(true);
    expect(pruefeIban("AT611904300234573201")).toBe(true);
  });

  it("lehnt falsche Prüfziffer und Länge ab", () => {
    expect(pruefeIban("DE88370400440532013000")).toBe(false);
    expect(pruefeIban("DE8937040044053201300")).toBe(false);
    expect(pruefeIban("kaputt")).toBe(false);
  });

  it("formatiert in Vierergruppen", () => {
    expect(formatiereIban("DE89370400440532013000")).toBe("DE89 3704 0044 0532 0130 00");
  });
});
