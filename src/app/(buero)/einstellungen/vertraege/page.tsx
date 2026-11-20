import type { Metadata } from "next";
import { bueroKontext } from "@/lib/auth";
import { VertragsEinstellungen } from "./vertrags-einstellungen";

export const metadata: Metadata = { title: "Einstellungen Verträge" };

export default async function VertragsEinstellungenSeite() {
  const k = await bueroKontext();
  const { data: b } = await k.supabase
    .from("betrieb")
    .select("bundesland, vertragsbedingungen")
    .eq("id", k.betriebId)
    .single();
  if (!b) return null;
  return (
    <VertragsEinstellungen
      darfAendern={k.rolle === "inhaber"}
      werte={{
        bundesland: b.bundesland as "BW",
        vertragsbedingungen: b.vertragsbedingungen ?? "",
      }}
    />
  );
}
