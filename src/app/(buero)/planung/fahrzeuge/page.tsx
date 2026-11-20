import type { Metadata } from "next";
import Link from "next/link";
import { LoeschenKnopf } from "@/components/aktion-knoepfe";
import { Badge } from "@/components/ui/badge";
import { fahrzeugLoeschen } from "@/lib/aktionen/planung";
import { bueroKontext } from "@/lib/auth";
import { mitgliedName } from "@/lib/touren";
import { FahrzeugDialog, KoordinatenErgaenzen, TourStartFormular } from "./fahrzeug-teile";

export const metadata: Metadata = { title: "Fahrzeuge und Tourstart" };

export default async function FahrzeugeSeite() {
  const k = await bueroKontext();
  const [{ data: fahrzeuge }, { data: betrieb }, { count: ohneKoordinaten }] = await Promise.all([
    k.supabase
      .from("fahrzeug")
      .select("id, name, kennzeichen, aktiv, notiz, mitglied_id, mitglied(anzeigename)")
      .eq("betrieb_id", k.betriebId)
      .order("aktiv", { ascending: false })
      .order("name"),
    k.supabase
      .from("betrieb")
      .select("tour_start, breitengrad, laengengrad, strasse, plz, ort")
      .eq("id", k.betriebId)
      .single(),
    k.supabase
      .from("objekt")
      .select("id", { count: "exact", head: true })
      .eq("betrieb_id", k.betriebId)
      .or("breitengrad.is.null,laengengrad.is.null"),
  ]);
  const { data: mitglieder } = await k.supabase
    .from("mitglied")
    .select("id, anzeigename")
    .eq("betrieb_id", k.betriebId)
    .eq("aktiv", true)
    .order("anzeigename");
  const mitarbeiter = (mitglieder ?? []).map((m) => ({ wert: m.id, text: mitgliedName(m) }));
  const kartendienst = !!process.env.MAPBOX_TOKEN;
  const sitzVerortet = betrieb?.breitengrad != null && betrieb?.laengengrad != null;
  const adresse =
    [betrieb?.strasse, [betrieb?.plz, betrieb?.ort].filter(Boolean).join(" ")]
      .filter(Boolean)
      .join(", ") || "(keine Adresse)";

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h2 className="font-medium">Tourstart</h2>
        <div className="flex flex-col gap-3 rounded-lg border p-4 text-sm">
          <div>
            Touren starten und enden am Firmensitz <span className="font-medium">{adresse}</span>.{" "}
            {sitzVerortet ? (
              <Badge variant="secondary">auf der Karte</Badge>
            ) : (
              <span className="text-amber-700 dark:text-amber-400">
                Noch ohne Koordinaten – unter{" "}
                <Link href="/einstellungen" className="underline">
                  Firmendaten
                </Link>{" "}
                die Adresse speichern.
              </span>
            )}
          </div>
          <TourStartFormular tourStart={betrieb?.tour_start?.slice(0, 5) ?? "07:00"} />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">Kartendienst</h2>
        <div className="flex flex-col gap-2 rounded-lg border p-4 text-sm">
          <div>
            Mapbox:{" "}
            {kartendienst ? (
              <Badge variant="secondary">eingerichtet</Badge>
            ) : (
              <span className="text-amber-700 dark:text-amber-400">
                nicht eingerichtet (MAPBOX_TOKEN fehlt) – Fahrzeiten werden aus der Luftlinie
                geschätzt.
              </span>
            )}
          </div>
          <div>
            {ohneKoordinaten
              ? `${ohneKoordinaten} Objekte haben noch keine Koordinaten.`
              : "Alle Objekte haben Koordinaten."}
          </div>
          {kartendienst && !!ohneKoordinaten && <KoordinatenErgaenzen />}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Fahrzeuge</h2>
          <FahrzeugDialog mitarbeiter={mitarbeiter} />
        </div>
        {fahrzeuge && fahrzeuge.length > 0 ? (
          <ul className="divide-y rounded-lg border">
            {fahrzeuge.map((f) => (
              <li key={f.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="font-medium">{f.name}</span>
                {f.kennzeichen && <span className="text-muted-foreground">{f.kennzeichen}</span>}
                {!f.aktiv && <Badge variant="outline">inaktiv</Badge>}
                {f.mitglied && <Badge variant="secondary">{mitgliedName(f.mitglied)}</Badge>}
                <span className="text-muted-foreground flex-1 truncate">{f.notiz}</span>
                <FahrzeugDialog fahrzeug={f} mitarbeiter={mitarbeiter} />
                <LoeschenKnopf
                  aktion={fahrzeugLoeschen.bind(null, f.id)}
                  frage="Fahrzeug löschen?"
                />
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
            Noch keine Fahrzeuge.
          </div>
        )}
      </section>
    </div>
  );
}
