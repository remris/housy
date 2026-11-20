/**
 * Öffentliche Umgebungsvariablen. Next.js ersetzt `process.env.NEXT_PUBLIC_*`
 * nur bei direktem Zugriff, deshalb hier ausgeschrieben.
 */
export function supabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL und NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY fehlen (.env.local, siehe .env.example).",
    );
  }
  return { url, key };
}

export function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}
