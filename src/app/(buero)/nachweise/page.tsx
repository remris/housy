import type { Metadata } from "next";
import Link from "next/link";
import { Seitenkopf } from "@/components/seitenkopf";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDatum, heuteIso } from "@/domain/datum";
import { istMonat, monatVon, monatsZeitraum, monatsname, plusMonat } from "@/domain/nachweis";
import { bueroKontext } from "@/lib/auth";
import { NACHWEISVERSAND } from "@/lib/schemas/kunde";
import { NACHWEISSTATUS } from "@/lib/schemas/nachweis";
import { EinsatzNachweisKnoepfe, MonatsnachweisFormular, NachweisKnoepfe } from "./nachweis-teile";

export const metadata: Metadata = { title: "Nachweise" };

const TON = {
  ok: "default",
  warn: "outline",
  fehler: "destructive",
  neutral: "secondary",
} as const;

const versandText = (v: string) => NACHWEISVERSAND.find((x) => x.wert === v)?.text ?? v;

export default async function NachweiseSeite({
  searchParams,
}: {
  searchParams: Promise<{ monat?: string }>;
}) {
  const { monat: m } = await searchParams;
  const monat = m && istMonat(m) ? m : monatVon(heuteIso());
  const { von, bis } = monatsZeitraum(monat);
  const k = await bueroKontext();

  const [{ data: nachweise }, { data: erledigt }, { data: einstellung }] = await Promise.all([
    k.supabase
      .from("nachweis")
      .select(
        "id, art, von, bis, status, fehler, empfaenger, gesendet_am, pdf_pfad, kunde(name), objekt(id, name)",
      )
      .eq("betrieb_id", k.betriebId)
      .gte("von", von)
      .lte("von", bis)
      .order("von", { ascending: false })
      .order("erstellt_am", { ascending: false }),
    k.supabase
      .from("einsatz")
      .select(
        "id, datum, objekt(id, name, kunde(name, nachweis_versand)), auftragsvorlage(name), nachweis(id)",
      )
      .eq("betrieb_id", k.betriebId)
      .eq("status", "erledigt")
      .gte("datum", von)
      .lte("datum", bis)
      .order("datum", { ascending: false }),
    k.supabase.from("betrieb").select("nachweis_kopie").eq("id", k.betriebId).single(),
  ]);

  const ohneNachweis = (erledigt ?? []).filter((e) => e.nachweis.length === 0);
  const objekte = new Map<string, string>();
  for (const e of erledigt ?? []) {
    if (e.objekt) objekte.set(e.objekt.id, `${e.objekt.name} (${e.objekt.kunde?.name ?? ""})`);
  }
  const link = (x: string) => `/nachweise?monat=${x}`;

  return (
    <div className="flex flex-col gap-6">
      <Seitenkopf
        titel="Nachweise"
        beschreibung={
          <>
            Leistungsnachweise als PDF. Nach jedem Einsatz oder zum Monatsanfang automatisch an den
            Kunden (Einstellung je Kunde)
            {einstellung?.nachweis_kopie ? ", Kopie an die Firmen-E-Mail" : ""}.{" "}
            <Link href="/einstellungen/nachweise" className="underline">
              Einstellungen
            </Link>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<Link href={link(plusMonat(monat, -1))} />}
        >
          ← Vormonat
        </Button>
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<Link href={link(monatVon(heuteIso()))} />}
        >
          Dieser Monat
        </Button>
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<Link href={link(plusMonat(monat, 1))} />}
        >
          Nächster Monat →
        </Button>
        <h2 className="ml-2 font-medium">{monatsname(monat)}</h2>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">
          Erstellte Nachweise <Badge variant="secondary">{nachweise?.length ?? 0}</Badge>
        </h2>
        {!nachweise?.length ? (
          <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
            In diesem Monat wurden noch keine Nachweise erstellt.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border" data-nachweise>
            {nachweise.map((n) => {
              const st = NACHWEISSTATUS[n.status] ?? { text: n.status, ton: "neutral" as const };
              return (
                <li
                  key={n.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm"
                >
                  <span className="w-40 shrink-0 font-medium">
                    {n.art === "monat" ? monatsname(n.von.slice(0, 7)) : formatDatum(n.von)}
                  </span>
                  <span className="min-w-48 flex-1">
                    <Link href={`/objekte/${n.objekt?.id}`} className="hover:underline">
                      {n.objekt?.name}
                    </Link>
                    <span className="text-muted-foreground"> · {n.kunde?.name}</span>
                    {n.art === "monat" && <span className="text-muted-foreground"> · Monat</span>}
                  </span>
                  <span className="flex flex-col">
                    <Badge variant={TON[st.ton]}>{st.text}</Badge>
                  </span>
                  <span className="text-muted-foreground min-w-40 text-xs">
                    {n.gesendet_am
                      ? `${n.empfaenger.join(", ")} · ${new Date(n.gesendet_am).toLocaleString("de-DE", { timeZone: "Europe/Berlin", dateStyle: "short", timeStyle: "short" })}`
                      : (n.fehler ?? "")}
                  </span>
                  <span className="ml-auto flex gap-1">
                    {n.pdf_pfad && (
                      <Button
                        size="sm"
                        variant="ghost"
                        nativeButton={false}
                        render={
                          <a href={`/nachweise/${n.id}/pdf`} target="_blank" rel="noreferrer" />
                        }
                      >
                        PDF
                      </Button>
                    )}
                    <NachweisKnoepfe id={n.id} gesendet={n.status === "gesendet"} />
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">
          Erledigte Einsätze ohne Nachweis <Badge variant="secondary">{ohneNachweis.length}</Badge>
        </h2>
        <p className="text-muted-foreground text-sm">
          Kunden mit Monatsnachweis oder ohne automatischen Versand erscheinen hier; Nachweise je
          Einsatz entstehen sonst beim Auschecken (bei fehlendem Netz spätestens am Abend).
        </p>
        {ohneNachweis.length > 0 && (
          <ul className="divide-y rounded-lg border">
            {ohneNachweis.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
                <span className="w-24 shrink-0">{formatDatum(e.datum)}</span>
                <span className="flex-1">
                  {e.objekt?.name}
                  <span className="text-muted-foreground">
                    {" "}
                    · {e.auftragsvorlage?.name} · {e.objekt?.kunde?.name} (
                    {versandText(e.objekt?.kunde?.nachweis_versand ?? "")})
                  </span>
                </span>
                <span className="flex gap-1">
                  <EinsatzNachweisKnoepfe einsatzId={e.id} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">Monatsnachweis für {monatsname(monat)}</h2>
        <MonatsnachweisFormular
          monat={monat}
          objekte={[...objekte].map(([id, text]) => ({ id, text }))}
        />
      </section>
    </div>
  );
}
