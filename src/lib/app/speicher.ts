"use client";

import Dexie, { type EntityTable } from "dexie";
import type { AppAktion, Tagesdaten } from "@/domain/app";

/** Gespeicherte Tagesdaten (Serverstand, ohne ausstehende Aktionen). */
export type TagEintrag = { schluessel: string; daten: Tagesdaten };

export type WarteEintrag = {
  nr?: number;
  aktion: AppAktion;
  erstellt: string;
  versuche: number;
  naechsterVersuch: number;
};

export type FehlerEintrag = { nr?: number; aktion: AppAktion; fehler: string; zeit: string };

/** Fotos warten als Blob, bis sie hochgeladen sind. */
export type FotoEintrag = { id: string; blob: Blob };

class AppSpeicher extends Dexie {
  tage!: EntityTable<TagEintrag, "schluessel">;
  warteschlange!: EntityTable<WarteEintrag, "nr">;
  fehler!: EntityTable<FehlerEintrag, "nr">;
  fotos!: EntityTable<FotoEintrag, "id">;

  constructor() {
    super("housy-app");
    this.version(1).stores({
      tage: "schluessel",
      warteschlange: "++nr",
      fehler: "++nr",
      fotos: "id",
    });
  }
}

let speicher: AppSpeicher | null = null;

export function appSpeicher(): AppSpeicher {
  speicher ??= new AppSpeicher();
  return speicher;
}

/** Schlüssel je Mitglied und Tag, damit sich zwei Konten auf einem Gerät nicht mischen. */
export const tagSchluessel = (mitgliedId: string, datum: string) => `${mitgliedId}|${datum}`;
