import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { als, benutzer, neueDatenbank, wert } from "./harness";

let db: PGlite;
let a: string;
let b: string;
let ma: string;
let betriebA: string;
let kunde: string;
let einsatz: string;

const DATEN = JSON.stringify({ test: true });

async function entwurf(nettoCent = 10000): Promise<string> {
  return als(db, a, async (tx) => {
    const id = await wert<string>(
      tx,
      `insert into public.rechnung (betrieb_id, kunde_id, leistung_von, leistung_bis, netto_cent, ust_cent, brutto_cent)
       values ($1, $2, '2026-11-01', '2026-11-30', $3::int, $3::int * 19 / 100, $3::int * 119 / 100) returning id`,
      [betriebA, kunde, nettoCent],
    );
    await tx.query(
      `insert into public.rechnungsposition (betrieb_id, rechnung_id, pos, bezeichnung, menge, einheit, einzelpreis_cent, netto_cent, ust_satz)
       values ($1, $2, 1, 'Pauschale', 1, 'monat', $3::int, $3::int, 19)`,
      [betriebA, id, nettoCent],
    );
    return id;
  });
}
const festschreiben = (id: string, datum = "2026-11-30") =>
  als(db, a, (tx) =>
    wert<string>(tx, "select public.rechnung_festschreiben($1, $2, $3::jsonb)", [id, datum, DATEN]),
  );

beforeAll(async () => {
  db = await neueDatenbank();
  a = await benutzer(db, "a@x.de", { betrieb_name: "A" });
  b = await benutzer(db, "b@x.de", { betrieb_name: "B" });
  ma = await benutzer(db, "ma@x.de");
  betriebA = await wert(db, "select id from public.betrieb where name='A'");
  await db.query(
    "insert into public.mitglied (betrieb_id, user_id, rolle) values ($1, $2, 'mitarbeiter')",
    [betriebA, ma],
  );
  await als(db, a, async (tx) => {
    kunde = await wert(
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
      "insert into public.einsatz (betrieb_id, objekt_id, vorlage_id, datum, quelle, status) values ($1, $2, $3, '2026-11-10', 'manuell', 'erledigt') returning id",
      [betriebA, objekt, vorlage],
    );
  });
});

describe("Nummernkreis und Festschreiben", () => {
  it("vergibt lückenlos fortlaufende Nummern je Jahr; Entwürfe haben keine Nummer", async () => {
    const r1 = await entwurf();
    const r2 = await entwurf();
    const r3 = await entwurf();
    expect(await festschreiben(r1)).toBe("RE-2026-0001");
    expect(await festschreiben(r2)).toBe("RE-2026-0002");
    // erneutes Festschreiben ändert nichts
    expect(await festschreiben(r1)).toBe("RE-2026-0001");
    expect(await festschreiben(r3, "2027-01-02")).toBe("RE-2027-0001");
    expect(await wert(db, "select faellig_am::text from public.rechnung where id=$1", [r1])).toBe(
      "2026-12-14",
    );
  });

  it("ohne Positionen kein Festschreiben", async () => {
    const leer = await als(db, a, (tx) =>
      wert<string>(
        tx,
        "insert into public.rechnung (betrieb_id, kunde_id, leistung_von, leistung_bis) values ($1, $2, '2026-11-01', '2026-11-30') returning id",
        [betriebA, kunde],
      ),
    );
    await expect(festschreiben(leer)).rejects.toThrow(/ohne Positionen/);
  });
});

describe("Unveränderlichkeit (GoBD)", () => {
  let id: string;
  beforeAll(async () => {
    id = await entwurf(5000);
    await festschreiben(id);
  });

  it("Betrag, Positionen und Nummer sind fest; Löschen geht nicht", async () => {
    await expect(
      als(db, a, (tx) => tx.query("update public.rechnung set netto_cent = 1 where id=$1", [id])),
    ).rejects.toThrow(/nicht geändert/);
    await expect(
      als(db, a, (tx) =>
        tx.query("update public.rechnungsposition set netto_cent = 1 where rechnung_id=$1", [id]),
      ),
    ).rejects.toThrow(/unveränderlich/);
    await expect(
      als(db, a, (tx) => tx.query("delete from public.rechnung where id=$1", [id])),
    ).resolves.toBeDefined(); // RLS: Entwurf-Bedingung → nichts gelöscht
    expect(await wert(db, "select count(*)::int from public.rechnung where id=$1", [id])).toBe(1);
  });

  it("Zahlung und Versand dürfen nachgetragen werden", async () => {
    await als(db, a, (tx) =>
      tx.query(
        "update public.rechnung set status='bezahlt', bezahlt_am='2026-12-05', gesendet_am=now() where id=$1",
        [id],
      ),
    );
    expect(await wert(db, "select status::text from public.rechnung where id=$1", [id])).toBe(
      "bezahlt",
    );
  });
});

describe("Storno und Doppelabrechnung", () => {
  it("ein Einsatz kann nur auf einer aktiven Rechnung stehen; nach Storno wieder frei", async () => {
    const r1 = await entwurf();
    await als(db, a, (tx) =>
      tx.query(
        "insert into public.abrechnung (betrieb_id, rechnung_id, einsatz_id) values ($1, $2, $3)",
        [betriebA, r1, einsatz],
      ),
    );
    const r2 = await entwurf();
    await expect(
      als(db, a, (tx) =>
        tx.query(
          "insert into public.abrechnung (betrieb_id, rechnung_id, einsatz_id) values ($1, $2, $3)",
          [betriebA, r2, einsatz],
        ),
      ),
    ).rejects.toThrow(/duplicate|unique/i);

    await festschreiben(r1);
    const storno = await als(db, a, (tx) =>
      wert<string>(tx, "select public.rechnung_stornieren($1, 'falscher Kunde')", [r1]),
    );
    expect(await wert(db, "select status::text from public.rechnung where id=$1", [r1])).toBe(
      "storniert",
    );
    expect(
      await wert(db, "select count(*)::int from public.rechnungsposition where rechnung_id=$1", [
        storno,
      ]),
    ).toBe(1);
    expect(await festschreiben(storno)).toMatch(/^RE-2026-\d{4}$/);
    // Einsatz ist wieder abrechenbar
    await als(db, a, (tx) =>
      tx.query(
        "insert into public.abrechnung (betrieb_id, rechnung_id, einsatz_id) values ($1, $2, $3)",
        [betriebA, r2, einsatz],
      ),
    );
    // zweites Storno derselben Rechnung geht nicht
    await expect(
      als(db, a, (tx) => tx.query("select public.rechnung_stornieren($1, 'nochmal')", [r1])),
    ).rejects.toThrow(/Nur festgeschriebene/);
  });

  it("Entwurf darf gelöscht werden", async () => {
    const r = await entwurf();
    await als(db, a, (tx) => tx.query("delete from public.rechnung where id=$1", [r]));
    expect(await wert(db, "select count(*)::int from public.rechnung where id=$1", [r])).toBe(0);
  });
});

describe("Mandantentrennung", () => {
  it("Betrieb B und Mitarbeiter sehen keine Rechnungen von A und können nichts festschreiben", async () => {
    const r = await entwurf();
    for (const u of [b, ma]) {
      expect(
        Number(
          await als(db, u, (tx) =>
            wert(
              tx,
              "select (select count(*) from public.rechnung) + (select count(*) from public.rechnungsposition) + (select count(*) from public.abrechnung)",
            ),
          ),
        ),
      ).toBe(0);
      await expect(
        als(db, u, (tx) =>
          tx.query("select public.rechnung_festschreiben($1, '2026-11-30', '{}')", [r]),
        ),
      ).rejects.toThrow(/Berechtigung/);
    }
  });
});
