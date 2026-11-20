"use client";

import {
  AuswahlFeld,
  Formfehler,
  TextFeld,
  useAktionsFormular,
} from "@/components/formular/formular";
import { Button } from "@/components/ui/button";
import { objektBedarfSpeichern } from "@/lib/aktionen/inventar";
import { objektBedarfSchema } from "@/lib/schemas/inventar";
import { BEDARFSBEZUEGE } from "@/lib/schemas/vorlage";

export function VerbrauchFormular({
  objektId,
  artikel,
}: {
  objektId: string;
  artikel: { wert: string; text: string }[];
}) {
  const { form, absenden, serverFehler, laeuft } = useAktionsFormular(objektBedarfSchema, {
    standard: { objekt_id: objektId, artikel_id: "", menge: "", bezug: "einsatz" },
    aktion: objektBedarfSpeichern,
    erfolg: () => form.reset(),
  });
  return (
    <form onSubmit={absenden} className="flex flex-wrap items-end gap-3">
      <Formfehler text={serverFehler} />
      <AuswahlFeld
        form={form}
        name="artikel_id"
        label="Artikel"
        leer="– wählen –"
        optionen={artikel}
        className="min-w-48"
      />
      <TextFeld form={form} name="menge" label="Menge" inputMode="decimal" className="w-24" />
      <AuswahlFeld form={form} name="bezug" label="Bezug" optionen={BEDARFSBEZUEGE} />
      <Button type="submit" size="sm" variant="outline" disabled={laeuft}>
        Speichern
      </Button>
    </form>
  );
}
