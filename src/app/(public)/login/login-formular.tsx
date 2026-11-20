"use client";

import Link from "next/link";
import { Formfehler, TextFeld, useAktionsFormular } from "@/components/formular/formular";
import { Button } from "@/components/ui/button";
import { anmelden } from "@/lib/aktionen/konto";
import { loginSchema } from "@/lib/schemas/konto";

export function LoginFormular({ next }: { next?: string }) {
  const { form, absenden, serverFehler, laeuft } = useAktionsFormular(loginSchema, {
    standard: { email: "", passwort: "" },
    aktion: (d) => anmelden(d, next),
  });
  return (
    <form onSubmit={absenden} className="flex flex-col gap-4" noValidate>
      <Formfehler text={serverFehler} />
      <TextFeld form={form} name="email" label="E-Mail" type="email" autoComplete="email" />
      <TextFeld
        form={form}
        name="passwort"
        label="Passwort"
        type="password"
        autoComplete="current-password"
      />
      <Button type="submit" disabled={laeuft}>
        {laeuft ? "Anmelden …" : "Anmelden"}
      </Button>
      <Link href="/passwort-vergessen" className="text-muted-foreground text-sm underline">
        Passwort vergessen?
      </Link>
    </form>
  );
}
