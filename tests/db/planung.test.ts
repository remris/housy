import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { als, benutzer, neueDatenbank, wert } from "./harness";

let db: PGlite;
let a: string;
let ma: string;
let betriebA: string;
let maMitglied: string;
let objekt: string;
let vorlage: string;
let vertrag: string;

beforeAll(async () => {
  db = await neueDatenbank();
  a = await benutzer(db, "a@x.de", { betrieb_name: "A" });
  await benutzer(db, "b@x.de", { betrieb_name: "B" });
  betriebA = await wert(db, "select id from public.betrieb where name='A'");
  ma = await benutzer(db, "ma@x.de");
  maMitglied = await wert(
    db,
    "insert into public.mitglied (betrieb_id, user_id, rolle) values ($1, $2, 'mitarbeiter') returning id",
    [betriebA, ma],
  );
  await als(db, a, async (tx) => {
    const kunde = await wert<string>(
      tx,
      "insert into public.kunde (betrieb_id, name) values ($1, 'K') returning id",
      [betriebA],
    );
    objekt = await wert(
      tx,
      "insert into public.objekt (betrieb_id, kunde_id, name) values ($1, $2, 'O') returning id",
      [betriebA, kunde],
    );
    vorlage = await wert(
      tx,
      "insert into public.auftragsvorlage (betrieb_id, name) values ($1, 'V') returning id",
      [betriebA],
    );
    vertrag = await wert(
      tx,
      "insert into public.vertrag (betrieb_id, kunde_id, objekt_id, titel, beginn) values ($1, $2, $3, 'T', '2026-12-01') returning id",
      [betriebA, kunde, objekt],
    );
  });
}, 60_000);

const neuerEinsatz = (datum: string, mitarbeiter: string | null = null) =>
  als(db, a, (tx) =>
    wert<string>(
      tx,
      "insert into public.einsatz (betrieb_id, objekt_id, vorlage_id, vertrag_id, datum, mitarbeiter_id) values ($1, $2, $3, $4, $5, $6) returning id",
      [betriebA, objekt, vorlage, vertrag, datum, mitarbeiter],
    ),
  );

describe("Planung", () => {
  it("Seriendatum wird vorbelegt, Status folgt der Zuweisung", async () => {
    const id = await neuerEinsatz("2026-12-07");
    const zeile = async () =>
      (
        await db.query<{ serien_datum: string; status: string }>(
          "select serien_datum::text, status::text from public.einsatz where id=$1",
          [id],
        )
      ).rows[0]!;
    expect(await zeile()).toEqual({ serien_datum: "2026-12-07", status: "geplant" });

    await als(db, a, (tx) =>
      tx.query("update public.einsatz set mitarbeiter_id=$2, datum='2026-12-08' where id=$1", [
        id,
        maMitglied,
      ]),
    );
    expect(await zeile()).toEqual({ serien_datum: "2026-12-07", status: "zugewiesen" });

    await als(db, a, (tx) =>
      tx.query("update public.einsatz set mitarbeiter_id=null where id=$1", [id]),
    );
    expect((await zeile()).status).toBe("geplant");
  });

  it("begonnene Einsätze behalten ihren Status", async () => {
    const id = await neuerEinsatz("2026-12-09", maMitglied);
    await als(db, a, (tx) =>
      tx.query("update public.einsatz set status='begonnen' where id=$1", [id]),
    );
    await als(db, a, (tx) =>
      tx.query("update public.einsatz set mitarbeiter_id=null where id=$1", [id]),
    );
    expect(await wert(db, "select status::text from public.einsatz where id=$1", [id])).toBe(
      "begonnen",
    );
  });

  it("verschobener Serieneinsatz blockiert keinen anderen Serientermin am neuen Tag", async () => {
    const montag = await neuerEinsatz("2026-12-14");
    await als(db, a, (tx) =>
      tx.query("update public.einsatz set datum='2026-12-15' where id=$1", [montag]),
    );
    // Serientermin Dienstag derselben Vorlage darf trotzdem entstehen
    await expect(neuerEinsatz("2026-12-15")).resolves.toBeTypeOf("string");
    // aber nicht zweimal derselbe Serientermin
    await expect(neuerEinsatz("2026-12-14")).rejects.toThrow(/einsatz_serie_eindeutig/);
  });

  it("eine Tour je Mitarbeiter und Tag", async () => {
    const tour = () =>
      als(db, a, (tx) =>
        tx.query(
          "insert into public.tour (betrieb_id, mitarbeiter_id, datum) values ($1, $2, $3)",
          [betriebA, maMitglied, "2026-12-07"],
        ),
      );
    await tour();
    await expect(tour()).rejects.toThrow(/tour_mitarbeiter_id_datum_key/);
  });

  it("Arbeitszeit und Abwesenheit werden geprüft", async () => {
    await expect(
      als(db, a, (tx) =>
        tx.query(
          "insert into public.mitarbeiter_verfuegbarkeit (betrieb_id, mitglied_id, wochentag, von, bis) values ($1, $2, 1, '14:00', '06:00')",
          [betriebA, maMitglied],
        ),
      ),
    ).rejects.toThrow(/check/);
    await expect(
      als(db, a, (tx) =>
        tx.query(
          "insert into public.abwesenheit (betrieb_id, mitglied_id, von, bis) values ($1, $2, '2026-12-10', '2026-12-01')",
          [betriebA, maMitglied],
        ),
      ),
    ).rejects.toThrow(/check/);
  });

  it("Mitarbeiter sieht eigene Tour, ändert sie aber nicht", async () => {
    const n = await als(db, ma, (tx) => wert<number>(tx, "select count(*)::int from public.tour"));
    expect(n).toBe(1);
    const r = await als(db, ma, (tx) =>
      tx.query("update public.tour set startzeit='05:00' returning id"),
    );
    expect(r.rows).toHaveLength(0);
  });
});
