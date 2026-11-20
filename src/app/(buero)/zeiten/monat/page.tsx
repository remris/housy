import type { Metadata } from "next";
import Link from "next/link";
import { Seitenkopf } from "@/components/seitenkopf";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ZEITHINWEIS_TEXT, dezimalStunden, stundenMinuten } from "@/domain/arbeitszeitliste";
import { WOCHENTAGE_KURZ, formatDatum, heuteIso, wochentag } from "@/domain/datum";
import { istMonat, monatVon, monatsname, plusMonat } from "@/domain/nachweis";
import { uhrzeitBerlin } from "@/domain/zeiterfassung";
import { ladeArbeitszeiten } from "@/lib/arbeitszeit";
import { bueroKontext } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Arbeitszeitliste" };

export default async function ArbeitszeitlisteSeite({
  searchParams,
}: {
  searchParams: Promise<{ monat?: string; ma?: string }>;
}) {
  const { monat: m, ma } = await searchParams;
  const monat = m && istMonat(m) ? m : monatVon(heuteIso());
  const k = await bueroKontext();
  const alle = await ladeArbeitszeiten(k.supabase, k.betriebId, monat);
  const gewaehlt = alle.find((x) => x.id === ma) ?? null;

  const link = (p: { monat?: string; ma?: string | null }) => {
    const q = new URLSearchParams({ monat: p.monat ?? monat });
    const id = p.ma === undefined ? ma : p.ma;
    if (id) q.set("ma", id);
    return `/zeiten/monat?${q}`;
  };
  const exportLink = (format: "csv" | "pdf", id?: string) => {
    const q = new URLSearchParams({ monat, format });
    if (id) q.set("ma", id);
    return `/zeiten/export?${q}`;
  };

  return (
    <div className="flex flex-col gap-5">
      <Seitenkopf
        titel="Arbeitszeitliste"
        beschreibung="Beginn, Ende und Dauer der täglichen Arbeitszeit je Mitarbeiter (Aufzeichnungspflicht nach § 17 MiLoG). Aufbewahren: mindestens zwei Jahre."
        aktionen={
          <>
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href="/zeiten" />}
            >
              Wochenansicht
            </Button>
            <Button size="sm" nativeButton={false} render={<a href={exportLink("csv")} />}>
              Alle als CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<a href={exportLink("pdf")} target="_blank" rel="noreferrer" />}
            >
              Alle als PDF
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<Link href={link({ monat: plusMonat(monat, -1) })} />}
        >
          ← Vormonat
        </Button>
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<Link href={link({ monat: monatVon(heuteIso()) })} />}
        >
          Dieser Monat
        </Button>
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<Link href={link({ monat: plusMonat(monat, 1) })} />}
        >
          Nächster Monat →
        </Button>
        <h2 className="ml-2 font-medium">{monatsname(monat)}</h2>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[640px] text-sm" data-arbeitszeiten>
          <thead className="bg-muted/50">
            <tr>
              <th className="p-2 text-left font-medium">Mitarbeiter</th>
              <th className="p-2 text-right font-medium">Arbeitstage</th>
              <th className="p-2 text-right font-medium">Stunden</th>
              <th className="p-2 text-right font-medium">Tage mit Hinweis</th>
              <th className="p-2 text-right font-medium">Export</th>
            </tr>
          </thead>
          <tbody>
            {alle.map((x) => (
              <tr key={x.id} className={cn("border-t", x.id === ma && "bg-muted/40")}>
                <td className="p-2">
                  <Link href={link({ ma: x.id })} className="font-medium hover:underline">
                    {x.name}
                  </Link>
                  {!x.aktiv && <span className="text-muted-foreground"> (inaktiv)</span>}
                </td>
                <td className="p-2 text-right">{x.liste.arbeitstage}</td>
                <td className="p-2 text-right tabular-nums">
                  {stundenMinuten(x.liste.summeMinuten)}
                  <span className="text-muted-foreground">
                    {" "}
                    ({dezimalStunden(x.liste.summeMinuten)})
                  </span>
                </td>
                <td className="p-2 text-right">
                  {x.liste.tageMitHinweis > 0 ? (
                    <Badge
                      variant="outline"
                      className="border-amber-500 text-amber-700 dark:text-amber-300"
                    >
                      {x.liste.tageMitHinweis}
                    </Badge>
                  ) : (
                    "–"
                  )}
                </td>
                <td className="p-2 text-right whitespace-nowrap">
                  <a href={exportLink("csv", x.id)} className="underline">
                    CSV
                  </a>{" "}
                  ·{" "}
                  <a
                    href={exportLink("pdf", x.id)}
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    PDF
                  </a>
                </td>
              </tr>
            ))}
            {alle.length === 0 && (
              <tr>
                <td colSpan={5} className="text-muted-foreground p-6 text-center">
                  Keine Mitarbeiter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {gewaehlt && (
        <section className="flex flex-col gap-3" data-tage>
          <h2 className="font-medium">
            {gewaehlt.name} · {monatsname(monat)}
          </h2>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="p-2 text-left font-medium">Datum</th>
                  <th className="p-2 text-left font-medium">Beginn</th>
                  <th className="p-2 text-left font-medium">Ende</th>
                  <th className="p-2 text-right font-medium">Pause</th>
                  <th className="p-2 text-right font-medium">Arbeitszeit</th>
                  <th className="p-2 text-left font-medium">Hinweise</th>
                </tr>
              </thead>
              <tbody>
                {gewaehlt.liste.tage.map((t) => (
                  <tr key={t.datum} className="border-t">
                    <td className="p-2">
                      {WOCHENTAGE_KURZ[wochentag(t.datum) - 1]} {formatDatum(t.datum)}
                    </td>
                    <td className="p-2">{t.beginn ? uhrzeitBerlin(t.beginn) : "–"}</td>
                    <td className="p-2">{t.ende ? uhrzeitBerlin(t.ende) : "–"}</td>
                    <td className="p-2 text-right">{t.pauseMinuten} min</td>
                    <td className="p-2 text-right tabular-nums">
                      {stundenMinuten(t.arbeitMinuten)}
                    </td>
                    <td className="p-2">
                      <div className="flex flex-wrap gap-1">
                        {t.hinweise.map((h) => (
                          <Badge
                            key={h}
                            variant="outline"
                            className="border-amber-500 text-amber-700 dark:text-amber-300"
                          >
                            {ZEITHINWEIS_TEXT[h]}
                          </Badge>
                        ))}
                        {t.korrigiert && <Badge variant="secondary">korrigiert</Badge>}
                      </div>
                    </td>
                  </tr>
                ))}
                {gewaehlt.liste.tage.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-muted-foreground p-6 text-center">
                      Keine Buchungen in diesem Monat.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="text-muted-foreground text-sm">
            Korrekturen in der{" "}
            <Link href={`/zeiten?ma=${gewaehlt.id}`} className="underline">
              Wochenansicht
            </Link>{" "}
            (mit Grund, wird protokolliert).
          </p>
        </section>
      )}
    </div>
  );
}
