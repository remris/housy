import { describe, expect, it } from "vitest";
import { alsWindows1252, datevBuchungsstapel, debitor } from "./datev";

describe("DATEV-Buchungsstapel", () => {
  const csv = datevBuchungsstapel(
    {
      beraternummer: 1234567,
      mandantennummer: 12345,
      kontenrahmen: "skr03",
      von: "2026-11-01",
      bis: "2026-11-30",
      erzeugt: new Date("2026-12-01T08:00:00.000Z"),
      bezeichnung: "Rechnungen November 2026",
    },
    [
      {
        nummer: "RE-2026-0001",
        datum: "2026-11-30",
        storno: false,
        kundennummer: 1001,
        kunde: "Hausverwaltung Müller",
        gruppen: [
          { satz: 19, bruttoCent: 55930 },
          { satz: 7, bruttoCent: 1070 },
        ],
      },
      {
        nummer: "RE-2026-0004",
        datum: "2026-11-30",
        storno: true,
        kundennummer: 1001,
        kunde: "Hausverwaltung Müller",
        gruppen: [{ satz: 19, bruttoCent: 55930 }],
      },
    ],
  );
  const zeilen = csv.trimEnd().split("\r\n");

  it("Kopf: EXTF 700, Buchungsstapel, Berater, Mandant, Zeitraum", () => {
    const kopf = zeilen[0]!.split(";");
    expect(kopf.slice(0, 6)).toEqual([
      '"EXTF"',
      "700",
      "21",
      '"Buchungsstapel"',
      "13",
      "20261201080000000",
    ]);
    expect(kopf.slice(10, 16)).toEqual([
      "1234567",
      "12345",
      "20260101",
      "4",
      "20261101",
      "20261130",
    ]);
    expect(zeilen[1]).toContain('"Umsatz (ohne Soll/Haben-Kz)"');
  });

  it("je Rechnung und Steuersatz eine Buchung, Storno im Haben", () => {
    expect(zeilen.slice(2)).toEqual([
      '559,30;"S";"EUR";;;"";11001;8400;"";3011;"RE-2026-0001";"";;"Hausverwaltung Müller"',
      '10,70;"S";"EUR";;;"";11001;8300;"";3011;"RE-2026-0001";"";;"Hausverwaltung Müller"',
      '559,30;"H";"EUR";;;"";11001;8400;"";3011;"RE-2026-0004";"";;"Storno Hausverwaltung Müller"',
    ]);
    expect(debitor(7)).toBe(10007);
  });

  it("Windows-1252: Umlaute und Euro als ein Byte", () => {
    expect([...alsWindows1252("Müller €")]).toEqual([77, 0xfc, 108, 108, 101, 114, 32, 0x80]);
    expect([...alsWindows1252("Ş")]).toEqual([0x3f]);
  });
});
