import type { Metadata } from "next";
import Link from "next/link";
import { Seitenkopf } from "@/components/seitenkopf";
import { Badge } from "@/components/ui/badge";
import { formatDatum, heuteIso } from "@/domain/datum";
import { formatEuro } from "@/domain/geld";
import { bueroKontext } from "@/lib/auth";
import { ANGEBOTSSTATUS } from "@/lib/schemas/anfrage";
import { NeuesAngebot } from "./angebot-teile";

export const metadata: Metadata = { title: "Angebote" };

const TON = {
  ok: "default",
  warn: "outline",
  fehler: "destructive",
  neutral: "secondary",
} as const;

export default async function AngeboteSeite() {
  const k = await bueroKontext();
  const heute = heuteIso();
  const { data: angebote } = await k.supabase
    .from("angebot")
    .select(
      "id, nummer, titel, status, empfaenger_name, empfaenger_firma, gueltig_bis, abrechnungsart, pauschale_cent, versendet_am, erstellt_am, vertrag_id",
    )
    .eq("betrieb_id", k.betriebId)
    .order("nummer", { ascending: false })
    .limit(200);
  return (
    <div className="flex max-w-4xl flex-col gap-5">
      <Seitenkopf
        titel="Angebote"
        beschreibung="Aus Vorlagen und Preisliste; der Kunde nimmt per Link an, dann entstehen Kunde, Objekt und Vertragsentwurf."
        aktionen={<NeuesAngebot />}
      />
      {!angebote?.length ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
          Noch keine Angebote. Tipp: unter „Anfragen“ mit einem Klick aus einer Anfrage erstellen.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border" data-angebote>
          {angebote.map((a) => {
            const abgelaufen = a.status === "versendet" && a.gueltig_bis && a.gueltig_bis < heute;
            const st = ANGEBOTSSTATUS[a.status] ?? { text: a.status, ton: "neutral" as const };
            return (
              <li key={a.id} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
                <Link href={`/angebote/${a.id}`} className="w-16 font-medium hover:underline">
                  Nr. {a.nummer}
                </Link>
                <span className="min-w-48 flex-1">
                  <Link href={`/angebote/${a.id}`} className="hover:underline">
                    {a.titel}
                  </Link>
                  <span className="text-muted-foreground block text-xs">
                    {a.empfaenger_firma || a.empfaenger_name}
                    {a.versendet_am
                      ? ` · verschickt ${formatDatum(a.versendet_am.slice(0, 10))}`
                      : ""}
                    {a.gueltig_bis ? ` · gültig bis ${formatDatum(a.gueltig_bis)}` : ""}
                  </span>
                </span>
                {a.abrechnungsart === "pauschale" && a.pauschale_cent !== null && (
                  <span className="tabular-nums">{formatEuro(a.pauschale_cent)}/Monat</span>
                )}
                <Badge variant={abgelaufen ? "destructive" : TON[st.ton]}>
                  {abgelaufen ? "abgelaufen" : st.text}
                </Badge>
                {a.vertrag_id && (
                  <Link href={`/vertraege/${a.vertrag_id}`} className="underline">
                    Vertrag
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
