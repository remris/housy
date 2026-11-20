import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { als, benutzer, neueDatenbank, wert } from "./harness";

let db: PGlite;
let a: string;
let ma: string;
let ma2: string;
let betriebA: string;
let maMitglied: string;
let objekt: string;
let einsatz: string;
let fremderEinsatz: string;
let taetigkeit: string;
let preis: string;
let fenster: string;

const uuid = () => crypto.randomUUID();

beforeAll(async () => {
  db = await neueDatenbank();
  a = await benutzer(db, "a@x.de", { betrieb_name: "A" });
  await benutzer(db, "b@x.de", { betrieb_name: "B" });
  betriebA = await wert(db, "select id from public.betrieb where name='A'");
  ma = await benutzer(db, "ma@x.de");
  ma2 = await benutzer(db, "ma2@x.de");
  maMitglied = await wert(
    db,
    "insert into public.mitglied (betrieb_id, user_id, rolle) values ($1, $2, 'mitarbeiter') returning id",
    [betriebA, ma],
  );
  const ma2Mitglied = await wert<string>(
    db,
    "insert into public.mitglied (betrieb_id, user_id, rolle) values ($1, $2, 'mitarbeiter') returning id",
    [betriebA, ma2],
  );
  await als(db, a, async (tx) => {
    const kunde = await wert<string>(
      tx,
      "insert into public.kunde (betrieb_id, name) values ($1, 'K') returning id",
      [betriebA],
    );
    objekt = await wert(
      tx,
      "insert into public.objekt (betrieb_id, kunde_id, name, zugangshinweise) values ($1, $2, 'O', 'Schlüssel beim Hausmeister') returning id",
      [betriebA, kunde],
    );
    fenster = await wert(
      tx,
      "insert into public.fensteraufmass (betrieb_id, objekt_id, anzahl) values ($1, $2, 10) returning id",
      [betriebA, objekt],
    );
    const vorlage = await wert<string>(
      tx,
      "insert into public.auftragsvorlage (betrieb_id, name) values ($1, 'V') returning id",
      [betriebA],
    );
    taetigkeit = await wert(
      tx,
      "insert into public.vorlage_taetigkeit (betrieb_id, vorlage_id, text) values ($1, $2, 'Treppen wischen') returning id",
      [betriebA, vorlage],
    );
    preis = await wert(
      tx,
      "insert into public.preisliste (betrieb_id, name, einheit, preis_cent) values ($1, 'Fenster Keller', 'fenster', 450) returning id",
      [betriebA],
    );
    einsatz = await wert(
      tx,
      "insert into public.einsatz (betrieb_id, objekt_id, vorlage_id, datum, mitarbeiter_id, quelle) values ($1, $2, $3, current_date, $4, 'manuell') returning id",
      [betriebA, objekt, vorlage, maMitglied],
    );
    fremderEinsatz = await wert(
      tx,
      "insert into public.einsatz (betrieb_id, objekt_id, vorlage_id, datum, mitarbeiter_id, quelle) values ($1, $2, $3, current_date, $4, 'manuell') returning id",
      [betriebA, objekt, vorlage, ma2Mitglied],
    );
  });
}, 60_000);

const status = (id: string) =>
  wert<string>(db, "select status::text from public.einsatz where id=$1", [id]);

describe("Mitarbeiter-App: Zeitbuchung", () => {
  it("Check-in und Check-out setzen den Status, Wiederholung bucht nicht doppelt", async () => {
    const checkin = uuid();
    const buchen = (id: string, art: string, min: number) =>
      als(db, ma, (tx) =>
        tx.query(
          "select public.app_zeit_buchen($1, $2::public.zeitbuchungsart, now() - make_interval(mins => $3), $4, null, 'qr')",
          [id, art, min, einsatz],
        ),
      );
    await buchen(checkin, "checkin", 60);
    await buchen(checkin, "checkin", 60); // erneut gesendet
    expect(await status(einsatz)).toBe("begonnen");
    await buchen(uuid(), "checkout", 5);
    expect(await status(einsatz)).toBe("erledigt");
    expect(
      await wert(db, "select count(*)::int from public.zeitbuchung where einsatz_id=$1", [einsatz]),
    ).toBe(2);
  });

  it("fremder Einsatz wird abgewiesen", async () => {
    await expect(
      als(db, ma, (tx) =>
        tx.query("select public.app_zeit_buchen($1, 'checkin', now(), $2)", [
          uuid(),
          fremderEinsatz,
        ]),
      ),
    ).rejects.toThrow(/nicht zugewiesen/);
  });

  it("Pause ohne Einsatz, aber nicht in der Zukunft", async () => {
    await als(db, ma, (tx) =>
      tx.query("select public.app_zeit_buchen($1, 'pause_beginn', now(), null, $2)", [
        uuid(),
        betriebA,
      ]),
    );
    await expect(
      als(db, ma, (tx) =>
        tx.query(
          "select public.app_zeit_buchen($1, 'pause_ende', now() + interval '1 hour', null, $2)",
          [uuid(), betriebA],
        ),
      ),
    ).rejects.toThrow(/Zukunft/);
  });

  it("Mitarbeiter schreibt nicht direkt in Zeitbuchungen", async () => {
    await expect(
      als(db, ma, (tx) =>
        tx.query(
          "insert into public.zeitbuchung (betrieb_id, mitglied_id, art, zeitpunkt) values ($1, $2, 'pause_beginn', now())",
          [betriebA, maMitglied],
        ),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("Büro korrigiert mit Grund und Protokoll", async () => {
    const id = await wert<string>(
      db,
      "select id from public.zeitbuchung where art='checkout' and einsatz_id=$1",
      [einsatz],
    );
    await als(db, a, (tx) =>
      tx.query(
        "select public.zeitbuchung_korrigieren($1, now() - interval '2 minutes', 'Handy-Akku leer')",
        [id],
      ),
    );
    await expect(
      als(db, a, (tx) => tx.query("select public.zeitbuchung_stornieren($1, 'x')", [id])),
    ).rejects.toThrow(/check/);
    const neu = await als(db, a, (tx) =>
      wert<string>(
        tx,
        "select public.zeitbuchung_nachtragen($1, 'pause_ende', now() - interval '1 minute', 'vergessen')",
        [maMitglied],
      ),
    );
    const protokoll = await als(db, ma, (tx) =>
      tx.query<{ aktion: string }>(
        "select aktion from public.zeitbuchung_protokoll order by geaendert_am, aktion",
      ),
    );
    expect(protokoll.rows.map((r) => r.aktion).sort()).toEqual(["geaendert", "nachgetragen"]);
    expect(await wert(db, "select quelle from public.zeitbuchung where id=$1", [neu])).toBe(
      "buero",
    );
    await expect(
      als(db, ma, (tx) =>
        tx.query("select public.zeitbuchung_korrigieren($1, now(), 'selbst geändert')", [id]),
      ),
    ).rejects.toThrow(/Berechtigung/);
  });
});

describe("Mitarbeiter-App: Einsatzdaten", () => {
  it("Checkliste: letzte Änderung gewinnt", async () => {
    const setzen = (erledigt: boolean, zeit: string) =>
      als(db, ma, (tx) =>
        tx.query("select public.app_aufgabe_setzen($1, $2, $3, $4)", [
          einsatz,
          taetigkeit,
          erledigt,
          zeit,
        ]),
      );
    await setzen(true, "2026-11-20T08:00:00Z");
    await setzen(false, "2026-11-20T07:59:00Z"); // ältere Änderung kommt später an
    expect(
      await wert(db, "select erledigt from public.einsatz_aufgabe where einsatz_id=$1", [einsatz]),
    ).toBe(true);
    await setzen(false, "2026-11-20T08:01:00Z");
    expect(
      await wert(db, "select erledigt from public.einsatz_aufgabe where einsatz_id=$1", [einsatz]),
    ).toBe(false);
  });

  it("Notiz: letzte Änderung gewinnt", async () => {
    const notiz = (text: string, zeit: string) =>
      als(db, ma, (tx) =>
        tx.query("select public.app_notiz_setzen($1, $2, $3)", [einsatz, text, zeit]),
      );
    await notiz("neu", "2026-11-20T09:00:00Z");
    await notiz("alt", "2026-11-20T08:00:00Z");
    expect(
      await wert(db, "select notiz_mitarbeiter from public.einsatz where id=$1", [einsatz]),
    ).toBe("neu");
  });

  it("Meldung und Foto, idempotent", async () => {
    const m = uuid();
    for (let i = 0; i < 2; i++) {
      await als(db, ma, (tx) =>
        tx.query("select public.app_meldung($1, $2, 'mangel', 'Glas gesprungen')", [m, einsatz]),
      );
    }
    await als(db, ma, (tx) =>
      tx.query("select public.app_foto($1, $2, $3, $4)", [
        uuid(),
        einsatz,
        `${betriebA}/${einsatz}/a.jpg`,
        m,
      ]),
    );
    await expect(
      als(db, ma, (tx) =>
        tx.query("select public.app_foto($1, $2, $3)", [uuid(), einsatz, `x/${einsatz}/a.jpg`]),
      ),
    ).rejects.toThrow(/Pfad/);
    expect(await wert(db, "select count(*)::int from public.einsatz_meldung")).toBe(1);
    const sichtbar = await als(db, ma2, (tx) =>
      wert<number>(tx, "select count(*)::int from public.einsatz_meldung"),
    );
    expect(sichtbar).toBe(0);
  });

  it("Position aus Preisliste ist bestätigt, freie Position nur Vorschlag ohne Preis", async () => {
    await als(db, ma, (tx) =>
      tx.query(
        "select public.app_position($1, $2, $3, 'egal', 6, 'heute', 'unterschrift', 'Frau Kunde', 'data:image/png;base64,AA')",
        [uuid(), einsatz, preis],
      ),
    );
    await als(db, ma, (tx) =>
      tx.query(
        "select public.app_position($1, $2, null, 'Keller ausfegen', 1, 'dauerhaft', 'muendlich')",
        [uuid(), einsatz],
      ),
    );
    const r = await db.query<{ bezeichnung: string; status: string; preis_cent: number | null }>(
      "select bezeichnung, status::text, preis_cent from public.einsatz_position order by erstellt_am, bezeichnung",
    );
    expect(r.rows).toEqual(
      expect.arrayContaining([
        { bezeichnung: "Fenster Keller", status: "bestaetigt", preis_cent: 450 },
        { bezeichnung: "Keller ausfegen", status: "vorgeschlagen", preis_cent: null },
      ]),
    );
  });

  it("Stammdaten-Korrektur mit Verlauf", async () => {
    await als(db, ma, (tx) =>
      tx.query("select public.app_objekt_korrigieren($1, $2, 'fenster_anzahl', '12', $3)", [
        uuid(),
        einsatz,
        fenster,
      ]),
    );
    await als(db, ma, (tx) =>
      tx.query("select public.app_objekt_korrigieren($1, $2, 'zugangshinweise', 'Code 4711')", [
        uuid(),
        einsatz,
      ]),
    );
    await expect(
      als(db, ma, (tx) =>
        tx.query("select public.app_objekt_korrigieren($1, $2, 'name', 'Hack')", [uuid(), einsatz]),
      ),
    ).rejects.toThrow(/nicht änderbar/);
    expect(await wert(db, "select anzahl from public.fensteraufmass where id=$1", [fenster])).toBe(
      12,
    );
    const verlauf = await als(db, a, (tx) =>
      tx.query<{ alt: string; neu: string }>(
        "select alt, neu from public.stammdaten_verlauf order by geaendert_am, feld",
      ),
    );
    expect(verlauf.rows).toHaveLength(2);
    expect(verlauf.rows.map((r) => r.alt).sort()).toEqual(["10", "Schlüssel beim Hausmeister"]);
    expect(
      await als(db, ma, (tx) =>
        wert<number>(tx, "select count(*)::int from public.stammdaten_verlauf"),
      ),
    ).toBe(0);
  });

  it("Zeitbuchungen verhindern das Löschen des Einsatzes", async () => {
    await expect(
      als(db, a, (tx) => tx.query("delete from public.einsatz where id=$1", [einsatz])),
    ).rejects.toThrow(/zeitbuchung/);
  });
});
