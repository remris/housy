import { type NextRequest, NextResponse } from "next/server";
import { alsWindows1252, datevBuchungsstapel } from "@/domain/datev";
import { heuteIso } from "@/domain/datum";
import { istMonat, monatVon, monatsZeitraum, monatsname } from "@/domain/nachweis";
import { bueroKontext } from "@/lib/auth";

/** DATEV-Buchungsstapel (EXTF) aller festgeschriebenen Rechnungen eines Monats (Rechnungsdatum). */
export async function GET(request: NextRequest) {
  const m = request.nextUrl.searchParams.get("monat") ?? "";
  const monat = istMonat(m) ? m : monatVon(heuteIso());
  const { von, bis } = monatsZeitraum(monat);
  const k = await bueroKontext();
  const [{ data: b }, { data: rechnungen, error }] = await Promise.all([
    k.supabase
      .from("betrieb")
      .select("datev_beraternummer, datev_mandantennummer, kontenrahmen, name")
      .eq("id", k.betriebId)
      .single(),
    k.supabase
      .from("rechnung")
      .select(
        "id, nummer, rechnungsdatum, art, kleinunternehmer, kunde(name, kundennummer), rechnungsposition(netto_cent, ust_satz)",
      )
      .eq("betrieb_id", k.betriebId)
      .not("nummer", "is", null)
      .gte("rechnungsdatum", von)
      .lte("rechnungsdatum", bis)
      .order("rechnungsdatum")
      .order("laufnummer"),
  ]);
  if (error) return new NextResponse(error.message, { status: 500 });
  if (!b?.datev_beraternummer || !b.datev_mandantennummer) {
    return new NextResponse(
      "Bitte unter Einstellungen → Rechnungen Berater- und Mandantennummer eintragen.",
      { status: 400 },
    );
  }
  const csv = datevBuchungsstapel(
    {
      beraternummer: b.datev_beraternummer,
      mandantennummer: b.datev_mandantennummer,
      kontenrahmen: b.kontenrahmen as "skr03" | "skr04",
      von,
      bis,
      erzeugt: new Date(),
      bezeichnung: `Rechnungen ${monatsname(monat)}`,
    },
    (rechnungen ?? []).map((r) => {
      const jeSatz = new Map<number, number>();
      for (const p of r.rechnungsposition) {
        const satz = r.kleinunternehmer ? 0 : Number(p.ust_satz);
        jeSatz.set(satz, (jeSatz.get(satz) ?? 0) + p.netto_cent);
      }
      return {
        nummer: r.nummer!,
        datum: r.rechnungsdatum!,
        storno: r.art === "storno",
        kundennummer: Number(r.kunde?.kundennummer ?? 0),
        kunde: r.kunde?.name ?? "",
        gruppen: [...jeSatz].map(([satz, netto]) => ({
          satz,
          bruttoCent: netto + Math.round((netto * satz) / 100),
        })),
      };
    }),
  );
  const ids = (rechnungen ?? []).map((r) => r.id);
  if (ids.length > 0) {
    await k.supabase
      .from("rechnung")
      .update({ datev_exportiert_am: new Date().toISOString() })
      .in("id", ids)
      .is("datev_exportiert_am", null);
  }
  return new NextResponse(new Uint8Array(alsWindows1252(csv)), {
    headers: {
      "Content-Type": "text/csv; charset=windows-1252",
      "Content-Disposition": `attachment; filename="EXTF_Buchungsstapel_${monat}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
