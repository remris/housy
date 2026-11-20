"use client";

import { FormularDialog } from "@/components/aktion-knoepfe";
import {
  AuswahlFeld,
  Formfehler,
  TextFeld,
  useAktionsFormular,
} from "@/components/formular/formular";
import { Button } from "@/components/ui/button";
import { zeitKorrigieren, zeitNachtragen, zeitStornieren } from "@/lib/aktionen/rueckmeldungen";
import {
  BUCHUNGSARTEN,
  zeitKorrekturSchema,
  zeitNachtragSchema,
  zeitStornoSchema,
} from "@/lib/schemas/rueckmeldung";

export function BuchungAendern({
  id,
  datum,
  uhrzeit,
}: {
  id: string;
  datum: string;
  uhrzeit: string;
}) {
  return (
    <div className="flex gap-1">
      <FormularDialog
        titel="Zeit korrigieren"
        ausloeser={
          <Button size="xs" variant="ghost">
            Korrigieren
          </Button>
        }
      >
        {(fertig) => <Korrektur id={id} datum={datum} uhrzeit={uhrzeit} fertig={fertig} />}
      </FormularDialog>
      <FormularDialog
        titel="Buchung stornieren"
        ausloeser={
          <Button size="xs" variant="ghost">
            Stornieren
          </Button>
        }
      >
        {(fertig) => <Storno id={id} fertig={fertig} />}
      </FormularDialog>
    </div>
  );
}

function Korrektur({
  id,
  datum,
  uhrzeit,
  fertig,
}: {
  id: string;
  datum: string;
  uhrzeit: string;
  fertig: () => void;
}) {
  const { form, absenden, serverFehler, laeuft } = useAktionsFormular(zeitKorrekturSchema, {
    standard: { id, datum, uhrzeit, grund: "" },
    aktion: zeitKorrigieren,
    erfolg: fertig,
  });
  return (
    <form onSubmit={absenden} className="flex flex-col gap-3">
      <Formfehler text={serverFehler} />
      <div className="grid grid-cols-2 gap-3">
        <TextFeld form={form} name="datum" label="Datum" type="date" />
        <TextFeld form={form} name="uhrzeit" label="Uhrzeit" type="time" />
      </div>
      <TextFeld form={form} name="grund" label="Grund" placeholder="z. B. Check-out vergessen" />
      <Button type="submit" disabled={laeuft}>
        Korrigieren
      </Button>
    </form>
  );
}

function Storno({ id, fertig }: { id: string; fertig: () => void }) {
  const { form, absenden, serverFehler, laeuft } = useAktionsFormular(zeitStornoSchema, {
    standard: { id, grund: "" },
    aktion: zeitStornieren,
    erfolg: fertig,
  });
  return (
    <form onSubmit={absenden} className="flex flex-col gap-3">
      <Formfehler text={serverFehler} />
      <TextFeld form={form} name="grund" label="Grund" placeholder="z. B. doppelt gebucht" />
      <Button type="submit" variant="destructive" disabled={laeuft}>
        Stornieren
      </Button>
    </form>
  );
}

export function Nachtragen({
  mitgliedId,
  datum,
  einsaetze,
}: {
  mitgliedId: string;
  datum: string;
  einsaetze: { wert: string; text: string }[];
}) {
  return (
    <FormularDialog
      titel="Buchung nachtragen"
      ausloeser={<Button size="sm">Buchung nachtragen</Button>}
    >
      {(fertig) => (
        <NachtragFormular
          mitgliedId={mitgliedId}
          datum={datum}
          einsaetze={einsaetze}
          fertig={fertig}
        />
      )}
    </FormularDialog>
  );
}

function NachtragFormular({
  mitgliedId,
  datum,
  einsaetze,
  fertig,
}: {
  mitgliedId: string;
  datum: string;
  einsaetze: { wert: string; text: string }[];
  fertig: () => void;
}) {
  const { form, absenden, serverFehler, laeuft } = useAktionsFormular(zeitNachtragSchema, {
    standard: {
      mitglied_id: mitgliedId,
      art: "checkin",
      einsatz_id: null,
      datum,
      uhrzeit: "07:00",
      grund: "",
    },
    aktion: zeitNachtragen,
    erfolg: fertig,
  });
  return (
    <form onSubmit={absenden} className="flex flex-col gap-3">
      <Formfehler text={serverFehler} />
      <AuswahlFeld form={form} name="art" label="Art" optionen={BUCHUNGSARTEN} />
      <AuswahlFeld
        form={form}
        name="einsatz_id"
        label="Einsatz"
        leer="– ohne (nur bei Pausen) –"
        optionen={einsaetze}
      />
      <div className="grid grid-cols-2 gap-3">
        <TextFeld form={form} name="datum" label="Datum" type="date" />
        <TextFeld form={form} name="uhrzeit" label="Uhrzeit" type="time" />
      </div>
      <TextFeld form={form} name="grund" label="Grund" placeholder="z. B. Handy vergessen" />
      <Button type="submit" disabled={laeuft}>
        Nachtragen
      </Button>
    </form>
  );
}
