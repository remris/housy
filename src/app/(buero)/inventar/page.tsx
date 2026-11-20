import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { formatDatum, heuteIso } from "@/domain/datum";
import { formatMenge } from "@/domain/vorlagen";
import { bueroKontext } from "@/lib/auth";
import { type ArtikelPrognose, ladeInventar, ladeIstKorrekturen } from "@/lib/inventar";
import {
  BestellungKnoepfe,
  BestelltKnopf,
  BuchenDialog,
  IstKorrekturKnoepfe,
} from "./inventar-teile";

export const metadata: Metadata = { title: "Inventar" };

function Reichweite({ p }: { p: ArtikelPrognose }) {
  if (p.artikel.art !== "verbrauch") return <span className="text-muted-foreground">–</span>;
  const r = p.reichweite;
  if (r.tage === null) return <span className="text-muted-foreground">kein Bedarf geplant</span>;
  const knapp = r.tage < p.artikel.lieferzeit_tage + 7;
  return (
    <span className={knapp ? "font-medium text-red-700 dark:text-red-300" : undefined}>
      {r.tage === 0 ? "aufgebraucht" : `${r.tage} Tage`}
      {r.leerAm && (
        <span className="text-muted-foreground"> (leer am {formatDatum(r.leerAm)})</span>
      )}
    </span>
  );
}

const gebindeText = (p: ArtikelPrognose, gebinde: number) =>
  p.artikel.gebinde_name && Number(p.artikel.gebinde_menge) !== 1
    ? `${gebinde} × ${p.artikel.gebinde_name} (${formatMenge(gebinde * Number(p.artikel.gebinde_menge), p.artikel.einheit)})`
    : formatMenge(gebinde * Number(p.artikel.gebinde_menge), p.artikel.einheit);

export default async function InventarSeite() {
  const k = await bueroKontext();
  const heute = heuteIso();
  const [inv, abweichungen, { data: bestellungen }] = await Promise.all([
    ladeInventar(k.supabase, k.betriebId, heute),
    ladeIstKorrekturen(k.supabase, k.betriebId, heute),
    k.supabase
      .from("bestellung")
      .select("id, menge, lieferant, bestellt_am, artikel(name, einheit)")
      .eq("betrieb_id", k.betriebId)
      .eq("status", "offen")
      .order("bestellt_am"),
  ]);
  const artikelOptionen = inv.artikel.map((p) => ({ wert: p.artikel.id, text: p.artikel.name }));
  const orteOptionen = inv.lagerorte
    .filter((l) => l.aktiv)
    .map((l) => ({ wert: l.id, text: l.name }));
  const einkauf = inv.artikel.filter((p) => p.vorschlag);

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3" data-einkaufsliste>
        <h2 className="font-medium">
          Einkaufsliste <Badge variant="secondary">{einkauf.length}</Badge>
        </h2>
        <p className="text-muted-foreground text-sm">
          Lager am Mindestbestand oder Reichweite kürzer als Lieferzeit plus eine Woche.
          Bestellmenge: etwa 4 Wochen Bedarf nach Einsatzplan, damit der Mindestbestand danach
          wieder steht.
        </p>
        {einkauf.length === 0 ? (
          <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-center text-sm">
            Nichts zu bestellen.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {einkauf.map((p) => (
              <li
                key={p.artikel.id}
                className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm"
              >
                <span className="font-medium">{gebindeText(p, p.vorschlag!.gebinde)}</span>
                <span className="flex-1">
                  {p.artikel.name}
                  {p.artikel.lieferant && (
                    <span className="text-muted-foreground"> · {p.artikel.lieferant}</span>
                  )}
                  <span className="text-muted-foreground">
                    {" "}
                    · Lager {formatMenge(p.lager, p.artikel.einheit)}, Mindestbestand{" "}
                    {formatMenge(Number(p.artikel.mindestbestand), p.artikel.einheit)}
                    {p.vorschlag!.grund === "reichweite" ? " · Reichweite knapp" : ""}
                  </span>
                </span>
                <BestelltKnopf
                  artikelId={p.artikel.id}
                  menge={p.vorschlag!.menge}
                  lieferant={p.artikel.lieferant}
                />
              </li>
            ))}
          </ul>
        )}
        {bestellungen && bestellungen.length > 0 && (
          <>
            <h3 className="text-sm font-medium">Offene Bestellungen</h3>
            <ul className="divide-y rounded-lg border">
              {bestellungen.map((b) => (
                <li key={b.id} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
                  <span className="font-medium">
                    {formatMenge(Number(b.menge), b.artikel?.einheit ?? "")} {b.artikel?.name}
                  </span>
                  <span className="text-muted-foreground flex-1">
                    bestellt {formatDatum(b.bestellt_am)}
                    {b.lieferant ? ` bei ${b.lieferant}` : ""}
                  </span>
                  <BestellungKnoepfe id={b.id} />
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {abweichungen.length > 0 && (
        <section className="flex flex-col gap-3" data-abweichungen>
          <h2 className="font-medium">
            Mehr verbraucht als geplant <Badge variant="secondary">{abweichungen.length}</Badge>
          </h2>
          <p className="text-muted-foreground text-sm">
            Ein Mitarbeiter hat „leer“ gemeldet, obwohl laut Buch noch etwas da sein müsste.
            Übernimm den Ist-Wert für die betroffenen Objekte, dann rechnet die Prognose damit.
          </p>
          <ul className="flex flex-col gap-3">
            {abweichungen.map((v) => (
              <li key={v.meldungId} className="flex flex-col gap-2 rounded-lg border p-3 text-sm">
                <div>
                  <span className="font-medium">{v.artikel.name}</span> leer im {v.lagerortName}
                  {v.mitarbeiter && ` (${v.mitarbeiter})`} am{" "}
                  {formatDatum(v.gemeldetAm.slice(0, 10))}; rechnerisch noch{" "}
                  {formatMenge(v.korrektur.rechnerischRest, v.artikel.einheit)}.
                </div>
                <div>
                  Ist eher{" "}
                  <span className="font-medium">
                    {formatMenge(v.korrektur.istJeEinsatz, v.artikel.einheit)}
                  </span>{" "}
                  statt {formatMenge(v.korrektur.sollJeEinsatz, v.artikel.einheit)} je Einsatz (+
                  {Math.round(v.korrektur.abweichung * 100)} %) · Objekte:{" "}
                  {v.objekte.map((o) => o.name).join(", ")}
                </div>
                <div className="flex flex-wrap gap-2">
                  <IstKorrekturKnoepfe meldungId={v.meldungId} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-medium">Bestände und Reichweite</h2>
          <BuchenDialog artikel={artikelOptionen} lagerorte={orteOptionen} />
        </div>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[760px] text-sm" data-bestaende>
            <thead className="bg-muted/50">
              <tr>
                <th className="p-2 text-left font-medium">Artikel</th>
                <th className="p-2 text-right font-medium">Gesamt</th>
                <th className="p-2 text-left font-medium">je Lagerort</th>
                <th className="p-2 text-right font-medium">Bedarf/Woche</th>
                <th className="p-2 text-left font-medium">Reichweite</th>
                <th className="p-2" />
              </tr>
            </thead>
            <tbody>
              {inv.artikel.map((p) => (
                <tr key={p.artikel.id} className="border-t align-top">
                  <td className="p-2">
                    <span className="font-medium">{p.artikel.name}</span>
                    {p.artikel.art !== "verbrauch" && (
                      <Badge variant="outline" className="ml-2">
                        {p.artikel.art === "verschleiss" ? "Verschleiß" : "Gerät"}
                      </Badge>
                    )}
                    {p.offenBestellt > 0 && (
                      <span className="text-muted-foreground block text-xs">
                        bestellt: {formatMenge(p.offenBestellt, p.artikel.einheit)}
                      </span>
                    )}
                  </td>
                  <td
                    className={`p-2 text-right tabular-nums ${p.gesamt < 0 ? "text-red-700 dark:text-red-300" : ""}`}
                  >
                    {formatMenge(p.gesamt, p.artikel.einheit)}
                  </td>
                  <td className="text-muted-foreground p-2 text-xs">
                    {p.jeOrt
                      .filter((o) => o.menge !== 0)
                      .map((o) => `${o.name}: ${o.menge.toLocaleString("de-DE")}`)
                      .join(" · ") || "–"}
                  </td>
                  <td className="p-2 text-right tabular-nums">
                    {p.artikel.art === "verbrauch" && p.reichweite.jeWoche > 0
                      ? formatMenge(Math.round(p.reichweite.jeWoche * 100) / 100, p.artikel.einheit)
                      : "–"}
                  </td>
                  <td className="p-2">
                    <Reichweite p={p} />
                  </td>
                  <td className="p-2 text-right">
                    <BuchenDialog
                      artikel={artikelOptionen}
                      lagerorte={orteOptionen}
                      artikelId={p.artikel.id}
                    />
                  </td>
                </tr>
              ))}
              {inv.artikel.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-muted-foreground p-6 text-center">
                    Noch keine Artikel. Lege sie unter „Artikel“ an oder übernimm ein Branchenpaket.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="text-muted-foreground text-xs">
          Erledigte Einsätze buchen den Sollverbrauch automatisch ab (Fahrzeug der Tour, sonst
          Standardfahrzeug, Putzkammer oder Zentrallager). Negative Bestände bedeuten: mehr
          abgebucht als eingebucht – Inventur machen.
        </p>
      </section>
    </div>
  );
}
