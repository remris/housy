import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { vertragPdfAntwort } from "@/lib/pdf/vertrag-antwort";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(token)) return new NextResponse("Nicht gefunden", { status: 404 });
  return vertragPdfAntwort(await createClient(), token);
}
