import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { abmelden } from "@/lib/aktionen/konto";
import { betriebKontext } from "@/lib/auth";

export const metadata: Metadata = { title: "Heute" };
export const dynamic = "force-dynamic";

/** Platzhalter für die Mitarbeiter-PWA (M6). */
export default async function AppStart() {
  const k = await betriebKontext();
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-4 py-8">
      <div>
        <p className="text-muted-foreground text-sm">{k.mitglied.betrieb?.name}</p>
        <h1 className="text-2xl font-semibold">Hallo {k.mitglied.anzeigename ?? ""}</h1>
      </div>
      <p className="text-muted-foreground">
        Die Mitarbeiter-App mit Tagesansicht, Checkliste und Zeiterfassung folgt in Kürze.
      </p>
      <form action={abmelden}>
        <Button variant="outline" type="submit" className="w-full">
          Abmelden
        </Button>
      </form>
    </main>
  );
}
