"use client";

import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import {
  AuswahlFeld,
  Formfehler,
  TextFeld,
  useAktionsFormular,
} from "@/components/formular/formular";
import { Button } from "@/components/ui/button";
import type { AktionErgebnis } from "@/lib/aktion";
import { tourEinstellen, tourNeuBerechnen } from "@/lib/aktionen/planung";
import { tourEinstellungSchema } from "@/lib/schemas/planung";

function melde(e: AktionErgebnis<unknown>) {
  if (e.ok) toast.success(e.meldung ?? "Gespeichert.");
  else toast.error(e.fehler);
}

export function TourKnoepfe({
  mitarbeiterId,
  datum,
  leer,
}: {
  mitarbeiterId: string;
  datum: string;
  leer: boolean;
}) {
  const [laeuft, starte] = useTransition();
  const los = (modus: "behalten" | "optimieren") =>
    starte(async () => melde(await tourNeuBerechnen(mitarbeiterId, datum, modus)));
  return (
    <>
      <Button size="sm" disabled={laeuft || leer} onClick={() => los("optimieren")}>
        Reihenfolge vorschlagen
      </Button>
      <Button size="sm" variant="outline" disabled={laeuft || leer} onClick={() => los("behalten")}>
        Fahrzeiten neu berechnen
      </Button>
    </>
  );
}

export function Verschieben({
  mitarbeiterId,
  datum,
  ids,
  index,
}: {
  mitarbeiterId: string;
  datum: string;
  ids: string[];
  index: number;
}) {
  const [laeuft, starte] = useTransition();
  const tausche = (mit: number) => {
    const neu = [...ids];
    [neu[index], neu[mit]] = [neu[mit]!, neu[index]!];
    starte(async () => {
      const e = await tourNeuBerechnen(mitarbeiterId, datum, neu);
      if (!e.ok) toast.error(e.fehler);
    });
  };
  return (
    <div className="flex flex-col gap-1">
      <Button
        size="icon-xs"
        variant="ghost"
        aria-label="nach oben"
        disabled={laeuft || index === 0}
        onClick={() => tausche(index - 1)}
      >
        <ArrowUpIcon />
      </Button>
      <Button
        size="icon-xs"
        variant="ghost"
        aria-label="nach unten"
        disabled={laeuft || index === ids.length - 1}
        onClick={() => tausche(index + 1)}
      >
        <ArrowDownIcon />
      </Button>
    </div>
  );
}

export function TourEinstellungen({
  mitarbeiterId,
  datum,
  startzeit,
  fahrzeugId,
  fahrzeuge,
}: {
  mitarbeiterId: string;
  datum: string;
  startzeit: string;
  fahrzeugId: string | null;
  fahrzeuge: { wert: string; text: string }[];
}) {
  const { form, absenden, serverFehler, laeuft } = useAktionsFormular(tourEinstellungSchema, {
    standard: { mitarbeiter_id: mitarbeiterId, datum, startzeit, fahrzeug_id: fahrzeugId },
    aktion: tourEinstellen,
  });
  return (
    <form onSubmit={absenden} className="flex flex-col gap-3 rounded-lg border p-4">
      <h3 className="font-medium">Tour</h3>
      <Formfehler text={serverFehler} />
      <TextFeld form={form} name="startzeit" label="Abfahrt" type="time" />
      <AuswahlFeld
        form={form}
        name="fahrzeug_id"
        label="Fahrzeug"
        leer="ohne Fahrzeug"
        optionen={fahrzeuge}
      />
      <Button type="submit" size="sm" disabled={laeuft} className="self-start">
        Speichern und neu berechnen
      </Button>
    </form>
  );
}
