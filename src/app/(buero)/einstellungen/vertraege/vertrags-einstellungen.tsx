"use client";

import type { z } from "zod";
import {
  AuswahlFeld,
  Formfehler,
  TextbereichFeld,
  useAktionsFormular,
} from "@/components/formular/formular";
import { Button } from "@/components/ui/button";
import { BUNDESLAENDER } from "@/domain/feiertage";
import { vertragsbedingungenSpeichern } from "@/lib/aktionen/vertraege";
import { vertragsbedingungenSchema } from "@/lib/schemas/vertrag";

export function VertragsEinstellungen({
  werte,
  darfAendern,
}: {
  werte: z.input<typeof vertragsbedingungenSchema>;
  darfAendern: boolean;
}) {
  const { form, absenden, serverFehler, laeuft } = useAktionsFormular(vertragsbedingungenSchema, {
    standard: werte,
    aktion: vertragsbedingungenSpeichern,
  });
  return (
    <form onSubmit={absenden} className="flex flex-col gap-6" noValidate>
      <fieldset disabled={!darfAendern || laeuft} className="flex flex-col gap-6">
        <Formfehler text={serverFehler} />
        <AuswahlFeld
          form={form}
          name="bundesland"
          label="Bundesland für Feiertage"
          className="max-w-xs"
          optionen={Object.entries(BUNDESLAENDER).map(([wert, text]) => ({ wert, text }))}
        />
        <TextbereichFeld
          form={form}
          name="vertragsbedingungen"
          label="Vertragsbedingungen"
          rows={10}
          hinweis="Erscheint auf jedem Vertrags-PDF unter „Weitere Bedingungen“. Texte bitte rechtlich prüfen lassen."
        />
        {darfAendern && (
          <div>
            <Button type="submit">Speichern</Button>
          </div>
        )}
      </fieldset>
    </form>
  );
}
