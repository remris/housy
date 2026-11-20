"use client";

import { useEffect, useMemo } from "react";
import {
  AuswahlFeld,
  Formfehler,
  TextFeld,
  TextbereichFeld,
  useAktionsFormular,
} from "@/components/formular/formular";
import { Button } from "@/components/ui/button";
import { vertragAnlegen } from "@/lib/aktionen/vertraege";
import { ABRECHNUNGSARTEN, vertragNeuSchema } from "@/lib/schemas/vertrag";

type Kunde = { id: string; name: string; objekte: { id: string; name: string }[] };

export function VertragNeuFormular({
  kunden,
  vorauswahl,
  beginn,
}: {
  kunden: Kunde[];
  vorauswahl: { kunde?: string; objekt?: string };
  beginn: string;
}) {
  const { form, absenden, serverFehler, laeuft } = useAktionsFormular(vertragNeuSchema, {
    standard: {
      kunde_id: vorauswahl.kunde ?? "",
      objekt_id: vorauswahl.objekt ?? "",
      titel: "",
      beginn,
      laufzeit_monate: 12,
      verlaengerung_monate: 12,
      kuendigungsfrist_monate: 3,
      frist_zum: "laufzeitende",
      notiz: "",
      abrechnungsart: "pauschale",
      pauschale_cent: "",
    },
    aktion: vertragAnlegen,
  });
  const kundeId = form.watch("kunde_id");
  const objekte = useMemo(
    () => kunden.find((k) => k.id === kundeId)?.objekte ?? [],
    [kunden, kundeId],
  );
  const abrechnung = form.watch("abrechnungsart");
  const laufzeit = Number(form.watch("laufzeit_monate"));

  useEffect(() => {
    const aktuell = form.getValues("objekt_id");
    if (aktuell && !objekte.some((o) => o.id === aktuell)) form.setValue("objekt_id", "");
    if (!aktuell && objekte.length === 1) form.setValue("objekt_id", objekte[0]!.id);
    if (!form.getValues("titel") && objekte.length === 1) form.setValue("titel", objekte[0]!.name);
  }, [kundeId, objekte, form]);

  return (
    <form onSubmit={absenden} className="flex flex-col gap-6" noValidate>
      <Formfehler text={serverFehler} />
      <div className="grid gap-4 sm:grid-cols-2">
        <AuswahlFeld
          form={form}
          name="kunde_id"
          label="Kunde"
          leer="Bitte wählen …"
          optionen={kunden.map((k) => ({ wert: k.id, text: k.name }))}
        />
        <AuswahlFeld
          form={form}
          name="objekt_id"
          label="Objekt"
          leer={
            kundeId
              ? objekte.length
                ? "Bitte wählen …"
                : "Kunde hat keine Objekte"
              : "zuerst Kunde wählen"
          }
          optionen={objekte.map((o) => ({ wert: o.id, text: o.name }))}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-[1fr_11rem]">
        <TextFeld
          form={form}
          name="titel"
          label="Bezeichnung"
          placeholder="z. B. Unterhaltsreinigung Praxis"
        />
        <TextFeld form={form} name="beginn" label="Beginn" type="date" />
      </div>
      <fieldset className="grid gap-4 sm:grid-cols-4">
        <TextFeld
          form={form}
          name="laufzeit_monate"
          label="Laufzeit (Monate)"
          type="number"
          hinweis="0 = unbefristet"
        />
        <TextFeld
          form={form}
          name="verlaengerung_monate"
          label="Verlängerung (Monate)"
          type="number"
          hinweis="0 = endet automatisch"
          disabled={laufzeit === 0}
        />
        <TextFeld
          form={form}
          name="kuendigungsfrist_monate"
          label="Kündigungsfrist (Monate)"
          type="number"
        />
        <AuswahlFeld
          form={form}
          name="frist_zum"
          label="Frist zum"
          optionen={[
            { wert: "laufzeitende", text: "Laufzeitende" },
            { wert: "monatsende", text: "Monatsende" },
          ]}
        />
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <AuswahlFeld
          form={form}
          name="abrechnungsart"
          label="Abrechnung"
          optionen={ABRECHNUNGSARTEN}
        />
        {abrechnung === "pauschale" && (
          <TextFeld
            form={form}
            name="pauschale_cent"
            label="Monatspauschale netto (€)"
            inputMode="decimal"
            placeholder="420,00"
          />
        )}
      </div>
      <TextbereichFeld form={form} name="notiz" label="Besondere Vereinbarungen" rows={3} />
      <p className="text-muted-foreground text-sm">
        Der Vertrag startet als Entwurf. Danach trägst du die Leistungen mit Intervall und
        Reinigungsfenster ein.
      </p>
      <div>
        <Button type="submit" disabled={laeuft}>
          Vertrag anlegen
        </Button>
      </div>
    </form>
  );
}
