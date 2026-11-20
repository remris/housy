import { type NextRequest, NextResponse } from "next/server";
import { bueroKontext } from "@/lib/auth";
import { dateienErzeugen, ladeRechnung } from "@/lib/rechnung/dokument";

/** Festgeschrieben: abgelegtes ZUGFeRD-PDF. Entwurf: Vorschau mit Wasserzeichen. */
export async function GET(_r: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const k = await bueroKontext();
  const g = await ladeRechnung(k.supabase, id);
  if (!g) return new NextResponse("Nicht gefunden", { status: 404 });
  if (g.r.pdf_pfad) {
    const { data } = await k.supabase.storage.from("rechnungen").createSignedUrl(g.r.pdf_pfad, 60);
    if (data)
      return NextResponse.redirect(data.signedUrl, { headers: { "Cache-Control": "no-store" } });
  }
  const { pdf } = await dateienErzeugen(k.supabase, g);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${g.r.nummer ?? "entwurf"}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
