import { NextResponse, type NextRequest, after } from "next/server";
import { z } from "zod";
import { uuid } from "@/lib/schemas/helfer";
import { nachEinsaetzen } from "@/lib/nachweise/lauf";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const eingabe = z.object({ einsatzIds: z.array(uuid).min(1).max(30) });

/**
 * Die Mitarbeiter-App meldet nach dem Übertragen, welche Einsätze ausgecheckt oder um Leistungen
 * ergänzt wurden. Der Server verschickt dann Nachweis und Bestätigungen (im Hintergrund).
 * Nur Einsätze, die der Benutzer sehen darf (RLS), werden berücksichtigt.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ fehler: "nicht angemeldet" }, { status: 401 });

  const geprueft = eingabe.safeParse(await request.json().catch(() => null));
  if (!geprueft.success) return NextResponse.json({ fehler: "ungültig" }, { status: 400 });

  const { data: sichtbar } = await supabase
    .from("einsatz")
    .select("id")
    .in("id", geprueft.data.einsatzIds);
  const ids = (sichtbar ?? []).map((e) => e.id);
  const admin = createAdminClient();
  if (!admin || ids.length === 0) return NextResponse.json({ angenommen: 0 }, { status: 202 });

  after(async () => {
    try {
      await nachEinsaetzen(admin, ids);
    } catch (e) {
      console.error("Nachweis nach Auschecken fehlgeschlagen", e);
    }
  });
  return NextResponse.json({ angenommen: ids.length }, { status: 202 });
}
