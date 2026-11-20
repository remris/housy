import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  WOCHENTAGE_KURZ,
  formatDatum,
  heuteIso,
  kalenderwoche,
  plusTage,
  wochenbeginn,
} from "@/domain/datum";
import { type Konflikt, abwesenheitAm, auslastung } from "@/domain/planung";
import { bueroKontext } from "@/lib/auth";
import { abwesenheitText } from "@/lib/schemas/planung";
import { ladeWoche } from "@/lib/touren";
import { type PlanKarte, type PlanZeile, Wochenplan } from "./wochenplan";

export const metadata: Metadata = { title: "Wochenplan" };

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export default async function WochenplanSeite({
  searchParams,
}: {
  searchParams: Promise<{ woche?: string }>;
}) {
  const { woche } = await searchParams;
  const heute = heuteIso();
  const montag = wochenbeginn(woche && ISO.test(woche) ? woche : heute);
  const k = await bueroKontext();
  const w = await ladeWoche(k.supabase, k.betriebId, montag);
  const tage = Array.from({ length: 7 }, (_, i) => plusTage(montag, i));
  const kw = kalenderwoche(montag);

  const konfliktIds = new Map<string, Konflikt[]>();
  for (const kf of w.konflikte) {
    for (const id of kf.einsatzIds) konfliktIds.set(id, [...(konfliktIds.get(id) ?? []), kf]);
  }

  const karten: PlanKarte[] = w.einsaetze.map((e) => ({
    id: e.id,
    datum: e.datum,
    mitarbeiterId: e.mitarbeiter_id,
    objekt: e.objekt?.name ?? "Objekt",
    ort: e.objekt?.ort ?? null,
    vorlage: e.auftragsvorlage?.name ?? "",
    zeitfenster:
      e.zeitfenster_von && e.zeitfenster_bis
        ? `${e.zeitfenster_von.slice(0, 5)}–${e.zeitfenster_bis.slice(0, 5)}`
        : null,
    beginn: e.geplanter_beginn?.slice(0, 5) ?? null,
    sollzeit: e.sollzeit_minuten,
    status: e.status,
    verschoben: !!e.serien_datum && e.serien_datum !== e.datum,
    konflikte: (konfliktIds.get(e.id) ?? []).map((x) => x.text),
  }));

  const zeilen: PlanZeile[] = w.mitarbeiter.map((m) => ({
    id: m.id,
    name: m.name,
    tage: tage.map((d) => {
      const a = auslastung(w.planEinsaetze, m, d);
      const abw = abwesenheitAm(m, d);
      const tour = w.touren.find((t) => t.mitarbeiter_id === m.id && t.datum === d);
      return {
        datum: d,
        bedarf: a.bedarf,
        verfuegbar: a.verfuegbar,
        abwesend: abw ? abwesenheitText(abw.art) : null,
        rueckkehr: tour?.rueckkehr?.slice(0, 5) ?? null,
      };
    }),
  }));

  const offen = karten.filter((x) => !x.mitarbeiterId).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<Link href={`/planung?woche=${plusTage(montag, -7)}`} />}
        >
          ← Vorwoche
        </Button>
        <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/planung" />}>
          Heute
        </Button>
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<Link href={`/planung?woche=${plusTage(montag, 7)}`} />}
        >
          Nächste Woche →
        </Button>
        <h2 className="ml-2 font-medium">
          KW {kw.woche} · {formatDatum(montag)} – {formatDatum(w.sonntag)}
        </h2>
        <span className="text-muted-foreground ml-auto text-sm">
          {karten.length} Einsätze · {offen} offen · {w.konflikte.length} Konflikte
        </span>
      </div>

      {w.mitarbeiter.length === 0 ? (
        <div className="text-muted-foreground rounded-lg border border-dashed p-10 text-center text-sm">
          Noch keine aktiven Mitarbeiter. Unter Einstellungen → Team einladen.
        </div>
      ) : (
        <Wochenplan
          tage={tage.map((d, i) => ({
            datum: d,
            text: `${WOCHENTAGE_KURZ[i]} ${formatDatum(d).slice(0, 6)}`,
            heute: d === heute,
          }))}
          zeilen={zeilen}
          karten={karten}
        />
      )}

      {w.konflikte.length > 0 && (
        <section className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/40">
          <h2 className="mb-2 font-medium">Konflikte</h2>
          <ul className="flex flex-col gap-1 text-sm">
            {w.konflikte.map((kf, i) => (
              <li key={i}>
                <span className="text-muted-foreground tabular-nums">
                  {formatDatum(kf.datum).slice(0, 6)}
                </span>{" "}
                {kf.mitarbeiterId ? (
                  <Link
                    className="hover:underline"
                    href={`/planung/tour/${kf.mitarbeiterId}/${kf.datum}`}
                  >
                    {kf.text}
                  </Link>
                ) : (
                  kf.text
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="text-muted-foreground text-xs">
        Einsätze per Ziehen auf einen anderen Mitarbeiter oder Tag legen. Die Tour des Tages wird
        danach automatisch neu berechnet. Klick auf den Tag eines Mitarbeiters öffnet die Tagestour.
      </p>
    </div>
  );
}
