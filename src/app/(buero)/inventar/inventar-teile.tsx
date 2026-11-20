"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { FormularDialog } from "@/components/aktion-knoepfe";
import {
  AuswahlFeld,
  Formfehler,
  TextFeld,
  useAktionsFormular,
} from "@/components/formular/formular";
import { Button } from "@/components/ui/button";
import type { AktionErgebnis } from "@/lib/aktion";
import {
  bestellungAnlegen,
  bestellungGeliefert,
  bestellungStornieren,
  bewegungBuchen,
  istKorrekturAnwenden,
} from "@/lib/aktionen/inventar";
import { BUCHUNGSARTEN, bewegungSchema } from "@/lib/schemas/inventar";

type Option = { wert: string; text: string };

function melde(e: AktionErgebnis<unknown>) {
  if (e.ok) toast.success(e.meldung ?? "Gespeichert.");
  else toast.error(e.fehler);
}

function Knopf({
  text,
  aktion,
  variante = "outline",
  frage,
}: {
  text: string;
  aktion: () => Promise<AktionErgebnis<unknown>>;
  variante?: "outline" | "default" | "ghost";
  frage?: string;
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

export function BuchenDialog({
  artikel,
  lagerorte,
  artikelId,
  art = "zugang",
  ausloeserText = "Buchen",
}: {
  artikel: Option[];
  lagerorte: Option[];
  artikelId?: string;
  art?: "zugang" | "umbuchung" | "inventur";
  ausloeserText?: string;
}) {
  return (
    <FormularDialog
      titel="Lagerbewegung buchen"
      ausloeser={
        <Button size="sm" variant={artikelId ? "ghost" : "default"}>
          {ausloeserText}
        </Button>
      }
    >
      {(schliessen) => (
        <BuchenFormular
          artikel={artikel}
          lagerorte={lagerorte}
          artikelId={artikelId}
          art={art}
          fertig={schliessen}
        />
      )}
    </FormularDialog>
  );
}

function BuchenFormular({
  artikel,
  lagerorte,
  artikelId,
  art,
  fertig,
}: {
  artikel: Option[];
  lagerorte: Option[];
  artikelId?: string;
  art: "zugang" | "umbuchung" | "inventur";
  fertig: () => void;
}) {
  const { form, absenden, serverFehler, laeuft } = useAktionsFormular(bewegungSchema, {
    standard: {
      art,
      artikel_id: artikelId ?? "",
      menge: "",
      von_lagerort_id: null,
      nach_lagerort_id: lagerorte[0]?.wert ?? null,
      notiz: "",
    },
    aktion: bewegungBuchen,
    erfolg: fertig,
  });
  const gewaehlt = form.watch("art");
  return (
    <form onSubmit={absenden} className="flex flex-col gap-3">
      <Formfehler text={serverFehler} />
      <AuswahlFeld form={form} name="art" label="Art" optionen={BUCHUNGSARTEN} />
      <AuswahlFeld
        form={form}
        name="artikel_id"
        label="Artikel"
        leer="– wählen –"
        optionen={artikel}
      />
      {gewaehlt === "umbuchung" && (
        <AuswahlFeld
          form={form}
          name="von_lagerort_id"
          label="von"
          leer="– wählen –"
          optionen={lagerorte}
        />
      )}
      <AuswahlFeld
        form={form}
        name="nach_lagerort_id"
        label={gewaehlt === "inventur" ? "Lagerort" : "nach"}
        leer="– wählen –"
        optionen={lagerorte}
      />
      <TextFeld
        form={form}
        name="menge"
        label={gewaehlt === "inventur" ? "Gezählte Menge" : "Menge (in der Artikeleinheit)"}
        inputMode="decimal"
        hinweis={
          gewaehlt === "inventur" ? "Die Differenz zum Buchbestand wird gebucht." : undefined
        }
      />
      <TextFeld form={form} name="notiz" label="Notiz" />
      <Button type="submit" disabled={laeuft}>
        Buchen
      </Button>
    </form>
  );
}

export function BestelltKnopf({
  artikelId,
  menge,
  lieferant,
}: {
  artikelId: string;
  menge: number;
  lieferant: string | null;
}) {
  return (
    <Knopf
      text="Bestellt"
      variante="default"
      aktion={() => bestellungAnlegen({ artikel_id: artikelId, menge, lieferant: lieferant ?? "" })}
    />
  );
}

export function BestellungKnoepfe({ id }: { id: string }) {
  return (
    <>
      <Knopf text="Geliefert" variante="default" aktion={() => bestellungGeliefert(id)} />
      <Knopf
        text="Stornieren"
        variante="ghost"
        frage="Bestellung stornieren?"
        aktion={() => bestellungStornieren(id)}
      />
    </>
  );
}

export function IstKorrekturKnoepfe({ meldungId }: { meldungId: string }) {
  return (
    <>
      <Knopf
        text="Für diese Objekte übernehmen"
        variante="default"
        aktion={() => istKorrekturAnwenden(meldungId, true)}
      />
      <Knopf
        text="Nur Fahrzeug auf 0"
        variante="ghost"
        aktion={() => istKorrekturAnwenden(meldungId, false)}
      />
    </>
  );
}
