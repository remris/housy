"use client";

import { AuthRahmen } from "@/components/auth-rahmen";
import { Formfehler, TextFeld, useAktionsFormular } from "@/components/formular/formular";
import { Button } from "@/components/ui/button";
import { passwortSetzen } from "@/lib/aktionen/konto";
import { passwortNeuSchema } from "@/lib/schemas/konto";

export default function PasswortNeuSeite() {
  const { form, absenden, serverFehler, laeuft } = useAktionsFormular(passwortNeuSchema, {
    standard: { passwort: "", wiederholung: "" },
    aktion: passwortSetzen,
  });
  return (
    <AuthRahmen titel="Neues Passwort" beschreibung="Lege ein neues Passwort fest.">
      <form onSubmit={absenden} className="flex flex-col gap-4" noValidate>
        <Formfehler text={serverFehler} />
        <TextFeld
          form={form}
          name="passwort"
          label="Neues Passwort"
          type="password"
          autoComplete="new-password"
        />
        <TextFeld
          form={form}
          name="wiederholung"
          label="Wiederholen"
          type="password"
          autoComplete="new-password"
        />
        <Button type="submit" disabled={laeuft}>
          Speichern
        </Button>
      </form>
    </AuthRahmen>
  );
}
