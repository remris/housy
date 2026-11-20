"use client";

import { useTransition } from "react";
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
import { fehlendeKoordinatenErgaenzen } from "@/lib/aktionen/kunden";
import { fahrzeugSpeichern, tourStartSpeichern } from "@/lib/aktionen/planung";
import { fahrzeugSchema, tourStartSchema } from "@/lib/schemas/planung";

type Fahrzeug = {
  id: string;
  name: string;
  kennzeichen: string | null;
  aktiv: boolean;
  notiz: string | null;
  mitglied_id: string | null;
};
type Option = { wert: string; text: string };

export function FahrzeugDialog({
  fahrzeug,
  mitarbeiter,
}: {
  fahrzeug?: Fahrzeug;
  mitarbeiter: Option[];
}) {
  return (
    <FormularDialog
      titel={fahrzeug ? "Fahrzeug bearbeiten" : "Neues Fahrzeug"}
      ausloeser={
        <Button size="sm" variant={fahrzeug ? "ghost" : "default"}>
          {fahrzeug ? "Bearbeiten" : "Fahrzeug anlegen"}
        </Button>
      }
    >
      {(schliessen) => (
        <FahrzeugFormular fahrzeug={fahrzeug} mitarbeiter={mitarbeiter} fertig={schliessen} />
      )}
    </FormularDialog>
  );
}

function FahrzeugFormular({
  fahrzeug,
  mitarbeiter,
  fertig,
}: {
  fahrzeug?: Fahrzeug;
  mitarbeiter: Option[];
  fertig: () => void;
}) {
  const { form, absenden, serverFehler, laeuft } = useAktionsFormular(fahrzeugSchema, {
    standard: {
      name: fahrzeug?.name ?? "",
      kennzeichen: fahrzeug?.kennzeichen ?? "",
      notiz: fahrzeug?.notiz ?? "",
      aktiv: fahrzeug?.aktiv ?? true,
      mitglied_id: fahrzeug?.mitglied_id ?? null,
    },
    aktion: (d) => fahrzeugSpeichern(fahrzeug?.id ?? null, d),
    erfolg: fertig,
  });
  return (
    <form onSubmit={absenden} className="flex flex-col gap-3">
      <Formfehler text={serverFehler} />
      <TextFeld form={form} name="name" label="Bezeichnung" placeholder="Caddy weiß" />
      <TextFeld form={form} name="kennzeichen" label="Kennzeichen" placeholder="S-HY 123" />
      <AuswahlFeld
        form={form}
        name="mitglied_id"
        label="Standardfahrer"
        leer="– keiner –"
        optionen={mitarbeiter}
        hinweis="Material wird bei seinen Einsätzen aus diesem Fahrzeug abgebucht, wenn die Tour kein anderes nennt."
      />
      <TextFeld form={form} name="notiz" label="Notiz" />
      <KontrollkaestchenFeld form={form} name="aktiv" label="aktiv (in Touren wählbar)" />
      <Button type="submit" disabled={laeuft}>
        Speichern
      </Button>
    </form>
  );
}

export function TourStartFormular({ tourStart }: { tourStart: string }) {
  const { form, absenden, serverFehler, laeuft } = useAktionsFormular(tourStartSchema, {
    standard: { tour_start: tourStart },
    aktion: tourStartSpeichern,
  });
  return (
    <form onSubmit={absenden} className="flex flex-wrap items-end gap-3">
      <Formfehler text={serverFehler} />
      <TextFeld
        form={form}
        name="tour_start"
        label="Übliche Abfahrt"
        type="time"
        className="w-36"
      />
      <Button type="submit" size="sm" variant="outline" disabled={laeuft}>
        Speichern
      </Button>
    </form>
  );
}

export function KoordinatenErgaenzen() {
  const [laeuft, starte] = useTransition();
  return (
    <Button
      size="sm"
      className="self-start"
      disabled={laeuft}
      onClick={() =>
        starte(async () => {
          const e = await fehlendeKoordinatenErgaenzen();
          if (e.ok) toast.success(e.meldung);
          else toast.error(e.fehler);
        })
      }
    >
      {laeuft ? "Suche Adressen …" : "Fehlende Koordinaten ergänzen"}
    </Button>
  );
}
