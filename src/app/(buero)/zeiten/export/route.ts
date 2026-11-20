import { type NextRequest, NextResponse } from "next/server";
import { arbeitszeitCsv } from "@/domain/arbeitszeitliste";
import { heuteIso } from "@/domain/datum";
import { istMonat, monatVon } from "@/domain/nachweis";
import { ladeArbeitszeiten } from "@/lib/arbeitszeit";
import { bueroKontext } from "@/lib/auth";
import { arbeitszeitPdfErzeugen } from "@/lib/pdf/arbeitszeit-pdf";

const UUID = /^[0-9a-f-]{36}$/i;

/** Arbeitszeitliste als CSV oder PDF: ?monat=JJJJ-MM&ma=<mitglied>&format=csv|pdf */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const monat = istMonat(q.get("monat") ?? "") ? q.get("monat")! : monatVon(heuteIso());
  const ma = q.get("ma");
  const format = q.get("format") === "pdf" ? "pdf" : "csv";
  const k = await bueroKontext();
  const liste = await ladeArbeitszeiten(
    k.supabase,
    k.betriebId,
    monat,
    ma && UUID.test(ma) ? ma : undefined,
  );
  if (liste.length === 0) return new NextResponse("Keine Daten", { status: 404 });

  const name = liste.length === 1 ? liste[0]!.name : "alle";
  const datei = `arbeitszeiten-${monat}-${name}`
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-");
  const kopf = (typ: string, endung: string) => ({
    "Content-Type": typ,
    "Content-Disposition": `${format === "pdf" ? "inline" : "attachment"}; filename="${datei}.${endung}"`,
    "Cache-Control": "private, no-store",
  });

  if (format === "csv") {
    return new NextResponse(arbeitszeitCsv(liste), {
      headers: kopf("text/csv; charset=utf-8", "csv"),
    });
  }
  const { data: b } = await k.supabase
    .from("betrieb")
    .select("name, firmenname")
    .eq("id", k.betriebId)
    .single();
  const pdf = await arbeitszeitPdfErzeugen({
    betrieb: b?.firmenname || b?.name || "",
    monat,
    mitarbeiter: liste.map((m) => ({ name: m.name, liste: m.liste })),
    erstelltAm: new Date().toISOString(),
  });
  return new NextResponse(new Uint8Array(pdf), { headers: kopf("application/pdf", "pdf") });
}
