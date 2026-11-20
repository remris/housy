import type { Metadata } from "next";
import Link from "next/link";
import { Seitenkopf } from "@/components/seitenkopf";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  WOCHENTAGE_KURZ,
  formatDatum,
  heuteIso,
  kalenderwoche,
  plusTage,
  wochenbeginn,
} from "@/domain/datum";
import { zuDauer } from "@/domain/planung";
import {
  type Buchung,
  type Zeithinweis,
  tagBerlin,
  uhrzeitBerlin,
  werteTagAus,
} from "@/domain/zeiterfassung";
import { bueroKontext } from "@/lib/auth";
import { buchungsartText } from "@/lib/schemas/rueckmeldung";
import { mitgliedName } from "@/lib/touren";
import { cn } from "@/lib/utils";
import { BuchungAendern, Nachtragen } from "./zeit-teile";

export const metadata: Metadata = { title: "Zeiten" };

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const HINWEIS: Record<Zeithinweis, string> = {
  checkout_fehlt: "Check-out fehlt",
  checkin_fehlt: "Check-in fehlt",
  pause_offen: "Pause nicht beendet",
  pause_ende_ohne_beginn: "Pausenende ohne Beginn",
  pause_zu_kurz: "Pause zu kurz (§ 4 ArbZG)",
  ueber_10_stunden: "über 10 Stunden (§ 3 ArbZG)",
};

export default async function ZeitenSeite({
  searchParams,
}: {
  searchParams: Promise<{ woche?: string; ma?: string }>;
}) {
  const { woche, ma } = await searchParams;
  const k = await bueroKontext();
  const montag = wochenbeginn(woche && ISO.test(woche) ? woche : heuteIso());
  const sonntag = plusTage(montag, 6);
  const tage = Array.from({ length: 7 }, (_, i) => plusTage(montag, i));
  const kw = kalenderwoche(montag);

  const [{ data: mitglieder }, { data: buchungen }] = await Promise.all([
    k.supabase
      .from("mitglied")
      .select("id, anzeigename")
      .eq("betrieb_id", k.betriebId)
      .eq("aktiv", true)
      .order("anzeigename"),
    k.supabase
      .from("zeitbuchung")
      .select(
        "id, mitglied_id, einsatz_id, art, zeitpunkt, quelle, storniert_am, einsatz(objekt(name)), zeitbuchung_protokoll(aktion, alt, neu, grund, geaendert_am)",
      )
      .eq("betrieb_id", k.betriebId)
      .gte("zeitpunkt", `${plusTage(montag, -1)}T12:00:00Z`)
      .lte("zeitpunkt", `${plusTage(sonntag, 1)}T12:00:00Z`)
      .order("zeitpunkt"),
  ]);
  const alle = (buchungen ?? []).filter((b) => tage.includes(tagBerlin(b.zeitpunkt)));
  const zuBuchung = (b: (typeof alle)[number]): Buchung => ({
    id: b.id,
    art: b.art,
    zeitpunkt: b.zeitpunkt,
    einsatzId: b.einsatz_id,
    storniert: !!b.storniert_am,
  });
  const auswertung = (mitglied: string, d: string) =>
    werteTagAus(
      alle.filter((b) => b.mitglied_id === mitglied && tagBerlin(b.zeitpunkt) === d).map(zuBuchung),
    );
  const link = (p: { woche?: string; ma?: string | null }) => {
    const q = new URLSearchParams({ woche: p.woche ?? montag });
    const m = p.ma === undefined ? ma : p.ma;
    if (m) q.set("ma", m);
    return `/zeiten?${q}`;
  };
  const gewaehlt = (mitglieder ?? []).find((m) => m.id === ma);

  const { data: einsaetze } = gewaehlt
    ? await k.supabase
        .from("einsatz")
        .select("id, datum, objekt(name)")
        .eq("mitarbeiter_id", gewaehlt.id)
        .gte("datum", montag)
        .lte("datum", sonntag)
        .order("datum")
    : { data: [] };

  return (
    <div className="flex flex-col gap-5">
      <Seitenkopf
        titel="Zeiten"
        beschreibung="Arbeitszeiten aus Check-in/-out und Pausen. Korrekturen nur mit Grund, alles wird protokolliert."
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<Link href={link({ woche: plusTage(montag, -7) })} />}
        >
          ← Vorwoche
        </Button>
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<Link href={link({ woche: wochenbeginn(heuteIso()) })} />}
        >
          Diese Woche
        </Button>
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<Link href={link({ woche: plusTage(montag, 7) })} />}
        >
          Nächste Woche →
        </Button>
        <h2 className="ml-2 font-medium">
          KW {kw.woche} · {formatDatum(montag)} – {formatDatum(sonntag)}
        </h2>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-2 text-left font-medium">Mitarbeiter</th>
              {tage.map((d, i) => (
                <th key={d} className="p-2 text-right font-medium">
                  {WOCHENTAGE_KURZ[i]} {formatDatum(d).slice(0, 6)}
                </th>
              ))}
              <th className="p-2 text-right font-medium">Woche</th>
            </tr>
          </thead>
          <tbody>
            {(mitglieder ?? []).map((m) => {
              const werte = tage.map((d) => auswertung(m.id, d));
              const summe = werte.reduce((s, w) => s + w.arbeitMinuten, 0);
              return (
                <tr
                  key={m.id}
                  className={cn("border-t", m.id === ma && "bg-blue-50/60 dark:bg-blue-950/30")}
                >
                  <td className="p-2">
                    <Link href={link({ ma: m.id })} className="font-medium hover:underline">
                      {mitgliedName(m)}
                    </Link>
                  </td>
                  {werte.map((w, i) => (
                    <td
                      key={tage[i]}
                      className={cn(
                        "p-2 text-right tabular-nums",
                        w.hinweise.length > 0 && "text-amber-700 dark:text-amber-400",
                      )}
                      title={w.hinweise.map((h) => HINWEIS[h]).join(", ")}
                    >
                      {w.arbeitMinuten ? zuDauer(w.arbeitMinuten) : ""}
                      {w.hinweise.length > 0 && " ⚠"}
                    </td>
                  ))}
                  <td className="p-2 text-right font-medium tabular-nums">
                    {summe ? zuDauer(summe) : "–"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {gewaehlt && (
        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-medium">{mitgliedName(gewaehlt)}</h2>
            <Nachtragen
              mitgliedId={gewaehlt.id}
              datum={tage.includes(heuteIso()) ? heuteIso() : montag}
              einsaetze={(einsaetze ?? []).map((e) => ({
                wert: e.id,
                text: `${formatDatum(e.datum).slice(0, 6)} ${e.objekt?.name ?? ""}`,
              }))}
            />
          </div>
          {tage.map((d, i) => {
            const liste = alle.filter(
              (b) => b.mitglied_id === gewaehlt.id && tagBerlin(b.zeitpunkt) === d,
            );
            if (!liste.length) return null;
            const w = auswertung(gewaehlt.id, d);
            return (
              <div key={d} className="rounded-lg border">
                <div className="bg-muted/40 flex flex-wrap items-center gap-x-4 gap-y-1 border-b px-3 py-2 text-sm">
                  <span className="font-medium">
                    {WOCHENTAGE_KURZ[i]} {formatDatum(d)}
                  </span>
                  <span>
                    {w.beginn && uhrzeitBerlin(w.beginn)}–{w.ende && uhrzeitBerlin(w.ende)}
                  </span>
                  <span>Pause {w.pauseMinuten} min</span>
                  <span className="font-medium">Arbeit {zuDauer(w.arbeitMinuten)}</span>
                  {w.hinweise.map((h) => (
                    <Badge key={h} variant="destructive">
                      {HINWEIS[h]}
                    </Badge>
                  ))}
                </div>
                <ul className="divide-y text-sm">
                  {liste.map((b) => (
                    <li key={b.id} className="flex flex-col gap-1 px-3 py-2">
                      <div
                        className={cn(
                          "flex flex-wrap items-center gap-3",
                          b.storniert_am && "text-muted-foreground line-through",
                        )}
                      >
                        <span className="w-12 font-medium tabular-nums">
                          {uhrzeitBerlin(b.zeitpunkt)}
                        </span>
                        <span className="w-28">{buchungsartText(b.art)}</span>
                        <span className="text-muted-foreground flex-1">
                          {b.einsatz?.objekt?.name ?? ""}
                          {b.quelle === "qr" && " · QR"}
                          {b.quelle === "buero" && " · vom Büro"}
                        </span>
                        {!b.storniert_am && (
                          <BuchungAendern
                            id={b.id}
                            datum={d}
                            uhrzeit={uhrzeitBerlin(b.zeitpunkt)}
                          />
                        )}
                      </div>
                      {b.zeitbuchung_protokoll.map((p, j) => (
                        <div key={j} className="text-muted-foreground pl-[3.75rem] text-xs">
                          {new Date(p.geaendert_am).toLocaleString("de-DE", {
                            timeZone: "Europe/Berlin",
                            dateStyle: "short",
                            timeStyle: "short",
                          })}{" "}
                          {p.aktion}
                          {p.alt && ` von ${uhrzeitBerlin(p.alt)}`}
                          {p.neu && ` auf ${uhrzeitBerlin(p.neu)}`}: {p.grund}
                        </div>
                      ))}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
          {!alle.some((b) => b.mitglied_id === gewaehlt.id) && (
            <div className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
              Keine Buchungen in dieser Woche.
            </div>
          )}
        </section>
      )}
    </div>
  );
}
