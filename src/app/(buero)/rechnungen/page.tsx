import type { Metadata } from "next";
import Link from "next/link";
import { Seitenkopf } from "@/components/seitenkopf";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDatum, heuteIso } from "@/domain/datum";
import { pruefeERechnung } from "@/domain/erechnung";
import { formatEuro } from "@/domain/geld";
import { istMonat, monatVon, monatsZeitraum, monatsname, plusMonat } from "@/domain/nachweis";
import { EINHEIT_TEXT, type Preiseinheit } from "@/domain/rechnung";
import { bueroKontext } from "@/lib/auth";
import { stammdaten, zuDokument } from "@/lib/rechnung/dokument";
import { RECHNUNGSSTATUS } from "@/lib/schemas/rechnung";
import type { Tables } from "@/lib/supabase/database.types";
import {
  AlleFestschreiben,
  EntwurfKnoepfe,
  LaufKnopf,
  PositionDialog,
  PositionEntfernen,
  RechnungKnoepfe,
} from "./rechnung-teile";

export const metadata: Metadata = { title: "Rechnungen" };

const TON = {
  ok: "default",
  warn: "outline",
  fehler: "destructive",
  neutral: "secondary",
} as const;

export default async function RechnungenSeite({
  searchParams,
}: {
  searchParams: Promise<{ monat?: string }>;
}) {
  const { monat: m } = await searchParams;
  const heute = heuteIso();
  // Standard: Vormonat bis zum 10., danach der laufende Monat
  const monat =
    m && istMonat(m)
      ? m
      : Number(heute.slice(8, 10)) <= 10
        ? plusMonat(monatVon(heute), -1)
        : monatVon(heute);
  const { von, bis } = monatsZeitraum(monat);
  const k = await bueroKontext();

  const [{ data: entwuerfe }, { data: fest }, { data: offen }] = await Promise.all([
    k.supabase
      .from("rechnung")
      .select("*, kunde(name), objekt(name), rechnungsposition(*)")
      .eq("betrieb_id", k.betriebId)
      .eq("status", "entwurf")
      .eq("monat", monat)
      .order("brutto_cent", { ascending: false }),
    k.supabase
      .from("rechnung")
      .select(
        "id, nummer, art, status, rechnungsdatum, faellig_am, brutto_cent, gesendet_am, gesendet_an, bezahlt_am, pdf_pfad, xml_pfad, storno_grund, kunde(name), objekt(name)",
      )
      .eq("betrieb_id", k.betriebId)
      .neq("status", "entwurf")
      .or(`monat.eq.${monat},and(rechnungsdatum.gte.${von},rechnungsdatum.lte.${bis})`)
      .order("laufnummer", { ascending: false }),
    k.supabase
      .from("rechnung")
      .select("brutto_cent, faellig_am")
      .eq("betrieb_id", k.betriebId)
      .eq("status", "offen")
      .eq("art", "rechnung"),
  ]);

  // Pflichtangaben je Entwurf prüfen (XRechnung/ZUGFeRD)
  const pruefung = new Map<string, string[]>();
  for (const r of entwuerfe ?? []) {
    // zusätzliche Felder (kunde, objekt) stören zuDokument nicht
    const doc = zuDokument(
      r as unknown as Tables<"rechnung">,
      r.rechnungsposition,
      await stammdaten(k.supabase, r),
    );
    pruefung.set(r.id, pruefeERechnung(doc));
  }
  const bereit = (entwuerfe ?? []).filter((r) => (pruefung.get(r.id) ?? []).length === 0);
  const summeEntwuerfe = (entwuerfe ?? []).reduce((s, r) => s + Number(r.brutto_cent), 0);
  const offenSumme = (offen ?? []).reduce((s, r) => s + Number(r.brutto_cent), 0);
  const ueberfaellig = (offen ?? []).filter((r) => r.faellig_am && r.faellig_am < heute).length;
  const link = (x: string) => `/rechnungen?monat=${x}`;

  return (
    <div className="flex flex-col gap-6">
      <Seitenkopf
        titel={`Rechnungen für ${monatsname(monat)}`}
        beschreibung={
          <>
            Monatslauf aus Verträgen, erledigten Einsätzen und Nachträgen. Prüfen, dann mit einem
            Klick festschreiben und als E-Rechnung (ZUGFeRD, für Behörden XRechnung) senden.{" "}
            <Link href="/einstellungen/rechnungen" className="underline">
              Einstellungen
            </Link>
          </>
        }
        aktionen={
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<a href={`/rechnungen/datev?monat=${monat}`} />}
          >
            DATEV-Export {monatsname(monat)}
          </Button>
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
          render={<Link href={link(monatVon(heute))} />}
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
        <span className="text-muted-foreground ml-auto text-sm">
          Offene Posten: {formatEuro(offenSumme)} ({offen?.length ?? 0} Rechnungen
          {ueberfaellig > 0 ? `, ${ueberfaellig} überfällig` : ""})
        </span>
      </div>

      <section className="flex flex-col gap-3" data-entwuerfe>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-medium">
            Entwürfe prüfen <Badge variant="secondary">{entwuerfe?.length ?? 0}</Badge>
            {summeEntwuerfe > 0 && (
              <span className="text-muted-foreground ml-2 text-sm font-normal">
                zusammen {formatEuro(summeEntwuerfe)}
              </span>
            )}
          </h2>
          <LaufKnopf monat={monat} vorhanden={(entwuerfe?.length ?? 0) > 0} />
        </div>
        {!entwuerfe?.length ? (
          <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
            Keine Entwürfe. Der Monatslauf erstellt je Kunde und Objekt einen Entwurf.
          </p>
        ) : (
          <>
            {bereit.length > 0 && (
              <AlleFestschreiben ids={bereit.map((r) => r.id)} bereit={bereit.length} />
            )}
            <ul className="flex flex-col gap-3">
              {entwuerfe.map((r) => {
                const probleme = pruefung.get(r.id) ?? [];
                return (
                  <li
                    key={r.id}
                    className="flex flex-col gap-2 rounded-lg border p-3 text-sm"
                    data-entwurf={r.id}
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-medium">
                        {r.kunde?.name}
                        {r.objekt && (
                          <span className="text-muted-foreground"> · {r.objekt.name}</span>
                        )}
                      </span>
                      <span className="font-semibold tabular-nums">
                        {formatEuro(Number(r.brutto_cent))}
                      </span>
                    </div>
                    <table className="w-full text-sm">
                      <tbody>
                        {[...r.rechnungsposition]
                          .sort((a, b) => a.pos - b.pos)
                          .map((p) => (
                            <tr key={p.id} className="border-t align-top">
                              <td className="py-1 pr-2">
                                {p.bezeichnung}
                                {p.beschreibung && (
                                  <span className="text-muted-foreground block text-xs">
                                    {p.beschreibung}
                                  </span>
                                )}
                              </td>
                              <td className="py-1 pr-2 text-right whitespace-nowrap tabular-nums">
                                {Number(p.menge).toLocaleString("de-DE")}{" "}
                                {EINHEIT_TEXT[p.einheit as Preiseinheit]} ×{" "}
                                {formatEuro(p.einzelpreis_cent)}
                              </td>
                              <td className="py-1 text-right tabular-nums">
                                {formatEuro(p.netto_cent)}
                              </td>
                              <td className="py-1 pl-2 text-right">
                                {p.quelle !== "aufwand" && <PositionEntfernen id={p.id} />}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                    {r.lauf_hinweise.length > 0 && (
                      <ul className="rounded-md bg-amber-50 p-2 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
                        {r.lauf_hinweise.map((h) => (
                          <li key={h}>{h}</li>
                        ))}
                      </ul>
                    )}
                    {probleme.length > 0 && (
                      <ul className="rounded-md bg-red-50 p-2 text-red-900 dark:bg-red-950/40 dark:text-red-100">
                        {probleme.map((h) => (
                          <li key={h}>{h}</li>
                        ))}
                      </ul>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        nativeButton={false}
                        render={
                          <a href={`/rechnungen/${r.id}/pdf`} target="_blank" rel="noreferrer" />
                        }
                      >
                        Vorschau (PDF)
                      </Button>
                      <PositionDialog rechnungId={r.id} kleinunternehmer={r.kleinunternehmer} />
                      {probleme.length === 0 && <EntwurfKnoepfe id={r.id} />}
                      {probleme.length > 0 && (
                        <span className="text-muted-foreground self-center text-xs">
                          Erst die fehlenden Angaben ergänzen (Firmendaten bzw. Kunde).
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">
          Festgeschriebene Rechnungen <Badge variant="secondary">{fest?.length ?? 0}</Badge>
        </h2>
        {!fest?.length ? (
          <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
            Für {monatsname(monat)} noch keine.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border" data-rechnungen>
            {fest.map((r) => {
              const st = RECHNUNGSSTATUS[r.status] ?? { text: r.status, ton: "neutral" as const };
              const ueber =
                r.status === "offen" &&
                r.art === "rechnung" &&
                r.faellig_am &&
                r.faellig_am < heute;
              return (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm"
                >
                  <span className="w-32 font-medium">{r.nummer}</span>
                  <span className="min-w-40 flex-1">
                    {r.art === "storno" && <Badge variant="outline">Storno</Badge>} {r.kunde?.name}
                    {r.objekt && <span className="text-muted-foreground"> · {r.objekt.name}</span>}
                    <span className="text-muted-foreground block text-xs">
                      {formatDatum(r.rechnungsdatum)}
                      {r.art === "rechnung" && r.faellig_am
                        ? ` · fällig ${formatDatum(r.faellig_am)}`
                        : ""}
                      {r.gesendet_am
                        ? ` · gesendet an ${r.gesendet_an.join(", ")}`
                        : " · nicht gesendet"}
                      {r.bezahlt_am ? ` · bezahlt ${formatDatum(r.bezahlt_am)}` : ""}
                      {r.storno_grund ? ` · ${r.storno_grund}` : ""}
                    </span>
                  </span>
                  <span className="w-24 text-right font-medium tabular-nums">
                    {formatEuro(Number(r.brutto_cent))}
                  </span>
                  <Badge variant={ueber ? "destructive" : TON[st.ton]}>
                    {ueber ? "überfällig" : st.text}
                  </Badge>
                  <span className="ml-auto flex flex-wrap items-center gap-1">
                    {r.pdf_pfad && (
                      <Button
                        size="sm"
                        variant="ghost"
                        nativeButton={false}
                        render={
                          <a href={`/rechnungen/${r.id}/pdf`} target="_blank" rel="noreferrer" />
                        }
                      >
                        PDF
                      </Button>
                    )}
                    {r.xml_pfad && (
                      <Button
                        size="sm"
                        variant="ghost"
                        nativeButton={false}
                        render={<a href={`/rechnungen/${r.id}/xml`} />}
                      >
                        XRechnung
                      </Button>
                    )}
                    <RechnungKnoepfe
                      id={r.id}
                      status={r.status}
                      art={r.art}
                      gesendet={!!r.gesendet_am}
                      bezahltAm={r.bezahlt_am}
                      hatPdf={!!r.pdf_pfad}
                    />
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
