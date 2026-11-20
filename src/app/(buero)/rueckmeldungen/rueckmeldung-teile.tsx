"use client";

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
import {
  meldungErledigt,
  positionPruefen,
  positionUebernommen,
} from "@/lib/aktionen/rueckmeldungen";
import { bestaetigungJetztSenden } from "@/lib/aktionen/nachweise";
import { positionPruefenSchema } from "@/lib/schemas/rueckmeldung";

function melde(e: AktionErgebnis<unknown>) {
  if (e.ok) toast.success(e.meldung ?? "Gespeichert.");
  else toast.error(e.fehler);
}

export function PositionPruefen({
  id,
  preise,
}: {
  id: string;
  preise: { wert: string; text: string }[];
}) {
  const { form, absenden, serverFehler, laeuft } = useAktionsFormular(positionPruefenSchema, {
    standard: { id, entscheidung: "bestaetigen", preis_id: null, preis_cent: "", notiz_buero: "" },
    aktion: positionPruefen,
  });
  return (
    <form onSubmit={absenden} className="flex flex-col gap-3">
      <Formfehler text={serverFehler} />
      <div className="grid gap-3 sm:grid-cols-3">
        <AuswahlFeld
          form={form}
          name="preis_id"
          label="Leistung aus Preisliste"
          leer="– keine –"
          optionen={preise}
        />
        <TextFeld
          form={form}
          name="preis_cent"
          label="Einzelpreis netto (€)"
          inputMode="decimal"
          hinweis="leer = Preis aus der Liste"
        />
        <TextFeld form={form} name="notiz_buero" label="Notiz" />
      </div>
      <div className="flex gap-2">
        <Button
          type="submit"
          size="sm"
          disabled={laeuft}
          onClick={() => form.setValue("entscheidung", "bestaetigen")}
        >
          Bestätigen
        </Button>
        <Button
          type="submit"
          size="sm"
          variant="outline"
          disabled={laeuft}
          onClick={() => form.setValue("entscheidung", "ablehnen")}
        >
          Ablehnen
        </Button>
      </div>
    </form>
  );
}

export function UebernommenKnopf({ id }: { id: string }) {
  const [laeuft, starte] = useTransition();
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={laeuft}
      onClick={() => starte(async () => melde(await positionUebernommen(id)))}
    >
      Übernommen
    </Button>
  );
}

export function ErledigtKnopf({ id }: { id: string }) {
  const [laeuft, starte] = useTransition();
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={laeuft}
      onClick={() => starte(async () => melde(await meldungErledigt(id)))}
    >
      Erledigt
    </Button>
  );
}

export function BestaetigungKnopf({ id }: { id: string }) {
  const [laeuft, starte] = useTransition();
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={laeuft}
      onClick={() => starte(async () => melde(await bestaetigungJetztSenden(id)))}
    >
      Jetzt senden
    </Button>
  );
}
