import type { Metadata } from "next";
import Link from "next/link";
import { Seitenkopf } from "@/components/seitenkopf";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { bueroKontext } from "@/lib/auth";

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
      </div>
    </>
  );
}
