"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { AktionErgebnis } from "@/lib/aktion";
import { nachweisAnlegen, nachweisNeu } from "@/lib/aktionen/nachweise";

function melde(e: AktionErgebnis<unknown>) {
  if (e.ok) toast.success(e.meldung ?? "Erledigt.");
  else toast.error(e.fehler);
}

function AktionsKnopf({
  text,
  frage,
  aktion,
  variante = "outline",
}: {
  text: string;
  frage?: string;
  aktion: () => Promise<AktionErgebnis<unknown>>;
  variante?: "outline" | "default" | "ghost";
}) {
  const [laeuft, starte] = useTransition();
  return (
    <Button
      size="sm"
      variant={variante}
      disabled={laeuft}
      onClick={() => {
        if (frage && !window.confirm(frage)) return;
        starte(async () => melde(await aktion()));
      }}
    >
      {laeuft ? "…" : text}
    </Button>
  );
}

export function NachweisKnoepfe({ id, gesendet }: { id: string; gesendet: boolean }) {
  return (
    <>
      <AktionsKnopf
        text="Neu erstellen"
        aktion={() => nachweisNeu({ id, senden: false })}
        variante="ghost"
      />
      <AktionsKnopf
        text={gesendet ? "Erneut senden" : "Senden"}
        frage={
          gesendet ? "Nachweis neu erstellen und noch einmal an den Kunden senden?" : undefined
        }
        aktion={() => nachweisNeu({ id, senden: true })}
      />
    </>
  );
}

export function EinsatzNachweisKnoepfe({ einsatzId }: { einsatzId: string }) {
  return (
    <>
      <AktionsKnopf
        text="Nur erstellen"
        variante="ghost"
        aktion={() => nachweisAnlegen({ art: "einsatz", einsatz_id: einsatzId, senden: false })}
      />
      <AktionsKnopf
        text="Erstellen und senden"
        aktion={() => nachweisAnlegen({ art: "einsatz", einsatz_id: einsatzId, senden: true })}
      />
    </>
  );
}

export function MonatsnachweisFormular({
  monat,
  objekte,
}: {
  monat: string;
  objekte: { id: string; text: string }[];
}) {
  const [objektId, setObjektId] = useState(objekte[0]?.id ?? "");
  const [senden, setSenden] = useState(false);
  const [laeuft, starte] = useTransition();
  if (objekte.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Keine Objekte mit erledigten Einsätzen in diesem Monat.
      </p>
    );
  }
  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-sm">
        Objekt
        <select
          className="border-input bg-background h-9 min-w-64 rounded-lg border px-2"
          value={objektId}
          onChange={(e) => setObjektId(e.target.value)}
        >
          {objekte.map((o) => (
            <option key={o.id} value={o.id}>
              {o.text}
            </option>
          ))}
        </select>
      </label>
      <label className="flex h-9 items-center gap-2 text-sm">
        <input type="checkbox" checked={senden} onChange={(e) => setSenden(e.target.checked)} />
        an den Kunden senden
      </label>
      <Button
        size="sm"
        disabled={laeuft || !objektId}
        onClick={() =>
          starte(async () =>
            melde(await nachweisAnlegen({ art: "monat", objekt_id: objektId, monat, senden })),
          )
        }
      >
        {laeuft ? "Wird erstellt …" : "Monatsnachweis erstellen"}
      </Button>
    </div>
  );
}
