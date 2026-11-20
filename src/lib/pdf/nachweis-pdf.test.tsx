import { writeFileSync } from "node:fs";
import QRCode from "qrcode";
import { describe, expect, it } from "vitest";
import { berlinZuIso } from "@/domain/zeiterfassung";
import { type NachweisDokument, type NachweisEinsatz, nachweisPdfErzeugen } from "./nachweis-pdf";

async function beispiel(art: "einsatz" | "monat"): Promise<NachweisDokument> {
  const bild = { data: await QRCode.toBuffer("foto"), format: "png" as const };
  const unterschrift = await QRCode.toDataURL("unterschrift");
  const einsatz = (datum: string): NachweisEinsatz => ({
    datum,
    leistung: "Treppenhausreinigung",
    mitarbeiter: "Ayşe",
    von: berlinZuIso(datum, "07:05"),
    bis: berlinZuIso(datum, "08:20"),
    minuten: 75,
    aufgaben: [
      { text: "Treppen kehren", erledigt: true },
      { text: "Geländer abwischen", erledigt: false },
    ],
    positionen: [
      {
        bezeichnung: "Kellerfenster putzen",
        menge: 4,
        dauer: "heute",
        status: "bestaetigt",
        zustimmung: "unterschrift",
        unterschriftName: "Herr Müller",
      },
      {
        bezeichnung: "Mülltonnen rausstellen",
        menge: 1,
        dauer: "dauerhaft",
        status: "vorgeschlagen",
        zustimmung: "muendlich",
        unterschriftName: null,
      },
    ],
    maengel: [{ text: "Haustür schließt schwer", status: "offen" }],
    fotoAnzahl: 3,
    fotos: [bild, bild],
    abnahme: { name: "Herr Müller", am: berlinZuIso(datum, "08:19"), bild: unterschrift },
  });
  return {
    art,
    von: art === "monat" ? "2026-11-01" : "2026-11-20",
    bis: art === "monat" ? "2026-11-30" : "2026-11-20",
    betrieb: {
      name: "Glanz & Co. GmbH",
      strasse: "Königstraße 1",
      plz: "70173",
      ort: "Stuttgart",
      telefon: "0711 123",
      email: "info@glanz.de",
      steuernummer: null,
      ust_id: "DE123456789",
    },
    logo: bild,
    kunde: {
      name: "Hausverwaltung Müller",
      zusatz: null,
      strasse: "Hauptstraße 12",
      plz: "70173",
      ort: "Stuttgart",
      kundennummer: 1001,
    },
    objekt: { name: "Hauptstraße 12", strasse: "Hauptstraße 12", plz: "70173", ort: "Stuttgart" },
    einsaetze:
      art === "monat"
        ? ["2026-11-02", "2026-11-09", "2026-11-16", "2026-11-23"].map(einsatz)
        : [einsatz("2026-11-20")],
    erstelltAm: "2026-11-20T08:30:00Z",
  };
}

describe("Nachweis-PDF", () => {
  it.each(["einsatz", "monat"] as const)(
    "erzeugt einen %snachweis",
    async (art) => {
      const pdf = await nachweisPdfErzeugen(await beispiel(art));
      expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
      expect(pdf.length).toBeGreaterThan(3000);
      // Zum Ansehen: PDF_AUSGABE=ordner npx vitest run src/lib/pdf
      if (process.env.PDF_AUSGABE)
        writeFileSync(`${process.env.PDF_AUSGABE}/nachweis-${art}.pdf`, pdf);
    },
    30_000,
  );

  it("kommt ohne Einsätze, Logo und Fotos aus", async () => {
    const d = await beispiel("monat");
    const pdf = await nachweisPdfErzeugen({ ...d, logo: null, einsaetze: [] });
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  }, 30_000);
});
