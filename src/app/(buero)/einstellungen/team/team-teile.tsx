"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  AuswahlFeld,
  Formfehler,
  TextFeld,
  auswahlKlasse,
  useAktionsFormular,
} from "@/components/formular/formular";
import { Button } from "@/components/ui/button";
import { einladen, einladungLoeschen, mitgliedAendern } from "@/lib/aktionen/betrieb";
import type { AktionErgebnis } from "@/lib/aktion";
import { SPRACHEN, einladungSchema } from "@/lib/schemas/konto";

type Rolle = "inhaber" | "disponent" | "mitarbeiter";
const ROLLEN = [
  { wert: "mitarbeiter", text: "Mitarbeiter" },
  { wert: "disponent", text: "Disponent" },
  { wert: "inhaber", text: "Inhaber" },
] as const;

function melde(e: AktionErgebnis<unknown>) {
  if (e.ok) toast.success(e.meldung ?? "Gespeichert.");
  else toast.error(e.fehler);
}

export function EinladungFormular() {
  const [link, setLink] = useState<string | null>(null);
  const { form, absenden, serverFehler, laeuft } = useAktionsFormular(einladungSchema, {
    standard: { email: "", rolle: "mitarbeiter", sprache: "de" },
    aktion: einladen,
    erfolg: (e) => {
      setLink(e.daten && !e.daten.mailVerschickt ? e.daten.link : null);
      form.reset();
    },
  });
  return (
    <div className="flex flex-col gap-3">
      <form
        onSubmit={absenden}
        className="grid items-start gap-3 sm:grid-cols-[1fr_10rem_9rem_auto]"
        noValidate
      >
        <TextFeld form={form} name="email" label="E-Mail" type="email" />
        <AuswahlFeld form={form} name="rolle" label="Rolle" optionen={ROLLEN} />
        <AuswahlFeld form={form} name="sprache" label="App-Sprache" optionen={SPRACHEN} />
        <Button type="submit" disabled={laeuft} className="sm:mt-6">
          Einladen
        </Button>
      </form>
      <Formfehler text={serverFehler} />
      {link && (
        <div className="bg-muted/40 flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm">
          <span className="break-all">{link}</span>
          <LinkKopieren link={link} />
        </div>
      )}
    </div>
  );
}

export function LinkKopieren({ link }: { link: string }) {
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={async () => {
        await navigator.clipboard.writeText(link);
        toast.success("Link kopiert.");
      }}
    >
      Link kopieren
    </Button>
  );
}

export function EinladungLoeschenKnopf({ id }: { id: string }) {
  const [laeuft, starte] = useTransition();
  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      disabled={laeuft}
      onClick={() => starte(async () => melde(await einladungLoeschen(id)))}
    >
      Löschen
    </Button>
  );
}

export function MitgliedAktionen({
  id,
  rolle,
  aktiv,
}: {
  id: string;
  rolle: Rolle;
  aktiv: boolean;
}) {
  const [laeuft, starte] = useTransition();
  return (
    <div className="flex items-center justify-end gap-2">
      <select
        aria-label="Rolle"
        className={`${auswahlKlasse} w-36`}
        defaultValue={rolle}
        disabled={laeuft}
        onChange={(e) =>
          starte(async () => melde(await mitgliedAendern(id, { rolle: e.target.value as Rolle })))
        }
      >
        {ROLLEN.map((r) => (
          <option key={r.wert} value={r.wert}>
            {r.text}
          </option>
        ))}
      </select>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={laeuft}
        onClick={() => starte(async () => melde(await mitgliedAendern(id, { aktiv: !aktiv })))}
      >
        {aktiv ? "Deaktivieren" : "Aktivieren"}
      </Button>
    </div>
  );
}
