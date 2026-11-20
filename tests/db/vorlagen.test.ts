import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { kombiniere } from "@/domain/branchenpakete";
import { als, benutzer, neueDatenbank, wert } from "./harness";

let db: PGlite;
let a: string;
let b: string;
let ma: string;
let betriebA: string;
let betriebB: string;

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
}, 60_000);

describe("paket_installieren", () => {
  const paket = kombiniere(["gebaeudereinigung", "hausmeister", "fensterreinigung"]);

  it("installiert alle drei Branchenpakete in einem Rutsch", async () => {
    const r = await als(db, a, (tx) =>
      wert<{ artikel: number; vorlagen: number; preise: number }>(
        tx,
        "select public.paket_installieren($1, $2)",
        [betriebA, JSON.stringify(paket)],
      ),
    );
    expect(r).toEqual({
      artikel: paket.artikel.length,
      vorlagen: paket.vorlagen.length,
      preise: paket.preise.length,
    });
    const bedarf = await als(db, a, (tx) =>
      wert<number>(tx, "select count(*)::int from public.vorlage_bedarf"),
    );
    expect(bedarf).toBe(paket.vorlagen.reduce((s, v) => s + v.bedarf.length, 0));
    const verknuepft = await als(db, a, (tx) =>
      wert<number>(tx, "select count(*)::int from public.preisliste where vorlage_id is not null"),
    );
    expect(verknuepft).toBe(paket.preise.filter((p) => p.vorlage).length);
  });

  it("ist idempotent", async () => {
    const r = await als(db, a, (tx) =>
      wert(tx, "select public.paket_installieren($1, $2)", [betriebA, JSON.stringify(paket)]),
    );
    expect(r).toEqual({ artikel: 0, vorlagen: 0, preise: 0 });
  });

  it("Tätigkeiten behalten die Reihenfolge", async () => {
    const r = await als(db, a, (tx) =>
      tx.query<{ text: string }>(
        `select t.text from public.vorlage_taetigkeit t join public.auftragsvorlage v on v.id = t.vorlage_id
         where v.name = 'Unterhaltsreinigung Büro' order by t.reihenfolge`,
      ),
    );
    expect(r.rows[0]!.text).toBe("Papierkörbe leeren, Müllbeutel wechseln");
    expect(r.rows).toHaveLength(5);
  });

  it("Mitarbeiter darf kein Paket installieren, B nicht in A", async () => {
    await expect(
      als(db, ma, (tx) =>
        tx.query("select public.paket_installieren($1, $2)", [betriebA, JSON.stringify(paket)]),
      ),
    ).rejects.toThrow(/Keine Berechtigung/);
    await expect(
      als(db, b, (tx) =>
        tx.query("select public.paket_installieren($1, $2)", [betriebA, JSON.stringify(paket)]),
      ),
    ).rejects.toThrow(/Keine Berechtigung/);
  });
});

describe("RLS Vorlagen/Artikel/Preise", () => {
  const tabellen = [
    "artikel",
    "auftragsvorlage",
    "vorlage_taetigkeit",
    "vorlage_bedarf",
    "preisliste",
  ];

  it("B sieht nichts von A, Mitarbeiter A liest alles", async () => {
    for (const t of tabellen) {
      expect(
        await als(db, b, (tx) => wert<number>(tx, `select count(*)::int from public.${t}`)),
        t,
      ).toBe(0);
      expect(
        await als(db, ma, (tx) => wert<number>(tx, `select count(*)::int from public.${t}`)),
        t,
      ).toBeGreaterThan(0);
    }
  });

  it("Mitarbeiter darf Preise nicht ändern", async () => {
    await als(db, ma, (tx) => tx.query("update public.preisliste set preis_cent = 1"));
    expect(await wert(db, "select count(*)::int from public.preisliste where preis_cent = 1")).toBe(
      0,
    );
  });

  it("Artikel in Verwendung kann nicht gelöscht werden", async () => {
    await expect(
      als(db, a, (tx) => tx.query("delete from public.artikel where name = 'Allzweckreiniger'")),
    ).rejects.toThrow(/foreign key/);
  });

  it("Verschleißteil braucht Lebensdauer", async () => {
    await expect(
      als(db, a, (tx) =>
        tx.query(
          "insert into public.artikel (betrieb_id, name, art) values ($1, 'X', 'verschleiss')",
          [betriebA],
        ),
      ),
    ).rejects.toThrow(/check/);
  });

  it("Bedarf kann nicht auf Artikel eines fremden Betriebs zeigen", async () => {
    const artikelA = await als(db, a, (tx) =>
      wert<string>(tx, "select id from public.artikel where name = 'Besen'"),
    );
    await expect(
      als(db, b, async (tx) => {
        const v = await wert<string>(
          tx,
          "insert into public.auftragsvorlage (betrieb_id, name) values ($1, 'V') returning id",
          [betriebB],
        );
        await tx.query(
          "insert into public.vorlage_bedarf (betrieb_id, vorlage_id, artikel_id, menge) values ($1, $2, $3, 1)",
          [betriebB, v, artikelA],
        );
      }),
    ).rejects.toThrow(/foreign key/);
  });
});
