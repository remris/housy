import type { Metadata } from "next";
import Link from "next/link";
import { Seitenkopf } from "@/components/seitenkopf";
import { Suche, suchMuster } from "@/components/suche";
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
import { formatMenge } from "@/domain/vorlagen";
import { bueroKontext } from "@/lib/auth";
import { ARTIKELARTEN, LEBENSDAUER_EINHEITEN, artikelartText } from "@/lib/schemas/vorlage";
import { cn } from "@/lib/utils";
import { ArtikelAktionen, NeuerArtikel } from "./artikel-formular";

export const metadata: Metadata = { title: "Artikel" };

export default async function ArtikelSeite({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; art?: string }>;
}) {
  const { q, art } = await searchParams;
  const k = await bueroKontext();
  let abfrage = k.supabase
    .from("artikel")
    .select("*")
    .eq("betrieb_id", k.betriebId)
    .order("art")
    .order("name");
  if (art === "verbrauch" || art === "verschleiss" || art === "geraet")
    abfrage = abfrage.eq("art", art);
  if (q?.trim()) {
    const m = suchMuster(q.trim());
    abfrage = abfrage.or(`name.ilike.${m},lieferant.ilike.${m},bestellnummer.ilike.${m}`);
  }
  const { data: artikel } = await abfrage;

  const filter = [{ wert: "", text: "Alle" }, ...ARTIKELARTEN];

  return (
    <>
      <Seitenkopf
        titel="Artikel"
        beschreibung="Verbrauchsmaterial, Verschleißteile und Geräte"
        aktionen={<NeuerArtikel />}
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Suche wert={q} platzhalter="Name, Lieferant, Bestellnr." />
        <div className="flex gap-1">
          {filter.map((f) => (
            <Link
              key={f.wert}
              href={f.wert ? `/artikel?art=${f.wert}` : "/artikel"}
              className={cn(
                "rounded-full border px-3 py-1 text-sm",
                (art ?? "") === f.wert ? "bg-foreground text-background" : "hover:bg-muted",
              )}
            >
              {f.text}
            </Link>
          ))}
        </div>
      </div>
      {artikel && artikel.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Artikel</TableHead>
                <TableHead>Art</TableHead>
                <TableHead>Gebinde</TableHead>
                <TableHead className="text-right">Preis</TableHead>
                <TableHead className="hidden lg:table-cell">Regel</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {artikel.map((a) => {
                const zeile = {
                  ...a,
                  gebinde_menge: Number(a.gebinde_menge),
                  mindestbestand: Number(a.mindestbestand),
                  lebensdauer: a.lebensdauer === null ? null : Number(a.lebensdauer),
                  lebensdauer_einheit: a.lebensdauer_einheit as
                    "einsaetze" | "fenster" | "m2" | "stunden" | "waeschen" | "tage" | null,
                };
                const regel =
                  a.art === "verschleiss"
                    ? `hält ${zeile.lebensdauer?.toLocaleString("de-DE")} ${
                        LEBENSDAUER_EINHEITEN.find((e) => e.wert === a.lebensdauer_einheit)?.text ??
                        ""
                      }${a.auto_wechsel ? " · Auto-Wechsel" : ""}`
                    : a.art === "geraet"
                      ? a.pruefintervall_monate
                        ? `Prüfung alle ${a.pruefintervall_monate} Monate`
                        : "–"
                      : `Mindestbestand ${formatMenge(zeile.mindestbestand, a.einheit)}`;
                return (
                  <TableRow key={a.id}>
                    <TableCell>
                      <span className="font-medium">{a.name}</span>
                      {!a.aktiv && (
                        <Badge variant="outline" className="ml-2">
                          inaktiv
                        </Badge>
                      )}
                      {a.lieferant && (
                        <div className="text-muted-foreground text-xs">{a.lieferant}</div>
                      )}
                    </TableCell>
                    <TableCell>{artikelartText(a.art)}</TableCell>
                    <TableCell>
                      {a.gebinde_name
                        ? `${a.gebinde_name} à ${formatMenge(zeile.gebinde_menge, a.einheit)}`
                        : a.einheit}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {a.preis_cent === null ? "–" : formatEuro(a.preis_cent)}
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden lg:table-cell">
                      {regel}
                    </TableCell>
                    <TableCell>
                      <ArtikelAktionen artikel={zeile} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="text-muted-foreground rounded-lg border border-dashed p-10 text-center text-sm">
          Keine Artikel. Lege einen an oder übernimm ein{" "}
          <Link href="/vorlagen" className="underline">
            Branchenpaket
          </Link>
          .
        </div>
      )}
    </>
  );
}
