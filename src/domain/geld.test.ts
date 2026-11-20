import { describe, expect, it } from "vitest";
import { euroZuCent, formatEuro, parseEuro, rundeCent } from "./geld";

describe("geld", () => {
  it("rundet kaufmännisch", () => {
    expect(rundeCent(0.5)).toBe(1);
    expect(rundeCent(-0.5)).toBe(-1);
    expect(rundeCent(2.4)).toBe(2);
  });

  it("rechnet Euro in Cent ohne Fließkommafehler", () => {
    expect(euroZuCent(0.1 + 0.2)).toBe(30);
    expect(euroZuCent(19.99)).toBe(1999);
  });

  it("formatiert deutsch", () => {
    expect(formatEuro(42000)).toBe("420,00 €");
    expect(formatEuro(123456)).toBe("1.234,56 €");
  });

  it("parst deutsche Eingaben", () => {
    expect(parseEuro("1.234,5")).toBe(123450);
    expect(parseEuro("12,99 €")).toBe(1299);
    expect(parseEuro("abc")).toBeNull();
    expect(parseEuro("1,234")).toBeNull();
  });
});
