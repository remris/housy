import type { ReactNode } from "react";
import { Seitenkopf } from "@/components/seitenkopf";
import { EinstellungenTabs } from "./einstellungen-tabs";

export default function EinstellungenLayout({ children }: { children: ReactNode }) {
  return (
    <div className="max-w-3xl">
      <Seitenkopf titel="Einstellungen" beschreibung="Firmendaten, Rechnungskopf und Team" />
      <EinstellungenTabs />
      {children}
    </div>
  );
}
