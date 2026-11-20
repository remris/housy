/**
 * Testrechnungen für die drei Testkunden der Abnahme M9 (plus Storno). Daraus entstehen die
 * Fixtures in `fixtures/`, die der KoSIT-Validator prüft (`npm run erechnung:pruefen`).
 */
import type { RechnungDokument } from "@/domain/erechnung";
import {
  nachtragsPositionen,
  pflichthinweise,
  summen,
  vertragsPositionen,
} from "@/domain/rechnung";

const verkaeufer: RechnungDokument["verkaeufer"] = {
  name: "Glanz & Co. GmbH",
  strasse: "Königstraße 1",
  plz: "70173",
  ort: "Stuttgart",
  land: "DE",
  steuernummer: "99/123/45678",
  ustId: "DE123456789",
  email: "rechnung@glanz-co.example",
  telefon: "+49 711 123456",
  kontakt: "Anna Glanz",
  iban: "DE89 3704 0044 0532 0130 00",
  bic: "COBADEFFXXX",
  kontoinhaber: "Glanz & Co. GmbH",
};

function dokument(
  p: Omit<RechnungDokument, "summen" | "verkaeufer" | "hinweise"> & {
    verkaeufer?: RechnungDokument["verkaeufer"];
  },
): RechnungDokument {
  return {
    ...p,
    verkaeufer: p.verkaeufer ?? verkaeufer,
    summen: summen(p.positionen, p.kleinunternehmer),
    hinweise: pflichthinweise({
      kleinunternehmer: p.kleinunternehmer,
      privatkunde: p.kaeufer.privat,
    }),
  };
}

const basis = {
  datum: "2026-11-30",
  faelligAm: "2026-12-14",
  leistungVon: "2026-11-01",
  leistungBis: "2026-11-30",
  bezug: null,
  zahlungszielTage: 14,
  kleinunternehmer: false,
};

/** Testkunde 1: Hausverwaltung, Pauschale mit Versionswechsel + Nachtrag */
export const hausverwaltung = dokument({
  ...basis,
  art: "rechnung",
  nummer: "RE-2026-0001",
  kaeufer: {
    name: "Hausverwaltung Müller",
    strasse: "Hauptstraße 12",
    plz: "70173",
    ort: "Stuttgart",
    land: "DE",
    kundennummer: 1001,
    email: "buchhaltung@hv-mueller.example",
    leitwegId: null,
    ustId: null,
    privat: false,
  },
  positionen: [
    ...vertragsPositionen({
      monat: "2026-11",
      vertrag: {
        id: "v1",
        titel: "Treppenhaus Hauptstraße 12",
        beginn: "2026-01-01",
        endetAm: null,
        versionen: [
          {
            id: "v1-1",
            version: 1,
            gueltigAb: "2026-01-01",
            abrechnungsart: "pauschale",
            pauschaleCent: 42000,
            leistungen: [],
          },
          {
            id: "v1-2",
            version: 2,
            gueltigAb: "2026-11-15",
            abrechnungsart: "pauschale",
            pauschaleCent: 48000,
            leistungen: [],
          },
        ],
      },
      einsaetze: [],
    }).positionen,
    ...nachtragsPositionen([
      {
        id: "n1",
        einsatzId: "e1",
        datum: "2026-11-20",
        bezeichnung: "Kellerfenster putzen",
        menge: 4,
        einheit: "fenster",
        preisCent: 450,
        ustSatz: 19,
      },
    ]),
  ],
});

/** Testkunde 2: Öffentlicher Auftraggeber mit Leitweg-ID, Aufwand nach Stunden und Fenstern */
export const behoerde = dokument({
  ...basis,
  art: "rechnung",
  nummer: "RE-2026-0002",
  leistungVon: "2026-11-04",
  kaeufer: {
    name: "Stadt Musterstadt – Hochbauamt",
    strasse: "Rathausplatz 1",
    plz: "70174",
    ort: "Stuttgart",
    land: "DE",
    kundennummer: 1002,
    email: "rechnungseingang@musterstadt.example",
    leitwegId: "04011000-1234512345-06",
    ustId: null,
    privat: false,
  },
  positionen: vertragsPositionen({
    monat: "2026-11",
    vertrag: {
      id: "v2",
      titel: "Büroreinigung Rathaus",
      beginn: "2026-11-04",
      endetAm: null,
      versionen: [
        {
          id: "v2-1",
          version: 1,
          gueltigAb: "2026-11-04",
          abrechnungsart: "aufwand",
          pauschaleCent: null,
          leistungen: [
            {
              id: "l-std",
              bezeichnung: "Unterhaltsreinigung",
              einheit: "stunde",
              preisCent: 3500,
              ustSatz: 19,
            },
            {
              id: "l-fen",
              bezeichnung: "Fensterreinigung",
              einheit: "fenster",
              preisCent: 250,
              ustSatz: 19,
            },
          ],
        },
      ],
    },
    einsaetze: [
      {
        id: "a",
        datum: "2026-11-04",
        vertragsleistungId: "l-std",
        minuten: 150,
        fenster: 0,
        m2: 0,
      },
      {
        id: "b",
        datum: "2026-11-11",
        vertragsleistungId: "l-std",
        minuten: 145,
        fenster: 0,
        m2: 0,
      },
      {
        id: "c",
        datum: "2026-11-18",
        vertragsleistungId: "l-std",
        minuten: 155,
        fenster: 0,
        m2: 0,
      },
      {
        id: "d",
        datum: "2026-11-25",
        vertragsleistungId: "l-std",
        minuten: 150,
        fenster: 0,
        m2: 0,
      },
      {
        id: "f",
        datum: "2026-11-12",
        vertragsleistungId: "l-fen",
        minuten: 90,
        fenster: 40,
        m2: 0,
      },
    ],
  }).positionen,
});

/** Testkunde 3: Privatkunde beim Kleinunternehmer, Einzelauftrag */
export const privatKleinunternehmer = dokument({
  ...basis,
  art: "rechnung",
  nummer: "RE-2026-0003",
  leistungVon: "2026-11-07",
  leistungBis: "2026-11-07",
  kleinunternehmer: true,
  verkaeufer: {
    ...verkaeufer,
    name: "Fensterputz Jansen",
    ustId: null,
    email: "post@jansen.example",
    kontakt: "Jan Jansen",
    kontoinhaber: "Jan Jansen",
  },
  kaeufer: {
    name: "Erika Mustermann",
    strasse: "Gartenweg 3",
    plz: "71034",
    ort: "Böblingen",
    land: "DE",
    kundennummer: 1003,
    email: "erika@mustermann.example",
    leitwegId: null,
    ustId: null,
    privat: true,
  },
  positionen: vertragsPositionen({
    monat: "2026-11",
    vertrag: {
      id: "v3",
      titel: "Fensterputz Einfamilienhaus",
      beginn: "2026-11-01",
      endetAm: "2026-11-30",
      versionen: [
        {
          id: "v3-1",
          version: 1,
          gueltigAb: "2026-11-01",
          abrechnungsart: "einzelauftrag",
          pauschaleCent: null,
          leistungen: [
            {
              id: "l-p",
              bezeichnung: "Fensterreinigung komplett",
              einheit: "pauschal",
              preisCent: 8900,
              ustSatz: 19,
            },
          ],
        },
      ],
    },
    einsaetze: [
      {
        id: "p1",
        datum: "2026-11-07",
        vertragsleistungId: "l-p",
        minuten: 120,
        fenster: 18,
        m2: 0,
      },
    ],
  }).positionen,
});

/** Storno der Rechnung an die Hausverwaltung (Gutschrift 381 mit Bezug) */
export const storno: RechnungDokument = {
  ...hausverwaltung,
  art: "storno",
  nummer: "RE-2026-0004",
  datum: "2026-12-02",
  faelligAm: "2026-12-02",
  bezug: { nummer: hausverwaltung.nummer, datum: hausverwaltung.datum },
};

export const BEISPIELE = { hausverwaltung, behoerde, privatKleinunternehmer, storno };
