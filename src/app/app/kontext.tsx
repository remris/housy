"use client";

import { createContext, useContext } from "react";
import type { AppAktion, Tagesdaten } from "@/domain/app";
import type { Uebersetzer } from "@/lib/i18n";

export type AppKontextWert = {
  t: Uebersetzer;
  daten: Tagesdaten;
  betriebId: string;
  ausfuehren: (aktion: AppAktion, foto?: Blob) => void;
  oeffne: (einsatzId: string | null) => void;
};

export const AppKontext = createContext<AppKontextWert | null>(null);

export function useAppKontext(): AppKontextWert {
  const k = useContext(AppKontext);
  if (!k) throw new Error("AppKontext fehlt");
  return k;
}
