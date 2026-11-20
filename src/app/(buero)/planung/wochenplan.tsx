"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { zuDauer } from "@/domain/planung";
import { einsatzZuweisen } from "@/lib/aktionen/planung";
import { cn } from "@/lib/utils";

export type PlanKarte = {
  id: string;
  datum: string;
  mitarbeiterId: string | null;
  objekt: string;
  ort: string | null;
  vorlage: string;
  zeitfenster: string | null;
  beginn: string | null;
  sollzeit: number;
  status: string;
  verschoben: boolean;
  konflikte: string[];
};

export type PlanZeile = {
  id: string;
  name: string;
  tage: {
    datum: string;
    bedarf: number;
    verfuegbar: number | null;
    abwesend: string | null;
    rueckkehr: string | null;
  }[];
};

type Ziel = { mitarbeiterId: string | null; datum: string };
const zielKey = (z: Ziel) => `${z.mitarbeiterId ?? "offen"}|${z.datum}`;
const BEWEGLICH = new Set(["geplant", "zugewiesen"]);

export function Wochenplan({
  tage,
  zeilen,
  karten,
}: {
  tage: { datum: string; text: string; heute: boolean }[];
  zeilen: PlanZeile[];
  karten: PlanKarte[];
}) {
  const [optimistisch, verschiebe] = useOptimistic(karten, (stand, z: { id: string } & Ziel) =>
    stand.map((k) =>
      k.id === z.id ? { ...k, mitarbeiterId: z.mitarbeiterId, datum: z.datum, beginn: null } : k,
    ),
  );
  const [, starte] = useTransition();
  const [ueber, setUeber] = useState<string | null>(null);

  function ablegen(id: string, ziel: Ziel) {
    const karte = optimistisch.find((k) => k.id === id);
    if (!karte) return;
    if (karte.mitarbeiterId === ziel.mitarbeiterId && karte.datum === ziel.datum) return;
    starte(async () => {
      verschiebe({ id, ...ziel });
      const e = await einsatzZuweisen({
        id,
        mitarbeiter_id: ziel.mitarbeiterId,
        datum: ziel.datum,
      });
      if (!e.ok) toast.error(e.fehler);
      else if (e.meldung) toast.message(e.meldung);
    });
  }

  const zelle = (ziel: Ziel) => {
    const key = zielKey(ziel);
    return {
      onDragOver: (ev: React.DragEvent) => {
        ev.preventDefault();
        ev.dataTransfer.dropEffect = "move";
        if (ueber !== key) setUeber(key);
      },
      onDragLeave: () => setUeber((u) => (u === key ? null : u)),
      onDrop: (ev: React.DragEvent) => {
        ev.preventDefault();
        setUeber(null);
        const id = ev.dataTransfer.getData("text/einsatz");
        if (id) ablegen(id, ziel);
      },
      "data-ziel": key,
      className: cn(
        "flex min-h-20 flex-col gap-1 border-l p-1 align-top transition-colors",
        ueber === key && "bg-blue-50 dark:bg-blue-950/40",
      ),
    };
  };

  const kartenIn = (ziel: Ziel) =>
    optimistisch.filter((k) => k.mitarbeiterId === ziel.mitarbeiterId && k.datum === ziel.datum);

  return (
    <div className="overflow-x-auto rounded-lg border">
      <div
        className="grid min-w-[960px] text-sm"
        style={{ gridTemplateColumns: "10rem repeat(7, minmax(0, 1fr))" }}
      >
        <div className="bg-muted/50 border-b p-2 font-medium">Mitarbeiter</div>
        {tage.map((t) => (
          <div
            key={t.datum}
            className={cn(
              "bg-muted/50 border-b border-l p-2 font-medium",
              t.heute && "text-blue-700 dark:text-blue-300",
            )}
          >
            {t.text}
          </div>
        ))}

        {/* offene Einsätze */}
        <div className="border-b bg-amber-50/60 p-2 dark:bg-amber-950/20">
          <div className="font-medium">Offen</div>
          <div className="text-muted-foreground text-xs">ohne Mitarbeiter</div>
        </div>
        {tage.map((t) => {
          const ziel = { mitarbeiterId: null, datum: t.datum };
          const attr = zelle(ziel);
          return (
            <div
              key={t.datum}
              {...attr}
              className={cn(attr.className, "border-b bg-amber-50/60 dark:bg-amber-950/20")}
            >
              {kartenIn(ziel).map((k) => (
                <Karte key={k.id} k={k} />
              ))}
            </div>
          );
        })}

        {zeilen.map((z) => (
          <Zeile key={z.id} z={z} tage={tage} zelle={zelle} kartenIn={kartenIn} />
        ))}
      </div>
    </div>
  );
}

function Zeile({
  z,
  tage,
  zelle,
  kartenIn,
}: {
  z: PlanZeile;
  tage: { datum: string }[];
  zelle: (ziel: Ziel) => React.HTMLAttributes<HTMLDivElement> & { className: string };
  kartenIn: (ziel: Ziel) => PlanKarte[];
}) {
  const woche = z.tage.reduce((s, t) => s + t.bedarf, 0);
  return (
    <>
      <div className="border-b p-2">
        <div className="truncate font-medium" title={z.name}>
          {z.name}
        </div>
        <div className="text-muted-foreground text-xs">{zuDauer(woche)} diese Woche</div>
      </div>
      {tage.map((t, i) => {
        const info = z.tage[i]!;
        const ziel = { mitarbeiterId: z.id, datum: t.datum };
        const attr = zelle(ziel);
        const voll = info.verfuegbar !== null && info.bedarf > info.verfuegbar;
        const liste = kartenIn(ziel);
        return (
          <div
            key={t.datum}
            {...attr}
            className={cn(attr.className, "border-b", info.abwesend && "bg-muted/60")}
          >
            <Link
              href={`/planung/tour/${z.id}/${t.datum}`}
              className="text-muted-foreground flex items-center justify-between gap-1 rounded px-1 text-[11px] hover:underline"
              title="Tagestour öffnen"
            >
              <span className={cn(voll && "font-medium text-red-600 dark:text-red-400")}>
                {info.abwesend
                  ? info.abwesend
                  : info.verfuegbar === null
                    ? liste.length
                      ? zuDauer(info.bedarf)
                      : ""
                    : info.verfuegbar === 0 && !liste.length
                      ? "frei"
                      : `${zuDauer(info.bedarf)} / ${zuDauer(info.verfuegbar)}`}
              </span>
              {info.rueckkehr && liste.length > 0 && <span>↩ {info.rueckkehr}</span>}
            </Link>
            {liste.map((k) => (
              <Karte key={k.id} k={k} />
            ))}
          </div>
        );
      })}
    </>
  );
}

function Karte({ k }: { k: PlanKarte }) {
  const beweglich = BEWEGLICH.has(k.status);
  const konflikt = k.konflikte.length > 0;
  return (
    <div
      draggable={beweglich}
      onDragStart={(ev) => {
        ev.dataTransfer.setData("text/einsatz", k.id);
        ev.dataTransfer.effectAllowed = "move";
      }}
      data-einsatz={k.id}
      title={[
        `${k.objekt}${k.ort ? `, ${k.ort}` : ""}`,
        k.vorlage,
        k.zeitfenster ? `Zeitfenster ${k.zeitfenster}` : null,
        `Sollzeit ${zuDauer(k.sollzeit)}`,
        k.verschoben ? "von Hand verschoben" : null,
        ...k.konflikte,
      ]
        .filter(Boolean)
        .join("\n")}
      className={cn(
        "bg-background rounded-md border px-1.5 py-1 text-xs leading-tight shadow-xs",
        beweglich ? "cursor-grab active:cursor-grabbing" : "opacity-70",
        konflikt && "border-red-400 dark:border-red-700",
        k.status === "erledigt" && "line-through",
      )}
    >
      <div className="flex items-center gap-1">
        {k.beginn && <span className="font-medium tabular-nums">{k.beginn}</span>}
        <span className="truncate font-medium">{k.objekt}</span>
      </div>
      <div className="text-muted-foreground truncate">
        {k.vorlage}
        {k.zeitfenster ? ` · ${k.zeitfenster}` : ""}
      </div>
      {konflikt && (
        <div className="truncate text-red-600 dark:text-red-400">⚠ {k.konflikte[0]}</div>
      )}
    </div>
  );
}
