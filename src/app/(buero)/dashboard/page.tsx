import type { Metadata } from "next";
import Link from "next/link";
import { Seitenkopf } from "@/components/seitenkopf";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDatum, heuteIso } from "@/domain/datum";
import { bueroKontext } from "@/lib/auth";
import { type Inventar, ladeInventar } from "@/lib/inventar";

export const metadata: Metadata = { title: "Übersicht" };

export default async function DashboardSeite() {
  const k = await bueroKontext();
  const [{ count: mitglieder }, { data: betrieb }, { count: vorlagen }] = await Promise.all([
    k.supabase
      .from("mitglied")
      .select("id", { count: "exact", head: true })
      .eq("betrieb_id", k.betriebId),
    k.supabase
      .from("betrieb")
      .select("name, tarif, test_endet_am, iban, steuernummer")
      .eq("id", k.betriebId)
      .single(),
    k.supabase
      .from("auftragsvorlage")
      .select("id", { count: "exact", head: true })
      .eq("betrieb_id", k.betriebId),
  ]);

  let inventar: Inventar | null = null;
  try {
    inventar = await ladeInventar(k.supabase, k.betriebId, heuteIso());
  } catch {
    inventar = null; // Übersicht bleibt nutzbar
  }
  const knapp = (inventar?.artikel ?? []).filter(
    (p) =>
      p.vorschlag ||
      (p.artikel.art === "verbrauch" &&
        p.reichweite.tage !== null &&
        p.reichweite.tage < p.artikel.lieferzeit_tage + 7),
  );
  const werkzeugHinweise = (inventar?.werkzeuge ?? []).filter(
    (w) =>
      w.pruefung.stufe !== "ok" ||
      (w.verschleiss &&
        (w.verschleiss.stufe === "faellig" || w.verschleiss.stufe === "ueberfaellig")),
  );

  const offeneEinrichtung = [
    !betrieb?.steuernummer && "Steuernummer hinterlegen",
    !betrieb?.iban && "Bankverbindung für Rechnungen hinterlegen",
    (vorlagen ?? 0) === 0 && "Branchenpaket übernehmen (Vorlagen, Artikel, Preise)",
    (mitglieder ?? 0) < 2 && "Ersten Mitarbeiter einladen",
  ].filter(Boolean) as string[];

  return (
    <>
      <Seitenkopf
        titel={`Hallo ${k.mitglied.anzeigename ?? ""}`.trim()}
        beschreibung={betrieb?.name}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Team</CardDescription>
            <CardTitle className="text-3xl">{mitglieder ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        {betrieb?.tarif === "test" && betrieb.test_endet_am && (
          <Card>
            <CardHeader>
              <CardDescription>Testphase bis</CardDescription>
              <CardTitle className="text-3xl">
                {new Date(betrieb.test_endet_am).toLocaleDateString("de-DE")}
              </CardTitle>
            </CardHeader>
          </Card>
        )}
        {offeneEinrichtung.length > 0 && (
          <Card className="sm:col-span-2 lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-base">Einrichtung abschließen</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-muted-foreground list-inside list-disc text-sm">
                {offeneEinrichtung.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
              <Link href="/einstellungen" className="mt-3 inline-block text-sm underline">
                Zu den Einstellungen
              </Link>
            </CardContent>
          </Card>
        )}
        {knapp.length > 0 && (
          <Card data-material-knapp>
            <CardHeader>
              <CardTitle className="text-base">Material mit kurzer Reichweite</CardTitle>
              <CardDescription>{knapp.length} Artikel auf der Einkaufsliste</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-1 text-sm">
                {knapp.slice(0, 5).map((p) => (
                  <li key={p.artikel.id} className="flex justify-between gap-2">
                    <span>{p.artikel.name}</span>
                    <span className="text-muted-foreground">
                      {p.reichweite.tage === null
                        ? "Mindestbestand"
                        : p.reichweite.tage === 0
                          ? "aufgebraucht"
                          : `${p.reichweite.tage} Tage`}
                    </span>
                  </li>
                ))}
              </ul>
              <Link href="/inventar" className="mt-3 inline-block text-sm underline">
                Zur Einkaufsliste
              </Link>
            </CardContent>
          </Card>
        )}
        {werkzeugHinweise.length > 0 && (
          <Card data-werkzeug-hinweise>
            <CardHeader>
              <CardTitle className="text-base">Werkzeuge und Prüftermine</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-1 text-sm">
                {werkzeugHinweise.slice(0, 6).map((w) => (
                  <li key={w.id} className="flex justify-between gap-2">
                    <span>{w.bezeichnung}</span>
                    <span
                      className={
                        w.pruefung.stufe === "ueberfaellig" ||
                        w.verschleiss?.stufe === "ueberfaellig"
                          ? "text-red-700 dark:text-red-300"
                          : "text-amber-700 dark:text-amber-300"
                      }
                    >
                      {w.pruefung.stufe !== "ok" && w.pruefung.faelligAm
                        ? `${w.pruefung.stufe === "ueberfaellig" ? "Prüfung überfällig" : "prüfen bis"} ${formatDatum(w.pruefung.faelligAm)}`
                        : w.verschleiss?.stufe === "ueberfaellig"
                          ? `Wechsel überfällig seit ${Math.round(w.verschleiss.ueberUm)}`
                          : "Wechsel fällig"}
                    </span>
                  </li>
                ))}
              </ul>
              <Link href="/inventar/werkzeuge" className="mt-3 inline-block text-sm underline">
                Zu den Werkzeugen
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
