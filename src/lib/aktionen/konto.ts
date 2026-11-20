"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { type AktionErgebnis, dbFehler, fehler, pruefe } from "@/lib/aktion";
import { BETRIEB_COOKIE, aktuellerBenutzer } from "@/lib/auth";
import { siteUrl } from "@/lib/env";
import {
  betriebAnlegenSchema,
  einladungRegistrierungSchema,
  loginSchema,
  passwortNeuSchema,
  passwortVergessenSchema,
  registrierungSchema,
} from "@/lib/schemas/konto";
import { createClient } from "@/lib/supabase/server";

function sichererPfad(next: string | undefined | null, standard = "/dashboard") {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : standard;
}

export async function anmelden(
  eingabe: z.input<typeof loginSchema>,
  next?: string,
): Promise<AktionErgebnis | void> {
  const p = pruefe(loginSchema, eingabe);
  if (!p.ok) return p.ergebnis;
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: p.daten.email,
    password: p.daten.passwort,
  });
  if (error) {
    return fehler(
      error.code === "email_not_confirmed"
        ? "Bitte zuerst die E-Mail-Adresse bestätigen (Link im Postfach)."
        : "E-Mail oder Passwort ist falsch.",
    );
  }
  redirect(sichererPfad(next));
}

export async function registrieren(
  eingabe: z.input<typeof registrierungSchema>,
): Promise<AktionErgebnis | void> {
  const p = pruefe(registrierungSchema, eingabe);
  if (!p.ok) return p.ergebnis;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: p.daten.email,
    password: p.daten.passwort,
    options: {
      emailRedirectTo: `${siteUrl()}/auth/confirm?next=/dashboard`,
      data: {
        betrieb_name: p.daten.betriebName,
        anzeigename: p.daten.anzeigename,
        branchen: p.daten.branchen,
      },
    },
  });
  if (error) {
    return fehler(
      error.code === "user_already_exists"
        ? "Für diese E-Mail gibt es schon ein Konto. Bitte anmelden."
        : error.message,
    );
  }
  if (data.session) redirect("/dashboard");
  return {
    ok: true,
    meldung: "Fast geschafft: Bitte bestätige deine E-Mail-Adresse über den Link im Postfach.",
  };
}

export async function mitEinladungRegistrieren(
  eingabe: z.input<typeof einladungRegistrierungSchema>,
): Promise<AktionErgebnis | void> {
  const p = pruefe(einladungRegistrierungSchema, eingabe);
  if (!p.ok) return p.ergebnis;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: p.daten.email,
    password: p.daten.passwort,
    options: {
      emailRedirectTo: `${siteUrl()}/auth/confirm?next=/dashboard`,
      data: { einladung_token: p.daten.token, anzeigename: p.daten.anzeigename },
    },
  });
  if (error) {
    if (error.code === "user_already_exists") {
      return fehler(
        "Für diese E-Mail gibt es schon ein Konto. Bitte anmelden und Einladung annehmen.",
      );
    }
    return fehler(
      error.message.includes("Database error")
        ? "Einladung ungültig, abgelaufen oder für eine andere E-Mail-Adresse."
        : error.message,
    );
  }
  if (data.session) redirect("/dashboard");
  return { ok: true, meldung: "Bitte bestätige deine E-Mail-Adresse über den Link im Postfach." };
}

export async function einladungAnnehmen(token: string): Promise<AktionErgebnis | void> {
  const { supabase, user } = await aktuellerBenutzer();
  if (!user) return fehler("Bitte zuerst anmelden.");
  const { data, error } = await supabase.rpc("einladung_annehmen", { p_token: token });
  if (error) return fehler(dbFehler(error));
  (await cookies()).set(BETRIEB_COOKIE, data, { path: "/", sameSite: "lax", httpOnly: true });
  redirect("/dashboard");
}

export async function passwortVergessen(
  eingabe: z.input<typeof passwortVergessenSchema>,
): Promise<AktionErgebnis> {
  const p = pruefe(passwortVergessenSchema, eingabe);
  if (!p.ok) return p.ergebnis;
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(p.daten.email, {
    redirectTo: `${siteUrl()}/auth/confirm?next=/passwort-neu`,
  });
  // Immer gleiche Antwort, damit niemand prüfen kann, ob eine Adresse registriert ist.
  return {
    ok: true,
    meldung: "Wenn ein Konto existiert, ist ein Link zum Zurücksetzen unterwegs.",
  };
}

export async function passwortSetzen(
  eingabe: z.input<typeof passwortNeuSchema>,
): Promise<AktionErgebnis | void> {
  const p = pruefe(passwortNeuSchema, eingabe);
  if (!p.ok) return p.ergebnis;
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: p.daten.passwort });
  if (error) return fehler("Link abgelaufen oder ungültig. Bitte erneut anfordern.");
  redirect("/dashboard");
}

export async function abmelden() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  (await cookies()).delete(BETRIEB_COOKIE);
  redirect("/login");
}

export async function betriebAnlegen(
  eingabe: z.input<typeof betriebAnlegenSchema>,
): Promise<AktionErgebnis | void> {
  const p = pruefe(betriebAnlegenSchema, eingabe);
  if (!p.ok) return p.ergebnis;
  const { supabase, user } = await aktuellerBenutzer();
  if (!user) redirect("/login");
  const { data, error } = await supabase.rpc("betrieb_anlegen", {
    p_name: p.daten.betriebName,
    p_branchen: p.daten.branchen,
  });
  if (error) return fehler(dbFehler(error));
  (await cookies()).set(BETRIEB_COOKIE, data, { path: "/", sameSite: "lax", httpOnly: true });
  redirect("/dashboard");
}

export async function betriebWechseln(betriebId: string) {
  (await cookies()).set(BETRIEB_COOKIE, betriebId, { path: "/", sameSite: "lax", httpOnly: true });
  revalidatePath("/", "layout");
  redirect("/dashboard");
}
