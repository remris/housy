import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthRahmen } from "@/components/auth-rahmen";
import { aktuellerBenutzer } from "@/lib/auth";
import { BetriebAnlegenFormular } from "./betrieb-anlegen-formular";

export const metadata: Metadata = { title: "Betrieb anlegen" };

export default async function BetriebAnlegenSeite() {
  const { user } = await aktuellerBenutzer();
  if (!user) redirect("/login");
  return (
    <AuthRahmen
      titel="Betrieb anlegen"
      beschreibung="Dein Konto gehört noch zu keinem Betrieb. Lege einen an oder nimm eine Einladung an."
    >
      <BetriebAnlegenFormular />
    </AuthRahmen>
  );
}
