/**
 * Mitarbeiter-App: Tagesdaten, Aktionen und Offline-Logik.
 * Aktionen werden lokal sofort angewendet und in eine Warteschlange gelegt. Beim Synchronisieren
 * schickt das Gerät sie der Reihe nach an den Server; der Server setzt „letzte Änderung gewinnt“
 * je Feld um (Checkliste, Notiz) und ignoriert Wiederholungen (IDs vom Gerät).
 * Nach dem Neuladen vom Server werden noch ausstehende Aktionen erneut lokal angewendet.
 */
import { type Bedarf, type Einsatzumfang, type Vorlagenzeit, bedarfJeEinsatz } from "./vorlagen";
import type { Buchung, Buchungsart } from "./zeiterfassung";

// ---------------------------------------------------------------------------
// Tagesdaten
// ---------------------------------------------------------------------------

export type AppAufgabe = {
  taetigkeitId: string;
  text: string;
  fotoPflicht: boolean;
  erledigt: boolean;
  geaendertAm: string | null;
};

export type AppPosition = {
  id: string;
  bezeichnung: string;
  menge: number;
  preisCent: number | null;
  status: "vorgeschlagen" | "bestaetigt" | "abgelehnt";
  dauer: "heute" | "dauerhaft";
};

export type AppMeldung = {
  id: string;
  art: "mangel" | "material_leer";
  text: string | null;
  artikelId: string | null;
};

export type AppEinsatz = {
  id: string;
  datum: string;
  status: string;
  reihenfolge: number | null;
  geplanterBeginn: string | null;
  zeitfensterVon: string | null;
  zeitfensterBis: string | null;
  sollzeitMinuten: number;
  vorlage: string;
  objekt: {
    id: string;
    name: string;
    strasse: string | null;
    plz: string | null;
    ort: string | null;
    lat: number | null;
    lng: number | null;
    zugangshinweise: string | null;
    qrKennung: string;
    fenster: { id: string; bezeichnung: string | null; anzahl: number }[];
  };
  aufgaben: AppAufgabe[];
  notiz: string | null;
  notizAm: string | null;
  positionen: AppPosition[];
  meldungen: AppMeldung[];
  fotos: number;
  /** Abnahme-Unterschrift des Kunden (optional) */
  abnahme: { name: string; am: string } | null;
};

export type AppPreis = { id: string; name: string; einheit: string; preisCent: number };
export type AppArtikel = { id: string; name: string; einheit: string };
export type Packposten = { artikelId: string; name: string; einheit: string; menge: number };

export type Tagesdaten = {
  geladenAm: string;
  datum: string;
  betriebId: string;
  mitgliedId: string;
  einsaetze: AppEinsatz[];
  buchungen: Buchung[];
  preisliste: AppPreis[];
  artikel: AppArtikel[];
  packliste: Packposten[];
};

// ---------------------------------------------------------------------------
// Aktionen
// ---------------------------------------------------------------------------

export type AppAktion =
  | {
      typ: "zeit";
      id: string;
      art: Buchungsart;
      zeitpunkt: string;
      einsatzId: string | null;
      quelle: "qr" | "app";
    }
  | {
      typ: "aufgabe";
      id: string;
      einsatzId: string;
      taetigkeitId: string;
      erledigt: boolean;
      zeit: string;
    }
  | { typ: "notiz"; id: string; einsatzId: string; text: string; zeit: string }
  | {
      typ: "meldung";
      id: string;
      einsatzId: string;
      art: "mangel" | "material_leer";
      text: string | null;
      artikelId: string | null;
    }
  | { typ: "foto"; id: string; einsatzId: string; pfad: string; meldungId: string | null }
  | {
      typ: "position";
      id: string;
      einsatzId: string;
      preisId: string | null;
      bezeichnung: string;
      menge: number;
      dauer: "heute" | "dauerhaft";
      zustimmung: "unterschrift" | "muendlich";
      unterschriftName: string | null;
      unterschriftBild: string | null;
    }
  | { typ: "abnahme"; id: string; einsatzId: string; name: string; bild: string; zeit: string }
  | {
      typ: "korrektur";
      id: string;
      einsatzId: string;
      feld: "zugangshinweise" | "fenster_anzahl";
      wert: string;
      fensterId: string | null;
    };

const neuer = (a: string | null, b: string) => a === null || Date.parse(a) < Date.parse(b);

function aendereEinsatz(d: Tagesdaten, id: string, f: (e: AppEinsatz) => AppEinsatz): Tagesdaten {
  return { ...d, einsaetze: d.einsaetze.map((e) => (e.id === id ? f(e) : e)) };
}

/** Wendet eine Aktion lokal an (rein, ohne Seiteneffekte). */
export function wendeAn(d: Tagesdaten, a: AppAktion): Tagesdaten {
  switch (a.typ) {
    case "zeit": {
      if (d.buchungen.some((b) => b.id === a.id)) return d;
      const mitBuchung = {
        ...d,
        buchungen: [
          ...d.buchungen,
          { id: a.id, art: a.art, zeitpunkt: a.zeitpunkt, einsatzId: a.einsatzId },
        ],
      };
      if (!a.einsatzId) return mitBuchung;
      return aendereEinsatz(mitBuchung, a.einsatzId, (e) => ({
        ...e,
        status:
          a.art === "checkin" && ["geplant", "zugewiesen", "unterwegs"].includes(e.status)
            ? "begonnen"
            : a.art === "checkout" && e.status !== "abgesagt"
              ? "erledigt"
              : e.status,
      }));
    }
    case "aufgabe":
      return aendereEinsatz(d, a.einsatzId, (e) => ({
        ...e,
        aufgaben: e.aufgaben.map((t) =>
          t.taetigkeitId === a.taetigkeitId && neuer(t.geaendertAm, a.zeit)
            ? { ...t, erledigt: a.erledigt, geaendertAm: a.zeit }
            : t,
        ),
      }));
    case "notiz":
      return aendereEinsatz(d, a.einsatzId, (e) =>
        neuer(e.notizAm, a.zeit) ? { ...e, notiz: a.text.trim() || null, notizAm: a.zeit } : e,
      );
    case "meldung":
      return aendereEinsatz(d, a.einsatzId, (e) =>
        e.meldungen.some((m) => m.id === a.id)
          ? e
          : {
              ...e,
              meldungen: [
                ...e.meldungen,
                { id: a.id, art: a.art, text: a.text, artikelId: a.artikelId },
              ],
            },
      );
    case "foto":
      return aendereEinsatz(d, a.einsatzId, (e) => ({ ...e, fotos: e.fotos + 1 }));
    case "position": {
      const preis = a.preisId ? d.preisliste.find((p) => p.id === a.preisId) : undefined;
      return aendereEinsatz(d, a.einsatzId, (e) =>
        e.positionen.some((p) => p.id === a.id)
          ? e
          : {
              ...e,
              positionen: [
                ...e.positionen,
                {
                  id: a.id,
                  bezeichnung: preis?.name ?? a.bezeichnung,
                  menge: a.menge,
                  preisCent: preis?.preisCent ?? null,
                  status: preis ? "bestaetigt" : "vorgeschlagen",
                  dauer: a.dauer,
                },
              ],
            },
      );
    }
    case "abnahme":
      return aendereEinsatz(d, a.einsatzId, (e) =>
        neuer(e.abnahme?.am ?? null, a.zeit)
          ? { ...e, abnahme: { name: a.name.trim(), am: a.zeit } }
          : e,
      );
    case "korrektur":
      return aendereEinsatz(d, a.einsatzId, (e) => ({
        ...e,
        objekt:
          a.feld === "zugangshinweise"
            ? { ...e.objekt, zugangshinweise: a.wert.trim() || null }
            : {
                ...e.objekt,
                fenster: e.objekt.fenster.map((f) =>
                  f.id === a.fensterId ? { ...f, anzahl: Number(a.wert) } : f,
                ),
              },
      }));
  }
}

/** Serverstand plus noch nicht übertragene Aktionen. */
export function mitAusstehenden(server: Tagesdaten, ausstehend: AppAktion[]): Tagesdaten {
  return ausstehend.reduce(wendeAn, server);
}

// ---------------------------------------------------------------------------
// Synchronisation
// ---------------------------------------------------------------------------

/** Wartezeit bis zum nächsten Versuch: 5 s, 10 s, 20 s … höchstens 5 Minuten. */
export function wartezeitMs(versuche: number): number {
  return Math.min(5_000 * 2 ** Math.max(0, versuche - 1), 300_000);
}

/**
 * Fehler, bei denen ein erneuter Versuch nichts ändert (Berechtigung, ungültige Daten).
 * Solche Aktionen werden aus der Warteschlange genommen und dem Mitarbeiter angezeigt.
 */
export function istEndgueltig(code: string | undefined): boolean {
  if (!code) return false;
  return code === "42501" || code === "22023" || code === "P0001" || /^23/.test(code);
}

// ---------------------------------------------------------------------------
// Ablauf am Einsatz
// ---------------------------------------------------------------------------

export type Einsatzphase = "offen" | "laeuft" | "fertig";

export function phase(e: AppEinsatz): Einsatzphase {
  if (e.status === "erledigt" || e.status === "abgesagt") return "fertig";
  if (e.status === "begonnen") return "laeuft";
  return "offen";
}

/** Fehlende Pflichtpunkte vor dem Auschecken (Checkliste, Pflichtfoto). */
export function fehltVorCheckout(e: AppEinsatz): { offeneAufgaben: number; fotoFehlt: boolean } {
  return {
    offeneAufgaben: e.aufgaben.filter((t) => !t.erledigt).length,
    fotoFehlt: e.aufgaben.some((t) => t.fotoPflicht) && e.fotos === 0,
  };
}

/** Prüft einen gescannten QR-Code gegen das Objekt (URL …/qr/<kennung> oder nur die Kennung). */
export function qrPasst(gescannt: string, kennung: string): boolean {
  const t = gescannt.trim().toLowerCase();
  const k = kennung.toLowerCase();
  return t === k || t.endsWith(`/${k}`) || t.endsWith(`=${k}`);
}

/** Navigations-Link: Apple Karten auf iPhone/iPad, sonst Google Maps. */
export function navigationsLink(o: AppEinsatz["objekt"], apple: boolean): string {
  const ziel =
    o.lat !== null && o.lng !== null
      ? `${o.lat},${o.lng}`
      : [o.strasse, o.plz, o.ort].filter(Boolean).join(" ");
  const q = encodeURIComponent(ziel);
  return apple
    ? `https://maps.apple.com/?daddr=${q}`
    : `https://www.google.com/maps/dir/?api=1&destination=${q}`;
}

// ---------------------------------------------------------------------------
// Packliste
// ---------------------------------------------------------------------------

export type PacklistenEinsatz = {
  vorlage: Vorlagenzeit;
  bedarfe: Bedarf[];
  umfang: Einsatzumfang;
};

/** Material für alle Einsätze des Tages, je Artikel summiert und aufgerundet auf 0,1. */
export function packliste(einsaetze: PacklistenEinsatz[], artikel: AppArtikel[]): Packposten[] {
  const summe = new Map<string, number>();
  for (const e of einsaetze) {
    for (const [id, menge] of bedarfJeEinsatz(e.bedarfe, e.umfang, e.vorlage)) {
      summe.set(id, (summe.get(id) ?? 0) + menge);
    }
  }
  const nachId = new Map(artikel.map((a) => [a.id, a]));
  return [...summe]
    .map(([artikelId, menge]) => ({
      artikelId,
      name: nachId.get(artikelId)?.name ?? "Artikel",
      einheit: nachId.get(artikelId)?.einheit ?? "",
      menge: Math.ceil(menge * 10 - 1e-9) / 10,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "de"));
}
