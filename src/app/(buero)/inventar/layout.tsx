import type { ReactNode } from "react";
import { Seitenkopf } from "@/components/seitenkopf";
import { InventarTabs } from "./inventar-tabs";

export default function InventarLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Seitenkopf
        titel="Inventar"
        beschreibung="Bestände je Lagerort, Reichweite nach Einsatzplan, Einkaufsliste, Werkzeuge und Prüftermine"
      />
      <InventarTabs />
      {children}
    </>
  );
}
