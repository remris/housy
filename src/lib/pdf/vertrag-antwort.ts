import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type { Database } from "@/lib/supabase/database.types";
import { type VertragDokument, vertragPdfErzeugen } from "./vertrag-pdf";

/** Erzeugt die PDF-Antwort für einen Vertrag anhand des Freigabe-Tokens. */
export async function vertragPdfAntwort(supabase: SupabaseClient<Database>, token: string) {
  const { data, error } = await supabase.rpc("vertrag_dokument", { p_token: token });
  if (error || !data) return new NextResponse("Vertrag nicht gefunden", { status: 404 });
  const d = data as unknown as VertragDokument;
  const logoUrl = d.betrieb.logo_pfad
    ? supabase.storage.from("logos").getPublicUrl(d.betrieb.logo_pfad).data.publicUrl
    : null;
  const pdf = await vertragPdfErzeugen(d, logoUrl);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="vertrag-${d.vertrag.vertragsnummer}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
