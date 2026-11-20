import type { Metadata } from "next";
import Link from "next/link";
import { AuthRahmen } from "@/components/auth-rahmen";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LoginFormular } from "./login-formular";

export const metadata: Metadata = { title: "Anmelden" };

export default async function LoginSeite({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; fehler?: string }>;
}) {
  const { next, fehler } = await searchParams;
  return (
    <AuthRahmen
      titel="Anmelden"
      beschreibung="Willkommen zurück bei Housy."
      fuss={
        <>
          Noch kein Konto?{" "}
          <Link href="/registrieren" className="underline">
            Betrieb registrieren
          </Link>
        </>
      }
    >
      {fehler === "link" && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>Der Link ist abgelaufen oder ungültig.</AlertDescription>
        </Alert>
      )}
      <LoginFormular next={next} />
    </AuthRahmen>
  );
}
