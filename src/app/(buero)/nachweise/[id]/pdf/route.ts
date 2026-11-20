import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Öffnet das abgelegte PDF eines Nachweises (kurzlebiger, signierter Link; nur Büro). */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("nachweis").select("pdf_pfad").eq("id", id).maybeSingle();
  if (!data?.pdf_pfad) return new NextResponse("Nicht gefunden", { status: 404 });
  const { data: link } = await supabase.storage
    .from("nachweise")
    .createSignedUrl(data.pdf_pfad, 60);
  if (!link) return new NextResponse("Nicht gefunden", { status: 404 });
  return NextResponse.redirect(link.signedUrl, { headers: { "Cache-Control": "no-store" } });
}
