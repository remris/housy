import type { Metadata } from "next";
import Link from "next/link";
import { Seitenkopf } from "@/components/seitenkopf";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatEuro } from "@/domain/geld";
import { bueroKontext } from "@/lib/auth";
import { preiseinheitText } from "@/lib/schemas/vorlage";
import { NeuerPreis, PreisAktionen } from "./preis-formular";

export const metadata: Metadata = { title: "Preisliste" };

export default async function PreislisteSeite() {
  const k = await bueroKontext();
  const [{ data: preise }, { data: vorlagen }] = await Promise.all([
    k.supabase
      .from("preisliste")
      .select("*, auftragsvorlage(id, name)")
      .eq("betrieb_id", k.betriebId)
      .order("sonderleistung")
      .order("name"),
    k.supabase
      .from("auftragsvorlage")
      .select("id, name")
      .eq("betrieb_id", k.betriebId)
      .order("name"),
  ]);

  return (
    <>
      <Seitenkopf
        titel="Preisliste"
        beschreibung="Leistungen für Angebote und Verträge, Sonderleistungen für Nachträge vor Ort"
        aktionen={<NeuerPreis vorlagen={vorlagen ?? []} />}
      />
      {preise && preise.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Leistung</TableHead>
                <TableHead className="text-right">Preis netto</TableHead>
                <TableHead>Einheit</TableHead>
                <TableHead className="hidden md:table-cell">Vorlage</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {preise.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <span className="font-medium">{p.name}</span>
                    {p.sonderleistung && (
                      <Badge variant="secondary" className="ml-2">
                        Sonderleistung
                      </Badge>
                    )}
                    {!p.aktiv && (
                      <Badge variant="outline" className="ml-2">
                        inaktiv
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatEuro(p.preis_cent)}
                    <span className="text-muted-foreground text-xs"> + {Number(p.ust_satz)} %</span>
                  </TableCell>
                  <TableCell>{preiseinheitText(p.einheit)}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    {p.auftragsvorlage ? (
                      <Link href={`/vorlagen/${p.auftragsvorlage.id}`} className="hover:underline">
                        {p.auftragsvorlage.name}
                      </Link>
                    ) : (
                      "–"
                    )}
                  </TableCell>
                  <TableCell>
                    <PreisAktionen
                      vorlagen={vorlagen ?? []}
                      preis={{ ...p, ust_satz: Number(p.ust_satz) }}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="text-muted-foreground rounded-lg border border-dashed p-10 text-center text-sm">
          Noch keine Preise. Lege einen an oder übernimm ein{" "}
          <Link href="/vorlagen" className="underline">
            Branchenpaket
          </Link>
          .
        </div>
      )}
    </>
  );
}
