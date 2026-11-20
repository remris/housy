import { describe, expect, it } from "vitest";
import { dekodiere, erkenneTrennzeichen, parseCsv } from "./csv";
import { findeKunde, importiereKunden, importiereObjekte } from "./import";

describe("parseCsv", () => {
  it("liest Excel-CSV mit Semikolon, BOM, CRLF und Anführungszeichen", () => {
    const t = parseCsv('﻿Name;Ort\r\n"Müller; Söhne";"Stuttgart"\r\n"Er sagte ""Hallo""";Ulm\r\n');
    expect(t.kopf).toEqual(["Name", "Ort"]);
    expect(t.zeilen).toEqual([
      ["Müller; Söhne", "Stuttgart"],
      ['Er sagte "Hallo"', "Ulm"],
    ]);
  });

  it("erkennt Komma und Tab", () => {
    expect(erkenneTrennzeichen("a,b,c\n1,2,3")).toBe(",");
    expect(erkenneTrennzeichen("a\tb\n1\t2")).toBe("\t");
    expect(erkenneTrennzeichen('"a;b",c,d')).toBe(",");
  });

  it("erlaubt Zeilenumbrüche in Feldern und ignoriert Leerzeilen", () => {
    const t = parseCsv('Name;Notiz\nA;"Zeile 1\nZeile 2"\n;\n\nB;x');
    expect(t.zeilen).toEqual([
      ["A", "Zeile 1\nZeile 2"],
      ["B", "x"],
    ]);
  });

  it("dekodiert Windows-1252 als Rückfall", () => {
    const bytes = new Uint8Array([0x4d, 0xfc, 0x6c, 0x6c, 0x65, 0x72]); // "Müller" in cp1252
    expect(dekodiere(bytes)).toBe("Müller");
    expect(dekodiere(new TextEncoder().encode("Straße"))).toBe("Straße");
  });
});

describe("importiereKunden", () => {
  const csv = parseCsv(
    [
      "Kd-Nr.;Firma;Kundentyp;Straße;PLZ;Ort;E-Mail;Telefon",
      "1001;Hausverwaltung Müller;Hausverwaltung;Hauptstraße 12;70173;Stuttgart;INFO@mueller.de;0711 123",
      ";Familie Schmidt;Privat;Gartenweg 3;;72070 Tübingen;;",
      "1002;;Firma;;;;;",
      "abc;Kaputt GmbH;Firma;;7017;;keine-mail;",
      "1001;Doppelt AG;;;;;;",
    ].join("\n"),
  );
  const e = importiereKunden(csv);

  it("erkennt Spalten über Synonyme", () => {
    expect(e.fehlendePflichtspalten).toEqual([]);
    expect(e.erkannteSpalten).toMatchObject({
      "Kd-Nr.": "kundennummer",
      Firma: "name",
      Kundentyp: "typ",
      Straße: "strasse",
    });
  });

  it("übernimmt gültige Zeilen", () => {
    expect(e.gueltig).toHaveLength(2);
    expect(e.gueltig[0]!.daten).toMatchObject({
      kundennummer: 1001,
      typ: "verwaltung",
      email: "info@mueller.de",
      plz: "70173",
    });
    expect(e.gueltig[1]!.daten).toMatchObject({
      kundennummer: null,
      typ: "privat",
      plz: "72070",
      ort: "Tübingen",
    });
  });

  it("meldet Fehler mit Zeilennummer", () => {
    expect(e.fehlerhaft.map((f) => f.zeile)).toEqual([4, 5, 6]);
    expect(e.fehlerhaft[0]!.fehler).toContain("Name fehlt");
    expect(e.fehlerhaft[1]!.fehler).toEqual([
      'Kundennummer "abc" ist keine Zahl',
      'PLZ "7017" ungültig',
      'E-Mail "keine-mail" ungültig',
    ]);
    expect(e.fehlerhaft[2]!.fehler).toEqual(["Kundennummer 1001 doppelt in der Datei"]);
  });

  it("meldet fehlende Pflichtspalte", () => {
    const r = importiereKunden(parseCsv("Ort;PLZ\nUlm;89073"));
    expect(r.fehlendePflichtspalten).toEqual(["name"]);
  });

  it("setzt öffentlich bei Leitweg-ID", () => {
    const r = importiereKunden(parseCsv("Name;Leitweg-ID\nStadt Ulm;08421000-12345-06"));
    expect(r.gueltig[0]!.daten.typ).toBe("oeffentlich");
  });
});

describe("importiereObjekte", () => {
  it("nutzt Straße als Objektname, wenn keiner angegeben ist", () => {
    const r = importiereObjekte(
      parseCsv(
        "Kundennummer;Straße;PLZ;Ort;Zugang\n1001;Hauptstraße 12;70173;Stuttgart;Schlüssel im Tresor\n;x;;;",
      ),
    );
    expect(r.gueltig[0]!.daten).toMatchObject({
      kunde: "1001",
      name: "Hauptstraße 12",
      zugangshinweise: "Schlüssel im Tresor",
    });
    expect(r.fehlerhaft[0]!.fehler).toEqual(["Kunde fehlt"]);
  });
});

describe("findeKunde", () => {
  const kunden = [
    { id: "a", kundennummer: 1001, name: "Müller GmbH" },
    { id: "b", kundennummer: 1002, name: "Schmidt" },
    { id: "c", kundennummer: 1003, name: "Schmidt" },
  ];
  it("findet per Nummer, dann per Name", () => {
    expect(findeKunde("1001", kunden)).toEqual({ id: "a" });
    expect(findeKunde("müller gmbh", kunden)).toEqual({ id: "a" });
  });
  it("meldet mehrdeutige und unbekannte Kunden", () => {
    expect(findeKunde("Schmidt", kunden)).toHaveProperty("fehler");
    expect(findeKunde("Meier", kunden)).toHaveProperty("fehler");
  });
});
