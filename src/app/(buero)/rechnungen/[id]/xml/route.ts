import { type NextRequest, NextResponse } from "next/server";
import { bueroKontext } from "@/lib/auth";

/** XRechnung (UBL) einer festgeschriebenen Rechnung herunterladen. */
export async function GET(_r: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const k = await bueroKontext();
  const { data: r } = await k.supabase
    .from("rechnung")
    .select("nummer, xml_pfad")
    .eq("id", id)
    .maybeSingle();
  if (!r?.xml_pfad) return new NextResponse("Nicht gefunden", { status: 404 });
  const { data } = await k.supabase.storage.from("rechnungen").download(r.xml_pfad);
  if (!data) return new NextResponse("Nicht gefunden", { status: 404 });
  return new NextResponse(new Uint8Array(await data.arrayBuffer()), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="${r.nummer}.xml"`,
      "Cache-Control": "private, no-store",
    },
  });
}
