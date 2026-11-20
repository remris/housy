import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/**
 * Admin-Client mit Secret Key (umgeht RLS). Nur serverseitig für Auth-Admin-Aufgaben
 * (z. B. Einladungs-Mail). Gibt null zurück, wenn kein Key konfiguriert ist.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
