import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LoeschenKnopf } from "@/components/aktion-knoepfe";
import { Seitenkopf } from "@/components/seitenkopf";
import { formatEuro } from "@/domain/geld";
import { type Bedarfsbezug, bedarfJeEinsatz, formatMenge, sollzeit } from "@/domain/vorlagen";
import { vorlageKopieren, vorlageLoeschen } from "@/lib/aktionen/vorlagen";
import { bueroKontext } from "@/lib/auth";
import { preiseinheitText } from "@/lib/schemas/vorlage";
import { Bedarf, Taetigkeiten, VorlageFormular } from "../vorlagen-teile";

export const metadata: Metadata = { title: "Auftragsvorlage" };

const BEISPIEL = { flaecheM2: 200, fenster: 20 };

export default async function VorlageSeite({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const k = await bueroKontext();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [{ data: v }, { data: artikel }] = await Promise.all([
    k.supabase
      .from("auftragsvorlage")
      .select(
        "*, vorlage_taetigkeit(id, text, reihenfolge, foto_pflicht), vorlage_bedarf(id, menge, bezug, artikel(id, name, einheit, art)), preisliste(id, name, einheit, preis_cent)",
      )
      .eq("id", id)
      .eq("betrieb_id", k.betriebId)
      .maybeSingle(),
    k.supabase
      .from("artikel")
      .select("id, name, einheit")
      .eq("betrieb_id", k.betriebId)
      .eq("aktiv", true)
      .order("name"),
  ]);
  if (!v) notFound();

  const bedarf = v.vorlage_bedarf
    .filter((b) => b.artikel)
    .map((b) => ({ ...b, menge: Number(b.menge), artikel: b.artikel! }))
    .sort((a, b) => a.artikel.name.localeCompare(b.artikel.name));
  const zeit = {
    sollzeitMinuten: v.sollzeit_minuten,
    minutenPro100m2: v.minuten_pro_100m2 === null ? null : Number(v.minuten_pro_100m2),
    minutenProFenster: v.minuten_pro_fenster === null ? null : Number(v.minuten_pro_fenster),
  };
  const beispielZeit = sollzeit(zeit, BEISPIEL);
  const beispielBedarf = bedarfJeEinsatz(
    bedarf.map((b) => ({
      artikelId: b.artikel.id,
      menge: b.menge,
      bezug: b.bezug as Bedarfsbezug,
    })),
    BEISPIEL,
    zeit,
  );

  return (
    <div className="flex max-w-4xl flex-col gap-10">
      <Seitenkopf
        titel={v.name}
        beschreibung="Auftragsvorlage"
        aktionen={
          <>
            <LoeschenKnopf
              aktion={vorlageKopieren.bind(null, v.id)}
              frage="Eine Kopie dieser Vorlage anlegen?"
              text="Kopieren"
              variante="outline"
            />
            <LoeschenKnopf
              aktion={vorlageLoeschen.bind(null, v.id)}
              frage={`Vorlage „${v.name}“ löschen?`}
              text="Löschen"
              variante="outline"
            />
          </>
        }
      />

      <VorlageFormular
        id={v.id}
        werte={{
          name: v.name,
          branche: v.branche as "gebaeudereinigung" | "hausmeister" | "fensterreinigung" | null,
          beschreibung: v.beschreibung ?? "",
          sollzeit_minuten: v.sollzeit_minuten,
          minuten_pro_100m2: zeit.minutenPro100m2?.toLocaleString("de-DE") ?? "",
          minuten_pro_fenster: zeit.minutenProFenster?.toLocaleString("de-DE") ?? "",
          aktiv: v.aktiv,
        }}
      />

      <Taetigkeiten
        vorlageId={v.id}
        liste={[...v.vorlage_taetigkeit].sort((a, b) => a.reihenfolge - b.reihenfolge)}
      />

      <Bedarf vorlageId={v.id} liste={bedarf} artikel={artikel ?? []} />

      <section className="bg-muted/30 flex flex-col gap-2 rounded-lg border p-4 text-sm">
        <h2 className="font-medium">
          Beispiel: Objekt mit {BEISPIEL.flaecheM2} m² und {BEISPIEL.fenster} Fenstern
        </h2>
        <p>
          Sollzeit <span className="font-medium">{beispielZeit} Minuten</span>
        </p>
        {beispielBedarf.size > 0 && (
          <ul className="text-muted-foreground list-inside list-disc">
            {bedarf
              .filter((b, i, l) => l.findIndex((x) => x.artikel.id === b.artikel.id) === i)
              .map((b) => (
                <li key={b.artikel.id}>
                  {b.artikel.name}:{" "}
                  {formatMenge(beispielBedarf.get(b.artikel.id) ?? 0, b.artikel.einheit)}
                  {b.artikel.art !== "verbrauch" && " (Zähler)"}
                </li>
              ))}
          </ul>
        )}
      </section>

      {v.preisliste.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-medium">Verknüpfte Preise</h2>
          <ul className="text-sm">
            {v.preisliste.map((p) => (
              <li key={p.id}>
                {p.name}: {formatEuro(p.preis_cent)} {preiseinheitText(p.einheit)}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
