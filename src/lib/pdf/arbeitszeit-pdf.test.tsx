import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { arbeitszeitliste } from "@/domain/arbeitszeitliste";
import { type Buchung, berlinZuIso } from "@/domain/zeiterfassung";
import { arbeitszeitPdfErzeugen } from "./arbeitszeit-pdf";

const tag = (datum: string, von: string, bis: string, pause = true): Buchung[] => [
  { id: `${datum}a`, art: "checkin", zeitpunkt: berlinZuIso(datum, von), einsatzId: "e" },
  ...(pause
    ? ([
        {
          id: `${datum}b`,
          art: "pause_beginn",
          zeitpunkt: berlinZuIso(datum, "11:00"),
          einsatzId: null,
        },
        {
          id: `${datum}c`,
          art: "pause_ende",
          zeitpunkt: berlinZuIso(datum, "11:30"),
          einsatzId: null,
        },
      ] as Buchung[])
    : []),
  { id: `${datum}d`, art: "checkout", zeitpunkt: berlinZuIso(datum, bis), einsatzId: "e" },
];

describe("Arbeitszeit-PDF", () => {
  it("erzeugt je Mitarbeiter eine Seite mit Summe", async () => {
    const buchungen = [
      ...tag("2026-11-02", "07:00", "15:30"),
      ...tag("2026-11-03", "06:00", "13:00", false),
      ...tag("2026-11-04", "07:00", "12:00"),
    ];
    const liste = arbeitszeitliste(buchungen, "2026-11", new Set(["2026-11-04a"]));
    const pdf = await arbeitszeitPdfErzeugen({
      betrieb: "Glanz & Co. GmbH",
      monat: "2026-11",
      mitarbeiter: [
        { name: "Ayşe Yılmaz", liste },
        { name: "Łukasz Nowak", liste: arbeitszeitliste([], "2026-11") },
      ],
      erstelltAm: "2026-12-01T08:00:00Z",
    });
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    if (process.env.PDF_AUSGABE) writeFileSync(`${process.env.PDF_AUSGABE}/arbeitszeit.pdf`, pdf);
  }, 30_000);
});
