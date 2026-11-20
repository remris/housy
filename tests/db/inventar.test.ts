import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { als, benutzer, neueDatenbank, wert } from "./harness";

let db: PGlite;
let a: string;
let b: string;
let ma: string;
let ma2: string;
let betriebA: string;
let maMitglied: string;
let zentrallager: string;
let autoMa: string;
let autoFremd: string;
let reiniger: string;
let gummi: string;
let leiter: string;
let einsatz: string;

const uuid = () => crypto.randomUUID();
const menge = async (ort: string, artikel: string) =>
  Number(
    (
      await db.query<{ menge: string }>(
        "select menge from public.bestand where lagerort_id=$1 and artikel_id=$2",
        [ort, artikel],
      )
    ).rows[0]?.menge ?? 0,
  );

beforeAll(async () => {
  db = await neueDatenbank();
  a = await benutzer(db, "a@x.de", { betrieb_name: "A" });
  b = await benutzer(db, "b@x.de", { betrieb_name: "B" });
  betriebA = await wert(db, "select id from public.betrieb where name='A'");
  ma = await benutzer(db, "ma@x.de");
  ma2 = await benutzer(db, "ma2@x.de");
  maMitglied = await wert(
    db,
    "insert into public.mitglied (betrieb_id, user_id, rolle) values ($1, $2, 'mitarbeiter') returning id",
    [betriebA, ma],
  );
  await db.query(
    "insert into public.mitglied (betrieb_id, user_id, rolle) values ($1, $2, 'mitarbeiter')",
    [betriebA, ma2],
  );
  await als(db, a, async (tx) => {
    const fahrzeug = await wert<string>(
      tx,
      "insert into public.fahrzeug (betrieb_id, name, mitglied_id) values ($1, 'Caddy', $2) returning id",
      [betriebA, maMitglied],
    );
    const fremd = await wert<string>(
      tx,
      "insert into public.fahrzeug (betrieb_id, name) values ($1, 'Transporter') returning id",
      [betriebA],
    );
    autoMa = await wert(tx, "select id from public.lagerort where fahrzeug_id=$1", [fahrzeug]);
    autoFremd = await wert(tx, "select id from public.lagerort where fahrzeug_id=$1", [fremd]);
    zentrallager = await wert(
      tx,
      "select id from public.lagerort where betrieb_id=$1 and standard",
      [betriebA],
    );
    reiniger = await wert(
      tx,
      "insert into public.artikel (betrieb_id, name, einheit, gebinde_name, gebinde_menge) values ($1, 'Allzweckreiniger', 'l', 'Kanister', 10) returning id",
      [betriebA],
    );
    gummi = await wert(
      tx,
      "insert into public.artikel (betrieb_id, name, art, lebensdauer, lebensdauer_einheit, mindestbestand) values ($1, 'Abziehergummi', 'verschleiss', 500, 'fenster', 2) returning id",
      [betriebA],
    );
    leiter = await wert(
      tx,
      "insert into public.artikel (betrieb_id, name, art, pruefintervall_monate) values ($1, 'Leiter', 'geraet', 12) returning id",
      [betriebA],
    );
    const kunde = await wert<string>(
      tx,
      "insert into public.kunde (betrieb_id, name) values ($1, 'K') returning id",
      [betriebA],
    );
    const objekt = await wert<string>(
      tx,
      "insert into public.objekt (betrieb_id, kunde_id, name) values ($1, $2, 'O') returning id",
      [betriebA, kunde],
    );
    const vorlage = await wert<string>(
      tx,
      "insert into public.auftragsvorlage (betrieb_id, name) values ($1, 'V') returning id",
      [betriebA],
    );
    einsatz = await wert(
      tx,
      "insert into public.einsatz (betrieb_id, objekt_id, vorlage_id, datum, mitarbeiter_id, quelle) values ($1, $2, $3, current_date, $4, 'manuell') returning id",
      [betriebA, objekt, vorlage, maMitglied],
    );
  });
});

describe("Lagerorte und Bestand", () => {
  it("jeder Betrieb hat ein Zentrallager, Fahrzeuge bekommen ihren Lagerort", async () => {
    expect(zentrallager).toBeTruthy();
    expect(autoMa).toBeTruthy();
    expect(Number(await wert(db, "select count(*) from public.lagerort where standard"))).toBe(2); // A und B
  });

  it("Bewegungen führen den Bestand: Zugang, Umbuchung, Abbuchung", async () => {
    await als(db, a, async (tx) => {
      await tx.query(
        "insert into public.lagerbewegung (betrieb_id, artikel_id, art, menge, nach_lagerort_id) values ($1, $2, 'zugang', 40, $3)",
        [betriebA, reiniger, zentrallager],
      );
      await tx.query(
        "insert into public.lagerbewegung (betrieb_id, artikel_id, art, menge, von_lagerort_id, nach_lagerort_id) values ($1, $2, 'umbuchung', 10, $3, $4)",
        [betriebA, reiniger, zentrallager, autoMa],
      );
      await tx.query(
        "insert into public.lagerbewegung (betrieb_id, artikel_id, art, menge, von_lagerort_id, einsatz_id) values ($1, $2, 'abgang_einsatz', 0.5, $3, $4)",
        [betriebA, reiniger, autoMa, einsatz],
      );
    });
    expect(await menge(zentrallager, reiniger)).toBe(30);
    expect(await menge(autoMa, reiniger)).toBe(9.5);
  });

  it("je Einsatz und Artikel nur eine Abbuchung; Bewegungen passen zur Art", async () => {
    await expect(
      db.query(
        "insert into public.lagerbewegung (betrieb_id, artikel_id, art, menge, von_lagerort_id, einsatz_id) values ($1, $2, 'abgang_einsatz', 0.5, $3, $4)",
        [betriebA, reiniger, autoMa, einsatz],
      ),
    ).rejects.toThrow(/duplicate|unique/i);
    await expect(
      db.query(
        "insert into public.lagerbewegung (betrieb_id, artikel_id, art, menge, von_lagerort_id) values ($1, $2, 'zugang', 1, $3)",
        [betriebA, reiniger, zentrallager],
      ),
    ).rejects.toThrow(/check/i);
  });

  it("Bewegungen lassen sich nicht ändern oder löschen", async () => {
    await als(db, a, async (tx) => {
      await tx.query("update public.lagerbewegung set menge = 99");
      await tx.query("delete from public.lagerbewegung");
    });
    expect(Number(await wert(db, "select max(menge) from public.lagerbewegung"))).toBe(40);
  });
});

describe("App: geladen und gewechselt", () => {
  it("Mitarbeiter lädt ins eigene Fahrzeug (idempotent), nicht in fremde", async () => {
    const id = uuid();
    for (let i = 0; i < 2; i++) {
      await als(db, ma, (tx) =>
        tx.query("select public.app_geladen($1, $2, 10, $3)", [id, reiniger, autoMa]),
      );
    }
    expect(await menge(autoMa, reiniger)).toBe(19.5);
    expect(await menge(zentrallager, reiniger)).toBe(20);
    await expect(
      als(db, ma, (tx) =>
        tx.query("select public.app_geladen($1, $2, 10, $3)", [uuid(), reiniger, autoFremd]),
      ),
    ).rejects.toThrow(/Nicht dein Fahrzeug/);
    await expect(
      als(db, ma, (tx) =>
        tx.query(
          "insert into public.lagerbewegung (betrieb_id, artikel_id, art, menge, nach_lagerort_id) values ($1, $2, 'zugang', 5, $3)",
          [betriebA, reiniger, autoMa],
        ),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("Wechsel setzt den Zähler-Beginn, bucht ein Ersatzteil ab; fremdes Werkzeug abgelehnt", async () => {
    const werkzeug = await als(db, a, async (tx) => {
      await tx.query(
        "insert into public.lagerbewegung (betrieb_id, artikel_id, art, menge, nach_lagerort_id) values ($1, $2, 'zugang', 2, $3)",
        [betriebA, gummi, zentrallager],
      );
      return wert<string>(
        tx,
        "insert into public.werkzeug (betrieb_id, artikel_id, bezeichnung, mitglied_id, startstand) values ($1, $2, 'Abzieher 45 cm', $3, 380) returning id",
        [betriebA, gummi, maMitglied],
      );
    });
    await als(db, ma, (tx) =>
      tx.query("select public.app_werkzeug_gewechselt($1, $2, now() - interval '1 day', 520)", [
        uuid(),
        werkzeug,
      ]),
    );
    expect(await menge(zentrallager, gummi)).toBe(1);
    // nachträglich früher datierter Wechsel verschiebt den Zähler-Beginn nicht zurück
    await als(db, a, (tx) =>
      tx.query(
        "insert into public.werkzeug_wechsel (betrieb_id, werkzeug_id, am, stand, grund) values ($1, $2, now() - interval '30 days', 500, 'defekt')",
        [betriebA, werkzeug],
      ),
    );
    expect(
      await wert<boolean>(
        db,
        "select letzter_wechsel_am > now() - interval '2 days' from public.werkzeug where id=$1",
        [werkzeug],
      ),
    ).toBe(true);
    await expect(
      als(db, ma2, (tx) =>
        tx.query("select public.app_werkzeug_gewechselt($1, $2, now(), 10)", [uuid(), werkzeug]),
      ),
    ).rejects.toThrow(/Nicht dein Werkzeug/);
  });

  it("bestandene Prüfung setzt den nächsten Termin nach dem Prüfintervall", async () => {
    const w = await als(db, a, async (tx) => {
      const id = await wert<string>(
        tx,
        "insert into public.werkzeug (betrieb_id, artikel_id, bezeichnung, naechste_pruefung) values ($1, $2, 'Leiter 3 m', '2026-12-04') returning id",
        [betriebA, leiter],
      );
      await tx.query(
        "insert into public.werkzeug_pruefung (betrieb_id, werkzeug_id, am) values ($1, $2, '2026-11-20')",
        [betriebA, id],
      );
      return id;
    });
    expect(
      await wert(db, "select naechste_pruefung::text from public.werkzeug where id=$1", [w]),
    ).toBe("2027-11-20");
  });
});

describe("Mandantentrennung", () => {
  it("Betrieb B sieht nichts von A, Mitarbeiter sieht Bestände, aber keine Bestellungen", async () => {
    await als(db, a, (tx) =>
      tx.query(
        "insert into public.bestellung (betrieb_id, artikel_id, menge) values ($1, $2, 30)",
        [betriebA, reiniger],
      ),
    );
    const zaehle = (u: string, t: string) =>
      als(db, u, (tx) => wert<number>(tx, `select count(*) from public.${t}`));
    for (const t of ["bestand", "lagerbewegung", "werkzeug", "bestellung", "werkzeug_wechsel"]) {
      expect(Number(await zaehle(b, t)), t).toBe(0);
    }
    expect(Number(await zaehle(b, "lagerort"))).toBe(1); // nur das eigene Zentrallager
    expect(Number(await zaehle(ma, "bestand"))).toBeGreaterThan(0);
    expect(Number(await zaehle(ma, "bestellung"))).toBe(0);
  });
});
