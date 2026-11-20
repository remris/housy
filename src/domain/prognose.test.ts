/**
 * Die beiden Szenarien aus dem Konzept („Material und Inventar mit Verbrauchsprognose“) als Tests.
 * Abnahme M8: Diese Szenarien sind grün.
 */
import { describe, expect, it } from "vitest";
import { plusTage } from "./datum";
import { type Bestaende, bestand, bucheBewegung, inventurKorrektur, abbuchungsort } from "./lager";
import {
  BESTELL_TAGE,
  bedarfFuerObjekt,
  bestellvorschlag,
  erwarteteWechsel,
  istKorrektur,
  ladeliste,
  lebensdauerVorschlag,
  pruefstatus,
  reichtFuerEinsaetze,
  reichweite,
  verschleissStand,
  wechselFaelligAm,
  zaehlerSeit,
} from "./prognose";
import { bedarfJeEinsatz } from "./vorlagen";

const REINIGER = "allzweckreiniger";
const LAGER = "zentrallager";
const AUTO_A = "auto-a";
const AUTO_B = "auto-b";
const KANISTER = 10;

describe("Szenario 1: Reinigungsbetrieb, Verbrauchsmaterial über mehrere Lagerorte", () => {
  // Vorlage „Unterhaltsreinigung Büro“: 0,5 l je Einsatz; A: 6, B: 9 Einsätze je Woche
  const proEinsatz = 0.5;
  const wochenbedarf = { A: 6 * proEinsatz, B: 9 * proEinsatz };
  const mindestbestand = 20;

  let lager: Bestaende = new Map();
  const zugang = (ort: string, menge: number) =>
    (lager = bucheBewegung(lager, {
      art: "zugang",
      artikelId: REINIGER,
      menge,
      von: null,
      nach: ort,
    }));
  const laden = (ort: string, gebinde: number) =>
    (lager = bucheBewegung(lager, {
      art: "umbuchung",
      artikelId: REINIGER,
      menge: gebinde * KANISTER,
      von: LAGER,
      nach: ort,
    }));
  const einsatz = (ort: string) =>
    (lager = bucheBewegung(lager, {
      art: "abgang_einsatz",
      artikelId: REINIGER,
      menge: proEinsatz,
      von: ort,
      nach: null,
    }));
  const packliste = () =>
    ladeliste([
      {
        artikelId: "A",
        bedarf: wochenbedarf.A,
        fahrzeugBestand: bestand(lager, AUTO_A, REINIGER),
        gebindeMenge: KANISTER,
      },
      {
        artikelId: "B",
        bedarf: wochenbedarf.B,
        fahrzeugBestand: bestand(lager, AUTO_B, REINIGER),
        gebindeMenge: KANISTER,
      },
    ]);

  it("Ausgangslage: 40 l im Lager, 6 l in Auto A, Auto B leer; Kanister reicht für 20 Einsätze", () => {
    zugang(LAGER, 40);
    zugang(AUTO_A, 6);
    expect(bestand(lager, LAGER, REINIGER)).toBe(40);
    expect(bestand(lager, AUTO_B, REINIGER)).toBe(0);
    expect(reichtFuerEinsaetze(KANISTER, proEinsatz)).toBe(20);
    expect(wochenbedarf.A + wochenbedarf.B).toBe(7.5);
  });

  it("Montag Woche 1: A muss nichts mitnehmen, B lädt 1 Kanister → Lager 30 l, Auto B 10 l", () => {
    const [a, b] = packliste();
    expect(a).toMatchObject({ bedarf: 3, fahrzeugBestand: 6, einladenGebinde: 0 });
    expect(b).toMatchObject({ bedarf: 4.5, fahrzeugBestand: 0, einladenGebinde: 1 });
    laden(AUTO_B, b!.einladenGebinde); // „geladen“ bucht um
    expect(bestand(lager, LAGER, REINIGER)).toBe(30);
    expect(bestand(lager, AUTO_B, REINIGER)).toBe(10);
  });

  it("jeder erledigte Einsatz bucht 0,5 l vom eigenen Auto ab: Ende Woche 1 A 3 l, B 5,5 l", () => {
    for (let i = 0; i < 6; i++) einsatz(AUTO_A);
    for (let i = 0; i < 9; i++) einsatz(AUTO_B);
    expect(bestand(lager, AUTO_A, REINIGER)).toBe(3);
    expect(bestand(lager, AUTO_B, REINIGER)).toBe(5.5);
    expect(bestand(lager, LAGER, REINIGER)).toBe(30);
  });

  it("Montag Woche 2: A hat genau 3 l für 3 l Bedarf → mit Puffer 1 Kanister; Lager erreicht 20 l", () => {
    const [a] = packliste();
    expect(a).toMatchObject({ bedarf: 3, fahrzeugBestand: 3, einladenGebinde: 1 });
    laden(AUTO_A, 1);
    expect(bestand(lager, LAGER, REINIGER)).toBe(mindestbestand);
  });

  it("Einkaufsliste: 3 Kanister (etwa 4 Wochen Verbrauch), Wareneingang mit einem Tipp", () => {
    const heute = "2026-11-09";
    const plan = Array.from({ length: BESTELL_TAGE }, (_, i) => ({
      datum: plusTage(heute, i),
      menge: 7.5 / 7,
    }));
    const gesamt =
      bestand(lager, LAGER, REINIGER) +
      bestand(lager, AUTO_A, REINIGER) +
      bestand(lager, AUTO_B, REINIGER);
    const r = reichweite(gesamt, plan, heute, BESTELL_TAGE);
    expect(r.jeWoche).toBeCloseTo(7.5, 5);
    const vorschlag = bestellvorschlag({
      lagerBestand: bestand(lager, LAGER, REINIGER),
      mindestbestand,
      gebindeMenge: KANISTER,
      lieferzeitTage: 5,
      bedarfVierWochen: r.jeWoche * 4,
      reichweiteTage: r.tage,
      offenBestellt: 0,
    });
    expect(vorschlag).toEqual({ menge: 30, gebinde: 3, grund: "mindestbestand" });
    // bestellt: kein zweiter Vorschlag, solange die Bestellung offen ist
    expect(
      bestellvorschlag({
        lagerBestand: 20,
        mindestbestand,
        gebindeMenge: KANISTER,
        lieferzeitTage: 5,
        bedarfVierWochen: 30,
        reichweiteTage: r.tage,
        offenBestellt: 30,
      }),
    ).toBeNull();
    zugang(LAGER, vorschlag!.menge);
    expect(bestand(lager, LAGER, REINIGER)).toBe(50);
  });

  it("Ist-Korrektur: B meldet „leer“, obwohl noch 2 l drin sein müssten → eher 0,6 l je Einsatz", () => {
    // B hat 10 l geladen und seitdem 16 Einsätze abgebucht (8 l) → Buch: 2 l
    let b: Bestaende = new Map();
    b = bucheBewegung(b, {
      art: "zugang",
      artikelId: REINIGER,
      menge: 10,
      von: null,
      nach: AUTO_B,
    });
    for (let i = 0; i < 16; i++) {
      b = bucheBewegung(b, {
        art: "abgang_einsatz",
        artikelId: REINIGER,
        menge: 0.5,
        von: AUTO_B,
        nach: null,
      });
    }
    const k = istKorrektur({
      bestandNachLaden: 10,
      einsaetzeSeitLaden: 16,
      sollJeEinsatz: proEinsatz,
      buchbestand: bestand(b, AUTO_B, REINIGER),
    });
    expect(k).toEqual({
      istJeEinsatz: 0.6,
      sollJeEinsatz: 0.5,
      abweichung: 0.25,
      rechnerischRest: 2,
    });
    // „leer“ stimmt: Inventur setzt das Auto auf 0
    const korrektur = inventurKorrektur(AUTO_B, REINIGER, bestand(b, AUTO_B, REINIGER), 0);
    expect(korrektur).toMatchObject({ art: "korrektur", menge: 2, von: AUTO_B, nach: null });
    b = bucheBewegung(b, korrektur!);
    expect(bestand(b, AUTO_B, REINIGER)).toBe(0);

    // Inhaber übernimmt 0,6 l für B's Objekte; die Prognose rechnet neu
    const vorlage = [{ artikelId: REINIGER, menge: 0.5, bezug: "einsatz" as const }];
    const objekt = [{ artikelId: REINIGER, menge: k!.istJeEinsatz, bezug: "einsatz" as const }];
    const umfang = { flaecheM2: 300, fenster: 0 };
    expect(bedarfJeEinsatz(bedarfFuerObjekt(vorlage, objekt), umfang).get(REINIGER)).toBe(0.6);
    expect(bedarfJeEinsatz(bedarfFuerObjekt(vorlage, []), umfang).get(REINIGER)).toBe(0.5);
  });

  it("kleine Abweichungen lösen keine Korrektur aus", () => {
    expect(
      istKorrektur({
        bestandNachLaden: 10,
        einsaetzeSeitLaden: 19,
        sollJeEinsatz: 0.5,
        buchbestand: 0.5,
      }),
    ).toBeNull();
  });
});

describe("Szenario 2: Fensterputzer allein, Verschleiß, Prüftermin und Vertragsänderung", () => {
  const GUMMI = "abziehergummi";
  const lebensdauer = 500;
  const montag = "2026-11-23";
  // nächste Woche 140 Fenster
  const woche = [35, 25, 30, 40, 10].map((menge, i) => ({ datum: plusTage(montag, i), menge }));

  it("Prognose: Zähler 380, die Grenze von 500 wird am Donnerstag erreicht", () => {
    expect(woche.reduce((s, w) => s + w.menge, 0)).toBe(140);
    expect(verschleissStand(380, lebensdauer).stufe).toBe("ok");
    expect(wechselFaelligAm(380, lebensdauer, woche)).toBe(plusTage(montag, 3));
  });

  it("Packliste: Ersatzgummi mitnehmen; „gewechselt“ setzt den Zähler auf 0, im Lager bleibt 1", () => {
    // fällig in dieser Woche → auf die Packliste
    expect(wechselFaelligAm(380, lebensdauer, woche)).not.toBeNull();
    let lager: Bestaende = new Map();
    lager = bucheBewegung(lager, {
      art: "zugang",
      artikelId: GUMMI,
      menge: 2,
      von: null,
      nach: LAGER,
    });
    lager = bucheBewegung(lager, {
      art: "wechsel",
      artikelId: GUMMI,
      menge: 1,
      von: LAGER,
      nach: null,
    });
    expect(bestand(lager, LAGER, GUMMI)).toBe(1);
    const nutzung = [
      { am: "2026-11-26T09:00:00Z", menge: 40 }, // Do, vor dem Wechsel
      { am: "2026-11-27T09:00:00Z", menge: 10 }, // Fr, nach dem Wechsel
    ];
    expect(zaehlerSeit("2026-11-26T12:00:00Z", nutzung)).toBe(10);
  });

  it("Einkaufsliste: Bestand 1 unter Mindestbestand 2 → 2 Abziehergummis bestellen", () => {
    // 4 Wochen à 140 Fenster = 560 → ein Wechsel
    const bedarf = erwarteteWechsel(0, lebensdauer, 4 * 140);
    expect(bedarf).toBe(1);
    expect(
      bestellvorschlag({
        lagerBestand: 1,
        mindestbestand: 2,
        gebindeMenge: 1,
        lieferzeitTage: 5,
        bedarfVierWochen: bedarf,
        reichweiteTage: null,
        offenBestellt: 0,
      }),
    ).toEqual({ menge: 2, gebinde: 2, grund: "mindestbestand" });
  });

  it("Prüftermin: Leiter in 14 Tagen fällig → „bald“; überfällig → Warnung", () => {
    expect(pruefstatus(plusTage(montag, 14), montag)).toEqual({
      faelligAm: plusTage(montag, 14),
      stufe: "bald",
      tage: 14,
    });
    expect(pruefstatus(plusTage(montag, -1), montag).stufe).toBe("ueberfaellig");
    expect(pruefstatus(plusTage(montag, 60), montag).stufe).toBe("ok");
  });

  it("Vertragsänderung: +6 Kellerfenster alle 4 Wochen erhöhen Verbrauch und ziehen den Wechsel vor", () => {
    const vorlage = [
      { artikelId: GUMMI, menge: 1, bezug: "fenster" as const },
      { artikelId: "fensterreiniger", menge: 0.02, bezug: "fenster" as const },
    ];
    const alt = bedarfJeEinsatz(vorlage, { flaecheM2: 0, fenster: 30 });
    const neu = bedarfJeEinsatz(vorlage, { flaecheM2: 0, fenster: 36 });
    expect(neu.get("fensterreiniger")).toBeGreaterThan(alt.get("fensterreiniger")!);
    // Einsatz am Mittwoch bekommt die 6 Kellerfenster dazu → Grenze schon am Mittwoch
    const mitKeller = woche.map((w, i) => (i === 2 ? { ...w, menge: w.menge + 6 } : w));
    expect(wechselFaelligAm(409, lebensdauer, woche)).toBe(plusTage(montag, 3));
    expect(wechselFaelligAm(409, lebensdauer, mitKeller)).toBe(plusTage(montag, 2));
  });
});

describe("Regeln für Verschleiß", () => {
  it("kein Übertrag: Wechsel bei 700 → überfällig seit 200, neuer Gummi startet bei 0", () => {
    expect(verschleissStand(700, 500)).toMatchObject({ stufe: "ueberfaellig", ueberUm: 200 });
    expect(verschleissStand(0, 500)).toMatchObject({ stufe: "ok", stand: 0 });
  });

  it("Stufen: ab 80 % Hinweis, ab 100 % fällig, gesperrt wird nichts", () => {
    expect(verschleissStand(399, 500).stufe).toBe("ok");
    expect(verschleissStand(400, 500).stufe).toBe("hinweis");
    expect(verschleissStand(500, 500).stufe).toBe("faellig");
    expect(verschleissStand(549, 500).stufe).toBe("faellig");
    expect(verschleissStand(550, 500).stufe).toBe("ueberfaellig");
  });

  it("nachträglich datierter Wechsel: Zähler rechnet ab diesem Zeitpunkt neu", () => {
    const nutzung = [
      { am: "2026-11-23T10:00:00Z", menge: 30 },
      { am: "2026-11-24T10:00:00Z", menge: 30 },
      { am: "2026-11-25T10:00:00Z", menge: 30 },
    ];
    expect(zaehlerSeit(null, nutzung)).toBe(90);
    expect(zaehlerSeit("2026-11-24T08:00:00Z", nutzung)).toBe(60);
  });

  it("Lebensdauer lernt mit: im Schnitt bei 680 gewechselt → Vorschlag 680; Defekte zählen nicht", () => {
    const wechsel = [
      { stand: 650, grund: "verschleiss" as const },
      { stand: 700, grund: "verschleiss" as const },
      { stand: 690, grund: "verschleiss" as const },
      { stand: 120, grund: "defekt" as const },
    ];
    expect(lebensdauerVorschlag(wechsel, 500)).toBe(680);
    expect(lebensdauerVorschlag(wechsel.slice(0, 2), 500)).toBeNull();
    expect(
      lebensdauerVorschlag(
        [520, 480, 510].map((stand) => ({ stand, grund: "verschleiss" as const })),
        500,
      ),
    ).toBeNull();
  });

  it("erwartete Wechsel: ein schon fälliges Teil zählt sofort", () => {
    expect(erwarteteWechsel(520, 500, 100)).toBe(1);
    expect(erwarteteWechsel(450, 500, 100)).toBe(1);
    expect(erwarteteWechsel(0, 500, 1000)).toBe(2);
  });
});

describe("Reichweite und Lagerorte", () => {
  it("leer am Tag, an dem der Plan den Bestand übersteigt; ohne Plan unbegrenzt", () => {
    const plan = [
      { datum: "2026-11-23", menge: 2 },
      { datum: "2026-11-24", menge: 2 },
      { datum: "2026-11-25", menge: 2 },
    ];
    expect(reichweite(5, plan, "2026-11-23", 7)).toMatchObject({ leerAm: "2026-11-25", tage: 2 });
    expect(reichweite(5, [], "2026-11-23", 28)).toEqual({ leerAm: null, tage: null, jeWoche: 0 });
    // reicht über den Plan hinaus → hochgerechnet
    expect(reichweite(12, plan, "2026-11-23", 7).tage).toBe(7 + Math.floor(6 / (6 / 7)));
  });

  it("Abbuchung: Tourfahrzeug vor Standardfahrzeug vor Putzkammer vor Zentrallager", () => {
    expect(
      abbuchungsort({
        tourFahrzeugOrt: "t",
        standardFahrzeugOrt: "s",
        objektOrt: "o",
        zentrallager: "z",
      }),
    ).toBe("t");
    expect(
      abbuchungsort({
        tourFahrzeugOrt: null,
        standardFahrzeugOrt: null,
        objektOrt: "o",
        zentrallager: "z",
      }),
    ).toBe("o");
    expect(
      abbuchungsort({
        tourFahrzeugOrt: null,
        standardFahrzeugOrt: null,
        objektOrt: null,
        zentrallager: null,
      }),
    ).toBeNull();
  });

  it("Inventur ohne Differenz bucht nichts; ungültige Bewegungen werden abgelehnt", () => {
    expect(inventurKorrektur(LAGER, REINIGER, 5, 5)).toBeNull();
    expect(() =>
      bucheBewegung(new Map(), {
        art: "umbuchung",
        artikelId: REINIGER,
        menge: 1,
        von: LAGER,
        nach: LAGER,
      }),
    ).toThrow();
  });
});
