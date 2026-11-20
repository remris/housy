import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { als, benutzer, neueDatenbank, wert } from "./harness";

let db: PGlite;
let a: string;
let b: string;
let ma: string;
let maMitglied: string;
let betriebA: string;
let betriebB: string;
let kunde: string;
let objekt: string;
let vorlage: string;
let vertrag: string;

beforeAll(async () => {
  db = await neueDatenbank();
  a = await benutzer(db, "a@x.de", { betrieb_name: "A" });
  b = await benutzer(db, "b@x.de", { betrieb_name: "B" });
  betriebA = await wert(db, "select id from public.betrieb where name='A'");
  betriebB = await wert(db, "select id from public.betrieb where name='B'");
  ma = await benutzer(db, "ma@x.de");
  maMitglied = await wert(
    db,
    "insert into public.mitglied (betrieb_id, user_id, rolle) values ($1, $2, 'mitarbeiter') returning id",
    [betriebA, ma],
  );
  await als(db, a, async (tx) => {
    kunde = await wert(
      tx,
      "insert into public.kunde (betrieb_id, name) values ($1, 'HV Müller') returning id",
      [betriebA],
    );
    objekt = await wert(
      tx,
      "insert into public.objekt (betrieb_id, kunde_id, name) values ($1, $2, 'Hauptstr. 12') returning id",
      [betriebA, kunde],
    );
    vorlage = await wert(
      tx,
      "insert into public.auftragsvorlage (betrieb_id, name) values ($1, 'Treppenhaus') returning id",
      [betriebA],
    );
    vertrag = await wert(
      tx,
      "insert into public.vertrag (betrieb_id, kunde_id, objekt_id, titel, beginn) values ($1, $2, $3, 'Treppenhaus', '2026-12-01') returning id",
      [betriebA, kunde, objekt],
    );
    const v1 = await wert<string>(
      tx,
      "insert into public.vertragsversion (betrieb_id, vertrag_id, version, gueltig_ab, abrechnungsart, pauschale_cent) values ($1, $2, 1, '2026-12-01', 'pauschale', 42000) returning id",
      [betriebA, vertrag],
    );
    await tx.query(
      "insert into public.vertragsleistung (betrieb_id, version_id, vorlage_id, frequenz, wochentage, zeitfenster_von, zeitfenster_bis) values ($1, $2, $3, 'woechentlich', '{1}', '07:00', '10:00')",
      [betriebA, v1, vorlage],
    );
  });
}, 60_000);

describe("Verträge", () => {
  it("Vertragsnummer wird vergeben", async () => {
    expect(
      Number(await wert(db, "select vertragsnummer from public.vertrag where id=$1", [vertrag])),
    ).toBe(1);
  });

  it("Objekt muss zum Kunden gehören", async () => {
    const andererKunde = await als(db, a, (tx) =>
      wert<string>(
        tx,
        "insert into public.kunde (betrieb_id, name) values ($1, 'X') returning id",
        [betriebA],
      ),
    );
    await expect(
      als(db, a, (tx) =>
        tx.query(
          "insert into public.vertrag (betrieb_id, kunde_id, objekt_id, titel, beginn) values ($1, $2, $3, 'x', '2026-12-01')",
          [betriebA, andererKunde, objekt],
        ),
      ),
    ).rejects.toThrow(/gehört nicht zum Kunden/);
  });

  it("Pauschale braucht Betrag, Wochentage bei wöchentlich Pflicht", async () => {
    await expect(
      als(db, a, (tx) =>
        tx.query(
          "insert into public.vertragsversion (betrieb_id, vertrag_id, version, gueltig_ab, abrechnungsart) values ($1, $2, 2, '2027-01-01', 'pauschale')",
          [betriebA, vertrag],
        ),
      ),
    ).rejects.toThrow(/check/);
  });

  it("Mitarbeiter und fremde Betriebe sehen keine Verträge", async () => {
    for (const u of [ma, b]) {
      for (const t of ["vertrag", "vertragsversion", "vertragsleistung"]) {
        expect(
          await als(db, u, (tx) => wert<number>(tx, `select count(*)::int from public.${t}`)),
          t,
        ).toBe(0);
      }
    }
  });
});

describe("Einsätze", () => {
  it("Serien-Einsatz ist je Vertrag/Vorlage/Tag eindeutig", async () => {
    const sql =
      "insert into public.einsatz (betrieb_id, objekt_id, vorlage_id, vertrag_id, datum) values ($1, $2, $3, $4, '2026-12-07')";
    await als(db, a, (tx) => tx.query(sql, [betriebA, objekt, vorlage, vertrag]));
    await expect(
      als(db, a, (tx) => tx.query(sql, [betriebA, objekt, vorlage, vertrag])),
    ).rejects.toThrow(/duplicate key/);
  });

  it("Mitarbeiter sieht nur eigene Einsätze", async () => {
    await als(db, a, (tx) =>
      tx.query(
        "insert into public.einsatz (betrieb_id, objekt_id, vorlage_id, vertrag_id, datum, mitarbeiter_id, status) values ($1, $2, $3, $4, '2026-12-14', $5, 'zugewiesen')",
        [betriebA, objekt, vorlage, vertrag, maMitglied],
      ),
    );
    const n = await als(db, ma, (tx) =>
      wert<number>(tx, "select count(*)::int from public.einsatz"),
    );
    expect(n).toBe(1);
    expect(
      await als(db, b, (tx) => wert<number>(tx, "select count(*)::int from public.einsatz")),
    ).toBe(0);
  });

  it("Mitarbeiter eines anderen Betriebs kann nicht zugewiesen werden", async () => {
    const fremd = await wert<string>(db, "select id from public.mitglied where betrieb_id=$1", [
      betriebB,
    ]);
    await expect(
      als(db, a, (tx) =>
        tx.query("update public.einsatz set mitarbeiter_id = $1 where datum = '2026-12-07'", [
          fremd,
        ]),
      ),
    ).rejects.toThrow(/gehört nicht zum Betrieb/);
  });
});

describe("Unterschrift per Link", () => {
  it("anon sieht Info und kann einmal unterschreiben", async () => {
    const token = await wert<string>(db, "select freigabe_token from public.vertrag where id=$1", [
      vertrag,
    ]);
    const info = await als(db, null, (tx) =>
      tx.query("select * from public.vertrag_freigabe_info($1)", [token]),
    );
    expect(info.rows[0]).toMatchObject({ titel: "Treppenhaus", kunde_name: "HV Müller" });
    await expect(
      als(db, null, (tx) =>
        tx.query("select public.vertrag_unterschreiben($1, 'M', 'kaputt')", [token]),
      ),
    ).rejects.toThrow(/erforderlich/);
    await als(db, null, (tx) =>
      tx.query(
        "select public.vertrag_unterschreiben($1, 'Max Müller', 'data:image/png;base64,AAAA')",
        [token],
      ),
    );
    expect(
      await wert(db, "select unterschrift_name from public.vertrag where id=$1", [vertrag]),
    ).toBe("Max Müller");
    await expect(
      als(db, null, (tx) =>
        tx.query("select public.vertrag_unterschreiben($1, 'Max', 'data:image/png;base64,AAAA')", [
          token,
        ]),
      ),
    ).rejects.toThrow(/bereits unterschrieben/);
  });

  it("anon kann Vertragstabelle nicht direkt lesen", async () => {
    expect(
      await als(db, null, (tx) => wert<number>(tx, "select count(*)::int from public.vertrag")),
    ).toBe(0);
  });
});

describe("Versionen und Dokument", () => {
  it("neue Version übernimmt Leistungen der Vorversion", async () => {
    const neu = await als(db, a, (tx) =>
      wert<string>(
        tx,
        "select public.vertragsversion_anlegen($1, '2027-01-01', 'pauschale', 45000, 'Kellerfenster dazu')",
        [vertrag],
      ),
    );
    const r = await als(db, a, (tx) =>
      tx.query<{ version: number; n: number }>(
        "select v.version, (select count(*)::int from public.vertragsleistung l where l.version_id = v.id) as n from public.vertragsversion v where v.id = $1",
        [neu],
      ),
    );
    expect(r.rows[0]).toEqual({ version: 2, n: 1 });
  });

  it("Mitarbeiter darf keine Version anlegen", async () => {
    await expect(
      als(db, ma, (tx) =>
        tx.query("select public.vertragsversion_anlegen($1, '2027-02-01', 'aufwand', null, null)", [
          vertrag,
        ]),
      ),
    ).rejects.toThrow(/Keine Berechtigung/);
  });

  it("Dokument per Token enthält Versionen und Leistungen", async () => {
    const token = await wert<string>(db, "select freigabe_token from public.vertrag where id=$1", [
      vertrag,
    ]);
    const d = await als(db, null, (tx) =>
      wert<{
        versionen: { version: number; leistungen: { bezeichnung: string }[] }[];
        vertrag: Record<string, unknown>;
      }>(tx, "select public.vertrag_dokument($1)", [token]),
    );
    expect(d.versionen.map((v) => v.version)).toEqual([1, 2]);
    expect(d.versionen[0]!.leistungen[0]!.bezeichnung).toBe("Treppenhaus");
    expect(d.vertrag).not.toHaveProperty("freigabe_token");
  });
});
