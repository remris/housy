"use client";

import { DownloadIcon, LogOutIcon, MonitorIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { spracheAendern } from "@/lib/aktionen/betrieb";
import { abmelden } from "@/lib/aktionen/konto";
import { APP_SPRACHEN, type Uebersetzer } from "@/lib/i18n";
import { SPRACHEN } from "@/lib/schemas/konto";
import { istApple, istInstalliert } from "./werkzeuge";

type InstallEvent = Event & { prompt: () => Promise<void> };

export function Kopf({
  t,
  name,
  betriebName,
  sprache,
  buero,
}: {
  t: Uebersetzer;
  name: string;
  betriebName: string;
  sprache: string;
  buero: boolean;
}) {
  const [, starte] = useTransition();
  const [install, setInstall] = useState<InstallEvent | null>(null);
  const [iosHinweis, setIosHinweis] = useState(false);

  useEffect(() => {
    const merken = (e: Event) => {
      e.preventDefault();
      setInstall(e as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", merken);
    setIosHinweis(istApple() && !istInstalliert());
    return () => window.removeEventListener("beforeinstallprompt", merken);
  }, []);

  return (
    <header className="bg-foreground text-background">
      <div className="mx-auto flex max-w-md items-center gap-3 px-3 py-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs opacity-70">{betriebName}</div>
          <h1 className="truncate text-lg font-semibold">{t("hallo", { name })}</h1>
        </div>
        <select
          aria-label={t("sprache")}
          className="bg-foreground rounded border border-white/30 px-1 py-1 text-sm"
          defaultValue={APP_SPRACHEN.includes(sprache as never) ? sprache : "de"}
          onChange={(e) => {
            const neu = e.target.value;
            starte(async () => {
              const r = await spracheAendern(neu);
              if (r.ok) window.location.reload();
            });
          }}
        >
          {SPRACHEN.filter((s) => APP_SPRACHEN.includes(s.wert as never)).map((s) => (
            <option key={s.wert} value={s.wert}>
              {s.text}
            </option>
          ))}
        </select>
        {buero && (
          <Link href="/dashboard" aria-label={t("bueroAnsicht")} className="p-1 opacity-80">
            <MonitorIcon className="size-5" />
          </Link>
        )}
        <form action={abmelden}>
          <button type="submit" aria-label={t("abmelden")} className="p-1 opacity-80">
            <LogOutIcon className="size-5" />
          </button>
        </form>
      </div>
      {(install || iosHinweis) && (
        <div className="mx-auto max-w-md px-3 pb-3 text-sm">
          {install ? (
            <button
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-white/10 py-2"
              onClick={() => void install.prompt().then(() => setInstall(null))}
            >
              <DownloadIcon className="size-4" />
              {t("installieren")}
            </button>
          ) : (
            <p className="opacity-80">{t("installierenIos")}</p>
          )}
        </div>
      )}
    </header>
  );
}
