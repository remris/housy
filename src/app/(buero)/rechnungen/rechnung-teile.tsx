"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { FormularDialog } from "@/components/aktion-knoepfe";
import {
  AuswahlFeld,
  Formfehler,
  KontrollkaestchenFeld,
  TextFeld,
  useAktionsFormular,
} from "@/components/formular/formular";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AktionErgebnis } from "@/lib/aktion";
import {
  bezahltSetzen,
  dateienNachholen,
  entwurfLoeschen,
  monatslaufStarten,
  positionEntfernen,
  positionHinzufuegen,
  rechnungSendenAktion,
  rechnungenFestschreiben,
  stornieren,
} from "@/lib/aktionen/rechnungen";
import { PREISEINHEITEN_RECHNUNG, positionSchema, stornoSchema } from "@/lib/schemas/rechnung";

function melde(e: AktionErgebnis<unknown>) {
  if (e.ok) toast.success(e.meldung ?? "Erledigt.");
  else toast.error(e.fehler, { duration: 10_000 });
}

function Knopf({
  text,
  aktion,
  variante = "outline",
  frage,
  size = "sm",
}: {
  text: string;
  aktion: () => Promise<AktionErgebnis<unknown>>;
  variante?: "outline" | "default" | "ghost" | "destructive";
  frage?: string;
  size?: "sm" | "default";
}) {
  const [laeuft, starte] = useTransition();
  return (
    <Button
      size={size}
      variant={variante}
      disabled={laeuft}
      onClick={() => {
        if (frage && !window.confirm(frage)) return;
        starte(async () => melde(await aktion()));
      }}
    >
      {laeuft ? "Bitte warten …" : text}
    </Button>
  );
}

export function LaufKnopf({ monat, vorhanden }: { monat: string; vorhanden: boolean }) {
  return (
    <Knopf
      text={vorhanden ? "Monatslauf neu starten" : "Monatslauf starten"}
      variante={vorhanden ? "outline" : "default"}
      frage={
        vorhanden
          ? "Vorhandene Entwürfe dieses Monats werden ersetzt (von Hand ergänzte Positionen gehen verloren). Fortfahren?"
          : undefined
      }
      aktion={() => monatslaufStarten(monat)}
    />
  );
}

export function AlleFestschreiben({ ids, bereit }: { ids: string[]; bereit: number }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Knopf
        text={`${bereit} festschreiben und senden`}
        variante="default"
        size="default"
        frage={`${bereit} Rechnungen festschreiben (Nummer vergeben, danach unveränderlich) und an die Kunden senden?`}
        aktion={() => rechnungenFestschreiben(ids, true)}
      />
      <Knopf
        text="Nur festschreiben"
        size="default"
        frage="Rechnungen festschreiben, ohne sie zu senden?"
        aktion={() => rechnungenFestschreiben(ids, false)}
      />
    </div>
  );
}

export function EntwurfKnoepfe({ id }: { id: string }) {
  return (
    <>
      <Knopf
        text="Festschreiben und senden"
        variante="default"
        frage="Rechnung festschreiben und senden? Danach ist sie unveränderlich."
        aktion={() => rechnungenFestschreiben([id], true)}
      />
      <Knopf
        text="Löschen"
        variante="ghost"
        frage="Entwurf löschen? Die Leistungen werden wieder abrechenbar."
        aktion={() => entwurfLoeschen(id)}
      />
    </>
  );
}

export function PositionEntfernen({ id }: { id: string }) {
  return (
    <Knopf
      text="Entfernen"
      variante="ghost"
      frage="Position entfernen?"
      aktion={() => positionEntfernen(id)}
    />
  );
}

export function PositionDialog({
  rechnungId,
  kleinunternehmer,
}: {
  rechnungId: string;
  kleinunternehmer: boolean;
}) {
  return (
    <FormularDialog
      titel="Position hinzufügen"
      ausloeser={
        <Button size="sm" variant="outline">
          Position hinzufügen
        </Button>
      }
    >
      {(schliessen) => (
        <PositionFormular
          rechnungId={rechnungId}
          kleinunternehmer={kleinunternehmer}
          fertig={schliessen}
        />
      )}
    </FormularDialog>
  );
}

function PositionFormular({
  rechnungId,
  kleinunternehmer,
  fertig,
}: {
  rechnungId: string;
  kleinunternehmer: boolean;
  fertig: () => void;
}) {
  const { form, absenden, serverFehler, laeuft } = useAktionsFormular(positionSchema, {
    standard: {
      rechnung_id: rechnungId,
      bezeichnung: "",
      beschreibung: "",
      menge: "1",
      einheit: "stueck",
      einzelpreis: "",
      ust_satz: kleinunternehmer ? 0 : 19,
    },
    aktion: positionHinzufuegen,
    erfolg: fertig,
  });
  return (
    <form onSubmit={absenden} className="flex flex-col gap-3">
      <Formfehler text={serverFehler} />
      <TextFeld form={form} name="bezeichnung" label="Bezeichnung" />
      <TextFeld form={form} name="beschreibung" label="Beschreibung" />
      <div className="grid grid-cols-3 gap-3">
        <TextFeld form={form} name="menge" label="Menge" inputMode="decimal" />
        <AuswahlFeld
          form={form}
          name="einheit"
          label="Einheit"
          optionen={PREISEINHEITEN_RECHNUNG}
        />
        <TextFeld
          form={form}
          name="einzelpreis"
          label="Einzelpreis netto (€)"
          inputMode="decimal"
        />
      </div>
      {!kleinunternehmer && (
        <AuswahlFeld
          form={form}
          name="ust_satz"
          label="USt-Satz"
          zahl
          optionen={[
            { wert: "19", text: "19 %" },
            { wert: "7", text: "7 %" },
            { wert: "0", text: "0 %" },
          ]}
        />
      )}
      <Button type="submit" disabled={laeuft}>
        Hinzufügen
      </Button>
    </form>
  );
}

export function RechnungKnoepfe({
  id,
  status,
  art,
  gesendet,
  bezahltAm,
  hatPdf,
}: {
  id: string;
  status: string;
  art: string;
  gesendet: boolean;
  bezahltAm: string | null;
  hatPdf: boolean;
}) {
  const [datum, setDatum] = useState(() => new Date().toISOString().slice(0, 10));
  return (
    <>
      {!hatPdf && <Knopf text="Dateien erzeugen" aktion={() => dateienNachholen(id)} />}
      {hatPdf && status !== "storniert" && (
        <Knopf
          text={gesendet ? "Erneut senden" : "Senden"}
          variante={gesendet ? "ghost" : "outline"}
          frage={gesendet ? "Rechnung noch einmal senden?" : undefined}
          aktion={() => rechnungSendenAktion(id)}
        />
      )}
      {art === "rechnung" && status === "offen" && (
        <span className="flex items-center gap-1">
          <Input
            type="date"
            aria-label="Bezahlt am"
            className="h-8 w-36"
            value={datum}
            onChange={(e) => setDatum(e.target.value)}
          />
          <Knopf text="Bezahlt" variante="default" aktion={() => bezahltSetzen(id, datum)} />
        </span>
      )}
      {status === "bezahlt" && bezahltAm && (
        <Knopf
          text="Zahlung zurücknehmen"
          variante="ghost"
          aktion={() => bezahltSetzen(id, null)}
        />
      )}
      {art === "rechnung" && (status === "offen" || status === "bezahlt") && (
        <StornoDialog id={id} />
      )}
    </>
  );
}

function StornoDialog({ id }: { id: string }) {
  return (
    <FormularDialog
      titel="Rechnung stornieren"
      ausloeser={
        <Button size="sm" variant="ghost">
          Stornieren
        </Button>
      }
    >
      {(schliessen) => <StornoFormular id={id} fertig={schliessen} />}
    </FormularDialog>
  );
}

function StornoFormular({ id, fertig }: { id: string; fertig: () => void }) {
  const { form, absenden, serverFehler, laeuft } = useAktionsFormular(stornoSchema, {
    standard: { id, grund: "", senden: true },
    aktion: stornieren,
    erfolg: fertig,
  });
  return (
    <form onSubmit={absenden} className="flex flex-col gap-3">
      <p className="text-muted-foreground text-sm">
        Es entsteht eine Stornorechnung (Gutschrift) mit eigener Nummer. Die Rechnung bleibt
        erhalten; die Leistungen werden wieder abrechenbar.
      </p>
      <Formfehler text={serverFehler} />
      <TextFeld form={form} name="grund" label="Grund" placeholder="z. B. falsche Anschrift" />
      <KontrollkaestchenFeld
        form={form}
        name="senden"
        label="Stornorechnung an den Kunden senden"
      />
      <Button type="submit" variant="destructive" disabled={laeuft}>
        Stornieren
      </Button>
    </form>
  );
}
