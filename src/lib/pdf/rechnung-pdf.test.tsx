import { writeFileSync } from "node:fs";
import { PDFDict, PDFDocument, PDFHexString, PDFName } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { zugferdCii } from "@/domain/erechnung";
import { BEISPIELE } from "../../../tests/erechnung/beispiele";
import { rechnungPdfErzeugen } from "./rechnung-pdf";
import { ZUGFERD_DATEI, zugferdEinbetten } from "./zugferd";

describe("Rechnungs-PDF und ZUGFeRD", () => {
  it.each(Object.entries(BEISPIELE))(
    "%s: PDF mit eingebettetem XML",
    async (name, doc) => {
      const pdf = await rechnungPdfErzeugen({
        doc,
        logo: null,
        entwurf: false,
        fusstext: "Vielen Dank für Ihren Auftrag.",
        bank: "Commerzbank",
      });
      const xml = zugferdCii(doc);
      const zugferd = await zugferdEinbetten(pdf, xml, {
        titel: `Rechnung ${doc.nummer}`,
        autor: doc.verkaeufer.name,
        nummer: doc.nummer,
        datum: new Date("2026-11-30T10:00:00Z"),
      });
      if (process.env.PDF_AUSGABE)
        writeFileSync(`${process.env.PDF_AUSGABE}/rechnung-${name}.pdf`, zugferd);

      const geladen = await PDFDocument.load(zugferd);
      const katalog = geladen.catalog;
      expect(katalog.get(PDFName.of("Metadata"))).toBeDefined();
      expect(katalog.get(PDFName.of("OutputIntents"))).toBeDefined();
      const namen = katalog.lookup(PDFName.of("Names"), PDFDict);
      const dateien = namen.lookup(PDFName.of("EmbeddedFiles"), PDFDict);
      expect(dateien.toString()).toContain(PDFHexString.fromText(ZUGFERD_DATEI).toString());
      expect(katalog.get(PDFName.of("AF"))).toBeDefined();
      expect(new TextDecoder("latin1").decode(zugferd)).toContain("pdfaid:part>3");
    },
    30_000,
  );

  it("Entwurf trägt das Wasserzeichen", async () => {
    const pdf = await rechnungPdfErzeugen({
      doc: BEISPIELE.hausverwaltung,
      logo: null,
      entwurf: true,
      fusstext: null,
      bank: null,
    });
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  }, 30_000);
});
