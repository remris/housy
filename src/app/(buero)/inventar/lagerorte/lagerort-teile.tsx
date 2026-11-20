"use client";

import { FormularDialog } from "@/components/aktion-knoepfe";
import {
  AuswahlFeld,
  Formfehler,
  KontrollkaestchenFeld,
  TextFeld,
  useAktionsFormular,
} from "@/components/formular/formular";
import { Button } from "@/components/ui/button";
import { lagerortSpeichern } from "@/lib/aktionen/inventar";
import { lagerortSchema } from "@/lib/schemas/inventar";

type Option = { wert: string; text: string };
type Lagerort = {
  id: string;
  name: string;
  art: "lager" | "objekt";
  objekt_id: string | null;
  aktiv: boolean;
};

export function LagerortDialog({ lagerort, objekte }: { lagerort?: Lagerort; objekte: Option[] }) {
  return (
    <FormularDialog
      titel={lagerort ? "Lagerort bearbeiten" : "Lagerort anlegen"}
      ausloeser={
        <Button size="sm" variant={lagerort ? "ghost" : "default"}>
          {lagerort ? "Bearbeiten" : "Lagerort anlegen"}
        </Button>
      }
    >
      {(schliessen) => (
        <LagerortFormular lagerort={lagerort} objekte={objekte} fertig={schliessen} />
      )}
    </FormularDialog>
  );
}

function LagerortFormular({
  lagerort,
  objekte,
  fertig,
}: {
  lagerort?: Lagerort;
  objekte: Option[];
  fertig: () => void;
}) {
  const { form, absenden, serverFehler, laeuft } = useAktionsFormular(lagerortSchema, {
    standard: {
      name: lagerort?.name ?? "",
      art: lagerort?.art ?? "objekt",
      objekt_id: lagerort?.objekt_id ?? null,
      aktiv: lagerort?.aktiv ?? true,
    },
    aktion: (d) => lagerortSpeichern(lagerort?.id ?? null, d),
    erfolg: fertig,
  });
  const art = form.watch("art");
  return (
    <form onSubmit={absenden} className="flex flex-col gap-3">
      <Formfehler text={serverFehler} />
      {!lagerort && (
        <AuswahlFeld
          form={form}
          name="art"
          label="Art"
          optionen={[
            { wert: "objekt", text: "Putzkammer im Objekt" },
            { wert: "lager", text: "weiteres Lager" },
          ]}
        />
      )}
      {!lagerort && art === "objekt" && (
        <AuswahlFeld
          form={form}
          name="objekt_id"
          label="Objekt"
          leer="– wählen –"
          optionen={objekte}
        />
      )}
      <TextFeld form={form} name="name" label="Name" placeholder="Putzkammer Hauptstraße 12" />
      <KontrollkaestchenFeld form={form} name="aktiv" label="aktiv" />
      <Button type="submit" disabled={laeuft}>
        Speichern
      </Button>
    </form>
  );
}
