import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OeffentlicherRahmen } from "@/components/oeffentlicher-rahmen";
import { ladeOeffentlichenBetrieb } from "@/lib/aktionen/oeffentlich";
import { createClient } from "@/lib/supabase/server";
import { Buchung } from "./buchung";

export const metadata: Metadata = { title: "Fensterreinigung buchen", robots: { index: false } };

/** Online-Buchung Fensterreinigung für Privatkunden; per iFrame einbettbar. */
export default async function BuchenSeite({ params }: { params: Promise<{ kennung: string }> }) {
  const { kennung } = await params;
  const b = await ladeOeffentlichenBetrieb(kennung);
  if (!b) notFound();
  const logoUrl = b.logo_pfad
    ? (await createClient()).storage.from("logos").getPublicUrl(b.logo_pfad).data.publicUrl
    : null;
  return (
    <OeffentlicherRahmen
      betrieb={b.name}
      logoUrl={logoUrl}
      titel="Fensterreinigung online buchen"
      beschreibung="Preis sofort berechnen, freien Termin wählen, fertig."
      datenschutzUrl={b.datenschutz_url}
      impressumUrl={b.impressum_url}
    >
      {b.buchung ? (
        <Buchung
          kennung={kennung}
          einstellungen={b.buchung}
          kleinunternehmer={b.kleinunternehmer}
          datenschutzUrl={b.datenschutz_url}
        />
      ) : (
        <p className="text-sm">
          Die Online-Buchung ist derzeit nicht möglich.
          {b.telefon ? ` Bitte rufen Sie an: ${b.telefon}.` : ""}
        </p>
      )}
    </OeffentlicherRahmen>
  );
}
