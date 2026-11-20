import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WOCHENTAGE_KURZ, formatDatum, plusTage, wochenbeginn, wochentag } from "@/domain/datum";
import { abwesenheitAm, berechneTour, zuDauer } from "@/domain/planung";
import { bueroKontext } from "@/lib/auth";
import { tourKarteUrl } from "@/lib/karten/mapbox";
import { abwesenheitText } from "@/lib/schemas/planung";
import { koordinate, ladeTourEinsaetze, mitgliedName } from "@/lib/touren";
import { TourEinstellungen, TourKnoepfe, Verschieben } from "./tour-teile";

export const metadata: Metadata = { title: "Tagestour" };

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const hhmm = (t: string | null) => (t ? t.slice(0, 5) : null);

export default async function TourSeite({
  params,
}: {
  params: Promise<{ mitarbeiter: string; datum: string }>;
}) {
  const { mitarbeiter, datum } = await params;
  if (!ISO.test(datum)) notFound();
  const k = await bueroKontext();
  const [
    { data: m },
    { data: betrieb },
    { data: tour },
    { data: fahrzeuge },
    { data: abw },
    einsaetze,
  ] = await Promise.all([
    k.supabase
      .from("mitglied")
      .select("id, anzeigename")
      .eq("id", mitarbeiter)
      .eq("betrieb_id", k.betriebId)
      .maybeSingle(),
    k.supabase
      .from("betrieb")
      .select("breitengrad, laengengrad, tour_start, strasse, plz, ort")
      .eq("id", k.betriebId)
      .single(),
    k.supabase
      .from("tour")
      .select("startzeit, fahrzeug_id, rueckfahrt_minuten, fahrzeit_quelle, berechnet_am")
      .eq("mitarbeiter_id", mitarbeiter)
      .eq("datum", datum)
      .maybeSingle(),
    k.supabase
      .from("fahrzeug")
      .select("id, name, kennzeichen")
      .eq("betrieb_id", k.betriebId)
      .eq("aktiv", true)
      .order("name"),
    k.supabase
      .from("abwesenheit")
      .select("art, von, bis")
      .eq("mitglied_id", mitarbeiter)
      .lte("von", datum)
      .gte("bis", datum),
    ladeTourEinsaetze(k.supabase, k.betriebId, mitarbeiter, datum),
  ]);
  if (!m) notFound();

  const name = mitgliedName(m);
  const start = hhmm(tour?.startzeit ?? betrieb?.tour_start ?? "07:00")!;
  const berechnet = !!tour?.berechnet_am && einsaetze.every((e) => e.fahrzeit_minuten !== null);
  const rechnung = berechnet
    ? berechneTour(
        start,
        einsaetze.map((e) => ({
          id: e.id,
          sollzeitMinuten: e.sollzeit_minuten,
          zeitfensterVon: hhmm(e.zeitfenster_von),
          zeitfensterBis: hhmm(e.zeitfenster_bis),
        })),
        [...einsaetze.map((e) => e.fahrzeit_minuten ?? 0), tour?.rueckfahrt_minuten ?? 0],
      )
    : null;
  const abwesend = abwesenheitAm(
    { id: m.id, name, arbeitszeiten: [], abwesenheiten: abw ?? [] },
    datum,
  );
  const startKoord = koordinate(betrieb ?? null);
  const karte = tourKarteUrl(
    startKoord,
    einsaetze.map((e) => koordinate(e.objekt)),
  );
  const ohneKoordinaten = einsaetze.filter((e) => !koordinate(e.objekt));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<Link href={`/planung?woche=${wochenbeginn(datum)}`} />}
        >
          ← Wochenplan
        </Button>
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<Link href={`/planung/tour/${mitarbeiter}/${plusTage(datum, -1)}`} />}
        >
          Vortag
        </Button>
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<Link href={`/planung/tour/${mitarbeiter}/${plusTage(datum, 1)}`} />}
        >
          Folgetag
        </Button>
        <h2 className="ml-2 text-lg font-medium">
          {name} · {WOCHENTAGE_KURZ[wochentag(datum) - 1]} {formatDatum(datum)}
        </h2>
        {abwesend && <Badge variant="destructive">{abwesenheitText(abwesend.art)}</Badge>}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <TourKnoepfe mitarbeiterId={mitarbeiter} datum={datum} leer={!einsaetze.length} />
            {rechnung && (
              <span className="text-muted-foreground text-sm">
                Start {start} · Rückkehr {rechnung.rueckkehr} · Fahrt{" "}
                {zuDauer(rechnung.fahrzeitGesamt)} · Arbeit {zuDauer(rechnung.arbeitszeitGesamt)}
                {tour?.fahrzeit_quelle === "schaetzung" && " · Fahrzeiten geschätzt"}
              </span>
            )}
          </div>

          {!einsaetze.length ? (
            <div className="text-muted-foreground rounded-lg border border-dashed p-10 text-center text-sm">
              Keine Einsätze an diesem Tag. Im Wochenplan Einsätze hierher ziehen.
            </div>
          ) : (
            <ol className="flex flex-col gap-2">
              <li className="text-muted-foreground flex items-center gap-3 px-3 text-sm">
                <span className="w-12 tabular-nums">{start}</span>
                Abfahrt Firmensitz
                {!startKoord && (
                  <span className="text-amber-700 dark:text-amber-400">
                    (Adresse ohne Koordinaten – Firmendaten speichern)
                  </span>
                )}
              </li>
              {einsaetze.map((e, i) => {
                const z = rechnung?.stopps[i];
                return (
                  <li
                    key={e.id}
                    className={
                      "rounded-lg border p-3 " +
                      (z?.warnung ? "border-red-400 dark:border-red-700" : "")
                    }
                    data-einsatz={e.id}
                  >
                    {z && (
                      <div className="text-muted-foreground mb-1 text-xs">
                        🚗 {z.fahrzeitMinuten} min · Ankunft {z.ankunft}
                        {z.warteMinuten > 0 && ` · ${z.warteMinuten} min warten`}
                      </div>
                    )}
                    <div className="flex flex-wrap items-start gap-3">
                      <span className="bg-foreground text-background flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium">
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-2">
                          {z && (
                            <span className="font-medium tabular-nums">
                              {z.beginn}–{z.ende}
                            </span>
                          )}
                          <Link
                            href={`/objekte/${e.objekt?.id}`}
                            className="font-medium hover:underline"
                          >
                            {e.objekt?.name}
                          </Link>
                          <span className="text-muted-foreground text-sm">
                            {e.auftragsvorlage?.name}
                          </span>
                        </div>
                        <div className="text-muted-foreground text-sm">
                          {[
                            e.objekt?.strasse,
                            [e.objekt?.plz, e.objekt?.ort].filter(Boolean).join(" "),
                          ]
                            .filter(Boolean)
                            .join(", ")}
                        </div>
                        <div className="text-muted-foreground text-sm">
                          Sollzeit {zuDauer(e.sollzeit_minuten)}
                          {e.zeitfenster_von &&
                            e.zeitfenster_bis &&
                            ` · Fenster ${hhmm(e.zeitfenster_von)}–${hhmm(e.zeitfenster_bis)}`}
                          {e.status !== "zugewiesen" && ` · ${e.status}`}
                        </div>
                        {z?.warnung && (
                          <div className="text-sm text-red-600 dark:text-red-400">
                            ⚠{" "}
                            {z.warnung === "fenster_verpasst"
                              ? "Reinigungsfenster wird verpasst"
                              : "Reinigung endet nach dem Reinigungsfenster"}
                          </div>
                        )}
                        {e.objekt?.zugangshinweise && (
                          <div className="mt-1 text-sm">🔑 {e.objekt.zugangshinweise}</div>
                        )}
                      </div>
                      <Verschieben
                        mitarbeiterId={mitarbeiter}
                        datum={datum}
                        ids={einsaetze.map((x) => x.id)}
                        index={i}
                      />
                    </div>
                  </li>
                );
              })}
              {rechnung && (
                <li className="text-muted-foreground flex items-center gap-3 px-3 text-sm">
                  <span className="w-12 tabular-nums">{rechnung.rueckkehr}</span>
                  Rückkehr Firmensitz ({rechnung.rueckfahrtMinuten} min Fahrt)
                </li>
              )}
            </ol>
          )}
          {ohneKoordinaten.length > 0 && (
            <p className="text-sm text-amber-700 dark:text-amber-400">
              {ohneKoordinaten.length} Objekt(e) ohne Koordinaten – Fahrzeit mit 15 min angenommen.
              Unter Planung → Fahrzeuge &amp; Tourstart lassen sich fehlende Koordinaten ergänzen.
            </p>
          )}
        </section>

        <aside className="flex flex-col gap-4">
          {karte ? (
            // eslint-disable-next-line @next/next/no-img-element -- externes Kartenbild von Mapbox
            <img
              src={karte}
              alt={`Karte der Tour von ${name}`}
              className="w-full rounded-lg border"
              width={640}
              height={360}
            />
          ) : (
            <div className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
              Kartenbild erscheint, sobald NEXT_PUBLIC_MAPBOX_TOKEN gesetzt ist und die Objekte
              Koordinaten haben.
            </div>
          )}
          <TourEinstellungen
            mitarbeiterId={mitarbeiter}
            datum={datum}
            startzeit={start}
            fahrzeugId={tour?.fahrzeug_id ?? null}
            fahrzeuge={(fahrzeuge ?? []).map((f) => ({
              wert: f.id,
              text: f.kennzeichen ? `${f.name} (${f.kennzeichen})` : f.name,
            }))}
          />
        </aside>
      </div>
    </div>
  );
}
