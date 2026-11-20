"use client";

import type { z } from "zod";
import {
  AuswahlFeld,
  Formfehler,
  TextFeld,
  TextbereichFeld,
  useAktionsFormular,
} from "@/components/formular/formular";
import { Button } from "@/components/ui/button";
import { rechnungEinstellungenSpeichern } from "@/lib/aktionen/rechnungen";
import { rechnungEinstellungenSchema } from "@/lib/schemas/rechnung";

export function RechnungEinstellungen({
  werte,
  darfAendern,
}: {
  werte: z.input<typeof rechnungEinstellungenSchema>;
  darfAendern: boolean;
}) {
  const { form, absenden, serverFehler, laeuft } = useAktionsFormular(rechnungEinstellungenSchema, {
    standard: werte,
    aktion: rechnungEinstellungenSpeichern,
  });
  return (
    <form onSubmit={absenden} className="flex flex-col gap-6" noValidate>
      <fieldset disabled={!darfAendern || laeuft} className="flex flex-col gap-4">
        <Formfehler text={serverFehler} />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextFeld
            form={form}
            name="rechnung_praefix"
            label="Präfix der Rechnungsnummer"
            hinweis="z. B. RE- → RE-2026-0001 (fortlaufend je Jahr)"
          />
          <TextFeld
            form={form}
            name="rechnung_kontakt"
            label="Ansprechpartner auf Rechnungen"
            hinweis="Pflicht in der XRechnung (sonst Firmenname)"
          />
        </div>
        <TextbereichFeld
          form={form}
          name="rechnung_fusstext"
          label="Text unter jeder Rechnung"
          rows={3}
          hinweis="z. B. Dank, Hinweise zu Skonto. Pflichtangaben setzt Housy selbst."
        />
        <h3 className="font-medium">DATEV-Export</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <TextFeld
            form={form}
            name="datev_beraternummer"
            label="Beraternummer"
            inputMode="numeric"
          />
          <TextFeld
            form={form}
            name="datev_mandantennummer"
            label="Mandantennummer"
            inputMode="numeric"
          />
          <AuswahlFeld
            form={form}
            name="kontenrahmen"
            label="Kontenrahmen"
            optionen={[
              { wert: "skr03", text: "SKR 03" },
              { wert: "skr04", text: "SKR 04" },
            ]}
          />
        </div>
        <p className="text-muted-foreground text-sm">
          Debitoren: 10000 + Kundennummer. Erlöskonten (Automatik): SKR 03 8400 (19 %), 8300 (7 %),
          8195 (Kleinunternehmer); SKR 04 4400, 4300, 4185. Bitte mit dem Steuerberater abstimmen.
        </p>
        {darfAendern && (
          <div>
            <Button type="submit">Speichern</Button>
          </div>
        )}
      </fieldset>
    </form>
  );
}
