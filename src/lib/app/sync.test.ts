import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppAktion } from "@/domain/app";
import { appSpeicher } from "./speicher";
import { einreihen, sofortVersuchen, synchronisiere } from "./sync";

type Rpc = (name: string, args: Record<string, unknown>) => Promise<{ error: unknown }>;

function attrappe(rpc: Rpc, upload = vi.fn(async () => ({ error: null }))) {
  return {
    rpc: vi.fn(rpc),
    storage: { from: vi.fn(() => ({ upload })) },
    upload,
  };
}

const notiz = (id: string): AppAktion => ({
  typ: "notiz",
  id,
  einsatzId: "e1",
  text: id,
  zeit: "2026-11-23T08:00:00Z",
});

beforeEach(async () => {
  const db = appSpeicher();
  await Promise.all([db.warteschlange.clear(), db.fehler.clear(), db.fotos.clear()]);
});

describe("Warteschlange", () => {
  it("überträgt in Reihenfolge und leert die Schlange", async () => {
    const s = attrappe(async () => ({ error: null }));
    await einreihen(notiz("a"));
    await einreihen(notiz("b"));
    const r = await synchronisiere(s as never, "betrieb");
    expect(r).toEqual({ uebertragen: 2, fehlgeschlagen: 0, offen: 0 });
    expect(s.rpc.mock.calls.map((c) => c[1].p_text)).toEqual(["a", "b"]);
  });

  it("ohne Netz: Abbruch, Reihenfolge bleibt, später erneuter Versuch", async () => {
    let netz = false;
    const s = attrappe(async () => {
      if (!netz) throw new TypeError("Failed to fetch");
      return { error: null };
    });
    await einreihen(notiz("a"));
    await einreihen(notiz("b"));
    const r1 = await synchronisiere(s as never, "betrieb");
    expect(r1).toEqual({ uebertragen: 0, fehlgeschlagen: 0, offen: 2 });
    const erster = await appSpeicher().warteschlange.orderBy("nr").first();
    expect(erster?.versuche).toBe(1);
    expect(erster!.naechsterVersuch).toBeGreaterThan(Date.now());

    netz = true;
    expect((await synchronisiere(s as never, "betrieb")).uebertragen).toBe(0); // wartet noch
    await sofortVersuchen();
    expect(await synchronisiere(s as never, "betrieb")).toEqual({
      uebertragen: 2,
      fehlgeschlagen: 0,
      offen: 0,
    });
  });

  it("endgültige Fehler wandern in die Fehlerliste, der Rest läuft weiter", async () => {
    const s = attrappe(async (_n, args) =>
      args.p_text === "kaputt"
        ? { error: { message: "Einsatz nicht zugewiesen", code: "42501" } }
        : { error: null },
    );
    await einreihen(notiz("kaputt"));
    await einreihen(notiz("gut"));
    const r = await synchronisiere(s as never, "betrieb");
    expect(r).toEqual({ uebertragen: 1, fehlgeschlagen: 1, offen: 0 });
    const fehler = await appSpeicher().fehler.toArray();
    expect(fehler.map((f) => f.fehler)).toEqual(["Einsatz nicht zugewiesen"]);
  });

  it("Foto: erst hochladen, dann registrieren, dann Blob löschen", async () => {
    const s = attrappe(async () => ({ error: null }));
    await einreihen(
      { typ: "foto", id: "f1", einsatzId: "e1", pfad: "b/e1/f1.jpg", meldungId: null },
      new Blob(["x"], { type: "image/jpeg" }),
    );
    expect(await appSpeicher().fotos.count()).toBe(1);
    await synchronisiere(s as never, "betrieb");
    expect(s.upload).toHaveBeenCalledWith("b/e1/f1.jpg", expect.any(Blob), expect.anything());
    expect(s.rpc).toHaveBeenCalledWith("app_foto", expect.objectContaining({ p_id: "f1" }));
    expect(await appSpeicher().fotos.count()).toBe(0);
  });

  it("Pause ohne Einsatz schickt die Betriebs-ID mit", async () => {
    const s = attrappe(async () => ({ error: null }));
    await einreihen({
      typ: "zeit",
      id: "z",
      art: "pause_beginn",
      zeitpunkt: "2026-11-23T09:00:00Z",
      einsatzId: null,
      quelle: "app",
    });
    await synchronisiere(s as never, "betrieb-1");
    expect(s.rpc.mock.calls[0]![1]).toMatchObject({
      p_betrieb_id: "betrieb-1",
      p_art: "pause_beginn",
    });
  });
});
