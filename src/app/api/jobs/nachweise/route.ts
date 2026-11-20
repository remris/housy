import { NextResponse, type NextRequest } from "next/server";
import { heuteIso } from "@/domain/datum";
import { nachweisLauf } from "@/lib/nachweise/lauf";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Täglicher Job (Vercel Cron, siehe vercel.json): verpasste Einsatznachweise, Monatsnachweise des
 * Vormonats, Wiederholungen nach Fehlern und offene Bestätigungs-Mails.
 * Geschützt über CRON_SECRET (Vercel sendet "Authorization: Bearer <CRON_SECRET>").
 */
export async function GET(request: NextRequest) {
  const geheimnis = process.env.CRON_SECRET;
  if (!geheimnis || request.headers.get("authorization") !== `Bearer ${geheimnis}`) {
    return NextResponse.json({ fehler: "nicht erlaubt" }, { status: 401 });
  }
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ fehler: "SUPABASE_SECRET_KEY fehlt" }, { status: 500 });
  const ergebnis = await nachweisLauf(admin, heuteIso());
  return NextResponse.json(ergebnis);
}
