"use client";

import { CloudOffIcon, CloudUploadIcon, CheckCircle2Icon, RefreshCwIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type AppAktion, type Tagesdaten, mitAusstehenden } from "@/domain/app";
import { tagBerlin } from "@/domain/zeiterfassung";
import { ladeTagesdaten } from "@/lib/app/laden";
import { type FehlerEintrag, appSpeicher, tagSchluessel } from "@/lib/app/speicher";
import { einreihen, sofortVersuchen, synchronisiere } from "@/lib/app/sync";
import { uebersetzer } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { EinsatzAnsicht } from "./einsatz-ansicht";
import { AppKontext } from "./kontext";
import { Kopf } from "./kopf";
import { Tagesansicht } from "./tagesansicht";

export type AppStart = {
  betriebId: string;
  betriebName: string;
  mitgliedId: string;
  name: string;
  sprache: string;
  buero: boolean;
  heute: string;
  morgen: string;
  initial: Tagesdaten | null;
};

/** Gehört eine ausstehende Aktion zu diesem Tag? (Pausen hängen am Zeitpunkt) */
function gehoertZuTag(a: AppAktion, d: Tagesdaten): boolean {
  if (a.typ === "zeit") return tagBerlin(a.zeitpunkt) === d.datum;
  return d.einsaetze.some((e) => e.id === a.einsatzId);
}

function einsatzAusHash(): string | null {
  const m = /einsatz=([0-9a-f-]{36})/.exec(window.location.hash);
  return m?.[1] ?? null;
}

export function MitarbeiterApp({ start }: { start: AppStart }) {
  const t = useMemo(() => uebersetzer(start.sprache), [start.sprache]);
  const supabase = useMemo(() => createClient(), []);
  const ctx = useMemo(
    () => ({ betriebId: start.betriebId, mitgliedId: start.mitgliedId }),
    [start.betriebId, start.mitgliedId],
  );

  const [datum, setDatum] = useState(start.heute);
  const [server, setServer] = useState<Tagesdaten | null>(
    start.initial?.datum === start.heute ? start.initial : null,
  );
  const [ausstehend, setAusstehend] = useState<AppAktion[]>([]);
  const [fehler, setFehler] = useState<FehlerEintrag[]>([]);
  const [online, setOnline] = useState(true);
  const [laedt, setLaedt] = useState(false);
  const [einsatzId, setEinsatzId] = useState<string | null>(null);
  const datumRef = useRef(datum);
  datumRef.current = datum;

  const ausDb = useCallback(async () => {
    const db = appSpeicher();
    const [schlange, f] = await Promise.all([
      db.warteschlange.orderBy("nr").toArray(),
      db.fehler.toArray(),
    ]);
    setAusstehend(schlange.map((s) => s.aktion));
    setFehler(f);
  }, []);

  /** Serverstand laden und lokal ablegen; ohne Netz den gespeicherten Stand nehmen. */
  const neuLaden = useCallback(
    async (fuer: string) => {
      const db = appSpeicher();
      const schluessel = tagSchluessel(ctx.mitgliedId, fuer);
      const lokal = await db.tage.get(schluessel);
      if (lokal && datumRef.current === fuer) setServer(lokal.daten);
      if (!navigator.onLine) return;
      setLaedt(true);
      try {
        const frisch = await ladeTagesdaten(supabase, ctx, fuer);
        await db.tage.put({ schluessel, daten: frisch });
        if (datumRef.current === fuer) setServer(frisch);
      } catch {
        // Netz weg oder Sitzung abgelaufen: lokaler Stand bleibt
      } finally {
        setLaedt(false);
      }
    },
    [ctx, supabase],
  );

  const sync = useCallback(async () => {
    if (!navigator.onLine) return;
    const r = await synchronisiere(supabase, ctx.betriebId);
    await ausDb();
    if (r.uebertragen > 0 && r.offen === 0) await neuLaden(datumRef.current);
  }, [supabase, ctx.betriebId, ausDb, neuLaden]);

  // Start: Service Worker, gespeicherte Daten, Netzstatus, regelmäßiger Abgleich
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    setOnline(navigator.onLine);
    setEinsatzId(einsatzAusHash());
    void (async () => {
      if (start.initial) {
        await appSpeicher().tage.put({
          schluessel: tagSchluessel(ctx.mitgliedId, start.initial.datum),
          daten: start.initial,
        });
      }
      await ausDb();
      await sync();
    })();
    const an = () => {
      setOnline(true);
      void sofortVersuchen().then(sync);
    };
    const aus = () => setOnline(false);
    const zurueck = () => setEinsatzId(einsatzAusHash());
    window.addEventListener("online", an);
    window.addEventListener("offline", aus);
    window.addEventListener("hashchange", zurueck);
    const takt = window.setInterval(() => void sync(), 30_000);
    return () => {
      window.removeEventListener("online", an);
      window.removeEventListener("offline", aus);
      window.removeEventListener("hashchange", zurueck);
      window.clearInterval(takt);
    };
    // nur beim Start
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tageswechsel (Heute/Morgen)
  useEffect(() => {
    if (server?.datum !== datum) setServer(null);
    void neuLaden(datum);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datum]);

  const daten = useMemo(
    () =>
      server
        ? mitAusstehenden(
            server,
            ausstehend.filter((a) => gehoertZuTag(a, server)),
          )
        : null,
    [server, ausstehend],
  );

  const ausfuehren = useCallback(
    (aktion: AppAktion, foto?: Blob) => {
      setAusstehend((liste) => [...liste, aktion]);
      void einreihen(aktion, foto).then(sync);
    },
    [sync],
  );

  const oeffne = useCallback((id: string | null) => {
    if (id) {
      window.location.hash = `einsatz=${id}`;
    } else if (window.location.hash) {
      history.back();
    }
    setEinsatzId(id);
    window.scrollTo(0, 0);
  }, []);

  const fehlerVerwerfen = async (nr: number) => {
    await appSpeicher().fehler.delete(nr);
    await ausDb();
  };

  const einsatz = daten?.einsaetze.find((e) => e.id === einsatzId) ?? null;

  return (
    <div className="bg-muted/30 min-h-dvh">
      <Kopf
        t={t}
        name={start.name}
        betriebName={start.betriebName}
        sprache={start.sprache}
        buero={start.buero}
      />
      <div className="mx-auto flex max-w-md flex-col gap-3 px-3 pb-24">
        <Verbindung
          t={t}
          online={online}
          wartend={ausstehend.length}
          laedt={laedt}
          stand={daten?.geladenAm ?? null}
          onSync={() => void sofortVersuchen().then(sync)}
        />
        {fehler.map((f) => (
          <div
            key={f.nr}
            className="flex items-center justify-between gap-2 rounded-lg border border-red-300 bg-red-50 p-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200"
          >
            <span>{t("nichtUebertragen", { fehler: f.fehler })}</span>
            <button className="underline" onClick={() => void fehlerVerwerfen(f.nr!)}>
              {t("verwerfen")}
            </button>
          </div>
        ))}

        {!daten ? (
          <div className="text-muted-foreground py-16 text-center text-sm">…</div>
        ) : (
          <AppKontext.Provider value={{ t, daten, betriebId: start.betriebId, ausfuehren, oeffne }}>
            {einsatz ? (
              <EinsatzAnsicht einsatz={einsatz} />
            ) : (
              <>
                <div className="bg-background grid grid-cols-2 rounded-lg border p-1 text-sm">
                  {[
                    { wert: start.heute, text: t("heute") },
                    { wert: start.morgen, text: t("morgen") },
                  ].map((x) => (
                    <button
                      key={x.wert}
                      onClick={() => setDatum(x.wert)}
                      className={cn(
                        "rounded-md py-2 font-medium",
                        datum === x.wert
                          ? "bg-foreground text-background"
                          : "text-muted-foreground",
                      )}
                    >
                      {x.text}
                    </button>
                  ))}
                </div>
                <Tagesansicht istHeute={datum === start.heute} />
              </>
            )}
          </AppKontext.Provider>
        )}
      </div>
    </div>
  );
}

function Verbindung({
  t,
  online,
  wartend,
  laedt,
  stand,
  onSync,
}: {
  t: ReturnType<typeof uebersetzer>;
  online: boolean;
  wartend: number;
  laedt: boolean;
  stand: string | null;
  onSync: () => void;
}) {
  const zeit = stand
    ? new Date(stand).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })
    : "";
  return (
    <div
      className={cn(
        "mt-3 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm",
        !online
          ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
          : "bg-background",
      )}
      role="status"
      data-verbindung={online ? (wartend ? "wartend" : "synchron") : "offline"}
    >
      {!online ? (
        <CloudOffIcon className="size-4 shrink-0" />
      ) : wartend ? (
        <CloudUploadIcon className="size-4 shrink-0" />
      ) : (
        <CheckCircle2Icon className="size-4 shrink-0 text-emerald-600" />
      )}
      <span className="flex-1">
        {!online ? t("offline") : wartend ? t("wartend", { n: wartend }) : t("synchron")}
        {wartend > 0 && !online && ` · ${t("wartend", { n: wartend })}`}
      </span>
      {zeit && <span className="text-muted-foreground text-xs">{t("stand", { zeit })}</span>}
      {online && (
        <button
          onClick={onSync}
          aria-label={t("synchronisieren")}
          className="text-muted-foreground p-1"
          disabled={laedt}
        >
          <RefreshCwIcon className={cn("size-4", laedt && "animate-spin")} />
        </button>
      )}
    </div>
  );
}
