import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { als, benutzer, neueDatenbank, wert } from "./harness";

let db: PGlite;
let a: string;
let b: string;
let ma: string;
let ma2: string;
let betriebA: string;
let kunde: string;
let objekt: string;
let einsatz: string;
let meldung: string;

const BILD = "data:image/png;base64,iVBORw0KGgo=";

beforeAll(async () => {
  db = await neueDatenbank();
  a = await benutzer(db, "a@x.de", { betrieb_name: "A" });
  b = await benutzer(db, "b@x.de", { betrieb_name: "B" });
  betriebA = await wert(db, "select id from public.betrieb where name='A'");
  ma = await benutzer(db, "ma@x.de");
  ma2 = await benutzer(db, "ma2@x.de");
  const maMitglied = await wert<string>(
    db,
    "insert into public.mitglied (betrieb_id, user_id, rolle) values ($1, $2, 'mitarbeiter') returning id",
    [betriebA, ma],
  );
  await db.query(
    "insert into public.mitglied (betrieb_id, user_id, rolle) values ($1, $2, 'mitarbeiter')",
    [betriebA, ma2],
  );
  await als(db, a, async (tx) => {
    kunde = await wert(
      tx,
      "insert into public.kunde (betrieb_id, name, email) values ($1, 'K', 'k@kunde.de') returning id",
      [betriebA],
    );
    objekt = await wert(
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
  await als(db, ma, async (tx) => {
    meldung = crypto.randomUUID();
    await tx.query("select public.app_meldung($1, $2, 'mangel', 'Tür klemmt')", [meldung, einsatz]);
  });
});

describe("Abnahme-Unterschrift", () => {
  it("Mitarbeiter unterschreibt den eigenen Einsatz, neuere Unterschrift gewinnt", async () => {
    await als(db, ma, (tx) =>
      tx.query("select public.app_abnahme($1, 'Frau Kunde', $2, now() - interval '5 minutes')", [
        einsatz,
        BILD,
      ]),
    );
    // ältere Wiederholung ändert nichts
    await als(db, ma, (tx) =>
      tx.query("select public.app_abnahme($1, 'Alt', $2, now() - interval '1 hour')", [
        einsatz,
        BILD,
      ]),
    );
    expect(await wert(db, "select abnahme_name from public.einsatz where id=$1", [einsatz])).toBe(
      "Frau Kunde",
    );
  });

  it("Kollege kann fremden Einsatz nicht unterschreiben, leere Unterschrift wird abgelehnt", async () => {
    await expect(
      als(db, ma2, (tx) =>
        tx.query("select public.app_abnahme($1, 'X', $2, now())", [einsatz, BILD]),
      ),
    ).rejects.toThrow(/nicht zugewiesen/);
    await expect(
      als(db, ma, (tx) => tx.query("select public.app_abnahme($1, 'X', '', now())", [einsatz])),
    ).rejects.toThrow(/Unterschrift/);
  });
});

describe("Mängelstatus", () => {
  it("Status und erledigt_am bleiben im Einklang", async () => {
    await als(db, a, (tx) =>
      tx.query("update public.einsatz_meldung set status='in_bearbeitung' where id=$1", [meldung]),
    );
    expect(
      await wert(db, "select erledigt_am is null from public.einsatz_meldung where id=$1", [
        meldung,
      ]),
    ).toBe(true);
    await als(db, a, (tx) =>
      tx.query("update public.einsatz_meldung set status='erledigt' where id=$1", [meldung]),
    );
    expect(
      await wert(db, "select erledigt_am is not null from public.einsatz_meldung where id=$1", [
        meldung,
      ]),
    ).toBe(true);
    // älterer Weg über erledigt_am setzt den Status mit
    await als(db, a, (tx) =>
      tx.query("update public.einsatz_meldung set erledigt_am=null where id=$1", [meldung]),
    );
    expect(
      await wert(db, "select status::text from public.einsatz_meldung where id=$1", [meldung]),
    ).toBe("offen");
  });

  it("Mitarbeiter kann den Status nicht ändern", async () => {
    await als(db, ma, (tx) =>
      tx.query("update public.einsatz_meldung set status='erledigt' where id=$1", [meldung]),
    );
    expect(
      await wert(db, "select status::text from public.einsatz_meldung where id=$1", [meldung]),
    ).toBe("offen");
  });
});

describe("Nachweise", () => {
  let nachweis: string;

  beforeAll(async () => {
    // Anlegen nur serverseitig (wie der Admin-Client)
    nachweis = await wert(
      db,
      `insert into public.nachweis (betrieb_id, art, kunde_id, objekt_id, einsatz_id, von, bis, status)
       values ($1, 'einsatz', $2, $3, $4, current_date, current_date, 'gesendet') returning id`,
      [betriebA, kunde, objekt, einsatz],
    );
    await db.query(
      `insert into public.mail_protokoll (betrieb_id, art, bezug_id, empfaenger, betreff)
       values ($1, 'nachweis', $2, '{k@kunde.de}', 'Nachweis')`,
      [betriebA, nachweis],
    );
  });

  it("je Einsatz nur ein Nachweis", async () => {
    await expect(
      db.query(
        `insert into public.nachweis (betrieb_id, art, kunde_id, objekt_id, einsatz_id, von, bis)
         values ($1, 'einsatz', $2, $3, $4, current_date, current_date)`,
        [betriebA, kunde, objekt, einsatz],
      ),
    ).rejects.toThrow(/duplicate|eindeutig|unique/i);
  });

  it("Büro sieht Nachweise und Mail-Protokoll, Mitarbeiter und Betrieb B nicht", async () => {
    const zaehle = (u: string) =>
      als(db, u, (tx) =>
        wert<number>(
          tx,
          "select (select count(*) from public.nachweis) + (select count(*) from public.mail_protokoll)",
        ),
      );
    expect(Number(await zaehle(a))).toBe(2);
    expect(Number(await zaehle(ma))).toBe(0);
    expect(Number(await zaehle(b))).toBe(0);
  });

  it("Büro kann Nachweise nicht direkt anlegen oder ändern", async () => {
    await expect(
      als(db, a, (tx) =>
        tx.query(
          `insert into public.nachweis (betrieb_id, art, kunde_id, objekt_id, von, bis)
           values ($1, 'monat', $2, $3, '2026-10-01', '2026-10-31')`,
          [betriebA, kunde, objekt],
        ),
      ),
    ).rejects.toThrow(/row-level security/);
    await als(db, a, (tx) =>
      tx.query("update public.nachweis set status='fehler' where id=$1", [nachweis]),
    );
    expect(await wert(db, "select status::text from public.nachweis where id=$1", [nachweis])).toBe(
      "gesendet",
    );
  });

  it("prüft die Nachweis-Adresse des Kunden", async () => {
    await expect(
      als(db, a, (tx) =>
        tx.query("update public.kunde set nachweis_email='kein-mail' where id=$1", [kunde]),
      ),
    ).rejects.toThrow(/check/i);
  });
});
