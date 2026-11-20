"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { FormularDialog } from "@/components/aktion-knoepfe";
import {
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
};

export function FahrzeugDialog({ fahrzeug }: { fahrzeug?: Fahrzeug }) {
  return (
    <FormularDialog
      titel={fahrzeug ? "Fahrzeug bearbeiten" : "Neues Fahrzeug"}
      ausloeser={
        <Button size="sm" variant={fahrzeug ? "ghost" : "default"}>
          {fahrzeug ? "Bearbeiten" : "Fahrzeug anlegen"}
        </Button>
      }
    >
      {(schliessen) => <FahrzeugFormular fahrzeug={fahrzeug} fertig={schliessen} />}
    </FormularDialog>
  );
}

function FahrzeugFormular({ fahrzeug, fertig }: { fahrzeug?: Fahrzeug; fertig: () => void }) {
  const { form, absenden, serverFehler, laeuft } = useAktionsFormular(fahrzeugSchema, {
    standard: {
      name: fahrzeug?.name ?? "",
      kennzeichen: fahrzeug?.kennzeichen ?? "",
      notiz: fahrzeug?.notiz ?? "",
      aktiv: fahrzeug?.aktiv ?? true,
    },
    aktion: (d) => fahrzeugSpeichern(fahrzeug?.id ?? null, d),
    erfolg: fertig,
  });
  return (
    <form onSubmit={absenden} className="flex flex-col gap-3">
      <Formfehler text={serverFehler} />
      <TextFeld form={form} name="name" label="Bezeichnung" placeholder="Caddy weiß" />
      <TextFeld form={form} name="kennzeichen" label="Kennzeichen" placeholder="S-HY 123" />
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
