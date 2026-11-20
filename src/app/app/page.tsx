import type { Metadata } from "next";
import { heuteIso, plusTage } from "@/domain/datum";
import type { Tagesdaten } from "@/domain/app";
import { ladeTagesdaten } from "@/lib/app/laden";
import { betriebKontext, istBueroRolle } from "@/lib/auth";
import { MitarbeiterApp } from "./mitarbeiter-app";

export const metadata: Metadata = { title: "Heute" };
export const dynamic = "force-dynamic";

/** Mitarbeiter-App (PWA). Erste Daten vom Server, danach arbeitet die App offline-fähig im Browser. */
export default async function AppStart() {
  const k = await betriebKontext();
  const heute = heuteIso();
  let initial: Tagesdaten | null = null;
  try {
    initial = await ladeTagesdaten(
      k.supabase,
      { betriebId: k.betriebId, mitgliedId: k.mitglied.id },
      heute,
    );
  } catch {
    initial = null; // App lädt dann im Browser
  }
  return (
    <MitarbeiterApp
      start={{
        betriebId: k.betriebId,
        betriebName: k.mitglied.betrieb?.name ?? "",
        mitgliedId: k.mitglied.id,
        name: k.mitglied.anzeigename ?? "",
        sprache: k.mitglied.sprache,
        buero: istBueroRolle(k.rolle),
        heute,
        morgen: plusTage(heute, 1),
        initial,
      }}
    />
  );
}
