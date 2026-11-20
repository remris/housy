import { type NextRequest, NextResponse } from "next/server";
import { type AngebotInfo, angebotPdfErzeugen } from "@/lib/pdf/angebot-pdf";
import { createClient } from "@/lib/supabase/server";

/** Angebot als PDF (per Token, auch ohne Login) */
export async function GET(_r: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(token)) return new NextResponse("Nicht gefunden", { status: 404 });
  const supabase = await createClient();
  const { data } = await supabase.rpc("angebot_info", { p_token: token });
  const d = data as AngebotInfo | null;
  if (!d) return new NextResponse("Nicht gefunden", { status: 404 });
  const logoUrl = d.betrieb.logo_pfad
    ? supabase.storage.from("logos").getPublicUrl(d.betrieb.logo_pfad).data.publicUrl
    : null;
  const pdf = await angebotPdfErzeugen(d, logoUrl);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="angebot-${d.angebot.nummer}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
