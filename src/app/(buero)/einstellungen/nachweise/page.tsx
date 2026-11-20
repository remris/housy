import type { Metadata } from "next";
import { bueroKontext } from "@/lib/auth";
import { NachweisEinstellungen } from "./nachweis-einstellungen";

export const metadata: Metadata = { title: "Einstellungen Nachweise" };

export default async function NachweisEinstellungenSeite() {
  const k = await bueroKontext();
  const { data: b } = await k.supabase
    .from("betrieb")
    .select("email, nachweis_kopie, nachweis_fotos")
    .eq("id", k.betriebId)
    .single();
  if (!b) return null;
  const versand = !!process.env.RESEND_API_KEY && !!process.env.MAIL_ABSENDER;
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      {!versand && (
        <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          Der Mail-Versand ist noch nicht eingerichtet (RESEND_API_KEY und MAIL_ABSENDER). Nachweise
          werden erstellt und unter „Nachweise“ abgelegt, aber nicht verschickt.
        </p>
      )}
      <NachweisEinstellungen
        darfAendern={k.rolle === "inhaber"}
        firmenEmail={b.email}
        werte={{ nachweis_kopie: b.nachweis_kopie, nachweis_fotos: b.nachweis_fotos }}
      />
      <p className="text-muted-foreground text-sm">
        Ob ein Kunde Nachweise nach jedem Einsatz, einmal im Monat oder gar nicht automatisch
        bekommt, stellst du beim Kunden ein. Antworten der Kunden gehen an die Firmen-E-Mail.
      </p>
    </div>
  );
}
