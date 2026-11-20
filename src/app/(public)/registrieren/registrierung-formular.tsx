"use client";

import { useState } from "react";
import {
  Formfehler,
  MehrfachAuswahlFeld,
  TextFeld,
  useAktionsFormular,
} from "@/components/formular/formular";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { registrieren } from "@/lib/aktionen/konto";
import { BRANCHEN, registrierungSchema } from "@/lib/schemas/konto";

export function RegistrierungFormular() {
  const [erledigt, setErledigt] = useState<string | null>(null);
  const { form, absenden, serverFehler, laeuft } = useAktionsFormular(registrierungSchema, {
    standard: { betriebName: "", anzeigename: "", email: "", passwort: "", branchen: [] },
    aktion: registrieren,
    erfolg: (e) => setErledigt(e.meldung ?? "Registrierung erfolgreich."),
  });

  if (erledigt) {
    return (
      <Alert>
        <AlertDescription>{erledigt}</AlertDescription>
      </Alert>
    );
  }

  return (
    <form onSubmit={absenden} className="flex flex-col gap-4" noValidate>
      <Formfehler text={serverFehler} />
      <TextFeld
        form={form}
        name="betriebName"
        label="Name des Betriebs"
        autoComplete="organization"
      />
      <MehrfachAuswahlFeld form={form} name="branchen" label="Branche(n)" optionen={BRANCHEN} />
      <TextFeld form={form} name="anzeigename" label="Dein Name" autoComplete="name" />
      <TextFeld form={form} name="email" label="E-Mail" type="email" autoComplete="email" />
      <TextFeld
        form={form}
        name="passwort"
        label="Passwort"
        type="password"
        autoComplete="new-password"
        hinweis="Mindestens 8 Zeichen"
      />
      <Button type="submit" disabled={laeuft}>
        {laeuft ? "Wird angelegt …" : "Kostenlos testen"}
      </Button>
      <p className="text-muted-foreground text-xs">30 Tage kostenlos, keine Zahlungsdaten nötig.</p>
    </form>
  );
}
