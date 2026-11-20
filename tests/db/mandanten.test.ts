import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { als, benutzer, neueDatenbank, wert } from "./harness";

let db: PGlite;
let inhaberA: string;
let inhaberB: string;
let betriebA: string;
let betriebB: string;

beforeAll(async () => {
  db = await neueDatenbank();
  inhaberA = await benutzer(db, "a@example.com", {
    betrieb_name: "Glanz GmbH",
    branchen: ["gebaeudereinigung"],
    anzeigename: "Anna",
  });
  inhaberB = await benutzer(db, "b@example.com", { betrieb_name: "Blitzblank" });
  betriebA = await wert(db, "select id from public.betrieb where name='Glanz GmbH'");
  betriebB = await wert(db, "select id from public.betrieb where name='Blitzblank'");
}, 60_000);

describe("Registrierung", () => {
  it("legt Betrieb und Inhaber an", async () => {
    const r = await db.query(
      "select m.rolle, b.branchen from public.mitglied m join public.betrieb b on b.id=m.betrieb_id where m.user_id=$1",
      [inhaberA],
    );
    expect(r.rows).toEqual([{ rolle: "inhaber", branchen: ["gebaeudereinigung"] }]);
  });

  it("Benutzer ohne Metadaten bekommt keinen Betrieb", async () => {
    const u = await benutzer(db, "leer@example.com");
    const r = await db.query("select 1 from public.mitglied where user_id=$1", [u]);
    expect(r.rows).toHaveLength(0);
  });

  it("betrieb_anlegen legt weiteren Betrieb für eingeloggten Benutzer an", async () => {
    const u = await benutzer(db, "zwei@example.com");
    const id = await als(db, u, (tx) =>
      wert<string>(tx, "select public.betrieb_anlegen('Zweitbetrieb')"),
    );
    expect(await wert(db, "select rolle from public.mitglied where betrieb_id=$1", [id])).toBe(
      "inhaber",
    );
  });
});

describe("Mandantentrennung (RLS)", () => {
  it("Betrieb A sieht nur sich selbst", async () => {
    const r = await als(db, inhaberA, (tx) =>
      tx.query<{ id: string }>("select id from public.betrieb"),
    );
    expect(r.rows.map((x) => x.id)).toEqual([betriebA]);
  });

  it("Betrieb A sieht keine Mitglieder von B", async () => {
    const r = await als(db, inhaberA, (tx) =>
      tx.query("select 1 from public.mitglied where betrieb_id=$1", [betriebB]),
    );
    expect(r.rows).toHaveLength(0);
  });

  it("A kann B nicht ändern", async () => {
    await als(db, inhaberA, (tx) =>
      tx.query("update public.betrieb set name='gehackt' where id=$1", [betriebB]),
    );
    expect(await wert(db, "select name from public.betrieb where id=$1", [betriebB])).toBe(
      "Blitzblank",
    );
  });

  it("anon sieht nichts", async () => {
    const r = await als(db, null, (tx) => tx.query("select 1 from public.betrieb"));
    expect(r.rows).toHaveLength(0);
  });

  it("Betrieb direkt anlegen ist nicht erlaubt", async () => {
    await expect(
      als(db, inhaberA, (tx) => tx.query("insert into public.betrieb (name) values ('x')")),
    ).rejects.toThrow();
  });
});

describe("Einladungen und Rollen", () => {
  let mitarbeiter: string;

  it("Inhaber lädt ein, Annahme bei Registrierung", async () => {
    const token = await als(db, inhaberA, (tx) =>
      wert<string>(
        tx,
        "insert into public.einladung (betrieb_id, email, rolle, eingeladen_von) values ($1,'m@example.com','mitarbeiter',$2) returning token",
        [betriebA, inhaberA],
      ),
    );
    const info = await als(db, null, (tx) =>
      tx.query("select * from public.einladung_info($1)", [token]),
    );
    expect(info.rows[0]).toMatchObject({ betrieb_name: "Glanz GmbH", gueltig: true });

    mitarbeiter = await benutzer(db, "M@example.com", {
      einladung_token: token,
      anzeigename: "Mehmet",
    });
    expect(
      await wert(db, "select rolle from public.mitglied where user_id=$1 and betrieb_id=$2", [
        mitarbeiter,
        betriebA,
      ]),
    ).toBe("mitarbeiter");
    const nochmal = await als(db, null, (tx) =>
      wert<boolean>(tx, "select gueltig from public.einladung_info($1)", [token]),
    );
    expect(nochmal).toBe(false);
  });

  it("Einladung für andere E-Mail schlägt fehl", async () => {
    const token = await als(db, inhaberA, (tx) =>
      wert<string>(
        tx,
        "insert into public.einladung (betrieb_id, email, eingeladen_von) values ($1,'x@example.com',$2) returning token",
        [betriebA, inhaberA],
      ),
    );
    const fremd = await benutzer(db, "fremd@example.com");
    await expect(
      als(db, fremd, (tx) => tx.query("select public.einladung_annehmen($1)", [token])),
    ).rejects.toThrow(/andere E-Mail/);
  });

  it("bestehender Benutzer nimmt Einladung eines zweiten Betriebs an", async () => {
    const token = await als(db, inhaberB, (tx) =>
      wert<string>(
        tx,
        "insert into public.einladung (betrieb_id, email, rolle, eingeladen_von) values ($1,'m@example.com','disponent',$2) returning token",
        [betriebB, inhaberB],
      ),
    );
    const id = await als(db, mitarbeiter, (tx) =>
      wert<string>(tx, "select public.einladung_annehmen($1)", [token]),
    );
    expect(id).toBe(betriebB);
    const r = await als(db, mitarbeiter, (tx) => tx.query("select id from public.betrieb"));
    expect(r.rows).toHaveLength(2);
  });

  it("Mitarbeiter darf nicht einladen und Rolle nicht ändern", async () => {
    await expect(
      als(db, mitarbeiter, (tx) =>
        tx.query(
          "insert into public.einladung (betrieb_id, email, eingeladen_von) values ($1,'y@example.com',$2)",
          [betriebA, mitarbeiter],
        ),
      ),
    ).rejects.toThrow();
    await expect(
      als(db, mitarbeiter, (tx) =>
        tx.query("update public.mitglied set rolle='inhaber' where user_id=$1 and betrieb_id=$2", [
          mitarbeiter,
          betriebA,
        ]),
      ),
    ).rejects.toThrow(/Nur der Inhaber/);
  });

  it("Mitarbeiter darf eigene Sprache ändern", async () => {
    await als(db, mitarbeiter, (tx) =>
      tx.query("update public.mitglied set sprache='tr' where user_id=$1 and betrieb_id=$2", [
        mitarbeiter,
        betriebA,
      ]),
    );
    expect(
      await wert(db, "select sprache from public.mitglied where user_id=$1 and betrieb_id=$2", [
        mitarbeiter,
        betriebA,
      ]),
    ).toBe("tr");
  });

  it("letzter Inhaber kann nicht entfernt werden", async () => {
    await expect(
      als(db, inhaberA, (tx) =>
        tx.query("update public.mitglied set rolle='disponent' where user_id=$1", [inhaberA]),
      ),
    ).rejects.toThrow(/mindestens einen aktiven Inhaber/);
  });

  it("Betrieb löschen kaskadiert trotz Inhaber-Schutz", async () => {
    const u = await benutzer(db, "weg@example.com", { betrieb_name: "Weg GmbH" });
    await db.query("delete from public.betrieb where name='Weg GmbH'");
    const r = await db.query("select 1 from public.mitglied where user_id=$1", [u]);
    expect(r.rows).toHaveLength(0);
  });
});

describe("Logo-Storage", () => {
  it("nur Inhaber des Betriebs darf in seinen Ordner hochladen", async () => {
    await als(db, inhaberA, (tx) =>
      tx.query("insert into storage.objects (bucket_id, name) values ('logos', $1)", [
        `${betriebA}/logo.png`,
      ]),
    );
    await expect(
      als(db, inhaberB, (tx) =>
        tx.query("insert into storage.objects (bucket_id, name) values ('logos', $1)", [
          `${betriebA}/boese.png`,
        ]),
      ),
    ).rejects.toThrow();
  });
});
