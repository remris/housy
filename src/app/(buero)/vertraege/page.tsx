import type { Metadata } from "next";
import Link from "next/link";
import { Seitenkopf } from "@/components/seitenkopf";
import { Suche, suchMuster } from "@/components/suche";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDatum } from "@/domain/datum";
import { formatEuro } from "@/domain/geld";
import { bueroKontext } from "@/lib/auth";
import { VERTRAGSSTATUS, abrechnungsartText } from "@/lib/schemas/vertrag";
import { cn } from "@/lib/utils";
import { StatusBadge } from "./status-badge";

export const metadata: Metadata = { title: "Verträge" };

export default async function VertraegeSeite({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { q, status } = await searchParams;
  const k = await bueroKontext();
  let abfrage = k.supabase
    .from("vertrag")
    .select(
      "id, vertragsnummer, titel, status, beginn, endet_am, unterschrieben_am, kunde(id, name), objekt(id, name), vertragsversion(version, gueltig_ab, abrechnungsart, pauschale_cent)",
    )
    .eq("betrieb_id", k.betriebId)
    .order("vertragsnummer", { ascending: false })
    .limit(500);
  if (status && status in VERTRAGSSTATUS) {
    abfrage = abfrage.eq("status", status as keyof typeof VERTRAGSSTATUS);
  }
  if (q?.trim()) abfrage = abfrage.ilike("titel", suchMuster(q.trim()));
  const { data: vertraege } = await abfrage;

  const filter = [
    { wert: "", text: "Alle" },
    ...Object.entries(VERTRAGSSTATUS).map(([wert, text]) => ({ wert, text })),
  ];

  return (
    <>
      <Seitenkopf
        titel="Verträge"
        beschreibung="Leistungen, Intervalle, Preise und Laufzeiten – daraus entstehen die Einsätze"
        aktionen={
          <Button nativeButton={false} render={<Link href="/vertraege/neu" />}>
            Neuer Vertrag
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Suche wert={q} platzhalter="Bezeichnung" />
        <div className="flex flex-wrap gap-1">
          {filter.map((f) => (
            <Link
              key={f.wert}
              href={f.wert ? `/vertraege?status=${f.wert}` : "/vertraege"}
              className={cn(
                "rounded-full border px-3 py-1 text-sm",
                (status ?? "") === f.wert ? "bg-foreground text-background" : "hover:bg-muted",
              )}
            >
              {f.text}
            </Link>
          ))}
        </div>
      </div>
      {vertraege && vertraege.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Nr.</TableHead>
                <TableHead>Vertrag</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Laufzeit</TableHead>
                <TableHead className="text-right">Vergütung</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vertraege.map((v) => {
                const aktuell = [...v.vertragsversion].sort((a, b) => b.version - a.version)[0];
                return (
                  <TableRow key={v.id}>
                    <TableCell className="text-muted-foreground tabular-nums">
                      {v.vertragsnummer}
                    </TableCell>
                    <TableCell>
                      <Link href={`/vertraege/${v.id}`} className="font-medium hover:underline">
                        {v.titel}
                      </Link>
                      <div className="text-muted-foreground text-xs">
                        {v.kunde?.name} · {v.objekt?.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={v.status} unterschrieben={!!v.unterschrieben_am} />
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      ab {formatDatum(v.beginn)}
                      {v.endet_am && ` bis ${formatDatum(v.endet_am)}`}
                    </TableCell>
                    <TableCell className="text-right">
                      {aktuell?.abrechnungsart === "pauschale" && aktuell.pauschale_cent !== null
                        ? `${formatEuro(aktuell.pauschale_cent)} / Monat`
                        : aktuell
                          ? abrechnungsartText(aktuell.abrechnungsart)
                          : "–"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="text-muted-foreground rounded-lg border border-dashed p-10 text-center text-sm">
          Noch keine Verträge.
        </div>
      )}
    </>
  );
}
