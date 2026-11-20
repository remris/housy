import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { abmelden, betriebWechseln } from "@/lib/aktionen/konto";
import { ROLLEN_TEXT, bueroKontext } from "@/lib/auth";
import { MobilMenue, Seitenleiste } from "./buero-navigation";
import { NAVIGATION } from "./navigation";

export const dynamic = "force-dynamic";

export default async function BueroLayout({ children }: { children: ReactNode }) {
  const k = await bueroKontext();
  const hrefs = NAVIGATION.filter((e) => !e.nurInhaber || k.rolle === "inhaber").map((e) => e.href);
  const betriebName = k.mitglied.betrieb?.name ?? "Betrieb";

  const kopf = (
    <div className="flex flex-col gap-1 px-1">
      <span className="truncate text-sm font-medium">{betriebName}</span>
      <span className="text-muted-foreground truncate text-xs">
        {k.mitglied.anzeigename ?? k.user.email} · {ROLLEN_TEXT[k.rolle]}
      </span>
      {k.mitgliedschaften.length > 1 && (
        <form className="mt-1 flex flex-col gap-1">
          {k.mitgliedschaften
            .filter((m) => m.betrieb_id !== k.betriebId)
            .map((m) => (
              <button
                key={m.betrieb_id}
                formAction={betriebWechseln.bind(null, m.betrieb_id)}
                className="text-muted-foreground hover:text-foreground text-left text-xs underline"
              >
                Wechseln zu {m.betrieb?.name}
              </button>
            ))}
        </form>
      )}
    </div>
  );

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <MobilMenue hrefs={hrefs} kopf={kopf} />
      <aside className="bg-muted/30 hidden w-60 shrink-0 flex-col gap-6 border-r p-4 md:flex">
        <Link href="/dashboard" className="px-1 text-lg font-semibold tracking-tight">
          Housy
        </Link>
        {kopf}
        <Seitenleiste hrefs={hrefs} />
        <form action={abmelden} className="mt-auto">
          <Button variant="ghost" size="sm" type="submit" className="w-full justify-start">
            Abmelden
          </Button>
        </form>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 md:px-8">{children}</main>
    </div>
  );
}
