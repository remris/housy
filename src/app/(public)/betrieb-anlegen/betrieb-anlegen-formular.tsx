"use client";

import {
  Formfehler,
  MehrfachAuswahlFeld,
  TextFeld,
  useAktionsFormular,
} from "@/components/formular/formular";
import { Button } from "@/components/ui/button";
import { betriebAnlegen } from "@/lib/aktionen/konto";
import { BRANCHEN, betriebAnlegenSchema } from "@/lib/schemas/konto";

export function BetriebAnlegenFormular() {
  const { form, absenden, serverFehler, laeuft } = useAktionsFormular(betriebAnlegenSchema, {
    standard: { betriebName: "", branchen: [] },
    aktion: betriebAnlegen,
  });
  return (
    <form onSubmit={absenden} className="flex flex-col gap-4" noValidate>
      <Formfehler text={serverFehler} />
      <TextFeld form={form} name="betriebName" label="Name des Betriebs" />
      <MehrfachAuswahlFeld form={form} name="branchen" label="Branche(n)" optionen={BRANCHEN} />
      <Button type="submit" disabled={laeuft}>
        Betrieb anlegen
      </Button>
    </form>
  );
}
