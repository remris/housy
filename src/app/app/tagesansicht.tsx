"use client";

import {
  AlertTriangleIcon,
  ClockIcon,
  MapPinIcon,
  NavigationIcon,
  PackageIcon,
  WrenchIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { type AppEinsatz, navigationsLink, phase } from "@/domain/app";
import { uhrzeitBerlin, werteTagAus } from "@/domain/zeiterfassung";
import { tourKarteUrl } from "@/lib/karten/kartenbild";
import { cn } from "@/lib/utils";
import { useAppKontext } from "./kontext";
import { dauer, istApple, jetztIso, neueId } from "./werkzeuge";

export function Tagesansicht({ istHeute }: { istHeute: boolean }) {
  const { t, daten } = useAppKontext();
  const einsaetze = daten.einsaetze;
  const karte = tourKarteUrl(
    null,
    einsaetze.map((e) =>
      e.objekt.lat !== null && e.objekt.lng !== null
        ? { lat: e.objekt.lat, lng: e.objekt.lng }
        : null,
    ),
    { breite: 400, hoehe: 220 },
  );

  return (
    <>
      {istHeute && <Zeitkarte />}
      {einsaetze.length === 0 ? (
        <p className="text-muted-foreground bg-background rounded-lg border p-6 text-center text-sm">
          {t("keineEinsaetze")}
        </p>
      ) : (
        <ol className="flex flex-col gap-3">
          {einsaetze.map((e, i) => (
            <EinsatzKarte key={e.id} e={e} nr={i + 1} />
          ))}
        </ol>
      )}
      {karte && einsaetze.length > 0 && (
        // eslint-disable-next-line @next/next/no-img-element -- externes Kartenbild
        <img
          src={karte}
          alt={t("karte")}
          className="w-full rounded-lg border"
          width={400}
          height={220}
        />
      )}
      <Packliste />
      <Werkzeuge />
    </>
  );
}

function Zeitkarte() {
  const { t, daten, ausfuehren } = useAppKontext();
  const [jetzt, setJetzt] = useState(() => new Date());
  useEffect(() => {
    const takt = window.setInterval(() => setJetzt(new Date()), 30_000);
    return () => window.clearInterval(takt);
  }, []);
  const a = werteTagAus(daten.buchungen, jetzt);
  const inPause = a.laufend?.art === "pause";
  const pauseSeit = inPause
    ? [...daten.buchungen].reverse().find((b) => b.art === "pause_beginn" && !b.storniert)
    : undefined;

  return (
    <section className="bg-background flex items-center gap-3 rounded-lg border p-3" data-zeitkarte>
      <ClockIcon className="text-muted-foreground size-5 shrink-0" />
      <div className="flex-1">
        <div className="text-muted-foreground text-xs">{t("arbeitszeit")}</div>
        <div className="text-lg font-semibold tabular-nums">{dauer(a.arbeitMinuten)}</div>
        {inPause && pauseSeit && (
          <div className="text-sm text-amber-700 dark:text-amber-400">
            {t("inPause", { zeit: uhrzeitBerlin(pauseSeit.zeitpunkt) })}
          </div>
        )}
        {a.hinweise.includes("pause_zu_kurz") && !inPause && (
          <div className="text-xs text-amber-700 dark:text-amber-400">{t("hinweisPause")}</div>
        )}
        {a.hinweise.includes("ueber_10_stunden") && (
          <div className="text-xs text-red-600">{t("hinweis10h")}</div>
        )}
      </div>
      {a.beginn && (
        <Button
          variant={inPause ? "default" : "outline"}
          onClick={() =>
            ausfuehren({
              typ: "zeit",
              id: neueId(),
              art: inPause ? "pause_ende" : "pause_beginn",
              zeitpunkt: jetztIso(),
              einsatzId: null,
              quelle: "app",
            })
          }
        >
          {inPause ? t("pauseBeenden") : t("pauseBeginnen")}
        </Button>
      )}
    </section>
  );
}

function EinsatzKarte({ e, nr }: { e: AppEinsatz; nr: number }) {
  const { t, oeffne } = useAppKontext();
  const p = phase(e);
  const [apple, setApple] = useState(false);
  useEffect(() => setApple(istApple()), []);
  return (
    <li
      className={cn(
        "bg-background rounded-lg border",
        p === "laeuft" && "border-blue-500 ring-1 ring-blue-500",
        p === "fertig" && "opacity-60",
      )}
      data-einsatz={e.id}
    >
      <button className="flex w-full items-start gap-3 p-3 text-left" onClick={() => oeffne(e.id)}>
        <span
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
            p === "fertig" ? "bg-emerald-600 text-white" : "bg-foreground text-background",
          )}
        >
          {p === "fertig" ? "✓" : nr}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className="truncate font-semibold">{e.objekt.name}</span>
            {e.geplanterBeginn && (
              <span className="text-muted-foreground shrink-0 text-sm tabular-nums">
                {e.geplanterBeginn}
              </span>
            )}
          </span>
          <span className="text-muted-foreground block text-sm">{e.vorlage}</span>
          <span className="text-muted-foreground flex items-center gap-1 text-sm">
            <MapPinIcon className="size-3.5" />
            {[e.objekt.strasse, e.objekt.ort].filter(Boolean).join(", ")}
          </span>
          {e.warnungen.length > 0 && (
            <span className="mt-1 flex items-center gap-1 text-sm font-medium text-red-700 dark:text-red-300">
              <AlertTriangleIcon className="size-3.5" />
              {t("pruefungUeberfaellig", { name: e.warnungen.join(", ") })}
            </span>
          )}
          {e.zeitfensterVon && e.zeitfensterBis && (
            <span className="block text-sm">
              {t("zeitfenster", { von: e.zeitfensterVon, bis: e.zeitfensterBis })}
            </span>
          )}
          <span
            className={cn(
              "mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium",
              p === "offen" && "bg-muted",
              p === "laeuft" && "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
              p === "fertig" &&
                "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
            )}
          >
            {p === "offen" ? t("phaseOffen") : p === "laeuft" ? t("phaseLaeuft") : t("phaseFertig")}
          </span>
        </span>
      </button>
      {p !== "fertig" && (
        <a
          href={navigationsLink(e.objekt, apple)}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-center gap-2 border-t py-2 text-sm font-medium text-blue-700 dark:text-blue-300"
        >
          <NavigationIcon className="size-4" />
          {t("navigation")}
        </a>
      )}
    </li>
  );
}

function Packliste() {
  const { t, daten, ausfuehren } = useAppKontext();
  const offen = daten.packliste.some((p) => (p.einladenGebinde ?? 0) > 0);
  return (
    <details className="bg-background rounded-lg border p-3" open={offen} data-packliste>
      <summary className="flex cursor-pointer items-center gap-2 font-medium">
        <PackageIcon className="size-4" />
        {t("packliste")}
        {daten.fahrzeug && (
          <span className="text-muted-foreground text-sm font-normal">· {daten.fahrzeug.name}</span>
        )}
      </summary>
      {daten.packliste.length === 0 ? (
        <p className="text-muted-foreground mt-2 text-sm">{t("packlisteLeer")}</p>
      ) : (
        <ul className="mt-2 flex flex-col divide-y text-sm">
          {daten.packliste.map((p) => (
            <li key={p.artikelId} className="flex flex-col gap-1 py-2">
              <span className="flex justify-between gap-2">
                <span className="font-medium">{p.name}</span>
                <span className="tabular-nums">
                  {p.art && p.art !== "verbrauch"
                    ? t("mitnehmen")
                    : `${p.menge.toLocaleString("de-DE")} ${p.einheit}`}
                </span>
              </span>
              {p.fahrzeugBestand !== undefined && p.fahrzeugBestand !== null && (
                <span className="text-muted-foreground flex items-center justify-between gap-2">
                  <span>
                    {t("imFahrzeug", {
                      menge: `${p.fahrzeugBestand.toLocaleString("de-DE")} ${p.einheit}`,
                    })}
                  </span>
                  {(p.einladenGebinde ?? 0) > 0 && daten.fahrzeug ? (
                    <Button
                      size="sm"
                      onClick={() =>
                        ausfuehren({
                          typ: "geladen",
                          id: neueId(),
                          artikelId: p.artikelId,
                          menge: p.einladenMenge ?? 0,
                          lagerortId: daten.fahrzeug!.lagerortId,
                        })
                      }
                    >
                      {t("einladen", {
                        n: p.einladenGebinde ?? 0,
                        gebinde: p.gebindeName ?? p.einheit,
                      })}
                    </Button>
                  ) : (
                    <span className="text-emerald-700 dark:text-emerald-300">{t("reicht")}</span>
                  )}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}

function Werkzeuge() {
  const { t, daten, ausfuehren } = useAppKontext();
  const liste = daten.werkzeuge ?? [];
  if (liste.length === 0) return null;
  const achtung = liste.some((w) => w.faelligHeute || w.pruefung === "ueberfaellig");
  return (
    <details className="bg-background rounded-lg border p-3" open={achtung} data-werkzeuge>
      <summary className="flex cursor-pointer items-center gap-2 font-medium">
        <WrenchIcon className="size-4" />
        {t("werkzeuge")}
      </summary>
      <ul className="mt-2 flex flex-col divide-y text-sm">
        {liste.map((w) => (
          <li key={w.id} className="flex flex-col gap-1 py-2">
            <span className="flex justify-between gap-2">
              <span className="font-medium">{w.name}</span>
              {w.stand !== null && w.lebensdauer !== null && (
                <span className="text-muted-foreground tabular-nums">
                  {t("zaehler", {
                    stand: Math.round(w.stand).toLocaleString("de-DE"),
                    lebensdauer: w.lebensdauer.toLocaleString("de-DE"),
                  })}
                </span>
              )}
            </span>
            {w.pruefung !== "ok" && w.pruefungAm && (
              <span
                className={cn(
                  "text-sm",
                  w.pruefung === "ueberfaellig"
                    ? "font-medium text-red-700 dark:text-red-300"
                    : "text-amber-700 dark:text-amber-300",
                )}
              >
                {w.pruefung === "ueberfaellig"
                  ? t("pruefungUeberfaellig", { name: w.pruefungAm.split("-").reverse().join(".") })
                  : t("pruefungBis", { datum: w.pruefungAm.split("-").reverse().join(".") })}
              </span>
            )}
            {w.stand !== null && (
              <span className="flex items-center justify-between gap-2">
                <span
                  className={cn(
                    "text-sm",
                    w.faelligHeute
                      ? "font-medium text-amber-700 dark:text-amber-300"
                      : "text-muted-foreground",
                  )}
                >
                  {w.faelligHeute
                    ? t("ersatzMitnehmen")
                    : w.stufe === "hinweis"
                      ? t("baldWechseln")
                      : ""}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    ausfuehren({
                      typ: "gewechselt",
                      id: neueId(),
                      werkzeugId: w.id,
                      am: jetztIso(),
                      stand: w.stand ?? 0,
                      grund: "verschleiss",
                      lagerortId: daten.fahrzeug?.lagerortId ?? null,
                    })
                  }
                >
                  {t("gewechselt")}
                </Button>
              </span>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}
