"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/planung", text: "Wochenplan" },
  { href: "/planung/offen", text: "Offene Einsätze" },
  { href: "/planung/mitarbeiter", text: "Arbeitszeiten & Abwesenheit" },
  { href: "/planung/fahrzeuge", text: "Fahrzeuge & Tourstart" },
];

export function PlanungTabs() {
  const pfad = usePathname();
  const aktiv = (href: string) =>
    href === "/planung" ? pfad === href || pfad.startsWith("/planung/tour") : pfad.startsWith(href);
  return (
    <div className="mb-6 flex gap-1 overflow-x-auto overflow-y-hidden border-b">
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={cn(
            "-mb-px shrink-0 border-b-2 px-3 py-2 text-sm",
            aktiv(t.href)
              ? "border-foreground font-medium"
              : "text-muted-foreground border-transparent",
          )}
        >
          {t.text}
        </Link>
      ))}
    </div>
  );
}
