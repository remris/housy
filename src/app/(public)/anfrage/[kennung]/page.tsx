import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OeffentlicherRahmen } from "@/components/oeffentlicher-rahmen";
import { ladeOeffentlichenBetrieb } from "@/lib/aktionen/oeffentlich";
import { createClient } from "@/lib/supabase/server";
import { AnfrageFormular } from "./anfrage-formular";

export const metadata: Metadata = { title: "Anfrage", robots: { index: false } };

/** Öffentliches Anfrageformular; per iFrame auf der Website des Betriebs einbettbar. */
export default async function AnfrageSeite({ params }: { params: Promise<{ kennung: string }> }) {
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
      titel="Angebot anfragen"
      beschreibung={`${b.name} meldet sich mit einem unverbindlichen Angebot bei Ihnen.`}
      datenschutzUrl={b.datenschutz_url}
      impressumUrl={b.impressum_url}
    >
      {b.anfrage_aktiv ? (
        <AnfrageFormular kennung={kennung} datenschutzUrl={b.datenschutz_url} />
      ) : (
        <p className="text-sm">
          Anfragen über dieses Formular sind derzeit nicht möglich.
          {b.telefon ? ` Bitte rufen Sie an: ${b.telefon}.` : ""}
        </p>
      )}
    </OeffentlicherRahmen>
  );
}
