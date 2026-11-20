import type { Metadata } from "next";
import Link from "next/link";
import { AuthRahmen } from "@/components/auth-rahmen";
import { RegistrierungFormular } from "./registrierung-formular";

export const metadata: Metadata = { title: "Betrieb registrieren" };

export default function RegistrierenSeite() {
  return (
    <AuthRahmen
      titel="Betrieb registrieren"
      beschreibung="Lege deinen Betrieb an. Du wirst automatisch Inhaber."
      fuss={
        <>
          Schon registriert?{" "}
          <Link href="/login" className="underline">
            Anmelden
          </Link>
        </>
      }
    >
      <RegistrierungFormular />
    </AuthRahmen>
  );
}
