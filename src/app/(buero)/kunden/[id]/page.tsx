import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LoeschenKnopf } from "@/components/aktion-knoepfe";
import { Seitenkopf } from "@/components/seitenkopf";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { kundeLoeschen } from "@/lib/aktionen/kunden";
import { bueroKontext } from "@/lib/auth";
import { kundentypText } from "@/lib/schemas/kunde";
import { KundeFormular } from "../kunde-formular";
import { AnsprechpartnerListe } from "./ansprechpartner";

export const metadata: Metadata = { title: "Kunde" };

export default async function KundeSeite({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const k = await bueroKontext();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data: kd } = await k.supabase
    .from("kunde")
    .select(
      "*, ansprechpartner(id, name, funktion, email, telefon, ist_hauptkontakt), objekt(id, name, strasse, plz, ort, aktiv)",
    )
    .eq("id", id)
    .eq("betrieb_id", k.betriebId)
    .maybeSingle();
  if (!kd) notFound();

  return (
    <div className="flex max-w-4xl flex-col gap-10">
      <Seitenkopf
        titel={kd.name}
        beschreibung={`Kunde ${kd.kundennummer} · ${kundentypText(kd.typ)}`}
        aktionen={
          <LoeschenKnopf
            aktion={kundeLoeschen.bind(null, kd.id)}
            frage={`Kunde „${kd.name}“ mit allen Ansprechpartnern löschen?`}
            text="Kunde löschen"
            variante="outline"
          />
        }
      />

      <KundeFormular
        id={kd.id}
        werte={{
          typ: kd.typ,
          name: kd.name,
          zusatz: kd.zusatz ?? "",
          strasse: kd.strasse ?? "",
          plz: kd.plz ?? "",
          ort: kd.ort ?? "",
          email: kd.email ?? "",
          telefon: kd.telefon ?? "",
          rechnungs_email: kd.rechnungs_email ?? "",
          leitweg_id: kd.leitweg_id ?? "",
          ust_id: kd.ust_id ?? "",
          zahlungsziel_tage: kd.zahlungsziel_tage,
          nachweis_versand: kd.nachweis_versand,
          nachweis_email: kd.nachweis_email ?? "",
          erechnung: kd.erechnung as "zugferd" | "xrechnung",
          notiz: kd.notiz ?? "",
          aktiv: kd.aktiv,
        }}
      />

      <AnsprechpartnerListe
        kundeId={kd.id}
        liste={[...kd.ansprechpartner].sort(
          (a, b) => Number(b.ist_hauptkontakt) - Number(a.ist_hauptkontakt),
        )}
      />

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Objekte</h2>
          <Button
            size="sm"
            variant="outline"
            nativeButton={false}
            render={<Link href={`/objekte/neu?kunde=${kd.id}`} />}
          >
            Objekt anlegen
          </Button>
        </div>
        {kd.objekt.length === 0 ? (
          <p className="text-muted-foreground text-sm">Noch keine Objekte.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {kd.objekt.map((o) => (
              <li key={o.id} className="p-3 text-sm">
                <Link href={`/objekte/${o.id}`} className="font-medium hover:underline">
                  {o.name}
                </Link>
                {!o.aktiv && (
                  <Badge variant="outline" className="ml-2">
                    inaktiv
                  </Badge>
                )}
                <div className="text-muted-foreground">
                  {[o.strasse, [o.plz, o.ort].filter(Boolean).join(" ")]
                    .filter(Boolean)
                    .join(", ") || "–"}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
