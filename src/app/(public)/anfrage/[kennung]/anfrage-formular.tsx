"use client";

import { useState } from "react";
import {
  AuswahlFeld,
  Formfehler,
  TextFeld,
  TextbereichFeld,
  useAktionsFormular,
} from "@/components/formular/formular";
import { Button } from "@/components/ui/button";
import { anfrageSenden } from "@/lib/aktionen/oeffentlich";
import { oeffentlicheAnfrageSchema } from "@/lib/schemas/anfrage";

const KUNDENTYPEN = [
  { wert: "privat", text: "Privat" },
  { wert: "firma", text: "Firma" },
  { wert: "verwaltung", text: "Hausverwaltung" },
  { wert: "oeffentlich", text: "Öffentliche Einrichtung" },
];

const LEISTUNGEN = [
  { wert: "Unterhaltsreinigung", text: "Unterhaltsreinigung (Büro, Praxis …)" },
  { wert: "Treppenhausreinigung", text: "Treppenhausreinigung" },
  { wert: "Fensterreinigung", text: "Fensterreinigung" },
  { wert: "Grundreinigung", text: "Grund- oder Sonderreinigung" },
  { wert: "Hausmeisterservice", text: "Hausmeisterservice / Winterdienst" },
  { wert: "Sonstiges", text: "Sonstiges" },
];

export function AnfrageFormular({
  kennung,
  datenschutzUrl,
}: {
  kennung: string;
  datenschutzUrl: string | null;
}) {
  const [gesendet, setGesendet] = useState(false);
  const { form, absenden, serverFehler, laeuft } = useAktionsFormular(oeffentlicheAnfrageSchema, {
    standard: {
      kundentyp: "privat",
      name: "",
      firma: "",
      email: "",
      telefon: "",
      strasse: "",
      plz: "",
      ort: "",
      leistung: "Unterhaltsreinigung",
      nachricht: "",
      wunschtermin: "",
      website: "",
    },
    aktion: (d) => anfrageSenden(kennung, d),
    erfolg: () => setGesendet(true),
  });
  const typ = form.watch("kundentyp");

  if (gesendet) {
    return (
      <p
        className="rounded-md bg-emerald-50 p-4 text-sm text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"
        data-anfrage-gesendet
      >
        Vielen Dank für Ihre Anfrage! Wir melden uns schnellstmöglich bei Ihnen.
      </p>
    );
  }
  return (
    <form onSubmit={absenden} className="flex flex-col gap-4" noValidate>
      <Formfehler text={serverFehler} />
      <div className="grid gap-4 sm:grid-cols-2">
        <AuswahlFeld form={form} name="kundentyp" label="Sie sind" optionen={KUNDENTYPEN} />
        <AuswahlFeld
          form={form}
          name="leistung"
          label="Gewünschte Leistung"
          optionen={LEISTUNGEN}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextFeld form={form} name="name" label="Ihr Name" autoComplete="name" />
        {typ !== "privat" && (
          <TextFeld
            form={form}
            name="firma"
            label="Firma / Verwaltung"
            autoComplete="organization"
          />
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextFeld form={form} name="email" label="E-Mail" type="email" autoComplete="email" />
        <TextFeld form={form} name="telefon" label="Telefon" type="tel" autoComplete="tel" />
      </div>
      <TextFeld
        form={form}
        name="strasse"
        label="Straße des Objekts"
        autoComplete="street-address"
      />
      <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
        <TextFeld
          form={form}
          name="plz"
          label="PLZ"
          inputMode="numeric"
          autoComplete="postal-code"
        />
        <TextFeld form={form} name="ort" label="Ort" autoComplete="address-level2" />
      </div>
      <TextbereichFeld
        form={form}
        name="nachricht"
        label="Ihre Nachricht"
        rows={4}
        hinweis="z. B. Größe (m², Fensteranzahl), gewünschter Rhythmus, Besonderheiten"
      />
      <TextFeld form={form} name="wunschtermin" label="Ab wann? (optional)" />
      {/* Honigtopf gegen Bots – für Menschen unsichtbar */}
      <input
        type="text"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden
        className="absolute -left-[9999px] h-0 w-0 opacity-0"
        {...form.register("website")}
      />
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-0.5 size-4" {...form.register("datenschutz")} />
        <span>
          Ich bin einverstanden, dass meine Angaben zur Bearbeitung der Anfrage gespeichert werden.
          {datenschutzUrl && (
            <>
              {" "}
              <a href={datenschutzUrl} target="_blank" rel="noreferrer" className="underline">
                Datenschutzerklärung
              </a>
            </>
          )}
          {form.formState.errors.datenschutz && (
            <span className="text-destructive block">Bitte zustimmen</span>
          )}
        </span>
      </label>
      <Button type="submit" disabled={laeuft}>
        {laeuft ? "Wird gesendet …" : "Anfrage senden"}
      </Button>
    </form>
  );
}
