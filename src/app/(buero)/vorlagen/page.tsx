import type { Metadata } from "next";
import Link from "next/link";
import { Seitenkopf } from "@/components/seitenkopf";
import { Badge } from "@/components/ui/badge";
import { bueroKontext } from "@/lib/auth";
import { BRANCHEN } from "@/lib/schemas/konto";
import { BranchenpaketKarte, NeueVorlage } from "./vorlagen-teile";

export const metadata: Metadata = { title: "Auftragsvorlagen" };

export default async function VorlagenSeite() {
  const k = await bueroKontext();
  const [{ data: vorlagen }, { data: betrieb }] = await Promise.all([
    k.supabase
      .from("auftragsvorlage")
      .select(
        "id, name, branche, sollzeit_minuten, aktiv, vorlage_taetigkeit(count), vorlage_bedarf(count)",
      )
      .eq("betrieb_id", k.betriebId)
      .order("name"),
    k.supabase.from("betrieb").select("branchen").eq("id", k.betriebId).single(),
  ]);

  const nachBranche = new Map<string, NonNullable<typeof vorlagen>>();
  for (const v of vorlagen ?? []) {
    const key = v.branche ?? "sonstige";
    nachBranche.set(key, [...(nachBranche.get(key) ?? []), v]);
  }
  const titel = (b: string) => BRANCHEN.find((x) => x.wert === b)?.text ?? "Ohne Branche";

  return (
    <div className="flex flex-col gap-8">
      <Seitenkopf
        titel="Auftragsvorlagen"
        beschreibung="Leistungsverzeichnis: Checkliste, Sollzeit und Material je Leistung"
        aktionen={<NeueVorlage />}
      />
      {(vorlagen?.length ?? 0) === 0 && <BranchenpaketKarte vorauswahl={betrieb?.branchen ?? []} />}
      {[...nachBranche].map(([branche, liste]) => (
        <section key={branche} className="flex flex-col gap-3">
          <h2 className="text-muted-foreground text-sm font-medium tracking-wide uppercase">
            {titel(branche)}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {liste.map((v) => (
              <li key={v.id}>
                <Link
                  href={`/vorlagen/${v.id}`}
                  className="hover:bg-muted/50 flex h-full flex-col gap-1 rounded-lg border p-4"
                >
                  <span className="font-medium">
                    {v.name}
                    {!v.aktiv && (
                      <Badge variant="outline" className="ml-2">
                        inaktiv
                      </Badge>
                    )}
                  </span>
                  <span className="text-muted-foreground text-sm">
                    {v.sollzeit_minuten} Min. Grundzeit · {v.vorlage_taetigkeit[0]?.count ?? 0}{" "}
                    Tätigkeiten · {v.vorlage_bedarf[0]?.count ?? 0} Artikel
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {(vorlagen?.length ?? 0) > 0 && (
        <details className="text-sm">
          <summary className="text-muted-foreground cursor-pointer">
            Weiteres Branchenpaket übernehmen
          </summary>
          <div className="mt-3">
            <BranchenpaketKarte vorauswahl={[]} />
          </div>
        </details>
      )}
    </div>
  );
}
