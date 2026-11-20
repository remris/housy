import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LoeschenKnopf } from "@/components/aktion-knoepfe";
import { Seitenkopf } from "@/components/seitenkopf";
import { Button } from "@/components/ui/button";
import { objektLoeschen } from "@/lib/aktionen/kunden";
import { bueroKontext } from "@/lib/auth";
import { ObjektFormular } from "../objekt-formular";
import { Fotos } from "./fotos";
import { Maengel } from "./maengel";
import { Bereiche, Fensteraufmass } from "./raumbuch";

export const metadata: Metadata = { title: "Objekt" };

const dezimal = (n: number | null) =>
  n === null ? "" : n.toLocaleString("de-DE", { maximumFractionDigits: 6 });

export default async function ObjektSeite({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const k = await bueroKontext();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [{ data: o }, { data: kunden }] = await Promise.all([
    k.supabase
      .from("objekt")
      .select(
        "*, kunde(id, name), bereich(id, name, flaeche_m2, bodenart, etage, notiz, reihenfolge), fensteraufmass(id, bezeichnung, typ, anzahl, etage, mit_rahmen, hilfsmittel, notiz), objekt_foto(id, pfad, beschreibung, erstellt_am)",
      )
      .eq("id", id)
      .eq("betrieb_id", k.betriebId)
      .maybeSingle(),
    k.supabase
      .from("kunde")
      .select("id, name, kundennummer")
      .eq("betrieb_id", k.betriebId)
      .order("name"),
  ]);
  if (!o) notFound();

  const fotos = [...o.objekt_foto].sort((a, b) => b.erstellt_am.localeCompare(a.erstellt_am));
  const { data: signiert } = fotos.length
    ? await k.supabase.storage.from("objektfotos").createSignedUrls(
        fotos.map((f) => f.pfad),
        3600,
      )
    : { data: [] };

  const adresse = [o.strasse, [o.plz, o.ort].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const kartenLink =
    o.breitengrad !== null && o.laengengrad !== null
      ? `https://www.google.com/maps/search/?api=1&query=${o.breitengrad},${o.laengengrad}`
      : adresse
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(adresse)}`
        : null;

  return (
    <div className="flex max-w-4xl flex-col gap-10">
      <Seitenkopf
        titel={o.name}
        beschreibung={
          <>
            <Link href={`/kunden/${o.kunde?.id}`} className="underline">
              {o.kunde?.name}
            </Link>
            {adresse && <> · {adresse}</>}
            {kartenLink && (
              <>
                {" · "}
                <a href={kartenLink} target="_blank" rel="noreferrer" className="underline">
                  Karte
                </a>
              </>
            )}
          </>
        }
        aktionen={
          <>
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href={`/objekte/${o.id}/qr`} />}
            >
              QR-Code für Check-in
            </Button>
            <LoeschenKnopf
              aktion={objektLoeschen.bind(null, o.id)}
              frage={`Objekt „${o.name}“ mit Raumbuch, Fensteraufmaß und Fotos löschen?`}
              text="Objekt löschen"
              variante="outline"
            />
          </>
        }
      />

      <Bereiche
        objektId={o.id}
        liste={[...o.bereich]
          .sort((a, b) => a.reihenfolge - b.reihenfolge || a.name.localeCompare(b.name))
          .map((b) => ({ ...b, flaeche_m2: b.flaeche_m2 === null ? null : Number(b.flaeche_m2) }))}
      />
      <Fensteraufmass objektId={o.id} liste={o.fensteraufmass} />
      <Fotos
        objektId={o.id}
        fotos={fotos.map((f, i) => ({
          id: f.id,
          beschreibung: f.beschreibung,
          url: signiert?.[i]?.signedUrl ?? null,
        }))}
      />

      <Maengel k={k} objektId={o.id} />

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">Stammdaten</h2>
        <ObjektFormular
          id={o.id}
          kunden={(kunden ?? []).map((x) => ({ ...x, kundennummer: Number(x.kundennummer) }))}
          werte={{
            kunde_id: o.kunde_id,
            name: o.name,
            strasse: o.strasse ?? "",
            plz: o.plz ?? "",
            ort: o.ort ?? "",
            breitengrad: dezimal(o.breitengrad === null ? null : Number(o.breitengrad)),
            laengengrad: dezimal(o.laengengrad === null ? null : Number(o.laengengrad)),
            zugangshinweise: o.zugangshinweise ?? "",
            schluessel: o.schluessel ?? "",
            notiz: o.notiz ?? "",
            aktiv: o.aktiv,
          }}
        />
      </section>
    </div>
  );
}
