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
import { kundentypText } from "@/lib/schemas/kunde";

export const metadata: Metadata = { title: "Kunden" };

export default async function KundenSeite({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; alle?: string }>;
}) {
  const { q, alle } = await searchParams;
  const k = await bueroKontext();
  let abfrage = k.supabase
    .from("kunde")
    .select("id, kundennummer, typ, name, ort, telefon, email, aktiv, objekt(count)")
    .eq("betrieb_id", k.betriebId)
    .order("name")
    .limit(500);
  if (!alle) abfrage = abfrage.eq("aktiv", true);
  if (q?.trim()) {
    const m = suchMuster(q.trim());
    const nr = /^\d+$/.test(q.trim()) ? `,kundennummer.eq.${q.trim()}` : "";
    abfrage = abfrage.or(`name.ilike.${m},ort.ilike.${m},email.ilike.${m}${nr}`);
  }
  const { data: kunden } = await abfrage;

  return (
    <>
      <Seitenkopf
        titel="Kunden"
        beschreibung="Firmen, Hausverwaltungen, Privatkunden und öffentliche Auftraggeber"
        aktionen={
          <>
            <Button variant="outline" nativeButton={false} render={<Link href="/kunden/import" />}>
              CSV-Import
            </Button>
            <Button nativeButton={false} render={<Link href="/kunden/neu" />}>
              Neuer Kunde
            </Button>
          </>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Suche wert={q} platzhalter="Name, Ort, E-Mail oder Nr." />
        <Link
          href={alle ? "/kunden" : "/kunden?alle=1"}
          className="text-muted-foreground text-sm underline"
        >
          {alle ? "Nur aktive" : "Auch inaktive zeigen"}
        </Link>
      </div>
      {kunden && kunden.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Nr.</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead>Ort</TableHead>
                <TableHead className="hidden lg:table-cell">Kontakt</TableHead>
                <TableHead className="text-right">Objekte</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {kunden.map((kd) => (
                <TableRow key={kd.id}>
                  <TableCell className="text-muted-foreground tabular-nums">
                    {kd.kundennummer}
                  </TableCell>
                  <TableCell>
                    <Link href={`/kunden/${kd.id}`} className="font-medium hover:underline">
                      {kd.name}
                    </Link>
                    {!kd.aktiv && (
                      <Badge variant="outline" className="ml-2">
                        inaktiv
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{kundentypText(kd.typ)}</TableCell>
                  <TableCell>{kd.ort ?? "–"}</TableCell>
                  <TableCell className="text-muted-foreground hidden lg:table-cell">
                    {kd.telefon ?? kd.email ?? "–"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {kd.objekt?.[0]?.count ?? 0}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="text-muted-foreground rounded-lg border border-dashed p-10 text-center text-sm">
          {q
            ? "Keine Kunden gefunden."
            : "Noch keine Kunden. Lege den ersten an oder importiere eine Liste."}
        </div>
      )}
    </>
  );
}
