"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/inventar", text: "Bestände & Einkauf" },
  { href: "/inventar/werkzeuge", text: "Werkzeuge & Prüfungen" },
  { href: "/inventar/lagerorte", text: "Lagerorte & Buchungen" },
];

export function InventarTabs() {
  const pfad = usePathname();
  return (
    <div className="mb-6 flex gap-1 overflow-x-auto overflow-y-hidden border-b">
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={cn(
            "-mb-px shrink-0 border-b-2 px-3 py-2 text-sm",
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
