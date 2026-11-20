import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Ziel aller Auth-Mails (Bestätigung, Passwort zurücksetzen, Einladung).
 * Unterstützt PKCE (?code=) und Token-Hash-Vorlagen (?token_hash=&type=).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const nextParam = searchParams.get("next") ?? "/dashboard";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/dashboard";

  const supabase = await createClient();
  let ok = false;
  if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  } else if (tokenHash && type) {
    ok = !(await supabase.auth.verifyOtp({ type, token_hash: tokenHash })).error;
    if (ok && (type === "recovery" || type === "invite")) {
      return NextResponse.redirect(`${origin}/passwort-neu`);
    }
  }

  if (ok) return NextResponse.redirect(`${origin}${next}`);
  return NextResponse.redirect(`${origin}/login?fehler=link`);
}
