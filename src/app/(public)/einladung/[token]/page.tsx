import type { Metadata } from "next";
import Link from "next/link";
import { AuthRahmen } from "@/components/auth-rahmen";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ROLLEN_TEXT, aktuellerBenutzer } from "@/lib/auth";
import { EinladungAnnehmenKnopf, EinladungRegistrierung } from "./einladung-formulare";

export const metadata: Metadata = { title: "Einladung" };

export default async function EinladungSeite({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { supabase, user } = await aktuellerBenutzer();
  const gueltigesFormat = /^[0-9a-f-]{36}$/i.test(token);
  const { data } = gueltigesFormat
    ? await supabase.rpc("einladung_info", { p_token: token })
    : { data: null };
  const info = data?.[0];

  if (!info || !info.gueltig) {
    return (
      <AuthRahmen titel="Einladung">
        <Alert variant="destructive">
          <AlertDescription>
            Diese Einladung ist ungültig, abgelaufen oder wurde schon angenommen.
          </AlertDescription>
        </Alert>
      </AuthRahmen>
    );
  }

  return (
    <AuthRahmen
      titel={`Einladung zu ${info.betrieb_name}`}
      beschreibung={`Du wurdest als ${ROLLEN_TEXT[info.rolle]} eingeladen (${info.email}).`}
      fuss={
        !user && (
          <>
            Schon ein Konto?{" "}
            <Link href={`/login?next=/einladung/${token}`} className="underline">
              Anmelden
            </Link>
          </>
        )
      }
    >
      {user ? (
        user.email?.toLowerCase() === info.email.toLowerCase() ? (
          <EinladungAnnehmenKnopf token={token} />
        ) : (
          <Alert variant="destructive">
            <AlertDescription>
              Du bist als {user.email} angemeldet. Die Einladung gilt für {info.email}.
            </AlertDescription>
          </Alert>
        )
      ) : (
        <EinladungRegistrierung token={token} email={info.email} />
      )}
    </AuthRahmen>
  );
}
