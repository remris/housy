"use client";

import type { z } from "zod";
import {
  AuswahlFeld,
  Formfehler,
  KontrollkaestchenFeld,
  TextFeld,
  TextbereichFeld,
  useAktionsFormular,
} from "@/components/formular/formular";
import { Button } from "@/components/ui/button";
import { objektSpeichern } from "@/lib/aktionen/kunden";
import { objektSchema } from "@/lib/schemas/kunde";

export type ObjektWerte = z.input<typeof objektSchema>;

export function ObjektFormular({
  id,
  werte,
  kunden,
}: {
  id: string | null;
  werte: ObjektWerte;
  kunden: { id: string; name: string; kundennummer: number }[];
}) {
  const { form, absenden, serverFehler, laeuft } = useAktionsFormular(objektSchema, {
    standard: werte,
    aktion: (d) => objektSpeichern(id, d),
  });

  return (
    <form onSubmit={absenden} className="flex flex-col gap-6" noValidate>
      <Formfehler text={serverFehler} />
      <div className="grid gap-4 sm:grid-cols-2">
        <AuswahlFeld
          form={form}
          name="kunde_id"
          label="Kunde"
          leer="Bitte wählen …"
          optionen={kunden.map((k) => ({ wert: k.id, text: `${k.name} (${k.kundennummer})` }))}
        />
        <TextFeld
          form={form}
          name="name"
          label="Objektname"
          hinweis="z. B. Hauptstraße 12 oder Praxis Dr. Weber"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-[1fr_8rem_1fr]">
        <TextFeld form={form} name="strasse" label="Straße" />
        <TextFeld form={form} name="plz" label="PLZ" inputMode="numeric" />
        <TextFeld form={form} name="ort" label="Ort" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextFeld
          form={form}
          name="breitengrad"
          label="Breitengrad"
          inputMode="decimal"
          hinweis="optional, z. B. 48,7758"
        />
        <TextFeld
          form={form}
          name="laengengrad"
          label="Längengrad"
          inputMode="decimal"
          hinweis="optional, z. B. 9,1829"
        />
      </div>
      <TextbereichFeld
        form={form}
        name="zugangshinweise"
        label="Zugangshinweise"
        rows={3}
        hinweis="Sieht der Mitarbeiter in der App, z. B. Code Hintereingang, Parken im Hof"
      />
      <TextFeld
        form={form}
        name="schluessel"
        label="Schlüssel"
        hinweis="z. B. Schlüssel Nr. 14 im Tresor"
      />
      <TextbereichFeld form={form} name="notiz" label="Interne Notiz" rows={2} />
      <KontrollkaestchenFeld form={form} name="aktiv" label="Aktiv" />
      <div>
        <Button type="submit" disabled={laeuft}>
          {laeuft ? "Speichern …" : id ? "Speichern" : "Objekt anlegen"}
        </Button>
      </div>
    </form>
  );
}
