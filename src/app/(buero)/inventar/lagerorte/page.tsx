import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { formatMenge } from "@/domain/vorlagen";
import { bueroKontext } from "@/lib/auth";
import { BEWEGUNGSART_TEXT, lagerortartText } from "@/lib/schemas/inventar";
import { LagerortDialog } from "./lagerort-teile";

export const metadata: Metadata = { title: "Lagerorte und Buchungen" };

export default async function LagerorteSeite() {
  const k = await bueroKontext();
  const [{ data: orte }, { data: objekte }, { data: bewegungen }] = await Promise.all([
    k.supabase
      .from("lagerort")
      .select(
        "id, name, art, standard, aktiv, objekt_id, fahrzeug(mitglied(anzeigename)), bestand(menge)",
      )
      .eq("betrieb_id", k.betriebId)
      .order("standard", { ascending: false })
      .order("art")
      .order("name"),
    k.supabase
      .from("objekt")
      .select("id, name")
      .eq("betrieb_id", k.betriebId)
      .eq("aktiv", true)
      .order("name"),
    k.supabase
      .from("lagerbewegung")
      .select(
        "id, art, menge, erstellt_am, notiz, artikel(name, einheit), von:lagerort!lagerbewegung_von_lagerort_id_betrieb_id_fkey(name), nach:lagerort!lagerbewegung_nach_lagerort_id_betrieb_id_fkey(name), einsatz(datum, objekt(name))",
      )
      .eq("betrieb_id", k.betriebId)
      .order("erstellt_am", { ascending: false })
      .limit(100),
  ]);
  const objektOptionen = (objekte ?? []).map((o) => ({ wert: o.id, text: o.name }));

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-medium">Lagerorte</h2>
          <LagerortDialog objekte={objektOptionen} />
        </div>
        <p className="text-muted-foreground text-sm">
          Fahrzeuge erscheinen automatisch (Standardfahrer unter{" "}
          <Link href="/planung/fahrzeuge" className="underline">
            Planung → Fahrzeuge
          </Link>
          ). Putzkammern im Objekt sind sinnvoll, wenn dort Material lagert.
        </p>
        <ul className="divide-y rounded-lg border">
          {(orte ?? []).map((o) => (
            <li key={o.id} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
              <span className="font-medium">{o.name}</span>
              <Badge variant="outline">
                {o.standard ? "Zentrallager" : lagerortartText(o.art)}
              </Badge>
              {!o.aktiv && <Badge variant="secondary">inaktiv</Badge>}
              <span className="text-muted-foreground flex-1">
                {o.fahrzeug?.mitglied?.anzeigename
                  ? `fährt ${o.fahrzeug.mitglied.anzeigename} · `
                  : ""}
                {o.bestand.filter((b) => Number(b.menge) !== 0).length} Artikel im Bestand
              </span>
              {o.art !== "fahrzeug" && !o.standard && (
                <LagerortDialog
                  lagerort={{
                    id: o.id,
                    name: o.name,
                    art: o.art,
                    objekt_id: o.objekt_id,
                    aktiv: o.aktiv,
                  }}
                  objekte={objektOptionen}
                />
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">Letzte Buchungen</h2>
        <p className="text-muted-foreground text-sm">
          Buchungen werden nie geändert; Korrekturen sind eigene Buchungen (Inventur).
        </p>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[720px] text-sm" data-bewegungen>
            <thead className="bg-muted/50">
              <tr>
                <th className="p-2 text-left font-medium">Zeit</th>
                <th className="p-2 text-left font-medium">Art</th>
                <th className="p-2 text-left font-medium">Artikel</th>
                <th className="p-2 text-right font-medium">Menge</th>
                <th className="p-2 text-left font-medium">von → nach</th>
                <th className="p-2 text-left font-medium">Bezug</th>
              </tr>
            </thead>
            <tbody>
              {(bewegungen ?? []).map((b) => (
                <tr key={b.id} className="border-t">
                  <td className="p-2 whitespace-nowrap">
                    {new Date(b.erstellt_am).toLocaleString("de-DE", {
                      timeZone: "Europe/Berlin",
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </td>
                  <td className="p-2">{BEWEGUNGSART_TEXT[b.art] ?? b.art}</td>
                  <td className="p-2">{b.artikel?.name}</td>
                  <td className="p-2 text-right tabular-nums">
                    {formatMenge(Number(b.menge), b.artikel?.einheit ?? "")}
                  </td>
                  <td className="p-2">
                    {b.von?.name ?? "–"} → {b.nach?.name ?? "–"}
                  </td>
                  <td className="text-muted-foreground p-2">
                    {b.einsatz
                      ? `${b.einsatz.objekt?.name ?? ""} ${b.einsatz.datum}`
                      : (b.notiz ?? "")}
                  </td>
                </tr>
              ))}
              {(bewegungen ?? []).length === 0 && (
                <tr>
                  <td colSpan={6} className="text-muted-foreground p-6 text-center">
                    Noch keine Buchungen.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
