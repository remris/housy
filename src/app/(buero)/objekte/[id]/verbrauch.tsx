import { LoeschenKnopf } from "@/components/aktion-knoepfe";
import { formatMenge } from "@/domain/vorlagen";
import { bezugText } from "@/lib/schemas/vorlage";
import { objektBedarfLoeschen } from "@/lib/aktionen/inventar";
import type { BetriebKontext } from "@/lib/auth";
import { VerbrauchFormular } from "./verbrauch-formular";

/** Materialverbrauch dieses Objekts, wo er von der Vorlage abweicht. */
export async function Verbrauch({ k, objektId }: { k: BetriebKontext; objektId: string }) {
  const [{ data: liste }, { data: artikel }] = await Promise.all([
    k.supabase
      .from("objekt_bedarf")
      .select("id, menge, bezug, notiz, artikel(name, einheit)")
      .eq("objekt_id", objektId)
      .order("erstellt_am"),
    k.supabase
      .from("artikel")
      .select("id, name, einheit")
      .eq("betrieb_id", k.betriebId)
      .eq("aktiv", true)
      .eq("art", "verbrauch")
      .order("name"),
  ]);
  return (
    <section className="flex flex-col gap-3" data-verbrauch>
      <h2 className="font-medium">Materialverbrauch (abweichend von der Vorlage)</h2>
      <p className="text-muted-foreground text-sm">
        Ersetzt in allen Vorlagen dieses Objekts die Zeile mit gleichem Artikel und Bezug, z. B. 0,6
        l statt 0,5 l Allzweckreiniger je Einsatz. Abbuchung, Packliste und Prognose rechnen damit.
      </p>
      {liste && liste.length > 0 && (
        <ul className="divide-y rounded-lg border">
          {liste.map((b) => (
            <li key={b.id} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
              <span className="font-medium">{b.artikel?.name}</span>
              <span>
                {formatMenge(Number(b.menge), b.artikel?.einheit ?? "")} {bezugText(b.bezug)}
              </span>
              <span className="text-muted-foreground flex-1 text-xs">{b.notiz}</span>
              <LoeschenKnopf
                aktion={objektBedarfLoeschen.bind(null, b.id)}
                frage="Wieder den Wert der Vorlage verwenden?"
                text="Zurücksetzen"
              />
            </li>
          ))}
        </ul>
      )}
      <VerbrauchFormular
        objektId={objektId}
        artikel={(artikel ?? []).map((a) => ({ wert: a.id, text: `${a.name} (${a.einheit})` }))}
      />
    </section>
  );
}
