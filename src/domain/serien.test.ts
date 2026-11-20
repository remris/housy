import { describe, expect, it } from "vitest";
import { plusMonate, wochentag } from "./datum";
import { feiertage, feiertageImZeitraum, ostersonntag } from "./feiertage";
import {
  type IstEinsatz,
  type Leistung,
  type SollEinsatz,
  beschreibeWiederholung,
  gleicheAb,
  planeVertrag,
  termine,
  verschiebe,
} from "./serien";
import { darfWechseln, kuendigenBis, kuendigungZum, periodenende } from "./vertrag";

describe("Datum", () => {
  it("Monatsaddition begrenzt aufs Monatsende", () => {
    expect(plusMonate("2026-01-31", 1)).toBe("2026-02-28");
    expect(plusMonate("2028-01-31", 1)).toBe("2028-02-29");
    expect(plusMonate("2026-11-15", 3)).toBe("2027-02-15");
  });
  it("Wochentag nach ISO", () => {
    expect(wochentag("2026-11-23")).toBe(1); // Montag
    expect(wochentag("2026-11-22")).toBe(7); // Sonntag
  });
});

describe("Feiertage", () => {
  it("Ostersonntag", () => {
    expect(ostersonntag(2026)).toBe("2026-04-05");
    expect(ostersonntag(2027)).toBe("2027-03-28");
    expect(ostersonntag(2024)).toBe("2024-03-31");
  });

  it("Baden-Württemberg 2026", () => {
    const f = [...feiertage(2026, "BW").keys()].sort();
    expect(f).toEqual([
      "2026-01-01",
      "2026-01-06",
      "2026-04-03",
      "2026-04-06",
      "2026-05-01",
      "2026-05-14",
      "2026-05-25",
      "2026-06-04",
      "2026-10-03",
      "2026-11-01",
      "2026-12-25",
      "2026-12-26",
    ]);
  });

  it("Länderunterschiede", () => {
    expect(feiertage(2026, "NI").has("2026-10-31")).toBe(true);
    expect(feiertage(2026, "BW").has("2026-10-31")).toBe(false);
    expect(feiertage(2026, "SN").get("2026-11-18")).toBe("Buß- und Bettag");
    expect(feiertage(2026, "BE").has("2026-03-08")).toBe(true);
  });

  it("über Jahresgrenzen", () => {
    const f = feiertageImZeitraum("2026-12-20", "2027-01-10", "BW");
    expect([...f.keys()].sort()).toEqual(["2026-12-25", "2026-12-26", "2027-01-01", "2027-01-06"]);
  });
});

const leistung = (teil: Partial<Leistung> & Pick<Leistung, "wiederholung">): Leistung => ({
  id: "l1",
  vorlageId: "v1",
  feiertagRegel: "auslassen",
  sollzeitMinuten: 60,
  ...teil,
});

describe("Termine", () => {
  it("Mo/Mi/Fr wöchentlich", () => {
    const t = termine(
      { frequenz: "woechentlich", intervall: 1, wochentage: [1, 3, 5], anker: "2026-11-23" },
      "2026-11-23",
      "2026-12-06",
    );
    expect(t).toEqual([
      "2026-11-23",
      "2026-11-25",
      "2026-11-27",
      "2026-11-30",
      "2026-12-02",
      "2026-12-04",
    ]);
  });

  it("alle 6 Wochen am Dienstag ab Anker", () => {
    const t = termine(
      { frequenz: "woechentlich", intervall: 6, wochentage: [2], anker: "2026-11-24" },
      "2026-11-01",
      "2027-03-31",
    );
    expect(t).toEqual(["2026-11-24", "2027-01-05", "2027-02-16", "2027-03-30"]);
  });

  it("monatlich am 31. fällt auf Monatsende", () => {
    const t = termine(
      { frequenz: "monatlich", intervall: 1, monatstag: 31, anker: "2027-01-01" },
      "2027-01-01",
      "2027-04-30",
    );
    expect(t).toEqual(["2027-01-31", "2027-02-28", "2027-03-31", "2027-04-30"]);
  });

  it("täglich alle 2 Tage und einmalig", () => {
    expect(
      termine(
        { frequenz: "taeglich", intervall: 2, anker: "2026-11-20" },
        "2026-11-21",
        "2026-11-26",
      ),
    ).toEqual(["2026-11-22", "2026-11-24", "2026-11-26"]);
    expect(
      termine(
        { frequenz: "einmalig", intervall: 1, anker: "2026-12-01" },
        "2026-11-01",
        "2026-12-31",
      ),
    ).toEqual(["2026-12-01"]);
  });

  it("beschreibt Wiederholungen", () => {
    expect(
      beschreibeWiederholung({ frequenz: "woechentlich", intervall: 1, wochentage: [5, 1, 3] }),
    ).toBe("wöchentlich Mo, Mi, Fr");
    expect(
      beschreibeWiederholung({ frequenz: "woechentlich", intervall: 8, wochentage: [2] }),
    ).toBe("alle 8 Wochen Di");
    expect(beschreibeWiederholung({ frequenz: "monatlich", intervall: 3, monatstag: 15 })).toBe(
      "alle 3 Monate am 15.",
    );
  });
});

describe("Feiertagsregeln", () => {
  const f = feiertage(2026, "BW");
  const w = {
    frequenz: "woechentlich" as const,
    intervall: 1,
    wochentage: [1],
    anker: "2026-01-05",
  };

  it("Ostermontag auslassen", () => {
    expect(verschiebe("2026-04-06", leistung({ wiederholung: w }), f)).toBeNull();
  });

  it("Ostermontag auf Dienstag verschieben", () => {
    expect(
      verschiebe(
        "2026-04-06",
        leistung({ wiederholung: w, feiertagRegel: "naechster_werktag" }),
        f,
      ),
    ).toBe("2026-04-07");
  });

  it("Verschiebung respektiert Reinigungsfenster Mo–Fr (Karfreitag → Montag ist Ostermontag → Dienstag)", () => {
    expect(
      verschiebe(
        "2026-04-03",
        leistung({
          wiederholung: w,
          feiertagRegel: "naechster_werktag",
          erlaubteWochentage: [1, 2, 3, 4, 5],
        }),
        f,
      ),
    ).toBe("2026-04-07");
  });

  it("ignorieren plant auch am Feiertag", () => {
    expect(
      verschiebe("2026-04-06", leistung({ wiederholung: w, feiertagRegel: "ignorieren" }), f),
    ).toBe("2026-04-06");
  });
});

describe("planeVertrag", () => {
  const feiertageBW = feiertageImZeitraum("2026-01-01", "2027-12-31", "BW");
  // Konzept: Treppenhaus wöchentlich (Mo), Fenster alle 8 Wochen (Di)
  const v1 = {
    id: "v1",
    gueltigAb: "2026-11-02",
    leistungen: [
      leistung({
        id: "treppe",
        vorlageId: "treppenhaus",
        wiederholung: {
          frequenz: "woechentlich",
          intervall: 1,
          wochentage: [1],
          anker: "2026-11-02",
        },
        zeitfensterVon: "07:00",
        zeitfensterBis: "10:00",
        sollzeitMinuten: 45,
      }),
      leistung({
        id: "fenster",
        vorlageId: "fenster",
        wiederholung: {
          frequenz: "woechentlich",
          intervall: 8,
          wochentage: [2],
          anker: "2026-11-03",
        },
        feiertagRegel: "naechster_werktag",
        sollzeitMinuten: 120,
      }),
    ],
  };

  it("erzeugt 8 Wochen Einsätze im Zeitfenster", () => {
    const e = planeVertrag(
      { beginn: "2026-11-02", ende: null, versionen: [v1] },
      "2026-11-23",
      "2027-01-17",
      feiertageBW,
    );
    const treppe = e.filter((x) => x.vorlageId === "treppenhaus").map((x) => x.datum);
    expect(treppe).toEqual([
      "2026-11-23",
      "2026-11-30",
      "2026-12-07",
      "2026-12-14",
      "2026-12-21",
      "2026-12-28",
      "2027-01-04",
      "2027-01-11",
    ]);
    expect(e[0]).toMatchObject({
      zeitfensterVon: "07:00",
      zeitfensterBis: "10:00",
      sollzeitMinuten: 45,
    });
    // Fenster: 03.11. + 8 Wochen = 29.12.
    expect(e.filter((x) => x.vorlageId === "fenster").map((x) => x.datum)).toEqual(["2026-12-29"]);
  });

  it("Feiertag am Montag wird ausgelassen (Ostermontag 2027)", () => {
    const e = planeVertrag(
      { beginn: "2026-11-02", ende: null, versionen: [v1] },
      "2027-03-22",
      "2027-04-04",
      feiertageBW,
    );
    // Ostermontag 2027 = 29.03.
    expect(e.filter((x) => x.vorlageId === "treppenhaus").map((x) => x.datum)).toEqual([
      "2027-03-22",
    ]);
  });

  it("endet mit Vertragsende", () => {
    const e = planeVertrag(
      { beginn: "2026-11-02", ende: "2026-11-30", versionen: [v1] },
      "2026-11-01",
      "2026-12-31",
      feiertageBW,
    );
    expect(e.at(-1)!.datum).toBe("2026-11-30");
  });

  it("Version 2 ab Stichtag ändert nur die Zukunft (Kellerfenster dauerhaft dazu)", () => {
    const v2 = {
      id: "v2",
      gueltigAb: "2026-12-15",
      leistungen: [
        ...v1.leistungen.map((l) => ({ ...l, id: `${l.id}-2` })),
        leistung({
          id: "keller",
          vorlageId: "kellerfenster",
          wiederholung: {
            frequenz: "woechentlich",
            intervall: 4,
            wochentage: [3],
            anker: "2026-12-16",
          },
          sollzeitMinuten: 30,
        }),
      ],
    };
    const e = planeVertrag(
      { beginn: "2026-11-02", ende: null, versionen: [v2, v1] },
      "2026-11-23",
      "2027-01-17",
      feiertageBW,
    );
    const vorher = e.filter((x) => x.datum < "2026-12-15");
    const nachher = e.filter((x) => x.datum >= "2026-12-15");
    expect(vorher.every((x) => x.versionId === "v1")).toBe(true);
    expect(nachher.every((x) => x.versionId === "v2")).toBe(true);
    expect(e.filter((x) => x.vorlageId === "kellerfenster").map((x) => x.datum)).toEqual([
      "2026-12-16",
      "2027-01-13",
    ]);
  });
});

describe("gleicheAb", () => {
  const soll = (datum: string, teil: Partial<SollEinsatz> = {}): SollEinsatz => ({
    datum,
    versionId: "v2",
    leistungId: "l2",
    vorlageId: "v",
    zeitfensterVon: null,
    zeitfensterBis: null,
    sollzeitMinuten: 60,
    verschobenVon: null,
    ...teil,
  });
  const ist = (
    id: string,
    datum: string,
    status = "zugewiesen",
    teil: Partial<IstEinsatz> = {},
  ): IstEinsatz => ({
    id,
    datum,
    vorlageId: "v",
    leistungId: "l1",
    status,
    zeitfensterVon: null,
    zeitfensterBis: null,
    sollzeitMinuten: 60,
    ...teil,
  });

  it("Vergangenes bleibt, Zukunft wird angepasst, Zuweisungen bleiben erhalten", () => {
    const a = gleicheAb(
      [soll("2026-12-01"), soll("2026-12-08"), soll("2026-12-22")],
      [
        ist("alt", "2026-11-24", "erledigt"),
        ist("vor-stichtag", "2026-12-01"),
        ist("bleibt", "2026-12-08"),
        ist("weg", "2026-12-15"),
        ist("begonnen", "2026-12-29", "begonnen"),
      ],
      "2026-12-05",
    );
    expect(a.anlegen.map((s) => s.datum)).toEqual(["2026-12-22"]);
    expect(a.aktualisieren.map((x) => x.id)).toEqual(["bleibt"]); // neue Leistung l2
    expect(a.loeschen).toEqual(["weg"]);
  });

  it("idempotent: zweiter Lauf ändert nichts", () => {
    const s = [soll("2026-12-08")];
    const a = gleicheAb(s, [ist("x", "2026-12-08", "geplant", { leistungId: "l2" })], "2026-12-01");
    expect(a).toEqual({ anlegen: [], aktualisieren: [], loeschen: [] });
  });

  it("entfernt Dubletten", () => {
    const a = gleicheAb(
      [soll("2026-12-08")],
      [
        ist("a", "2026-12-08", "geplant", { leistungId: "l2" }),
        ist("b", "2026-12-08", "geplant", { leistungId: "l2" }),
      ],
      "2026-12-01",
    );
    expect(a.loeschen).toEqual(["b"]);
  });
});

describe("Laufzeit und Kündigung", () => {
  // Konzept: 12 Monate, 3 Monate zum Laufzeitende, verlängert sich um 12 Monate
  const l = {
    beginn: "2026-01-01",
    laufzeitMonate: 12,
    verlaengerungMonate: 12,
    kuendigungsfristMonate: 3,
    fristZum: "laufzeitende" as const,
  };

  it("Periodenende mit Verlängerung", () => {
    expect(periodenende(l, "2026-06-01")).toBe("2026-12-31");
    expect(periodenende(l, "2027-03-01")).toBe("2027-12-31");
    expect(periodenende({ ...l, verlaengerungMonate: 0 }, "2027-03-01")).toBe("2026-12-31");
    expect(periodenende({ ...l, laufzeitMonate: 0 }, "2027-03-01")).toBeNull();
  });

  it("rechtzeitig gekündigt endet zum Laufzeitende", () => {
    expect(kuendigungZum(l, "2026-09-30")).toBe("2026-12-31");
    expect(kuendigenBis(l, "2026-06-01")).toBe("2026-10-01");
  });

  it("zu spät gekündigt verlängert sich um eine Periode", () => {
    expect(kuendigungZum(l, "2026-10-02")).toBe("2027-12-31");
  });

  it("unbefristet: Frist ab Eingang zum Monatsende", () => {
    expect(kuendigungZum({ ...l, laufzeitMonate: 0 }, "2026-11-20")).toBe("2027-02-28");
  });

  it("zum Monatsende, aber nicht vor Mindestlaufzeit", () => {
    expect(kuendigungZum({ ...l, fristZum: "monatsende" }, "2026-03-10")).toBe("2026-12-31");
    expect(kuendigungZum({ ...l, fristZum: "monatsende" }, "2027-03-10")).toBe("2027-06-30");
  });

  it("Status-Workflow", () => {
    expect(darfWechseln("entwurf", "aktiv")).toBe(true);
    expect(darfWechseln("entwurf", "gekuendigt")).toBe(false);
    expect(darfWechseln("beendet", "aktiv")).toBe(false);
  });
});
