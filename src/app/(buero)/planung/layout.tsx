import type { ReactNode } from "react";
import { Seitenkopf } from "@/components/seitenkopf";
import { PlanungTabs } from "./planung-tabs";

export default function PlanungLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Seitenkopf
        titel="Planung"
        beschreibung="Einsätze auf Mitarbeiter verteilen, Touren mit Fahrzeiten und Ankunftszeiten"
      />
      <PlanungTabs />
      {children}
    </>
  );
}
