import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { formatDatum, heuteIso } from "@/domain/datum";
import type { Verschleissstufe } from "@/domain/prognose";
import { bueroKontext } from "@/lib/auth";
import { ladeInventar } from "@/lib/inventar";
import { mitgliedName } from "@/lib/touren";
import { cn } from "@/lib/utils";
import {
  AusmusternKnopf,
  LebensdauerKnopf,
  PruefungDialog,
  WechselDialog,
  WerkzeugDialog,
} from "./werkzeug-teile";

export const metadata: Metadata = { title: "Werkzeuge und Prüfungen" };

const EINHEIT: Record<string, string> = {
  einsaetze: "Einsätze",
  fenster: "Fenster",
  m2: "m²",
  stunden: "Std.",
  waeschen: "Wäschen",
  tage: "Tage",
};

const STUFE: Record<Verschleissstufe, { text: string; klasse: string }> = {
  ok: { text: "in Ordnung", klasse: "" },
  hinweis: { text: "bald wechseln", klasse: "border-amber-500 text-amber-700 dark:text-amber-300" },
  faellig: { text: "fällig", klasse: "border-orange-600 text-orange-700 dark:text-orange-300" },
  ueberfaellig: { text: "überfällig", klasse: "border-red-600 text-red-700 dark:text-red-300" },
};

export default async function WerkzeugeSeite() {
  const k = await bueroKontext();
  const heute = heuteIso();
  const [inv, { data: artikel }, { data: mitglieder }, { data: fahrzeuge }] = await Promise.all([
    ladeInventar(k.supabase, k.betriebId, heute),
    k.supabase
      .from("artikel")
      .select("id, name, art")
      .eq("betrieb_id", k.betriebId)
      .eq("aktiv", true)
      .neq("art", "verbrauch")
      .order("name"),
    k.supabase
      .from("mitglied")
      .select("id, anzeigename")
      .eq("betrieb_id", k.betriebId)
      .eq("aktiv", true)
      .order("anzeigename"),
    k.supabase
      .from("fahrzeug")
      .select("id, name")
      .eq("betrieb_id", k.betriebId)
      .eq("aktiv", true)
      .order("name"),
  ]);
  const optionen = {
    artikel: (artikel ?? []).map((a) => ({
      wert: a.id,
      text: `${a.name} (${a.art === "geraet" ? "Gerät" : "Verschleiß"})`,
    })),
    mitarbeiter: (mitglieder ?? []).map((m) => ({ wert: m.id, text: mitgliedName(m) })),
    fahrzeuge: (fahrzeuge ?? []).map((f) => ({ wert: f.id, text: f.name })),
  };
  const name = new Map(
    [...optionen.mitarbeiter, ...optionen.fahrzeuge].map((o) => [o.wert, o.text]),
  );
  const lagerorte = inv.lagerorte.filter((l) => l.aktiv).map((l) => ({ wert: l.id, text: l.name }));
  const { data: roh } = await k.supabase
    .from("werkzeug")
    .select("id, artikel_id, bezeichnung, mitglied_id, fahrzeug_id, startstand, naechste_pruefung")
    .eq("betrieb_id", k.betriebId)
    .eq("aktiv", true);
  const werte = new Map((roh ?? []).map((w) => [w.id, { ...w, startstand: Number(w.startstand) }]));
  const vorschlaege = new Map(
    inv.werkzeuge
      .filter((w) => w.lebensdauerVorschlag !== null)
      .map((w) => [w.artikel.id, { artikel: w.artikel, wert: w.lebensdauerVorschlag! }]),
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm">
          Gezählt wird ab dem echten Wechsel, die Lebensdauer ist eine Empfehlung: ab 80 % Hinweis,
          ab 100 % fällig (Packliste), danach überfällig. Gesperrt wird nichts.
        </p>
        <WerkzeugDialog {...optionen} />
      </div>

      {vorschlaege.size > 0 && (
        <section className="flex flex-col gap-2 rounded-lg border p-3 text-sm">
          <h2 className="font-medium">Lebensdauer lernt mit</h2>
          {[...vorschlaege.values()].map((v) => (
            <div key={v.artikel.id} className="flex flex-wrap items-center gap-2">
              <span className="flex-1">
                {v.artikel.name}: im Schnitt nach {v.wert.toLocaleString("de-DE")}{" "}
                {EINHEIT[v.artikel.lebensdauer_einheit ?? ""] ?? ""} gewechselt (eingestellt{" "}
                {Number(v.artikel.lebensdauer).toLocaleString("de-DE")}).
              </span>
              {k.rolle === "inhaber" && (
                <LebensdauerKnopf
                  artikelId={v.artikel.id}
                  wert={v.wert}
                  text={`${v.wert.toLocaleString("de-DE")} übernehmen`}
                />
              )}
            </div>
          ))}
        </section>
      )}

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[820px] text-sm" data-werkzeuge>
          <thead className="bg-muted/50">
            <tr>
              <th className="p-2 text-left font-medium">Werkzeug</th>
              <th className="p-2 text-left font-medium">Besitzer</th>
              <th className="p-2 text-left font-medium">Zähler</th>
              <th className="p-2 text-left font-medium">Prüfung</th>
              <th className="p-2" />
            </tr>
          </thead>
          <tbody>
            {inv.werkzeuge.map((w) => {
              const v = w.verschleiss;
              return (
                <tr key={w.id} className="border-t align-top">
                  <td className="p-2">
                    <span className="font-medium">{w.bezeichnung}</span>
                    <span className="text-muted-foreground block text-xs">{w.artikel.name}</span>
                  </td>
                  <td className="p-2">
                    {(w.mitgliedId && name.get(w.mitgliedId)) ||
                      (w.fahrzeugId && name.get(w.fahrzeugId)) ||
                      "–"}
                  </td>
                  <td className="p-2">
                    {v && w.artikel.lebensdauer ? (
                      <div className="flex flex-col gap-1">
                        <span className="tabular-nums">
                          {Math.round(v.stand).toLocaleString("de-DE")} von{" "}
                          {Number(w.artikel.lebensdauer).toLocaleString("de-DE")}{" "}
                          {EINHEIT[w.artikel.lebensdauer_einheit ?? ""] ?? ""}
                        </span>
                        <div className="bg-muted h-1.5 w-32 overflow-hidden rounded">
                          <div
                            className={cn(
                              "h-full",
                              v.stufe === "ok"
                                ? "bg-emerald-600"
                                : v.stufe === "hinweis"
                                  ? "bg-amber-500"
                                  : "bg-red-600",
                            )}
                            style={{ width: `${Math.min(100, v.anteil * 100)}%` }}
                          />
                        </div>
                        <span className="flex flex-wrap gap-1">
                          {v.stufe !== "ok" && (
                            <Badge variant="outline" className={STUFE[v.stufe].klasse}>
                              {STUFE[v.stufe].text}
                              {v.ueberUm > 0
                                ? ` seit ${Math.round(v.ueberUm).toLocaleString("de-DE")}`
                                : ""}
                            </Badge>
                          )}
                          {w.faelligAm && (
                            <span className="text-muted-foreground text-xs">
                              fällig nach Plan am {formatDatum(w.faelligAm)}
                            </span>
                          )}
                        </span>
                        {w.letzterWechsel && (
                          <span className="text-muted-foreground text-xs">
                            gewechselt {formatDatum(w.letzterWechsel.slice(0, 10))}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">–</span>
                    )}
                  </td>
                  <td className="p-2">
                    {w.pruefung.faelligAm ? (
                      <span
                        className={cn(
                          w.pruefung.stufe === "ueberfaellig" &&
                            "font-medium text-red-700 dark:text-red-300",
                          w.pruefung.stufe === "bald" && "text-amber-700 dark:text-amber-300",
                        )}
                      >
                        {w.pruefung.stufe === "ueberfaellig" ? "überfällig seit " : "bis "}
                        {formatDatum(w.pruefung.faelligAm)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">–</span>
                    )}
                  </td>
                  <td className="p-2">
                    <div className="flex flex-wrap justify-end gap-1">
                      {v && <WechselDialog werkzeugId={w.id} lagerorte={lagerorte} />}
                      {w.artikel.pruefintervall_monate && <PruefungDialog werkzeugId={w.id} />}
                      {werte.get(w.id) && (
                        <WerkzeugDialog werkzeug={werte.get(w.id)} {...optionen} />
                      )}
                      <AusmusternKnopf id={w.id} />
                    </div>
                  </td>
                </tr>
              );
            })}
            {inv.werkzeuge.length === 0 && (
              <tr>
                <td colSpan={5} className="text-muted-foreground p-6 text-center">
                  Noch keine Werkzeuge. Lege je Abzieher, Mopp oder Leiter ein Werkzeug an, damit
                  jedes seinen eigenen Zähler bzw. Prüftermin hat.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
