import { MangelStatus } from "@/components/mangel-status";
import { Badge } from "@/components/ui/badge";
import type { BetriebKontext } from "@/lib/auth";
import { mangelstatusText } from "@/lib/schemas/nachweis";

const zeit = (iso: string) =>
  new Date(iso).toLocaleString("de-DE", {
    timeZone: "Europe/Berlin",
    dateStyle: "short",
    timeStyle: "short",
  });

/** Mängel-Liste eines Objekts mit Status (aus der Mitarbeiter-App gemeldet). */
export async function Maengel({ k, objektId }: { k: BetriebKontext; objektId: string }) {
  const { data } = await k.supabase
    .from("einsatz_meldung")
    .select(
      "id, text, status, notiz_buero, erstellt_am, erledigt_am, einsatz(datum), einsatz_foto(pfad)",
    )
    .eq("objekt_id", objektId)
    .eq("art", "mangel")
    .order("erstellt_am", { ascending: false })
    .limit(100);
  const liste = data ?? [];
  const pfade = liste.flatMap((m) => m.einsatz_foto.map((f) => f.pfad));
  const { data: signiert } = pfade.length
    ? await k.supabase.storage.from("einsatzfotos").createSignedUrls(pfade, 3600)
    : { data: [] };
  const url = new Map((signiert ?? []).map((s) => [s.path, s.signedUrl]));
  const offen = liste.filter((m) => m.status !== "erledigt").length;

  return (
    <section className="flex flex-col gap-3" data-maengel>
      <h2 className="font-medium">
        Mängel{" "}
        <Badge variant={offen > 0 ? "destructive" : "secondary"}>
          {offen > 0 ? `${offen} offen` : "keine offenen"}
        </Badge>
      </h2>
      {liste.length === 0 ? (
        <p className="text-muted-foreground text-sm">Noch keine Mängel gemeldet.</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {liste.map((m) => (
            <li key={m.id} className="flex flex-col gap-2 px-3 py-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{m.text}</span>
                <span className="text-muted-foreground">
                  gemeldet {zeit(m.erstellt_am)}
                  {m.erledigt_am ? ` · erledigt ${zeit(m.erledigt_am)}` : ""}
                </span>
                <Badge variant="outline" className="ml-auto">
                  {mangelstatusText(m.status)}
                </Badge>
              </div>
              {m.einsatz_foto.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {m.einsatz_foto.map((f) =>
                    url.get(f.pfad) ? (
                      <a key={f.pfad} href={url.get(f.pfad)!} target="_blank" rel="noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element -- signierte Storage-URL */}
                        <img
                          src={url.get(f.pfad)!}
                          alt="Foto zum Mangel"
                          className="size-20 rounded object-cover"
                        />
                      </a>
                    ) : null,
                  )}
                </div>
              )}
              <MangelStatus id={m.id} status={m.status} notiz={m.notiz_buero} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
