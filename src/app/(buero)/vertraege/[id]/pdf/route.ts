import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { vertragPdfAntwort } from "@/lib/pdf/vertrag-antwort";
import { createClient } from "@/lib/supabase/server";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  // RLS: nur Büro des Betriebs sieht den Vertrag und damit das Token
  const { data } = await supabase
    .from("vertrag")
    .select("freigabe_token")
    .eq("id", id)
    .maybeSingle();
  if (!data) return new NextResponse("Nicht gefunden", { status: 404 });
  return vertragPdfAntwort(supabase, data.freigabe_token);
}
