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
import {
  lebensdauerUebernehmen,
  pruefungErfassen,
  werkzeugAusmustern,
  werkzeugGewechselt,
  werkzeugSpeichern,
} from "@/lib/aktionen/inventar";
import { pruefungSchema, wechselSchema, werkzeugSchema } from "@/lib/schemas/inventar";

type Option = { wert: string; text: string };

export type WerkzeugWerte = {
  id: string;
  artikel_id: string;
  bezeichnung: string;
  mitglied_id: string | null;
  fahrzeug_id: string | null;
  startstand: number;
  naechste_pruefung: string | null;
};

const jetztLokal = () => {
  const d = new Date();
  const z = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`;
};

export function WerkzeugDialog({
  werkzeug,
  artikel,
  mitarbeiter,
  fahrzeuge,
}: {
  werkzeug?: WerkzeugWerte;
  artikel: Option[];
  mitarbeiter: Option[];
  fahrzeuge: Option[];
}) {
  return (
    <FormularDialog
      titel={werkzeug ? "Werkzeug bearbeiten" : "Werkzeug oder Gerät anlegen"}
      ausloeser={
        <Button size="sm" variant={werkzeug ? "ghost" : "default"}>
          {werkzeug ? "Bearbeiten" : "Werkzeug anlegen"}
        </Button>
      }
    >
      {(schliessen) => (
        <WerkzeugFormular
          werkzeug={werkzeug}
          artikel={artikel}
          mitarbeiter={mitarbeiter}
          fahrzeuge={fahrzeuge}
          fertig={schliessen}
        />
      )}
    </FormularDialog>
  );
}

function WerkzeugFormular({
  werkzeug,
  artikel,
  mitarbeiter,
  fahrzeuge,
  fertig,
}: {
  werkzeug?: WerkzeugWerte;
  artikel: Option[];
  mitarbeiter: Option[];
  fahrzeuge: Option[];
  fertig: () => void;
}) {
  const { form, absenden, serverFehler, laeuft } = useAktionsFormular(werkzeugSchema, {
    standard: {
      artikel_id: werkzeug?.artikel_id ?? "",
      bezeichnung: werkzeug?.bezeichnung ?? "",
      mitglied_id: werkzeug?.mitglied_id ?? null,
      fahrzeug_id: werkzeug?.fahrzeug_id ?? null,
      startstand: werkzeug ? String(werkzeug.startstand) : "",
      naechste_pruefung: werkzeug?.naechste_pruefung ?? "",
    },
    aktion: (d) => werkzeugSpeichern(werkzeug?.id ?? null, d),
    erfolg: fertig,
  });
  return (
    <form onSubmit={absenden} className="flex flex-col gap-3">
      <Formfehler text={serverFehler} />
      <AuswahlFeld
        form={form}
        name="artikel_id"
        label="Artikel (Verschleißteil oder Gerät)"
        leer="– wählen –"
        optionen={artikel}
      />
      <TextFeld
        form={form}
        name="bezeichnung"
        label="Bezeichnung"
        placeholder="Abzieher 45 cm, Leiter 3 m"
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <AuswahlFeld
          form={form}
          name="mitglied_id"
          label="Besitzer"
          leer="– niemand –"
          optionen={mitarbeiter}
        />
        <AuswahlFeld
          form={form}
          name="fahrzeug_id"
          label="oder Fahrzeug"
          leer="– keins –"
          optionen={fahrzeuge}
        />
      </div>
      <TextFeld
        form={form}
        name="startstand"
        label="Zählerstand jetzt"
        inputMode="decimal"
        hinweis="Nur bei Verschleiß: bisherige Nutzung seit dem letzten Wechsel, z. B. 380 Fenster."
      />
      <TextFeld
        form={form}
        name="naechste_pruefung"
        label="Nächste Prüfung"
        type="date"
        hinweis="Nur bei Geräten mit Prüfpflicht."
      />
      <Button type="submit" disabled={laeuft}>
        Speichern
      </Button>
    </form>
  );
}

export function WechselDialog({
  werkzeugId,
  lagerorte,
}: {
  werkzeugId: string;
  lagerorte: Option[];
}) {
  return (
    <FormularDialog titel="Wechsel melden" ausloeser={<Button size="sm">Gewechselt</Button>}>
      {(schliessen) => (
        <WechselFormular werkzeugId={werkzeugId} lagerorte={lagerorte} fertig={schliessen} />
      )}
    </FormularDialog>
  );
}

function WechselFormular({
  werkzeugId,
  lagerorte,
  fertig,
}: {
  werkzeugId: string;
  lagerorte: Option[];
  fertig: () => void;
}) {
  const { form, absenden, serverFehler, laeuft } = useAktionsFormular(wechselSchema, {
    standard: {
      werkzeug_id: werkzeugId,
      am: jetztLokal(),
      grund: "verschleiss",
      lagerort_id: lagerorte[0]?.wert ?? null,
    },
    aktion: werkzeugGewechselt,
    erfolg: fertig,
  });
  return (
    <form onSubmit={absenden} className="flex flex-col gap-3">
      <Formfehler text={serverFehler} />
      <TextFeld
        form={form}
        name="am"
        label="Gewechselt am"
        type="datetime-local"
        hinweis="Auch nachträglich: Der Zähler rechnet ab diesem Zeitpunkt neu."
      />
      <AuswahlFeld
        form={form}
        name="grund"
        label="Grund"
        optionen={[
          { wert: "verschleiss", text: "abgenutzt" },
          { wert: "defekt", text: "defekt (zählt nicht für die Lebensdauer)" },
        ]}
      />
      <AuswahlFeld
        form={form}
        name="lagerort_id"
        label="Ersatzteil genommen aus"
        leer="– nicht abbuchen –"
        optionen={lagerorte}
      />
      <Button type="submit" disabled={laeuft}>
        Speichern
      </Button>
    </form>
  );
}

export function PruefungDialog({ werkzeugId }: { werkzeugId: string }) {
  return (
    <FormularDialog
      titel="Prüfung erfassen"
      ausloeser={
        <Button size="sm" variant="outline">
          Geprüft
        </Button>
      }
    >
      {(schliessen) => <PruefungFormular werkzeugId={werkzeugId} fertig={schliessen} />}
    </FormularDialog>
  );
}

function PruefungFormular({ werkzeugId, fertig }: { werkzeugId: string; fertig: () => void }) {
  const { form, absenden, serverFehler, laeuft } = useAktionsFormular(pruefungSchema, {
    standard: {
      werkzeug_id: werkzeugId,
      am: new Date().toISOString().slice(0, 10),
      bestanden: true,
      notiz: "",
    },
    aktion: pruefungErfassen,
    erfolg: fertig,
  });
  return (
    <form onSubmit={absenden} className="flex flex-col gap-3">
      <Formfehler text={serverFehler} />
      <TextFeld form={form} name="am" label="Geprüft am" type="date" />
      <KontrollkaestchenFeld
        form={form}
        name="bestanden"
        label="bestanden (nächster Termin nach Prüfintervall)"
      />
      <TextFeld form={form} name="notiz" label="Notiz" placeholder="Prüfer, Prüfbericht-Nr." />
      <Button type="submit" disabled={laeuft}>
        Speichern
      </Button>
    </form>
  );
}

function melde(r: { ok: true; meldung?: string } | { ok: false; fehler: string }) {
  if (r.ok) toast.success(r.meldung ?? "Gespeichert.");
  else toast.error(r.fehler);
}

export function LebensdauerKnopf({
  artikelId,
  wert,
  text,
}: {
  artikelId: string;
  wert: number;
  text: string;
}) {
  const [laeuft, starte] = useTransition();
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={laeuft}
      onClick={() => starte(async () => melde(await lebensdauerUebernehmen(artikelId, wert)))}
    >
      {text}
    </Button>
  );
}

export function AusmusternKnopf({ id }: { id: string }) {
  const [laeuft, starte] = useTransition();
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={laeuft}
      onClick={() => {
        if (!window.confirm("Werkzeug ausmustern?")) return;
        starte(async () => melde(await werkzeugAusmustern(id)));
      }}
    >
      Ausmustern
    </Button>
  );
}
