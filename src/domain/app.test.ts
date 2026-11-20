import { describe, expect, it } from "vitest";
import {
  type AppAktion,
  type AppEinsatz,
  type Tagesdaten,
  fehltVorCheckout,
  istEndgueltig,
  mitAusstehenden,
  navigationsLink,
  packliste,
  phase,
  qrPasst,
  wartezeitMs,
  wendeAn,
} from "./app";
import { mindestpause, werteTagAus, type Buchung } from "./zeiterfassung";

const t = (hhmm: string) => `2026-11-23T${hhmm}:00+01:00`;
const b = (
  id: string,
  art: Buchung["art"],
  zeit: string,
  einsatzId: string | null = null,
): Buchung => ({
  id,
  art,
  zeitpunkt: t(zeit),
  einsatzId,
});

describe("Zeiterfassung", () => {
  it("normaler Tag mit zwei Einsätzen und Pause", () => {
    const r = werteTagAus([
      b("1", "checkin", "07:00", "a"),
      b("2", "checkout", "09:00", "a"),
      b("3", "pause_beginn", "09:10"),
      b("4", "pause_ende", "09:40"),
      b("5", "checkin", "10:00", "b"),
      b("6", "checkout", "14:30", "b"),
    ]);
    expect(r.anwesenheitMinuten).toBe(450);
    expect(r.pauseMinuten).toBe(30);
    expect(r.arbeitMinuten).toBe(420);
    expect(r.einsaetze.map((e) => [e.einsatzId, e.minuten])).toEqual([
      ["a", 120],
      ["b", 270],
    ]);
    expect(r.hinweise).toEqual([]);
  });

  it("über 6 Stunden ohne ausreichende Pause", () => {
    const r = werteTagAus([
      b("1", "checkin", "06:00", "a"),
      b("2", "pause_beginn", "09:00"),
      b("3", "pause_ende", "09:10"), // 10 min zählen nicht (unter 15)
      b("4", "checkout", "13:00", "a"),
    ]);
    expect(r.arbeitMinuten).toBe(410);
    expect(r.hinweise).toContain("pause_zu_kurz");
    expect(mindestpause(6 * 60)).toBe(0);
    expect(mindestpause(6 * 60 + 1)).toBe(30);
    expect(mindestpause(9 * 60 + 1)).toBe(45);
  });

  it("vergessener Check-out wird beim nächsten Check-in geschlossen", () => {
    const r = werteTagAus([
      b("1", "checkin", "07:00", "a"),
      b("2", "checkin", "08:00", "b"),
      b("3", "checkout", "09:00", "b"),
    ]);
    expect(r.hinweise).toContain("checkout_fehlt");
    expect(r.einsaetze.map((e) => e.minuten)).toEqual([60, 60]);
  });

  it("laufender Einsatz und laufende Pause bis jetzt", () => {
    const jetzt = new Date(t("08:30"));
    const r = werteTagAus([b("1", "checkin", "07:00", "a")], jetzt);
    expect(r.laufend).toEqual({ art: "einsatz", einsatzId: "a" });
    expect(r.arbeitMinuten).toBe(90);
    expect(r.hinweise).toEqual([]);
    const p = werteTagAus(
      [b("1", "checkin", "07:00", "a"), b("2", "pause_beginn", "08:00")],
      jetzt,
    );
    expect(p.laufend).toEqual({ art: "pause" });
    expect(p.pauseMinuten).toBe(30);
    expect(p.arbeitMinuten).toBe(60);
  });

  it("stornierte Buchungen zählen nicht, Reihenfolge egal", () => {
    const r = werteTagAus([
      b("2", "checkout", "08:00", "a"),
      { ...b("x", "checkout", "12:00", "a"), storniert: true },
      b("1", "checkin", "07:00", "a"),
    ]);
    expect(r.arbeitMinuten).toBe(60);
    expect(r.hinweise).toEqual([]);
  });

  it("über 10 Stunden", () => {
    const r = werteTagAus([
      b("1", "checkin", "05:00", "a"),
      b("2", "pause_beginn", "09:00"),
      b("3", "pause_ende", "09:45"),
      b("4", "checkout", "16:00", "a"),
    ]);
    expect(r.hinweise).toEqual(["ueber_10_stunden"]);
  });
});

const einsatz = (p: Partial<AppEinsatz> = {}): AppEinsatz => ({
  id: "e1",
  datum: "2026-11-23",
  status: "zugewiesen",
  reihenfolge: 0,
  geplanterBeginn: "07:20",
  zeitfensterVon: "07:00",
  zeitfensterBis: "10:00",
  sollzeitMinuten: 60,
  vorlage: "Treppenhaus",
  objekt: {
    id: "o1",
    name: "Hauptstr. 12",
    strasse: "Hauptstr. 12",
    plz: "70173",
    ort: "Stuttgart",
    lat: 48.7,
    lng: 9.1,
    zugangshinweise: "Code 1234",
    qrKennung: "3f1c0f7e-0000-4000-8000-000000000001",
    fenster: [{ id: "f1", bezeichnung: "EG", anzahl: 10 }],
  },
  aufgaben: [
    {
      taetigkeitId: "t1",
      text: "Treppen wischen",
      fotoPflicht: false,
      erledigt: false,
      geaendertAm: null,
    },
    {
      taetigkeitId: "t2",
      text: "Foto Eingang",
      fotoPflicht: true,
      erledigt: false,
      geaendertAm: null,
    },
  ],
  notiz: null,
  notizAm: null,
  positionen: [],
  meldungen: [],
  fotos: 0,
  ...p,
});

const tag = (e = einsatz()): Tagesdaten => ({
  geladenAm: t("06:00"),
  datum: "2026-11-23",
  betriebId: "b",
  mitgliedId: "m",
  einsaetze: [e],
  buchungen: [],
  preisliste: [{ id: "p1", name: "Fenster Keller", einheit: "fenster", preisCent: 450 }],
  artikel: [],
  packliste: [],
});

describe("Offline-Aktionen", () => {
  it("Check-in und Check-out ändern den Status, doppelte Buchung wird ignoriert", () => {
    const ein: AppAktion = {
      typ: "zeit",
      id: "z1",
      art: "checkin",
      zeitpunkt: t("07:05"),
      einsatzId: "e1",
      quelle: "qr",
    };
    let d = wendeAn(wendeAn(tag(), ein), ein);
    expect(d.buchungen).toHaveLength(1);
    expect(phase(d.einsaetze[0]!)).toBe("laeuft");
    d = wendeAn(d, { ...ein, id: "z2", art: "checkout", zeitpunkt: t("08:10") });
    expect(phase(d.einsaetze[0]!)).toBe("fertig");
  });

  it("Checkliste: letzte Änderung gewinnt auch bei später ankommender alter Aktion", () => {
    const setze = (erledigt: boolean, zeit: string): AppAktion => ({
      typ: "aufgabe",
      id: zeit,
      einsatzId: "e1",
      taetigkeitId: "t1",
      erledigt,
      zeit: t(zeit),
    });
    const d = [setze(true, "08:00"), setze(false, "07:59")].reduce(wendeAn, tag());
    expect(d.einsaetze[0]!.aufgaben[0]!.erledigt).toBe(true);
  });

  it("ausstehende Aktionen überschreiben einen älteren Serverstand, aber keinen neueren", () => {
    const lokal: AppAktion = {
      typ: "notiz",
      id: "n1",
      einsatzId: "e1",
      text: "Klingel defekt",
      zeit: t("08:00"),
    };
    const alt = tag(einsatz({ notiz: "alt", notizAm: t("07:00") }));
    expect(mitAusstehenden(alt, [lokal]).einsaetze[0]!.notiz).toBe("Klingel defekt");
    const neu = tag(einsatz({ notiz: "Büro: Tür offen", notizAm: t("09:00") }));
    expect(mitAusstehenden(neu, [lokal]).einsaetze[0]!.notiz).toBe("Büro: Tür offen");
  });

  it("Position aus Preisliste ist bestätigt, freie Position nur Vorschlag", () => {
    const pos = (id: string, preisId: string | null): AppAktion => ({
      typ: "position",
      id,
      einsatzId: "e1",
      preisId,
      bezeichnung: "Keller fegen",
      menge: 6,
      dauer: "heute",
      zustimmung: "muendlich",
      unterschriftName: null,
      unterschriftBild: null,
    });
    const d = [pos("a", "p1"), pos("b", null), pos("b", null)].reduce(wendeAn, tag());
    expect(d.einsaetze[0]!.positionen).toEqual([
      {
        id: "a",
        bezeichnung: "Fenster Keller",
        menge: 6,
        preisCent: 450,
        status: "bestaetigt",
        dauer: "heute",
      },
      {
        id: "b",
        bezeichnung: "Keller fegen",
        menge: 6,
        preisCent: null,
        status: "vorgeschlagen",
        dauer: "heute",
      },
    ]);
  });

  it("Stammdaten-Korrektur lokal sichtbar", () => {
    const d = wendeAn(tag(), {
      typ: "korrektur",
      id: "k",
      einsatzId: "e1",
      feld: "fenster_anzahl",
      wert: "12",
      fensterId: "f1",
    });
    expect(d.einsaetze[0]!.objekt.fenster[0]!.anzahl).toBe(12);
  });

  it("Pflichtpunkte vor dem Auschecken", () => {
    expect(fehltVorCheckout(einsatz())).toEqual({ offeneAufgaben: 2, fotoFehlt: true });
    expect(
      fehltVorCheckout(
        einsatz({
          fotos: 1,
          aufgaben: einsatz().aufgaben.map((a) => ({ ...a, erledigt: true })),
        }),
      ),
    ).toEqual({ offeneAufgaben: 0, fotoFehlt: false });
  });

  it("Wartezeit und endgültige Fehler", () => {
    expect([1, 2, 3, 10].map(wartezeitMs)).toEqual([5_000, 10_000, 20_000, 300_000]);
    expect(istEndgueltig("42501")).toBe(true);
    expect(istEndgueltig("23505")).toBe(true);
    expect(istEndgueltig(undefined)).toBe(false);
    expect(istEndgueltig("PGRST301")).toBe(false);
  });
});

describe("Vor Ort", () => {
  it("QR-Code: URL oder reine Kennung", () => {
    const k = "3f1c0f7e-0000-4000-8000-000000000001";
    expect(qrPasst(`https://housy.de/qr/${k}`, k)).toBe(true);
    expect(qrPasst(k.toUpperCase(), k)).toBe(true);
    expect(qrPasst("https://housy.de/qr/anders", k)).toBe(false);
  });

  it("Navigation zu Koordinaten oder Adresse", () => {
    expect(navigationsLink(einsatz().objekt, false)).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=48.7%2C9.1",
    );
    expect(navigationsLink({ ...einsatz().objekt, lat: null, lng: null }, true)).toBe(
      "https://maps.apple.com/?daddr=Hauptstr.%2012%2070173%20Stuttgart",
    );
  });

  it("Packliste summiert über alle Einsätze und rundet auf", () => {
    const umfang = { flaecheM2: 200, fenster: 10 };
    const vorlage = { sollzeitMinuten: 60 };
    const p = packliste(
      [
        { vorlage, umfang, bedarfe: [{ artikelId: "r", menge: 0.25, bezug: "einsatz" }] },
        {
          vorlage,
          umfang,
          bedarfe: [
            { artikelId: "r", menge: 0.02, bezug: "fenster" },
            { artikelId: "m", menge: 3, bezug: "einsatz" },
          ],
        },
      ],
      [
        { id: "r", name: "Allzweckreiniger", einheit: "l" },
        { id: "m", name: "Müllbeutel", einheit: "Stk" },
      ],
    );
    expect(p).toEqual([
      { artikelId: "r", name: "Allzweckreiniger", einheit: "l", menge: 0.5 },
      { artikelId: "m", name: "Müllbeutel", einheit: "Stk", menge: 3 },
    ]);
  });
});

describe("Ortszeit", () => {
  it("Berlin Winter- und Sommerzeit", async () => {
    const { berlinZuIso, uhrzeitBerlin, tagBerlin } = await import("./zeiterfassung");
    expect(berlinZuIso("2026-11-23", "07:30")).toBe("2026-11-23T06:30:00.000Z");
    expect(berlinZuIso("2026-07-01", "07:30")).toBe("2026-07-01T05:30:00.000Z");
    expect(uhrzeitBerlin("2026-11-23T06:30:00.000Z")).toBe("07:30");
    expect(tagBerlin("2026-11-23T23:30:00.000Z")).toBe("2026-11-24");
  });
});
