import type { Metadata } from "next";
import { bueroKontext } from "@/lib/auth";
import { FirmendatenFormular } from "./firmendaten-formular";
import { LogoFormular } from "./logo-formular";

export const metadata: Metadata = { title: "Einstellungen" };

export default async function EinstellungenSeite() {
  const k = await bueroKontext();
  const { data: b } = await k.supabase.from("betrieb").select("*").eq("id", k.betriebId).single();
  if (!b) return null;
  const darfAendern = k.rolle === "inhaber";
  const logoUrl = b.logo_pfad
    ? k.supabase.storage.from("logos").getPublicUrl(b.logo_pfad).data.publicUrl
    : null;

  return (
    <div className="flex flex-col gap-10">
      <LogoFormular logoUrl={logoUrl} darfAendern={darfAendern} />
      <FirmendatenFormular
        darfAendern={darfAendern}
        werte={{
          name: b.name,
          firmenname: b.firmenname ?? "",
          strasse: b.strasse ?? "",
          plz: b.plz ?? "",
          ort: b.ort ?? "",
          telefon: b.telefon ?? "",
          email: b.email ?? "",
          website: b.website ?? "",
          steuernummer: b.steuernummer ?? "",
          ust_id: b.ust_id ?? "",
          kleinunternehmer: b.kleinunternehmer,
          kontoinhaber: b.kontoinhaber ?? "",
          iban: b.iban ?? "",
          bic: b.bic ?? "",
          bank_name: b.bank_name ?? "",
          branchen: b.branchen as ("gebaeudereinigung" | "hausmeister" | "fensterreinigung")[],
        }}
      />
    </div>
  );
}
