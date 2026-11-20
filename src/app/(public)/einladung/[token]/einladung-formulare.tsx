"use client";

import { useState, useTransition } from "react";
import { Formfehler, TextFeld, useAktionsFormular } from "@/components/formular/formular";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { einladungAnnehmen, mitEinladungRegistrieren } from "@/lib/aktionen/konto";
import { einladungRegistrierungSchema } from "@/lib/schemas/konto";

export function EinladungAnnehmenKnopf({ token }: { token: string }) {
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, starte] = useTransition();
  return (
    <div className="flex flex-col gap-4">
      <Formfehler text={fehler} />
      <Button
        disabled={laeuft}
        onClick={() =>
          starte(async () => {
            const e = await einladungAnnehmen(token);
            if (e && !e.ok) setFehler(e.fehler);
          })
        }
      >
        Einladung annehmen
      </Button>
    </div>
  );
}

export function EinladungRegistrierung({ token, email }: { token: string; email: string }) {
  const [meldung, setMeldung] = useState<string | null>(null);
  const { form, absenden, serverFehler, laeuft } = useAktionsFormular(
    einladungRegistrierungSchema,
    {
      standard: { token, email, anzeigename: "", passwort: "" },
      aktion: mitEinladungRegistrieren,
      erfolg: (e) => setMeldung(e.meldung ?? null),
    },
  );
  if (meldung) {
    return (
      <Alert>
        <AlertDescription>{meldung}</AlertDescription>
      </Alert>
    );
  }
  return (
    <form onSubmit={absenden} className="flex flex-col gap-4" noValidate>
      <Formfehler text={serverFehler} />
      <TextFeld form={form} name="email" label="E-Mail" type="email" readOnly />
      <TextFeld form={form} name="anzeigename" label="Dein Name" autoComplete="name" />
      <TextFeld
        form={form}
        name="passwort"
        label="Passwort festlegen"
        type="password"
        autoComplete="new-password"
        hinweis="Mindestens 8 Zeichen"
      />
      <Button type="submit" disabled={laeuft}>
        Konto anlegen und beitreten
      </Button>
    </form>
  );
}
