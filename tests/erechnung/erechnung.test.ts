import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { pruefeERechnung, xrechnungUbl, zugferdCii } from "@/domain/erechnung";
import { BEISPIELE, behoerde, hausverwaltung, privatKleinunternehmer, storno } from "./beispiele";

const ordner = join(__dirname, "fixtures");

function parse(text: string) {
  const d = new new JSDOM("").window.DOMParser().parseFromString(text, "application/xml");
  const fehler = d.getElementsByTagName("parsererror")[0];
  if (fehler) throw new Error(fehler.textContent ?? "XML-Fehler");
  return d;
}
const wert = (d: Document, tag: string) =>
  [...d.getElementsByTagName(tag)].map((e) => e.textContent);

describe("E-Rechnung", () => {
  it("Vorprüfung: Beispiele vollständig, fehlende Angaben werden genannt", () => {
    for (const doc of Object.values(BEISPIELE)) expect(pruefeERechnung(doc)).toEqual([]);
    expect(
      pruefeERechnung({
        ...hausverwaltung,
        kaeufer: { ...hausverwaltung.kaeufer, email: null },
        verkaeufer: { ...hausverwaltung.verkaeufer, telefon: null, iban: null },
      }),
    ).toEqual([
      "Firmentelefon fehlt (Pflicht in der XRechnung)",
      "IBAN für die Zahlung fehlt",
      "E-Mail des Kunden fehlt (Pflicht in der XRechnung)",
    ]);
  });

  it("XRechnung (UBL): Summen, Steuer, Leitweg-ID, Einheiten", () => {
    const d = parse(xrechnungUbl(behoerde));
    expect(d.documentElement.localName).toBe("Invoice");
    expect(wert(d, "cbc:BuyerReference")).toEqual(["04011000-1234512345-06"]);
    expect(wert(d, "cbc:PayableAmount")).toEqual(["535.50"]);
    expect(wert(d, "cbc:TaxAmount")[0]).toBe("85.50");
    expect(
      [...d.getElementsByTagName("cbc:InvoicedQuantity")].map((e) => e.getAttribute("unitCode")),
    ).toEqual(["HUR", "H87"]);
  });

  it("Umlaute und Sonderzeichen werden maskiert", () => {
    const text = xrechnungUbl(hausverwaltung);
    expect(text).toContain("Glanz &amp; Co. GmbH");
    expect(wert(parse(text), "cbc:RegistrationName")).toContain("Hausverwaltung Müller");
  });

  it("Kleinunternehmer: Kategorie E mit Befreiungsgrund, keine Steuer", () => {
    for (const text of [xrechnungUbl(privatKleinunternehmer), zugferdCii(privatKleinunternehmer)]) {
      expect(text).toContain("Kleinunternehmer gemäß § 19 UStG");
      expect(text).not.toMatch(/>S</);
    }
    const d = parse(zugferdCii(privatKleinunternehmer));
    expect(wert(d, "ram:CategoryCode")).toEqual(["E", "E"]);
    expect(wert(d, "ram:GrandTotalAmount")).toEqual(["89.00"]);
    expect(wert(d, "ram:Content")).toHaveLength(2); // § 19 und Aufbewahrung
  });

  it("Storno als Gutschrift mit Bezug auf die Rechnung", () => {
    const ubl = parse(xrechnungUbl(storno));
    expect(ubl.documentElement.localName).toBe("CreditNote");
    expect(wert(ubl, "cbc:CreditNoteTypeCode")).toEqual(["381"]);
    expect(wert(ubl, "cbc:ID")).toContain("RE-2026-0001");
    const cii = parse(zugferdCii(storno));
    expect(wert(cii, "ram:TypeCode")[0]).toBe("381");
    expect(wert(cii, "ram:IssuerAssignedID")).toEqual(["RE-2026-0001"]);
  });

  it("Fixtures für den KoSIT-Validator sind aktuell", () => {
    for (const [name, doc] of Object.entries(BEISPIELE)) {
      for (const [art, text] of [
        ["ubl", xrechnungUbl(doc)],
        ["cii", zugferdCii(doc)],
      ] as const) {
        const datei = join(ordner, `${name}-${art}.xml`);
        if (process.env.FIXTURES_AKTUALISIEREN || !existsSync(datei)) writeFileSync(datei, text);
        expect(readFileSync(datei, "utf8"), datei).toBe(text);
      }
    }
  });
});
