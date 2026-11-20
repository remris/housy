"use client";

import type { z } from "zod";
import {
  Formfehler,
  KontrollkaestchenFeld,
  useAktionsFormular,
} from "@/components/formular/formular";
import { Button } from "@/components/ui/button";
import { nachweisEinstellungenSpeichern } from "@/lib/aktionen/nachweise";
import { nachweisEinstellungenSchema } from "@/lib/schemas/nachweis";

export function NachweisEinstellungen({
  werte,
  darfAendern,
  firmenEmail,
}: {
  werte: z.input<typeof nachweisEinstellungenSchema>;
  darfAendern: boolean;
  firmenEmail: string | null;
}) {
  const { form, absenden, serverFehler, laeuft } = useAktionsFormular(nachweisEinstellungenSchema, {
    standard: werte,
    aktion: nachweisEinstellungenSpeichern,
  });
  return (
    <form onSubmit={absenden} className="flex flex-col gap-4" noValidate>
      <fieldset disabled={!darfAendern || laeuft} className="flex flex-col gap-4">
        <Formfehler text={serverFehler} />
        <KontrollkaestchenFeld
          form={form}
          name="nachweis_kopie"
          label={`Kopie jedes Nachweises an die Firmen-E-Mail${firmenEmail ? ` (${firmenEmail})` : " (unter Firmendaten eintragen)"}`}
        />
        <KontrollkaestchenFeld
          form={form}
          name="nachweis_fotos"
          label="Fotos im Nachweis je Einsatz (bis zu 6; Monatsnachweise zeigen nur die Anzahl)"
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
