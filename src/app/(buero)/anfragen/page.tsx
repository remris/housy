import type { Metadata } from "next";
import Link from "next/link";
import { Seitenkopf } from "@/components/seitenkopf";
import { Badge } from "@/components/ui/badge";
import { bueroKontext } from "@/lib/auth";
import { ANFRAGESTATUS, ANGEBOTSSTATUS, QUELLE_TEXT } from "@/lib/schemas/anfrage";
import { kundentypText } from "@/lib/schemas/kunde";
import { AnfrageKnoepfe, TelefonAnfrage } from "./anfrage-teile";

export const metadata: Metadata = { title: "Anfragen" };

const TON = {
  ok: "default",
  warn: "destructive",
  fehler: "outline",
  neutral: "secondary",
} as const;

export default async function AnfragenSeite({
  searchParams,
}: {
  searchParams: Promise<{ alle?: string }>;
}) {
  const { alle } = await searchParams;
  const k = await bueroKontext();
  let q = k.supabase
    .from("anfrage")
    .select("*, angebot(id, nummer, status), kunde(id, name)")
    .eq("betrieb_id", k.betriebId)
    .order("erstellt_am", { ascending: false })
    .limit(200);
  if (!alle) q = q.in("status", ["neu", "in_bearbeitung", "angebot"]);
  const { data: anfragen } = await q;

  return (
    <div className="flex max-w-4xl flex-col gap-5">
      <Seitenkopf
        titel="Anfragen"
        beschreibung={
          <>
            Über das Formular auf deiner Website, die Online-Buchung oder telefonisch.{" "}
            <Link href="/einstellungen/website" className="underline">
              Formular einbinden
            </Link>
          </>
        }
        aktionen={<TelefonAnfrage />}
      />
      <div className="flex gap-3 text-sm">
        <Link href="/anfragen" className={alle ? "text-muted-foreground" : "font-medium underline"}>
          Offen
        </Link>
        <Link
          href="/anfragen?alle=1"
          className={alle ? "font-medium underline" : "text-muted-foreground"}
        >
          Alle
        </Link>
      </div>
      {!anfragen?.length ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
          Keine {alle ? "" : "offenen "}Anfragen.
        </p>
      ) : (
        <ul className="flex flex-col gap-3" data-anfragen>
          {anfragen.map((a) => {
            const st = ANFRAGESTATUS[a.status] ?? { text: a.status, ton: "neutral" as const };
            const angebot = a.angebot[0];
            return (
              <li key={a.id} className="flex flex-col gap-2 rounded-lg border p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">
                    {a.name}
                    {a.firma && <span className="text-muted-foreground"> · {a.firma}</span>}
                  </span>
                  <Badge variant={TON[st.ton]}>{st.text}</Badge>
                  <Badge variant="outline">{QUELLE_TEXT[a.quelle] ?? a.quelle}</Badge>
                  <span className="text-muted-foreground ml-auto text-xs">
                    {new Date(a.erstellt_am).toLocaleString("de-DE", {
                      timeZone: "Europe/Berlin",
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </span>
                </div>
                <div className="text-muted-foreground">
                  {kundentypText(a.kundentyp)}
                  {a.leistung ? ` · ${a.leistung}` : ""}
                  {[a.strasse, [a.plz, a.ort].filter(Boolean).join(" ")].filter(Boolean).length >
                    0 &&
                    ` · ${[a.strasse, [a.plz, a.ort].filter(Boolean).join(" ")].filter(Boolean).join(", ")}`}
                  {a.wunschtermin ? ` · ${a.wunschtermin}` : ""}
                </div>
                <div>
                  {[a.email, a.telefon].filter(Boolean).map((x, i) => (
                    <span key={x}>
                      {i > 0 && " · "}
                      <a href={x!.includes("@") ? `mailto:${x}` : `tel:${x}`} className="underline">
                        {x}
                      </a>
                    </span>
                  ))}
                </div>
                {a.nachricht && <p className="whitespace-pre-line">{a.nachricht}</p>}
                <div className="flex flex-wrap items-center gap-2">
                  {angebot && (
                    <Link href={`/angebote/${angebot.id}`} className="underline">
                      Angebot {angebot.nummer} ({ANGEBOTSSTATUS[angebot.status]?.text})
                    </Link>
                  )}
                  {a.kunde && (
                    <Link href={`/kunden/${a.kunde.id}`} className="underline">
                      Kunde {a.kunde.name}
                    </Link>
                  )}
                  <AnfrageKnoepfe id={a.id} status={a.status} hatAngebot={!!angebot} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
