import type { Metadata } from "next";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  WOCHENTAGE_KURZ,
  formatDatum,
  heuteIso,
  plusTage,
  wochenbeginn,
  wochentag,
} from "@/domain/datum";
import { zuDauer } from "@/domain/planung";
import { bueroKontext } from "@/lib/auth";
import { HORIZONT_WOCHEN } from "@/lib/serienplanung";
import { mitgliedName } from "@/lib/touren";
import { Zuweisen } from "./zuweisen";

export const metadata: Metadata = { title: "Offene Einsätze" };

export default async function OffeneEinsaetzeSeite() {
  const k = await bueroKontext();
  const heute = heuteIso();
  const [{ data: einsaetze }, { data: mitglieder }] = await Promise.all([
    k.supabase
      .from("einsatz")
      .select(
        "id, datum, zeitfenster_von, zeitfenster_bis, sollzeit_minuten, objekt(id, name, ort), auftragsvorlage(name)",
      )
      .eq("betrieb_id", k.betriebId)
      .is("mitarbeiter_id", null)
      .eq("status", "geplant")
      .gte("datum", heute)
      .lte("datum", plusTage(heute, HORIZONT_WOCHEN * 7))
      .order("datum")
      .order("zeitfenster_von", { ascending: true, nullsFirst: false })
      .limit(500),
    k.supabase
      .from("mitglied")
      .select("id, anzeigename")
      .eq("betrieb_id", k.betriebId)
      .eq("aktiv", true)
      .order("anzeigename"),
  ]);
  const optionen = (mitglieder ?? []).map((m) => ({ wert: m.id, text: mitgliedName(m) }));

  if (!einsaetze?.length) {
    return (
      <div className="text-muted-foreground rounded-lg border border-dashed p-10 text-center text-sm">
        Alle Einsätze der nächsten {HORIZONT_WOCHEN} Wochen sind verteilt.
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground text-sm">
        {einsaetze.length} Einsätze ohne Mitarbeiter in den nächsten {HORIZONT_WOCHEN} Wochen.
      </p>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Datum</TableHead>
              <TableHead>Objekt</TableHead>
              <TableHead className="hidden md:table-cell">Zeitfenster</TableHead>
              <TableHead className="hidden md:table-cell">Sollzeit</TableHead>
              <TableHead className="w-56">Zuweisen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {einsaetze.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="tabular-nums">
                  <Link
                    href={`/planung?woche=${wochenbeginn(e.datum)}`}
                    className="hover:underline"
                  >
                    {WOCHENTAGE_KURZ[wochentag(e.datum) - 1]} {formatDatum(e.datum)}
                  </Link>
                </TableCell>
                <TableCell>
                  <Link href={`/objekte/${e.objekt?.id}`} className="font-medium hover:underline">
                    {e.objekt?.name}
                  </Link>
                  <div className="text-muted-foreground text-xs">
                    {e.auftragsvorlage?.name}
                    {e.objekt?.ort ? ` · ${e.objekt.ort}` : ""}
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  {e.zeitfenster_von && e.zeitfenster_bis
                    ? `${e.zeitfenster_von.slice(0, 5)}–${e.zeitfenster_bis.slice(0, 5)}`
                    : "–"}
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  {zuDauer(e.sollzeit_minuten)}
                </TableCell>
                <TableCell>
                  <Zuweisen id={e.id} datum={e.datum} optionen={optionen} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
