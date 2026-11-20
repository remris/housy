"use client";

import { FormularDialog, LoeschenKnopf } from "@/components/aktion-knoepfe";
import {
  AuswahlFeld,
  Formfehler,
  KontrollkaestchenFeld,
  TextFeld,
  useAktionsFormular,
} from "@/components/formular/formular";
import { Button } from "@/components/ui/button";
import { preisLoeschen, preisSpeichern } from "@/lib/aktionen/vorlagen";
import { centZuEingabe } from "@/lib/schemas/helfer";
import { PREISEINHEITEN, preisSchema } from "@/lib/schemas/vorlage";

export type PreisZeile = {
  id: string;
  name: string;
  beschreibung: string | null;
  einheit: "pauschal" | "stunde" | "m2" | "fenster" | "stueck" | "einsatz";
  preis_cent: number;
  ust_satz: number;
  sonderleistung: boolean;
  vorlage_id: string | null;
  aktiv: boolean;
};

type Vorlage = { id: string; name: string };

function PreisFormular({
  wert,
  vorlagen,
  fertig,
}: {
  wert?: PreisZeile;
  vorlagen: Vorlage[];
  fertig: () => void;
}) {
  const { form, absenden, serverFehler, laeuft } = useAktionsFormular(preisSchema, {
    standard: {
      id: wert?.id,
      name: wert?.name ?? "",
      beschreibung: wert?.beschreibung ?? "",
      einheit: wert?.einheit ?? "pauschal",
      preis_cent: centZuEingabe(wert?.preis_cent),
      ust_satz: wert?.ust_satz ?? 19,
      sonderleistung: wert?.sonderleistung ?? false,
      vorlage_id: wert?.vorlage_id ?? null,
      aktiv: wert?.aktiv ?? true,
    },
    aktion: preisSpeichern,
    erfolg: fertig,
  });
  return (
    <form onSubmit={absenden} className="flex flex-col gap-4" noValidate>
      <Formfehler text={serverFehler} />
      <TextFeld form={form} name="name" label="Bezeichnung" autoFocus={!wert} />
      <div className="grid gap-4 sm:grid-cols-3">
        <TextFeld form={form} name="preis_cent" label="Preis netto (€)" inputMode="decimal" />
        <AuswahlFeld form={form} name="einheit" label="Einheit" optionen={PREISEINHEITEN} />
        <AuswahlFeld
          form={form}
          name="ust_satz"
          label="USt."
          zahl
          optionen={[
            { wert: "19", text: "19 %" },
            { wert: "7", text: "7 %" },
            { wert: "0", text: "0 %" },
          ]}
        />
      </div>
      <AuswahlFeld
        form={form}
        name="vorlage_id"
        label="Auftragsvorlage"
        leer="– keine –"
        hinweis="Checkliste, Sollzeit und Material für diese Leistung"
        optionen={vorlagen.map((v) => ({ wert: v.id, text: v.name }))}
      />
      <TextFeld form={form} name="beschreibung" label="Beschreibung (für Angebote)" />
      <KontrollkaestchenFeld
        form={form}
        name="sonderleistung"
        label="Sonderleistung"
        hinweis="Kann vor Ort von Mitarbeitern hinzugefügt werden (Nachtrag)."
      />
      <KontrollkaestchenFeld form={form} name="aktiv" label="Aktiv" />
      <Button type="submit" disabled={laeuft}>
        Speichern
      </Button>
    </form>
  );
}

export function NeuerPreis({ vorlagen }: { vorlagen: Vorlage[] }) {
  return (
    <FormularDialog titel="Neuer Preis" ausloeser={<Button>Neuer Preis</Button>}>
      {(s) => <PreisFormular vorlagen={vorlagen} fertig={s} />}
    </FormularDialog>
  );
}

export function PreisAktionen({ preis, vorlagen }: { preis: PreisZeile; vorlagen: Vorlage[] }) {
  return (
    <div className="flex justify-end gap-1">
      <FormularDialog
        titel="Preis bearbeiten"
        ausloeser={
          <Button size="sm" variant="ghost">
            Bearbeiten
          </Button>
        }
      >
        {(s) => <PreisFormular wert={preis} vorlagen={vorlagen} fertig={s} />}
      </FormularDialog>
      <LoeschenKnopf aktion={() => preisLoeschen(preis.id)} frage={`„${preis.name}“ löschen?`} />
    </div>
  );
}
