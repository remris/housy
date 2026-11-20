"use client";

import Link from "next/link";
import { useState } from "react";
import { AuthRahmen } from "@/components/auth-rahmen";
import { Formfehler, TextFeld, useAktionsFormular } from "@/components/formular/formular";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { passwortVergessen } from "@/lib/aktionen/konto";
import { passwortVergessenSchema } from "@/lib/schemas/konto";

export default function PasswortVergessenSeite() {
  const [meldung, setMeldung] = useState<string | null>(null);
  const { form, absenden, serverFehler, laeuft } = useAktionsFormular(passwortVergessenSchema, {
    standard: { email: "" },
    aktion: passwortVergessen,
    erfolg: (e) => setMeldung(e.meldung ?? null),
  });
  return (
    <AuthRahmen
      titel="Passwort vergessen"
      beschreibung="Wir schicken dir einen Link zum Zurücksetzen."
      fuss={
        <Link href="/login" className="underline">
          Zurück zur Anmeldung
        </Link>
      }
    >
      {meldung ? (
        <Alert>
          <AlertDescription>{meldung}</AlertDescription>
        </Alert>
      ) : (
        <form onSubmit={absenden} className="flex flex-col gap-4" noValidate>
          <Formfehler text={serverFehler} />
          <TextFeld form={form} name="email" label="E-Mail" type="email" autoComplete="email" />
          <Button type="submit" disabled={laeuft}>
            Link senden
          </Button>
        </form>
      )}
    </AuthRahmen>
  );
}
