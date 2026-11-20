import type { Metadata } from "next";
import { LoeschenKnopf } from "@/components/aktion-knoepfe";
import { formatDatum, heuteIso } from "@/domain/datum";
import { abwesenheitLoeschen } from "@/lib/aktionen/planung";
import { bueroKontext } from "@/lib/auth";
import { abwesenheitText } from "@/lib/schemas/planung";
import { mitgliedName } from "@/lib/touren";
import { AbwesenheitFormular, ArbeitszeitenFormular } from "./mitarbeiter-teile";

export const metadata: Metadata = { title: "Arbeitszeiten und Abwesenheit" };

export default async function MitarbeiterPlanungSeite() {
  const k = await bueroKontext();
  const heute = heuteIso();
  const [{ data: mitglieder }, { data: zeiten }, { data: abwesenheiten }] = await Promise.all([
    k.supabase
      .from("mitglied")
      .select("id, anzeigename, rolle")
      .eq("betrieb_id", k.betriebId)
      .eq("aktiv", true)
      .order("anzeigename"),
    k.supabase
      .from("mitarbeiter_verfuegbarkeit")
      .select("mitglied_id, wochentag, von, bis")
      .eq("betrieb_id", k.betriebId),
    k.supabase
      .from("abwesenheit")
      .select("id, mitglied_id, art, von, bis, notiz")
      .eq("betrieb_id", k.betriebId)
      .gte("bis", heute)
      .order("von"),
  ]);
  const liste = mitglieder ?? [];
  const optionen = liste.map((m) => ({ wert: m.id, text: mitgliedName(m) }));

  return (
    <div className="flex max-w-4xl flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h2 className="font-medium">Abwesenheit eintragen</h2>
        <AbwesenheitFormular mitarbeiter={optionen} />
        {abwesenheiten && abwesenheiten.length > 0 && (
          <ul className="divide-y rounded-lg border">
            {abwesenheiten.map((a) => (
              <li key={a.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="w-40 truncate font-medium">
                  {optionen.find((o) => o.wert === a.mitglied_id)?.text ?? "–"}
                </span>
                <span className="w-20">{abwesenheitText(a.art)}</span>
                <span className="tabular-nums">
                  {formatDatum(a.von)}
                  {a.bis !== a.von && ` – ${formatDatum(a.bis)}`}
                </span>
                <span className="text-muted-foreground flex-1 truncate">{a.notiz}</span>
                <LoeschenKnopf
                  aktion={abwesenheitLoeschen.bind(null, a.id)}
                  frage="Abwesenheit löschen?"
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="font-medium">Arbeitszeiten</h2>
          <p className="text-muted-foreground text-sm">
            Regelmäßige Arbeitszeit je Wochentag. Ohne Eintrag prüft die Planung keine Arbeitszeiten
            für diese Person.
          </p>
        </div>
        {liste.map((m) => (
          <ArbeitszeitenFormular
            key={m.id}
            mitgliedId={m.id}
            name={mitgliedName(m)}
            zeiten={(zeiten ?? [])
              .filter((z) => z.mitglied_id === m.id)
              .map((z) => ({
                wochentag: z.wochentag,
                von: z.von.slice(0, 5),
                bis: z.bis.slice(0, 5),
              }))}
          />
        ))}
      </section>
    </div>
  );
}
