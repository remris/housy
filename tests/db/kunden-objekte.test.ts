import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { als, benutzer, neueDatenbank, wert } from "./harness";

let db: PGlite;
let a: string; // Inhaber A
let b: string; // Inhaber B
let ma: string; // Mitarbeiter A
let betriebA: string;
let betriebB: string;
let kundeA: string;
let objektA: string;

beforeAll(async () => {
  db = await neueDatenbank();
  a = await benutzer(db, "a@x.de", { betrieb_name: "A" });
  b = await benutzer(db, "b@x.de", { betrieb_name: "B" });
  betriebA = await wert(db, "select id from public.betrieb where name='A'");
  betriebB = await wert(db, "select id from public.betrieb where name='B'");
  ma = await benutzer(db, "ma@x.de");
  await db.query(
    "insert into public.mitglied (betrieb_id, user_id, rolle) values ($1, $2, 'mitarbeiter')",
    [betriebA, ma],
  );
  kundeA = await als(db, a, (tx) =>
    wert<string>(
      tx,
      "insert into public.kunde (betrieb_id, name, typ) values ($1, 'Hausverwaltung Müller', 'verwaltung') returning id",
      [betriebA],
    ),
  );
  objektA = await als(db, a, (tx) =>
    wert<string>(
      tx,
      "insert into public.objekt (betrieb_id, kunde_id, name, strasse, plz, ort) values ($1, $2, 'Hauptstraße 12', 'Hauptstraße 12', '70173', 'Stuttgart') returning id",
      [betriebA, kundeA],
    ),
  );
}, 60_000);

describe("Kundennummern", () => {
  it("werden je Betrieb fortlaufend vergeben", async () => {
    const nummern = await als(db, a, async (tx) => {
      await tx.query("insert into public.kunde (betrieb_id, name) values ($1, 'Zwei')", [betriebA]);
      await tx.query("insert into public.kunde (betrieb_id, name) values ($1, 'Drei')", [betriebA]);
      const r = await tx.query<{ kundennummer: number }>(
        "select kundennummer from public.kunde order by kundennummer",
      );
      return r.rows.map((x) => Number(x.kundennummer));
    });
    expect(nummern).toEqual([1, 2, 3]);
    const nb = await als(db, b, (tx) =>
      wert<number>(
        tx,
        "insert into public.kunde (betrieb_id, name) values ($1, 'B1') returning kundennummer",
        [betriebB],
      ),
    );
    expect(Number(nb)).toBe(1);
  });

  it("eigene Nummer aus Import setzt den Nummernkreis fort", async () => {
    await als(db, a, (tx) =>
      tx.query(
        "insert into public.kunde (betrieb_id, name, kundennummer) values ($1, 'Alt', 1000)",
        [betriebA],
      ),
    );
    const n = await als(db, a, (tx) =>
      wert<number>(
        tx,
        "insert into public.kunde (betrieb_id, name) values ($1, 'Neu') returning kundennummer",
        [betriebA],
      ),
    );
    expect(Number(n)).toBe(1001);
  });
});

describe("Mandantentrennung", () => {
  const tabellen = [
    "kunde",
    "ansprechpartner",
    "objekt",
    "bereich",
    "fensteraufmass",
    "objekt_foto",
  ];

  it("B sieht keine Daten von A", async () => {
    await als(db, a, async (tx) => {
      await tx.query(
        "insert into public.ansprechpartner (betrieb_id, kunde_id, name) values ($1, $2, 'Frau Müller')",
        [betriebA, kundeA],
      );
      await tx.query(
        "insert into public.bereich (betrieb_id, objekt_id, name, flaeche_m2) values ($1, $2, 'Treppenhaus', 85.5)",
        [betriebA, objektA],
      );
      await tx.query(
        "insert into public.fensteraufmass (betrieb_id, objekt_id, typ, anzahl, hilfsmittel) values ($1, $2, 'standard', 24, '{leiter}')",
        [betriebA, objektA],
      );
      await tx.query(
        "insert into public.objekt_foto (betrieb_id, objekt_id, pfad, erstellt_von) values ($1, $2, $3, $4)",
        [betriebA, objektA, `${betriebA}/${objektA}/eingang.jpg`, a],
      );
    });
    for (const t of tabellen) {
      const sichtbarA = await als(db, a, (tx) =>
        wert<number>(tx, `select count(*)::int from public.${t}`),
      );
      const sichtbarB = await als(db, b, (tx) =>
        wert<number>(tx, `select count(*)::int from public.${t} where betrieb_id = $1`, [betriebA]),
      );
      expect(sichtbarA, t).toBeGreaterThan(0);
      expect(sichtbarB, t).toBe(0);
    }
  });

  it("B kann nicht in A schreiben", async () => {
    await expect(
      als(db, b, (tx) =>
        tx.query("insert into public.kunde (betrieb_id, name) values ($1, 'fremd')", [betriebA]),
      ),
    ).rejects.toThrow(/row-level security/);
    await als(db, b, (tx) => tx.query("delete from public.objekt where id = $1", [objektA]));
    expect(await wert(db, "select count(*)::int from public.objekt where id=$1", [objektA])).toBe(
      1,
    );
  });

  it("Kind-Datensatz kann nicht an Elternteil eines anderen Betriebs hängen", async () => {
    const kundeB = await als(db, b, (tx) =>
      wert<string>(
        tx,
        "insert into public.kunde (betrieb_id, name) values ($1, 'KB') returning id",
        [betriebB],
      ),
    );
    // B versucht, ein Objekt im eigenen Betrieb an Kunde A zu hängen
    await expect(
      als(db, b, (tx) =>
        tx.query("insert into public.objekt (betrieb_id, kunde_id, name) values ($1, $2, 'x')", [
          betriebB,
          kundeA,
        ]),
      ),
    ).rejects.toThrow(/foreign key/);
    expect(kundeB).toBeTruthy();
  });
});

describe("Rollen", () => {
  it("Mitarbeiter liest Objekte, darf aber keine Kunden anlegen", async () => {
    const n = await als(db, ma, (tx) =>
      wert<number>(tx, "select count(*)::int from public.objekt"),
    );
    expect(n).toBe(1);
    await expect(
      als(db, ma, (tx) =>
        tx.query("insert into public.kunde (betrieb_id, name) values ($1, 'x')", [betriebA]),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("Mitarbeiter darf Fotos hochladen (Storage + Datensatz)", async () => {
    await als(db, ma, async (tx) => {
      await tx.query("insert into storage.objects (bucket_id, name) values ('objektfotos', $1)", [
        `${betriebA}/${objektA}/neu.jpg`,
      ]);
      await tx.query(
        "insert into public.objekt_foto (betrieb_id, objekt_id, pfad, erstellt_von) values ($1, $2, $3, $4)",
        [betriebA, objektA, `${betriebA}/${objektA}/neu.jpg`, ma],
      );
    });
  });

  it("Objekt mit Kunde verhindert Löschen des Kunden", async () => {
    await expect(
      als(db, a, (tx) => tx.query("delete from public.kunde where id = $1", [kundeA])),
    ).rejects.toThrow(/foreign key/);
  });

  it("Leitweg-ID wird geprüft", async () => {
    await expect(
      als(db, a, (tx) =>
        tx.query(
          "insert into public.kunde (betrieb_id, name, leitweg_id) values ($1, 'Amt', 'quatsch')",
          [betriebA],
        ),
      ),
    ).rejects.toThrow(/check/);
    await als(db, a, (tx) =>
      tx.query(
        "insert into public.kunde (betrieb_id, name, typ, leitweg_id) values ($1, 'Stadt', 'oeffentlich', '04011000-1234512345-06')",
        [betriebA],
      ),
    );
  });
});
