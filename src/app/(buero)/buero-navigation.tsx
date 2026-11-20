"use client";

import { MenuIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { NAVIGATION, type NavEintrag } from "./navigation";

function Links({ eintraege, onKlick }: { eintraege: NavEintrag[]; onKlick?: () => void }) {
  const pfad = usePathname();
  return (
    <nav className="flex flex-col gap-0.5">
      {eintraege.map(({ href, text, icon: Icon }) => {
        const aktiv = pfad === href || pfad.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            onClick={onKlick}
            aria-current={aktiv ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm",
              aktiv ? "bg-muted font-medium" : "text-muted-foreground hover:bg-muted/60",
            )}
          >
            <Icon className="size-4" />
            {text}
          </Link>
        );
      })}
    </nav>
  );
}

export function Seitenleiste({ hrefs }: { hrefs: string[] }) {
  const eintraege = NAVIGATION.filter((e) => hrefs.includes(e.href));
  return <Links eintraege={eintraege} />;
}

export function MobilMenue({ hrefs, kopf }: { hrefs: string[]; kopf: React.ReactNode }) {
  const [offen, setOffen] = useState(false);
  const eintraege = NAVIGATION.filter((e) => hrefs.includes(e.href));
  return (
    <div className="md:hidden">
      <div className="flex h-14 items-center justify-between border-b px-4">
        <Link href="/dashboard" className="font-semibold">
          Housy
        </Link>
        <button
          type="button"
          aria-label="Menü"
          aria-expanded={offen}
          onClick={() => setOffen((o) => !o)}
          className="hover:bg-muted rounded-md p-2"
        >
          <MenuIcon className="size-5" />
        </button>
      </div>
      {offen && (
        <div className="flex flex-col gap-3 border-b p-3">
          {kopf}
          <Links eintraege={eintraege} onKlick={() => setOffen(false)} />
        </div>
      )}
    </div>
  );
}
