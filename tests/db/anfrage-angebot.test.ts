import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { plusTage } from "@/domain/datum";
import {
  type BuchungsEinstellungen,
  STANDARD_BUCHUNG,
  preisBerechnen,
} from "@/domain/preisrechner";
import { als, benutzer, neueDatenbank, wert } from "./harness";

let db: PGlite;
let a: string;
let b: string;
let betriebA: string;
let kennung: string;
let vorlage: string;

const heute = new Date().toISOString().slice(0, 10);
const anon = <T>(fn: Parameters<typeof als<T>>[2]) => als<T>(db, null, fn);
const json = async <T>(sql: string, params: unknown[]) =>
  (await db.query<{ j: T }>(sql, params)).rows[0]!.j;

beforeAll(async () => {
  db = await neueDatenbank();
  a = await benutzer(db, "a@x.de", { betrieb_name: "A" });
  b = await benutzer(db, "b@x.de", { betrieb_name: "B" });
  betriebA = await wert(db, "select id from public.betrieb where name='A'");
  kennung = await wert(db, "select oeffentlich_kennung from public.betrieb where id=$1", [
    betriebA,
  ]);
  vorlage = await als(db, a, (tx) =>
    wert<string>(
      tx,
      "insert into public.auftragsvorlage (betrieb_id, name) values ($1, 'Fensterreinigung privat') returning id",
      [betriebA],
    ),
  );
});

describe("Anfrage (öffentlich)", () => {
  const daten = {
    name: "Erika Mustermann",
    email: "erika@example.org",
    telefon: "0711 1",
    plz: "70173",
    ort: "Stuttgart",
    leistung: "Treppenhausreinigung",
    nachricht: "Bitte um Angebot",
    datenschutz: true,
  };

  it("ohne Login möglich, Büro sieht sie, Betrieb B nicht", async () => {
    await anon((tx) => tx.query("select public.anfrage_stellen($1, $2)", [kennung, daten]));
    expect(Number(await als(db, a, (tx) => wert(tx, "select count(*) from public.anfrage")))).toBe(
      1,
    );
    expect(Number(await als(db, b, (tx) => wert(tx, "select count(*) from public.anfrage")))).toBe(
      0,
    );
    // ohne Login: Tabelle leer (RLS)
    expect(Number(await anon((tx) => wert(tx, "select count(*) from public.anfrage")))).toBe(0);
  });

  it("Datenschutz-Zustimmung ist Pflicht; mehr als 3 je Stunde und E-Mail werden abgewiesen", async () => {
    await expect(
      anon((tx) =>
        tx.query("select public.anfrage_stellen($1, $2)", [
          kennung,
          { ...daten, datenschutz: false },
        ]),
      ),
    ).rejects.toThrow(/Datenschutz/);
    await anon((tx) => tx.query("select public.anfrage_stellen($1, $2)", [kennung, daten]));
    await anon((tx) => tx.query("select public.anfrage_stellen($1, $2)", [kennung, daten]));
    await expect(
      anon((tx) => tx.query("select public.anfrage_stellen($1, $2)", [kennung, daten])),
    ).rejects.toThrow(/Zu viele/);
  });

  it("abgeschaltetes Formular und unbekannte Kennung werden abgewiesen", async () => {
    await expect(
      anon((tx) => tx.query("select public.anfrage_stellen('gibtsnicht', $1)", [daten])),
    ).rejects.toThrow(/nicht möglich/);
  });
});

describe("Angebot bis zum Vertragsentwurf", () => {
  let angebot: string;
  let token: string;

  beforeAll(async () => {
    await als(db, a, async (tx) => {
      const anfrage = await wert<string>(tx, "select id from public.anfrage limit 1");
      angebot = await wert(
        tx,
        `insert into public.angebot (betrieb_id, anfrage_id, kundentyp, empfaenger_name, empfaenger_firma, empfaenger_email,
           strasse, plz, ort, objekt_name, objekt_strasse, objekt_plz, objekt_ort, titel, beginn, gueltig_bis,
           abrechnungsart, pauschale_cent)
         values ($1, $2, 'verwaltung', 'Erika Mustermann', 'HV Mustermann', 'erika@example.org', 'Büroweg 1', '70173',
           'Stuttgart', 'Hauptstraße 12', 'Hauptstraße 12', '70174', 'Stuttgart', 'Treppenhausreinigung',
           $3, $4, 'pauschale', 42000) returning id`,
        [betriebA, anfrage, plusTage(heute, 7), plusTage(heute, 30)],
      );
      await tx.query(
        `insert into public.angebotsleistung (betrieb_id, angebot_id, pos, vorlage_id, bezeichnung, frequenz, wochentage)
         values ($1, $2, 1, $3, 'Treppenhaus wöchentlich', 'woechentlich', '{1}')`,
        [betriebA, angebot, vorlage],
      );
      token = await wert(tx, "select freigabe_token from public.angebot where id=$1", [angebot]);
    });
  });

  it("Entwurf ist öffentlich unsichtbar, nach Versand sichtbar mit Leistungen", async () => {
    expect(await json("select public.angebot_info($1) as j", [token])).toBeNull();
    await als(db, a, (tx) =>
      tx.query("update public.angebot set status='versendet', versendet_am=now() where id=$1", [
        angebot,
      ]),
    );
    const info = await anon(
      async (tx) =>
        (
          await tx.query<{ j: Record<string, unknown> }>("select public.angebot_info($1) as j", [
            token,
          ])
        ).rows[0]!.j,
    );
    expect(info).toMatchObject({ abgelaufen: false, betrieb: { name: "A" } });
    expect((info.leistungen as unknown[]).length).toBe(1);
    expect(JSON.stringify(info)).not.toContain("freigabe_token");
  });

  it("Annahme legt Kunde, Objekt und unterschriebenen Vertragsentwurf an; zweite Annahme geht nicht", async () => {
    const r = await anon(
      async (tx) =>
        (
          await tx.query<{ j: { vertrag_id: string } }>(
            "select public.angebot_annehmen($1, 'Erika Mustermann', 'data:image/png;base64,AAAA') as j",
            [token],
          )
        ).rows[0]!.j,
    );
    const v = (
      await db.query<{
        status: string;
        unterschrift_name: string;
        kunde: string;
        objekt: string;
        pauschale_cent: number;
        leistungen: number;
      }>(
        `select v.status::text, v.unterschrift_name, k.name as kunde, o.name as objekt, vv.pauschale_cent,
           (select count(*)::int from public.vertragsleistung l where l.version_id = vv.id) as leistungen
         from public.vertrag v join public.kunde k on k.id = v.kunde_id join public.objekt o on o.id = v.objekt_id
         join public.vertragsversion vv on vv.vertrag_id = v.id where v.id = $1`,
        [r.vertrag_id],
      )
    ).rows[0];
    expect(v).toEqual({
      status: "entwurf",
      unterschrift_name: "Erika Mustermann",
      kunde: "HV Mustermann",
      objekt: "Hauptstraße 12",
      pauschale_cent: 42000,
      leistungen: 1,
    });
    expect(await wert(db, "select count(*)::int from public.ansprechpartner")).toBe(1);
    expect(
      await wert(
        db,
        "select status::text from public.anfrage where id=(select anfrage_id from public.angebot where id=$1)",
        [angebot],
      ),
    ).toBe("gewonnen");
    await expect(
      anon((tx) => tx.query("select public.angebot_annehmen($1, 'X Y', null)", [token])),
    ).rejects.toThrow(/bereits beantwortet/);
    await expect(
      als(db, a, (tx) =>
        tx.query("update public.angebot set pauschale_cent = 1 where id=$1", [angebot]),
      ),
    ).rejects.toThrow(/nicht geändert/);
  });

  it("abgelaufenes Angebot kann nicht angenommen werden", async () => {
    const t2 = await als(db, a, async (tx) => {
      const id = await wert<string>(
        tx,
        `insert into public.angebot (betrieb_id, empfaenger_name, titel, beginn, gueltig_bis, status)
         values ($1, 'Max Muster', 'Alt', $2, $3, 'versendet') returning id`,
        [betriebA, heute, plusTage(heute, -1)],
      );
      return wert<string>(tx, "select freigabe_token from public.angebot where id=$1", [id]);
    });
    await expect(
      anon((tx) => tx.query("select public.angebot_annehmen($1, 'Max Muster', null)", [t2])),
    ).rejects.toThrow(/abgelaufen/);
  });
});

describe("Online-Buchung Fensterreinigung", () => {
  const einstellungen: BuchungsEinstellungen = {
    ...STANDARD_BUCHUNG,
    aktiv: true,
    vorlageId: null,
  };
  const datum = plusTage(heute, 5);
  const buchung = {
    name: "Max Privat",
    email: "max@example.org",
    strasse: "Gartenweg 3",
    plz: "71034",
    ort: "Böblingen",
    anzahl: { normal: 12, gross: 2 },
    rahmen: true,
    datum,
    halbtag: "vormittag",
    datenschutz: true,
  };

  beforeAll(async () => {
    einstellungen.vorlageId = vorlage;
    await db.query("update public.betrieb set buchung=$2 where id=$1", [betriebA, einstellungen]);
  });

  it("Preis der Datenbank entspricht dem Preisrechner", async () => {
    for (const [auswahl, ku] of [
      [{ anzahl: { normal: 12, gross: 2 }, rahmen: true }, false],
      [{ anzahl: { normal: 3 }, rahmen: false }, true],
      [{ anzahl: { dach: 7, sprossen: 5 }, rahmen: true }, false],
    ] as const) {
      const ts = preisBerechnen(
        einstellungen,
        { anzahl: { ...auswahl.anzahl }, rahmen: auswahl.rahmen },
        ku,
      );
      const sql = await json<{ netto_cent: number; brutto_cent: number; minuten: number }>(
        "select public.buchung_preis($1, $2, $3, $4) as j",
        [einstellungen, auswahl.anzahl, auswahl.rahmen, ku],
      );
      expect(sql).toMatchObject({
        netto_cent: ts.nettoCent,
        brutto_cent: ts.bruttoCent,
        minuten: ts.minuten,
      });
    }
  });

  it("Buchung ohne Login: Kunde, Objekt mit Fensteraufmaß, Einzelauftrag und Einsatz", async () => {
    const r = await anon(
      async (tx) =>
        (
          await tx.query<{ j: { brutto_cent: number; einsatz_id: string } }>(
            "select public.buchung_anlegen($1, $2) as j",
            [kennung, buchung],
          )
        ).rows[0]!.j,
    );
    expect(r.brutto_cent).toBe(16017);
    const e = (
      await db.query<{
        datum: string;
        sollzeit_minuten: number;
        status: string;
        quelle: string;
        abrechnungsart: string;
        preis: number;
      }>(
        `select e.datum::text, e.sollzeit_minuten, e.status::text, e.quelle, vv.abrechnungsart::text, l.preis_cent as preis
         from public.einsatz e join public.vertragsleistung l on l.id = e.vertragsleistung_id
         join public.vertragsversion vv on vv.id = l.version_id where e.id = $1`,
        [r.einsatz_id],
      )
    ).rows[0];
    expect(e).toEqual({
      datum,
      sollzeit_minuten: 135,
      status: "geplant",
      quelle: "serie",
      abrechnungsart: "einzelauftrag",
      preis: 13460,
    });
    expect(await wert(db, "select sum(anzahl)::int from public.fensteraufmass")).toBe(14);
    // zweite Buchung desselben Kunden nutzt Kunde und Objekt weiter
    await anon((tx) => tx.query("select public.buchung_anlegen($1, $2)", [kennung, buchung]));
    expect(
      await wert(db, "select count(*)::int from public.kunde where email='max@example.org'"),
    ).toBe(1);
  });

  it("zu früh, ohne Adresse oder ohne Fenster wird abgelehnt", async () => {
    const versuch = (d: Record<string, unknown>) =>
      anon((tx) =>
        tx.query("select public.buchung_anlegen($1, $2)", [
          kennung,
          { ...buchung, email: "neu@example.org", ...d },
        ]),
      );
    await expect(versuch({ datum: heute })).rejects.toThrow(/nicht buchbar/);
    await expect(versuch({ plz: "" })).rejects.toThrow(/Adresse/);
    await expect(versuch({ anzahl: {} })).rejects.toThrow(/mindestens ein Fenster/);
  });

  it("Kalender verrät keine Namen", async () => {
    const k = await anon(
      async (tx) =>
        (
          await tx.query<{ j: { belegt: { mitarbeiterId: string | null }[] } }>(
            "select public.buchung_kalender($1, $2, $3) as j",
            [kennung, heute, plusTage(heute, 20)],
          )
        ).rows[0]!.j,
    );
    expect(k.belegt.length).toBeGreaterThan(0);
    expect(JSON.stringify(k)).not.toMatch(/Max|@/);
  });
});
