"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { FormularDialog } from "@/components/aktion-knoepfe";
import {
  AuswahlFeld,
  Formfehler,
  TextFeld,
  TextbereichFeld,
  useAktionsFormular,
} from "@/components/formular/formular";
import { Button } from "@/components/ui/button";
import type { AktionErgebnis } from "@/lib/aktion";
import { anfrageAnlegen, anfrageStatus, angebotAnlegen } from "@/lib/aktionen/angebote";
import { anfrageSchema } from "@/lib/schemas/anfrage";
import { KUNDENTYPEN } from "@/lib/schemas/kunde";

function Knopf({
  text,
  aktion,
  variante = "outline",
}: {
  text: string;
  aktion: () => Promise<AktionErgebnis<unknown> | void>;
  variante?: "outline" | "default" | "ghost";
}) {
  const [laeuft, starte] = useTransition();
  return (
    <Button
      size="sm"
      variant={variante}
      disabled={laeuft}
      onClick={() =>
        starte(async () => {
          const r = await aktion();
          if (r && !r.ok) toast.error(r.fehler);
          else if (r?.meldung) toast.success(r.meldung);
        })
      }
    >
      {text}
    </Button>
  );
}

export function AnfrageKnoepfe({
  id,
  status,
  hatAngebot,
}: {
  id: string;
  status: string;
  hatAngebot: boolean;
}) {
  return (
    <>
      {!hatAngebot && status !== "gewonnen" && status !== "verloren" && (
        <Knopf
          text="Angebot erstellen"
          variante="default"
          aktion={() => angebotAnlegen({ anfrageId: id })}
        />
      )}
      {status === "neu" && (
        <Knopf text="In Bearbeitung" aktion={() => anfrageStatus(id, "in_bearbeitung")} />
      )}
      {status !== "gewonnen" && status !== "verloren" && (
        <Knopf text="Verloren" variante="ghost" aktion={() => anfrageStatus(id, "verloren")} />
      )}
    </>
  );
}

export function TelefonAnfrage() {
  return (
    <FormularDialog
      titel="Anfrage erfassen (Telefon, E-Mail)"
      ausloeser={<Button size="sm">Anfrage erfassen</Button>}
    >
      {(schliessen) => <AnfrageFormular fertig={schliessen} />}
    </FormularDialog>
  );
}

function AnfrageFormular({ fertig }: { fertig: () => void }) {
  const { form, absenden, serverFehler, laeuft } = useAktionsFormular(anfrageSchema, {
    standard: {
      kundentyp: "firma",
      name: "",
      firma: "",
      email: "",
      telefon: "",
      strasse: "",
      plz: "",
      ort: "",
      leistung: "",
      nachricht: "",
      wunschtermin: "",
    },
    aktion: anfrageAnlegen,
    erfolg: fertig,
  });
  return (
    <form onSubmit={absenden} className="flex flex-col gap-3">
      <Formfehler text={serverFehler} />
      <div className="grid gap-3 sm:grid-cols-2">
        <AuswahlFeld form={form} name="kundentyp" label="Kundentyp" optionen={KUNDENTYPEN} />
        <TextFeld form={form} name="leistung" label="Leistung" placeholder="Treppenhausreinigung" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextFeld form={form} name="name" label="Ansprechpartner" />
        <TextFeld form={form} name="firma" label="Firma" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextFeld form={form} name="email" label="E-Mail" type="email" />
        <TextFeld form={form} name="telefon" label="Telefon" type="tel" />
      </div>
      <TextFeld form={form} name="strasse" label="Straße des Objekts" />
      <div className="grid grid-cols-[7rem_1fr] gap-3">
        <TextFeld form={form} name="plz" label="PLZ" />
        <TextFeld form={form} name="ort" label="Ort" />
      </div>
      <TextbereichFeld form={form} name="nachricht" label="Notiz" rows={3} />
      <Button type="submit" disabled={laeuft}>
        Speichern
      </Button>
    </form>
  );
}
