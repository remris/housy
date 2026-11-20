import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Enums } from "@/lib/supabase/database.types";

export type Rolle = Enums<"rolle">;
export const BETRIEB_COOKIE = "housy_betrieb";

export const ROLLEN_TEXT: Record<Rolle, string> = {
  inhaber: "Inhaber",
  disponent: "Disponent",
  mitarbeiter: "Mitarbeiter",
};

export function istBueroRolle(rolle: Rolle) {
  return rolle === "inhaber" || rolle === "disponent";
}

export async function aktuellerBenutzer() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return { supabase, user: data.user };
}

/** Eingeloggter Benutzer mit aktivem Betrieb; leitet sonst auf Login bzw. Betrieb-anlegen um. */
export async function betriebKontext() {
  const { supabase, user } = await aktuellerBenutzer();
  if (!user) redirect("/login");

  const { data: mitgliedschaften } = await supabase
    .from("mitglied")
    .select("id, rolle, sprache, anzeigename, betrieb_id, betrieb(id, name, logo_pfad)")
    .eq("user_id", user.id)
    .eq("aktiv", true)
    .order("erstellt_am");

  if (!mitgliedschaften?.length) redirect("/betrieb-anlegen");

  const gewaehlt = (await cookies()).get(BETRIEB_COOKIE)?.value;
  const mitglied = mitgliedschaften.find((m) => m.betrieb_id === gewaehlt) ?? mitgliedschaften[0]!;

  return {
    supabase,
    user,
    mitglied,
    betriebId: mitglied.betrieb_id,
    rolle: mitglied.rolle,
    mitgliedschaften,
  };
}

export type BetriebKontext = Awaited<ReturnType<typeof betriebKontext>>;

/** Nur Inhaber und Disponenten; Mitarbeiter landen in der App. */
export async function bueroKontext() {
  const k = await betriebKontext();
  if (!istBueroRolle(k.rolle)) redirect("/app");
  return k;
}

export async function inhaberKontext() {
  const k = await betriebKontext();
  if (k.rolle !== "inhaber") redirect("/dashboard");
  return k;
}
