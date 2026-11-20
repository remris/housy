/**
 * Branchenpakete: Startwerte für Artikel, Auftragsvorlagen (Checklisten, Sollzeit, Bedarf)
 * und Preisliste. Werte sind typische Annahmen und vom Betrieb anpassbar.
 * Installation über die DB-Funktion `paket_installieren` (idempotent über Namen).
 */

export type Branche = "gebaeudereinigung" | "hausmeister" | "fensterreinigung";

export type PaketArtikel = {
  name: string;
  art: "verbrauch" | "verschleiss" | "geraet";
  einheit: string;
  gebinde_name?: string;
  gebinde_menge?: number;
  preis_cent?: number;
  mindestbestand?: number;
  lieferzeit_tage?: number;
  lebensdauer?: number;
  lebensdauer_einheit?: "einsaetze" | "fenster" | "m2" | "stunden" | "waeschen" | "tage";
  auto_wechsel?: boolean;
  pruefintervall_monate?: number;
};

export type PaketVorlage = {
  name: string;
  branche: Branche;
  beschreibung?: string;
  sollzeit_minuten: number;
  minuten_pro_100m2?: number;
  minuten_pro_fenster?: number;
  taetigkeiten: string[];
  bedarf: { artikel: string; menge: number; bezug: "einsatz" | "m2" | "fenster" | "stunde" }[];
};

export type PaketPreis = {
  name: string;
  beschreibung?: string;
  einheit: "pauschal" | "stunde" | "m2" | "fenster" | "stueck" | "einsatz";
  preis_cent: number;
  sonderleistung?: boolean;
  vorlage?: string;
};

export type Paket = { artikel: PaketArtikel[]; vorlagen: PaketVorlage[]; preise: PaketPreis[] };

// ---------------------------------------------------------------------------
// Gemeinsame Artikel
// ---------------------------------------------------------------------------
const allzweckreiniger: PaketArtikel = {
  name: "Allzweckreiniger",
  art: "verbrauch",
  einheit: "l",
  gebinde_name: "Kanister",
  gebinde_menge: 10,
  preis_cent: 2490,
  mindestbestand: 20,
  lieferzeit_tage: 5,
};
const muellbeutel: PaketArtikel = {
  name: "Müllbeutel 60 l",
  art: "verbrauch",
  einheit: "Stk",
  gebinde_name: "Rolle",
  gebinde_menge: 50,
  preis_cent: 590,
  mindestbestand: 100,
};
const sanitaerreiniger: PaketArtikel = {
  name: "Sanitärreiniger",
  art: "verbrauch",
  einheit: "l",
  gebinde_name: "Flasche",
  gebinde_menge: 1,
  preis_cent: 450,
  mindestbestand: 5,
};
const wischmopp: PaketArtikel = {
  name: "Mopp-Bezug",
  art: "verschleiss",
  einheit: "Stk",
  preis_cent: 890,
  mindestbestand: 4,
  lebensdauer: 200,
  lebensdauer_einheit: "waeschen",
};
const mikrofaser: PaketArtikel = {
  name: "Mikrofasertuch",
  art: "verschleiss",
  einheit: "Stk",
  gebinde_name: "Packung",
  gebinde_menge: 10,
  preis_cent: 1290,
  mindestbestand: 20,
  lebensdauer: 300,
  lebensdauer_einheit: "waeschen",
  auto_wechsel: true,
};
const besen: PaketArtikel = {
  name: "Besen",
  art: "verschleiss",
  einheit: "Stk",
  preis_cent: 1490,
  mindestbestand: 1,
  lebensdauer: 100,
  lebensdauer_einheit: "einsaetze",
};
const staubsauger: PaketArtikel = {
  name: "Staubsauger",
  art: "geraet",
  einheit: "Stk",
  preis_cent: 29900,
  pruefintervall_monate: 12,
};
const leiter: PaketArtikel = {
  name: "Leiter",
  art: "geraet",
  einheit: "Stk",
  preis_cent: 18900,
  pruefintervall_monate: 12,
};

// ---------------------------------------------------------------------------
// Gebäudereinigung
// ---------------------------------------------------------------------------
const gebaeudereinigung: Paket = {
  artikel: [
    allzweckreiniger,
    muellbeutel,
    sanitaerreiniger,
    wischmopp,
    mikrofaser,
    besen,
    staubsauger,
    {
      name: "Grundreiniger",
      art: "verbrauch",
      einheit: "l",
      gebinde_name: "Kanister",
      gebinde_menge: 10,
      preis_cent: 4290,
      mindestbestand: 10,
    },
    {
      name: "Scheuersaugmaschine",
      art: "geraet",
      einheit: "Stk",
      preis_cent: 349000,
      pruefintervall_monate: 12,
    },
  ],
  vorlagen: [
    {
      name: "Unterhaltsreinigung Büro",
      branche: "gebaeudereinigung",
      sollzeit_minuten: 15,
      minuten_pro_100m2: 20,
      taetigkeiten: [
        "Papierkörbe leeren, Müllbeutel wechseln",
        "Tische und Arbeitsflächen feucht wischen",
        "Böden saugen bzw. feucht wischen",
        "Türklinken und Lichtschalter desinfizieren",
        "Teeküche reinigen",
      ],
      bedarf: [
        { artikel: "Allzweckreiniger", menge: 0.5, bezug: "einsatz" },
        { artikel: "Müllbeutel 60 l", menge: 3, bezug: "einsatz" },
        { artikel: "Mopp-Bezug", menge: 1, bezug: "einsatz" },
        { artikel: "Besen", menge: 1, bezug: "einsatz" },
        { artikel: "Staubsauger", menge: 1, bezug: "einsatz" },
      ],
    },
    {
      name: "Treppenhausreinigung",
      branche: "gebaeudereinigung",
      sollzeit_minuten: 45,
      taetigkeiten: [
        "Treppen und Podeste kehren",
        "Treppen und Podeste nass wischen",
        "Handläufe und Geländer feucht abwischen",
        "Briefkastenanlage und Klingeltableau reinigen",
        "Eingangstür innen und außen reinigen",
      ],
      bedarf: [
        { artikel: "Allzweckreiniger", menge: 0.3, bezug: "einsatz" },
        { artikel: "Mopp-Bezug", menge: 1, bezug: "einsatz" },
        { artikel: "Besen", menge: 1, bezug: "einsatz" },
      ],
    },
    {
      name: "Sanitärreinigung",
      branche: "gebaeudereinigung",
      sollzeit_minuten: 20,
      taetigkeiten: [
        "WC, Urinale und Waschbecken reinigen und desinfizieren",
        "Spiegel und Armaturen reinigen",
        "Seife, Papier und Handtücher auffüllen",
        "Boden nass wischen",
      ],
      bedarf: [
        { artikel: "Sanitärreiniger", menge: 0.2, bezug: "einsatz" },
        { artikel: "Mikrofasertuch", menge: 2, bezug: "einsatz" },
      ],
    },
    {
      name: "Grundreinigung",
      branche: "gebaeudereinigung",
      sollzeit_minuten: 30,
      minuten_pro_100m2: 60,
      taetigkeiten: [
        "Möbel räumen",
        "Boden maschinell grundreinigen",
        "Schmutzwasser aufnehmen und nachwischen",
        "Möbel zurückstellen",
      ],
      bedarf: [
        { artikel: "Grundreiniger", menge: 0.05, bezug: "m2" },
        { artikel: "Scheuersaugmaschine", menge: 1, bezug: "einsatz" },
      ],
    },
  ],
  preise: [
    {
      name: "Unterhaltsreinigung je Stunde",
      einheit: "stunde",
      preis_cent: 3500,
      vorlage: "Unterhaltsreinigung Büro",
    },
    {
      name: "Treppenhausreinigung je Einsatz",
      einheit: "einsatz",
      preis_cent: 6500,
      vorlage: "Treppenhausreinigung",
    },
    { name: "Grundreinigung je m²", einheit: "m2", preis_cent: 350, vorlage: "Grundreinigung" },
    {
      name: "Sonderreinigung je Stunde",
      einheit: "stunde",
      preis_cent: 4200,
      sonderleistung: true,
    },
    { name: "Anfahrtspauschale", einheit: "pauschal", preis_cent: 1500, sonderleistung: true },
  ],
};

// ---------------------------------------------------------------------------
// Hausmeisterservice
// ---------------------------------------------------------------------------
const hausmeister: Paket = {
  artikel: [
    muellbeutel,
    besen,
    leiter,
    {
      name: "Streusalz",
      art: "verbrauch",
      einheit: "kg",
      gebinde_name: "Sack",
      gebinde_menge: 25,
      preis_cent: 990,
      mindestbestand: 100,
      lieferzeit_tage: 3,
    },
    {
      name: "Splitt",
      art: "verbrauch",
      einheit: "kg",
      gebinde_name: "Sack",
      gebinde_menge: 25,
      preis_cent: 790,
      mindestbestand: 50,
    },
    {
      name: "Laubsack",
      art: "verbrauch",
      einheit: "Stk",
      gebinde_name: "Rolle",
      gebinde_menge: 10,
      preis_cent: 690,
      mindestbestand: 20,
    },
    {
      name: "Schneeschieber",
      art: "verschleiss",
      einheit: "Stk",
      preis_cent: 3490,
      mindestbestand: 1,
      lebensdauer: 150,
      lebensdauer_einheit: "einsaetze",
    },
    {
      name: "Laubbläser",
      art: "geraet",
      einheit: "Stk",
      preis_cent: 24900,
      pruefintervall_monate: 12,
    },
  ],
  vorlagen: [
    {
      name: "Objektrundgang",
      branche: "hausmeister",
      sollzeit_minuten: 30,
      taetigkeiten: [
        "Beleuchtung Treppenhaus und Außen prüfen",
        "Türen, Schließanlage und Fenster prüfen",
        "Heizung und Zählerstände ablesen (Foto)",
        "Mängel dokumentieren",
      ],
      bedarf: [],
    },
    {
      name: "Mülltonnenservice",
      branche: "hausmeister",
      sollzeit_minuten: 20,
      taetigkeiten: [
        "Tonnen zur Abholung bereitstellen",
        "Tonnen nach Leerung zurückstellen",
        "Tonnenplatz kehren",
      ],
      bedarf: [{ artikel: "Besen", menge: 1, bezug: "einsatz" }],
    },
    {
      name: "Winterdienst",
      branche: "hausmeister",
      sollzeit_minuten: 30,
      beschreibung: "Protokoll mit Uhrzeit und Wetter als Haftungsnachweis",
      taetigkeiten: [
        "Gehwege und Zugänge räumen",
        "Streuen (Salz/Splitt)",
        "Uhrzeit und Wetterlage festhalten",
      ],
      bedarf: [
        { artikel: "Streusalz", menge: 5, bezug: "einsatz" },
        { artikel: "Schneeschieber", menge: 1, bezug: "einsatz" },
      ],
    },
    {
      name: "Grünpflege",
      branche: "hausmeister",
      sollzeit_minuten: 60,
      taetigkeiten: [
        "Rasen mähen",
        "Hecken und Sträucher schneiden",
        "Laub entfernen",
        "Grünschnitt entsorgen",
      ],
      bedarf: [
        { artikel: "Laubsack", menge: 3, bezug: "einsatz" },
        { artikel: "Laubbläser", menge: 1, bezug: "einsatz" },
      ],
    },
  ],
  preise: [
    { name: "Hausmeisterpauschale Objekt", einheit: "pauschal", preis_cent: 18000 },
    { name: "Hausmeisterstunde", einheit: "stunde", preis_cent: 4500, sonderleistung: true },
    {
      name: "Winterdienst je Einsatz",
      einheit: "einsatz",
      preis_cent: 3500,
      vorlage: "Winterdienst",
    },
    { name: "Kleinreparatur je Stunde", einheit: "stunde", preis_cent: 5200, sonderleistung: true },
    { name: "Material nach Aufwand", einheit: "stueck", preis_cent: 0, sonderleistung: true },
  ],
};

// ---------------------------------------------------------------------------
// Fensterreinigung
// ---------------------------------------------------------------------------
const fensterreinigung: Paket = {
  artikel: [
    mikrofaser,
    leiter,
    {
      name: "Fensterreiniger-Konzentrat",
      art: "verbrauch",
      einheit: "l",
      gebinde_name: "Flasche",
      gebinde_menge: 1,
      preis_cent: 1290,
      mindestbestand: 2,
    },
    {
      name: "Abziehergummi",
      art: "verschleiss",
      einheit: "Stk",
      preis_cent: 390,
      mindestbestand: 2,
      lebensdauer: 500,
      lebensdauer_einheit: "fenster",
    },
    {
      name: "Einwascherbezug",
      art: "verschleiss",
      einheit: "Stk",
      preis_cent: 1190,
      mindestbestand: 1,
      lebensdauer: 1500,
      lebensdauer_einheit: "fenster",
    },
    {
      name: "Teleskopstange",
      art: "geraet",
      einheit: "Stk",
      preis_cent: 8900,
    },
  ],
  vorlagen: [
    {
      name: "Fenster innen und außen",
      branche: "fensterreinigung",
      sollzeit_minuten: 10,
      minuten_pro_fenster: 6,
      taetigkeiten: [
        "Fenster innen reinigen",
        "Fenster außen reinigen",
        "Rahmen und Fensterbänke abwischen",
        "Boden unter den Fenstern trocken hinterlassen",
      ],
      bedarf: [
        { artikel: "Fensterreiniger-Konzentrat", menge: 0.01, bezug: "fenster" },
        { artikel: "Abziehergummi", menge: 1, bezug: "fenster" },
        { artikel: "Einwascherbezug", menge: 1, bezug: "fenster" },
        { artikel: "Mikrofasertuch", menge: 1, bezug: "einsatz" },
        { artikel: "Leiter", menge: 1, bezug: "einsatz" },
      ],
    },
    {
      name: "Schaufensterreinigung",
      branche: "fensterreinigung",
      sollzeit_minuten: 5,
      minuten_pro_fenster: 4,
      taetigkeiten: ["Schaufenster außen reinigen", "Eingangstür reinigen"],
      bedarf: [
        { artikel: "Fensterreiniger-Konzentrat", menge: 0.01, bezug: "fenster" },
        { artikel: "Abziehergummi", menge: 1, bezug: "fenster" },
        { artikel: "Teleskopstange", menge: 1, bezug: "einsatz" },
      ],
    },
    {
      name: "Rahmenreinigung",
      branche: "fensterreinigung",
      sollzeit_minuten: 5,
      minuten_pro_fenster: 4,
      taetigkeiten: ["Rahmen innen und außen reinigen", "Falze aussaugen"],
      bedarf: [
        { artikel: "Fensterreiniger-Konzentrat", menge: 0.005, bezug: "fenster" },
        { artikel: "Mikrofasertuch", menge: 1, bezug: "einsatz" },
      ],
    },
  ],
  preise: [
    {
      name: "Fenster Standard je Stück",
      einheit: "fenster",
      preis_cent: 450,
      vorlage: "Fenster innen und außen",
    },
    { name: "Sprossenfenster je Stück", einheit: "fenster", preis_cent: 750 },
    {
      name: "Schaufenster je Stück",
      einheit: "fenster",
      preis_cent: 600,
      vorlage: "Schaufensterreinigung",
    },
    {
      name: "Rahmenreinigung je Fenster",
      einheit: "fenster",
      preis_cent: 250,
      sonderleistung: true,
    },
    { name: "Fenster Keller je Stück", einheit: "fenster", preis_cent: 350, sonderleistung: true },
    { name: "Anfahrtspauschale", einheit: "pauschal", preis_cent: 1500, sonderleistung: true },
  ],
};

export const BRANCHENPAKETE: Record<Branche, { titel: string; paket: Paket }> = {
  gebaeudereinigung: { titel: "Gebäudereinigung", paket: gebaeudereinigung },
  hausmeister: { titel: "Hausmeisterservice", paket: hausmeister },
  fensterreinigung: { titel: "Fensterreinigung", paket: fensterreinigung },
};

/** Fügt Pakete zusammen; gleichnamige Artikel/Vorlagen/Preise werden nur einmal übernommen. */
export function kombiniere(branchen: Branche[]): Paket {
  const ergebnis: Paket = { artikel: [], vorlagen: [], preise: [] };
  const neu = <T extends { name: string }>(liste: T[], x: T) =>
    !liste.some((y) => y.name.toLowerCase() === x.name.toLowerCase());
  for (const b of branchen) {
    const p = BRANCHENPAKETE[b].paket;
    for (const a of p.artikel) if (neu(ergebnis.artikel, a)) ergebnis.artikel.push(a);
    for (const v of p.vorlagen) if (neu(ergebnis.vorlagen, v)) ergebnis.vorlagen.push(v);
    for (const pr of p.preise) if (neu(ergebnis.preise, pr)) ergebnis.preise.push(pr);
  }
  return ergebnis;
}

/** Prüft ein Paket auf Konsistenz (für Tests und vor der Installation). */
export function pruefePaket(p: Paket): string[] {
  const fehler: string[] = [];
  const artikel = new Map(p.artikel.map((a) => [a.name.toLowerCase(), a]));
  const vorlagen = new Set(p.vorlagen.map((v) => v.name.toLowerCase()));
  for (const a of p.artikel) {
    if (a.art === "verschleiss" && (!a.lebensdauer || !a.lebensdauer_einheit))
      fehler.push(`${a.name}: Verschleißteil ohne Lebensdauer`);
  }
  for (const v of p.vorlagen) {
    if (!v.taetigkeiten.length) fehler.push(`${v.name}: keine Tätigkeiten`);
    for (const b of v.bedarf) {
      const a = artikel.get(b.artikel.toLowerCase());
      if (!a) fehler.push(`${v.name}: Artikel ${b.artikel} fehlt`);
      else if (a.art === "verschleiss") {
        const passend: Record<string, string[]> = {
          einsaetze: ["einsatz"],
          waeschen: ["einsatz"],
          fenster: ["fenster"],
          m2: ["m2"],
          stunden: ["stunde"],
          tage: ["einsatz", "fenster", "m2", "stunde"],
        };
        if (!passend[a.lebensdauer_einheit!]?.includes(b.bezug))
          fehler.push(
            `${v.name}: ${a.name} zählt in ${a.lebensdauer_einheit}, Bedarf je ${b.bezug}`,
          );
      }
    }
  }
  for (const pr of p.preise) {
    if (pr.vorlage && !vorlagen.has(pr.vorlage.toLowerCase()))
      fehler.push(`Preis ${pr.name}: Vorlage ${pr.vorlage} fehlt`);
  }
  return fehler;
}
