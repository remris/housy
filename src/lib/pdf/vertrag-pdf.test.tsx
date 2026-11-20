import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { type VertragDokument, vertragPdfErzeugen } from "./vertrag-pdf";

const beispiel: VertragDokument = {
  vertrag: {
    vertragsnummer: 7,
    titel: "Treppenhaus und Fenster",
    status: "entwurf",
    beginn: "2026-12-01",
    laufzeit_monate: 12,
    verlaengerung_monate: 12,
    kuendigungsfrist_monate: 3,
    frist_zum: "laufzeitende",
    gekuendigt_am: null,
    endet_am: null,
    notiz: "Schlüssel beim Hausmeister.",
    unterschrieben_am: null,
    unterschrift_name: null,
  },
  unterschrift_bild: null,
  betrieb: {
    name: "Glanz & Co. GmbH",
    strasse: "Königstraße 1",
    plz: "70173",
    ort: "Stuttgart",
    telefon: "0711 123",
    email: "info@glanz.de",
    website: null,
    steuernummer: "99/123/45678",
    ust_id: "DE123456789",
    logo_pfad: null,
    vertragsbedingungen: "Es gelten unsere AGB.",
  },
  kunde: {
    name: "Hausverwaltung Müller",
    zusatz: null,
    strasse: "Hauptstraße 12",
    plz: "70173",
    ort: "Stuttgart",
    kundennummer: 1001,
  },
  objekt: { name: "Hauptstraße 12", strasse: "Hauptstraße 12", plz: "70173", ort: "Stuttgart" },
  versionen: [
    {
      version: 1,
      gueltig_ab: "2026-12-01",
      abrechnungsart: "pauschale",
      pauschale_cent: 42000,
      leistungen: [
        {
          bezeichnung: "Treppenhausreinigung",
          vorlage: "Treppenhausreinigung",
          frequenz: "woechentlich",
          intervall: 1,
          wochentage: [1],
          monatstag: null,
          zeitfenster_von: "07:00:00",
          zeitfenster_bis: "10:00:00",
          feiertag_regel: "auslassen",
          preis_cent: 6500,
          preis_einheit: "einsatz",
          taetigkeiten: ["Treppen kehren", "Treppen nass wischen"],
        },
      ],
    },
  ],
};

describe("Vertrags-PDF", () => {
  it("erzeugt ein PDF", async () => {
    const pdf = await vertragPdfErzeugen(beispiel, null);
    expect(Buffer.from(pdf).subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(2000);
    // Zum Ansehen: PDF_AUSGABE=pfad/datei.pdf npx vitest run src/lib/pdf
    if (process.env.PDF_AUSGABE) writeFileSync(process.env.PDF_AUSGABE, pdf);
  }, 30_000);
});
