import { NextResponse, type NextRequest } from "next/server";
import { heuteIso } from "@/domain/datum";
import { planeEinsaetze } from "@/lib/serienplanung";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Täglicher Job (Vercel Cron, siehe vercel.json): beendet abgelaufene Verträge und
 * rollt den Planungshorizont aller aktiven Verträge um einen Tag weiter.
 * Geschützt über CRON_SECRET (Vercel sendet "Authorization: Bearer <CRON_SECRET>").
 */
export async function GET(request: NextRequest) {
  const geheimnis = process.env.CRON_SECRET;
  if (!geheimnis || request.headers.get("authorization") !== `Bearer ${geheimnis}`) {
    return NextResponse.json({ fehler: "nicht erlaubt" }, { status: 401 });
  }
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ fehler: "SUPABASE_SECRET_KEY fehlt" }, { status: 500 });

  const heute = heuteIso();
  const { data: beendet } = await admin
    .from("vertrag")
    .update({ status: "beendet" })
    .in("status", ["aktiv", "gekuendigt"])
    .lt("endet_am", heute)
    .select("id");

  const { data: vertraege, error } = await admin
    .from("vertrag")
    .select("id")
    .in("status", ["aktiv", "gekuendigt"]);
  if (error) return NextResponse.json({ fehler: error.message }, { status: 500 });

  const summe = { vertraege: 0, angelegt: 0, geaendert: 0, geloescht: 0, fehler: [] as string[] };
  for (const v of [...(vertraege ?? []), ...(beendet ?? [])]) {
    try {
      const r = await planeEinsaetze(admin, v.id, heute);
      summe.vertraege++;
      summe.angelegt += r.angelegt;
      summe.geaendert += r.geaendert;
      summe.geloescht += r.geloescht;
    } catch (e) {
      summe.fehler.push(`${v.id}: ${(e as Error).message}`);
    }
  }
  return NextResponse.json({ ...summe, beendet: beendet?.length ?? 0 });
}
