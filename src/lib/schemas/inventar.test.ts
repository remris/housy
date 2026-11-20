import { describe, expect, it } from "vitest";
import { fahrzeugSchema } from "./planung";
import { bestellungSchema, bewegungSchema, werkzeugSchema } from "./inventar";

/** Formular prüft im Browser, die Server Action prüft das Ergebnis noch einmal. */
const zweimal = <T>(schema: { parse: (x: unknown) => T }, eingabe: unknown) =>
  schema.parse(schema.parse(eingabe));

const ID = "5f1c2f8e-7a0b-4c55-9b1e-2d3c4b5a6f70";

describe("Inventar-Schemas", () => {
  it("überstehen die zweite Prüfung auf dem Server", () => {
    expect(
      zweimal(werkzeugSchema, {
        artikel_id: ID,
        bezeichnung: "Abzieher",
        mitglied_id: "",
        fahrzeug_id: null,
        startstand: "380",
        naechste_pruefung: "",
      }),
    ).toMatchObject({ startstand: 380, naechste_pruefung: null, mitglied_id: null });
    expect(
      zweimal(bestellungSchema, { artikel_id: ID, menge: "2,5", lieferant: "" }),
    ).toMatchObject({
      menge: 2.5,
    });
    expect(
      zweimal(fahrzeugSchema, {
        name: "Caddy",
        kennzeichen: "",
        notiz: "",
        aktiv: true,
        mitglied_id: "",
      }),
    ).toMatchObject({ mitglied_id: null });
  });

  it("Bewegung: Umbuchung braucht zwei verschiedene Orte, Inventur erlaubt 0", () => {
    const basis = { artikel_id: ID, notiz: "", von_lagerort_id: null, nach_lagerort_id: ID };
    expect(bewegungSchema.safeParse({ ...basis, art: "umbuchung", menge: "1" }).success).toBe(
      false,
    );
    expect(
      bewegungSchema.safeParse({ ...basis, art: "umbuchung", menge: "1", von_lagerort_id: ID })
        .success,
    ).toBe(false);
    expect(bewegungSchema.safeParse({ ...basis, art: "inventur", menge: "0" }).success).toBe(true);
    expect(bewegungSchema.safeParse({ ...basis, art: "zugang", menge: "0" }).success).toBe(false);
  });
});

describe("Anfrage- und Website-Schemas", () => {
  it("überstehen die zweite Prüfung", async () => {
    const { websiteSchema, angebotSchema } = await import("./anfrage");
    expect(
      zweimal(websiteSchema, {
        anfrage_aktiv: true,
        datenschutz_url: "",
        impressum_url: "https://x.de/impressum",
      }),
    ).toEqual({
      anfrage_aktiv: true,
      datenschutz_url: null,
      impressum_url: "https://x.de/impressum",
    });
    const angebot = zweimal(angebotSchema, {
      kunde_id: "",
      objekt_id: null,
      kundentyp: "firma",
      empfaenger_name: "Erika",
      empfaenger_firma: "",
      empfaenger_email: "",
      empfaenger_telefon: "",
      strasse: "",
      plz: "",
      ort: "",
      objekt_name: "",
      objekt_strasse: "",
      objekt_plz: "",
      objekt_ort: "",
      titel: "Treppenhaus",
      einleitung: "",
      beginn: "2026-12-01",
      gueltig_bis: "",
      abrechnungsart: "pauschale",
      pauschale_cent: "420,00",
      laufzeit_monate: 12,
      kuendigungsfrist_monate: 3,
    });
    expect(angebot).toMatchObject({ pauschale_cent: 42000, gueltig_bis: null, kunde_id: null });
  });
});
