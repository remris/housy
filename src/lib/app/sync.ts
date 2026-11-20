"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { type AppAktion, istEndgueltig, wartezeitMs } from "@/domain/app";
import type { Database } from "@/lib/supabase/database.types";
import { appSpeicher } from "./speicher";

type Client = SupabaseClient<Database>;

export class SyncFehler extends Error {
  constructor(
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

/** Überträgt eine Aktion an den Server (idempotent über die ID). */
export async function uebertrage(supabase: Client, betriebId: string, a: AppAktion): Promise<void> {
  const pruefe = (r: { error: { message: string; code?: string } | null }) => {
    if (r.error) throw new SyncFehler(r.error.message, r.error.code);
  };
  switch (a.typ) {
    case "zeit":
      return pruefe(
        await supabase.rpc("app_zeit_buchen", {
          p_id: a.id,
          p_art: a.art,
          p_zeitpunkt: a.zeitpunkt,
          p_einsatz_id: a.einsatzId ?? undefined,
          p_betrieb_id: a.einsatzId ? undefined : betriebId,
          p_quelle: a.quelle,
        }),
      );
    case "aufgabe":
      return pruefe(
        await supabase.rpc("app_aufgabe_setzen", {
          p_einsatz_id: a.einsatzId,
          p_taetigkeit_id: a.taetigkeitId,
          p_erledigt: a.erledigt,
          p_zeit: a.zeit,
        }),
      );
    case "notiz":
      return pruefe(
        await supabase.rpc("app_notiz_setzen", {
          p_einsatz_id: a.einsatzId,
          p_text: a.text,
          p_zeit: a.zeit,
        }),
      );
    case "meldung":
      return pruefe(
        await supabase.rpc("app_meldung", {
          p_id: a.id,
          p_einsatz_id: a.einsatzId,
          p_art: a.art,
          p_text: a.text ?? undefined,
          p_artikel_id: a.artikelId ?? undefined,
        }),
      );
    case "foto": {
      const db = appSpeicher();
      const datei = await db.fotos.get(a.id);
      if (datei) {
        const up = await supabase.storage
          .from("einsatzfotos")
          .upload(a.pfad, datei.blob, { contentType: "image/jpeg", upsert: false });
        // "Duplicate": Datei liegt schon oben (früherer Versuch) – weiter mit Registrierung
        if (up.error && !/exist|duplicate/i.test(up.error.message)) {
          throw new SyncFehler(up.error.message);
        }
      }
      pruefe(
        await supabase.rpc("app_foto", {
          p_id: a.id,
          p_einsatz_id: a.einsatzId,
          p_pfad: a.pfad,
          p_meldung_id: a.meldungId ?? undefined,
        }),
      );
      await db.fotos.delete(a.id);
      return;
    }
    case "position":
      return pruefe(
        await supabase.rpc("app_position", {
          p_id: a.id,
          p_einsatz_id: a.einsatzId,
          p_preis_id: a.preisId as string,
          p_bezeichnung: a.bezeichnung,
          p_menge: a.menge,
          p_dauer: a.dauer,
          p_zustimmung: a.zustimmung,
          p_unterschrift_name: a.unterschriftName ?? undefined,
          p_unterschrift_bild: a.unterschriftBild ?? undefined,
        }),
      );
    case "abnahme":
      return pruefe(
        await supabase.rpc("app_abnahme", {
          p_einsatz_id: a.einsatzId,
          p_name: a.name,
          p_bild: a.bild,
          p_zeit: a.zeit,
        }),
      );
    case "korrektur":
      return pruefe(
        await supabase.rpc("app_objekt_korrigieren", {
          p_id: a.id,
          p_einsatz_id: a.einsatzId,
          p_feld: a.feld,
          p_wert: a.wert,
          p_fenster_id: a.fensterId ?? undefined,
        }),
      );
  }
}

export type SyncErgebnis = {
  uebertragen: number;
  fehlgeschlagen: number;
  offen: number;
  /** Einsätze mit übertragenem Check-out, Abnahme oder Leistung (Nachweis/Bestätigung anstoßen) */
  abgeschlossen: string[];
};

const stoesstVersandAn = (a: AppAktion): string | null =>
  (a.typ === "zeit" && a.art === "checkout") || a.typ === "position" || a.typ === "abnahme"
    ? a.einsatzId
    : null;

let laeuft: Promise<SyncErgebnis> | null = null;

/**
 * Arbeitet die Warteschlange in Reihenfolge ab. Bei Netzproblemen wird abgebrochen und später
 * erneut versucht (wachsende Wartezeit); endgültige Fehler wandern in die Fehlerliste.
 */
export function synchronisiere(supabase: Client, betriebId: string): Promise<SyncErgebnis> {
  laeuft ??= (async () => {
    const db = appSpeicher();
    const ergebnis: SyncErgebnis = {
      uebertragen: 0,
      fehlgeschlagen: 0,
      offen: 0,
      abgeschlossen: [],
    };
    try {
      for (;;) {
        const eintrag = await db.warteschlange.orderBy("nr").first();
        if (!eintrag) break;
        if (eintrag.naechsterVersuch > Date.now()) break;
        try {
          await uebertrage(supabase, betriebId, eintrag.aktion);
          await db.warteschlange.delete(eintrag.nr!);
          ergebnis.uebertragen++;
          const id = stoesstVersandAn(eintrag.aktion);
          if (id && !ergebnis.abgeschlossen.includes(id)) ergebnis.abgeschlossen.push(id);
        } catch (e) {
          const code = e instanceof SyncFehler ? e.code : undefined;
          if (istEndgueltig(code)) {
            await db.transaction("rw", db.warteschlange, db.fehler, async () => {
              await db.fehler.add({
                aktion: eintrag.aktion,
                fehler: (e as Error).message,
                zeit: new Date().toISOString(),
              });
              await db.warteschlange.delete(eintrag.nr!);
            });
            ergebnis.fehlgeschlagen++;
            continue;
          }
          const versuche = eintrag.versuche + 1;
          await db.warteschlange.update(eintrag.nr!, {
            versuche,
            naechsterVersuch: Date.now() + wartezeitMs(versuche),
          });
          break;
        }
      }
      ergebnis.offen = await db.warteschlange.count();
      return ergebnis;
    } finally {
      laeuft = null;
    }
  })();
  return laeuft;
}

/** Legt eine Aktion in die Warteschlange (Fotos zusätzlich als Blob). */
export async function einreihen(aktion: AppAktion, foto?: Blob) {
  const db = appSpeicher();
  await db.transaction("rw", db.warteschlange, db.fotos, async () => {
    if (foto && aktion.typ === "foto") await db.fotos.put({ id: aktion.id, blob: foto });
    await db.warteschlange.add({
      aktion,
      erstellt: new Date().toISOString(),
      versuche: 0,
      naechsterVersuch: 0,
    });
  });
}

/** Wartezeit sofort zurücksetzen (Knopf „Jetzt übertragen“, Netz wieder da). */
export async function sofortVersuchen() {
  await appSpeicher().warteschlange.toCollection().modify({ naechsterVersuch: 0 });
}
