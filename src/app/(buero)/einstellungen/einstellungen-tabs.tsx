"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/einstellungen", text: "Firmendaten" },
  { href: "/einstellungen/team", text: "Team" },
  { href: "/einstellungen/vertraege", text: "Verträge" },
  { href: "/einstellungen/nachweise", text: "Nachweise" },
  { href: "/einstellungen/rechnungen", text: "Rechnungen" },
  { href: "/einstellungen/website", text: "Website & Buchung" },
];

export function EinstellungenTabs() {
  const pfad = usePathname();
  return (
    <div className="mb-6 flex gap-1 border-b">
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={cn(
            "-mb-px border-b-2 px-3 py-2 text-sm",
            pfad === t.href
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
