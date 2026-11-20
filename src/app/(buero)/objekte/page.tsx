import type { Metadata } from "next";
import Link from "next/link";
import { Seitenkopf } from "@/components/seitenkopf";
import { Suche, suchMuster } from "@/components/suche";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { bueroKontext } from "@/lib/auth";

export const metadata: Metadata = { title: "Objekte" };

export default async function ObjekteSeite({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; alle?: string }>;
}) {
  const { q, alle } = await searchParams;
  const k = await bueroKontext();
  let abfrage = k.supabase
    .from("objekt")
    .select(
      "id, name, strasse, plz, ort, aktiv, kunde!inner(id, name), bereich(flaeche_m2), fensteraufmass(anzahl)",
    )
    .eq("betrieb_id", k.betriebId)
    .order("name")
    .limit(500);
  if (!alle) abfrage = abfrage.eq("aktiv", true);
  if (q?.trim()) {
    const m = suchMuster(q.trim());
    abfrage = abfrage.or(`name.ilike.${m},strasse.ilike.${m},ort.ilike.${m},plz.ilike.${m}`);
  }
  const { data: objekte } = await abfrage;

  return (
    <>
      <Seitenkopf
        titel="Objekte"
        beschreibung="Gebäude und Einsatzorte mit Raumbuch und Fensteraufmaß"
        aktionen={
          <>
            <Button variant="outline" nativeButton={false} render={<Link href="/objekte/import" />}>
              CSV-Import
            </Button>
            <Button nativeButton={false} render={<Link href="/objekte/neu" />}>
              Neues Objekt
            </Button>
          </>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Suche wert={q} platzhalter="Name, Straße, PLZ oder Ort" />
        <Link
          href={alle ? "/objekte" : "/objekte?alle=1"}
          className="text-muted-foreground text-sm underline"
        >
          {alle ? "Nur aktive" : "Auch inaktive zeigen"}
        </Link>
      </div>
      {objekte && objekte.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Objekt</TableHead>
                <TableHead>Kunde</TableHead>
                <TableHead className="hidden md:table-cell">Adresse</TableHead>
                <TableHead className="text-right">Fläche</TableHead>
                <TableHead className="text-right">Fenster</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {objekte.map((o) => {
                const flaeche = o.bereich.reduce((s, b) => s + Number(b.flaeche_m2 ?? 0), 0);
                const fenster = o.fensteraufmass.reduce((s, f) => s + f.anzahl, 0);
                return (
                  <TableRow key={o.id}>
                    <TableCell>
                      <Link href={`/objekte/${o.id}`} className="font-medium hover:underline">
                        {o.name}
                      </Link>
                      {!o.aktiv && (
                        <Badge variant="outline" className="ml-2">
                          inaktiv
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Link href={`/kunden/${o.kunde.id}`} className="hover:underline">
                        {o.kunde.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden md:table-cell">
                      {[o.strasse, [o.plz, o.ort].filter(Boolean).join(" ")]
                        .filter(Boolean)
                        .join(", ") || "–"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {flaeche ? `${flaeche.toLocaleString("de-DE")} m²` : "–"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{fenster || "–"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="text-muted-foreground rounded-lg border border-dashed p-10 text-center text-sm">
          {q ? "Keine Objekte gefunden." : "Noch keine Objekte."}
        </div>
      )}
    </>
  );
}
