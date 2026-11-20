import type { Metadata } from "next";
import { AuthRahmen } from "@/components/auth-rahmen";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatDatum } from "@/domain/datum";
import { createClient } from "@/lib/supabase/server";
import { KundenUnterschrift } from "./kunden-unterschrift";

export const metadata: Metadata = { title: "Vertrag unterschreiben", robots: { index: false } };

export default async function VertragFreigabeSeite({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();
  const { data } = /^[0-9a-f-]{36}$/i.test(token)
    ? await supabase.rpc("vertrag_freigabe_info", { p_token: token })
    : { data: null };
  const info = data?.[0];

  if (!info) {
    return (
      <AuthRahmen titel="Vertrag">
        <Alert variant="destructive">
          <AlertDescription>Dieser Link ist ungültig.</AlertDescription>
        </Alert>
      </AuthRahmen>
    );
  }

  return (
    <AuthRahmen
      titel={info.titel}
      beschreibung={`${info.betrieb_name} · Vertrag ${info.vertragsnummer} · ${info.objekt_name}, Beginn ${formatDatum(info.beginn)}`}
    >
      <div className="flex flex-col gap-4">
        <a
          href={`/vertrag/${token}/pdf`}
          target="_blank"
          rel="noreferrer"
          className="text-sm underline"
        >
          Vertrag als PDF ansehen
        </a>
        {info.unterschrieben_am ? (
          <Alert>
            <AlertDescription>
              Vielen Dank – der Vertrag wurde am{" "}
              {new Date(info.unterschrieben_am).toLocaleString("de-DE", {
                timeZone: "Europe/Berlin",
              })}{" "}
              unterschrieben.
            </AlertDescription>
          </Alert>
        ) : info.status !== "entwurf" ? (
          <Alert>
            <AlertDescription>
              Dieser Vertrag kann nicht mehr online unterschrieben werden.
            </AlertDescription>
          </Alert>
        ) : (
          <KundenUnterschrift token={token} kunde={info.kunde_name} />
        )}
      </div>
    </AuthRahmen>
  );
}
