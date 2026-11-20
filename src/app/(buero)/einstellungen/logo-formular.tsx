"use client";

import { useRef, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { logoEntfernen, logoHochladen } from "@/lib/aktionen/betrieb";

export function LogoFormular({
  logoUrl,
  darfAendern,
}: {
  logoUrl: string | null;
  darfAendern: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [laeuft, starte] = useTransition();

  function melde(e: { ok: boolean; meldung?: string; fehler?: string }) {
    if (e.ok) toast.success(e.meldung ?? "Gespeichert.");
    else toast.error(e.fehler ?? "Fehler");
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-medium">Logo</h2>
      <div className="flex items-center gap-4">
        <div className="bg-muted/40 flex size-20 items-center justify-center overflow-hidden rounded-lg border">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- Logo aus Supabase Storage
            <img src={logoUrl} alt="Firmenlogo" className="max-h-full max-w-full object-contain" />
          ) : (
            <span className="text-muted-foreground text-xs">kein Logo</span>
          )}
        </div>
        {darfAendern && (
          <form
            ref={formRef}
            className="flex flex-wrap items-center gap-2"
            action={(fd) =>
              starte(async () => {
                melde(await logoHochladen(fd));
                formRef.current?.reset();
              })
            }
          >
            <input
              type="file"
              name="logo"
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              className="text-sm"
              required
            />
            <Button type="submit" size="sm" disabled={laeuft}>
              Hochladen
            </Button>
            {logoUrl && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={laeuft}
                onClick={() => starte(async () => melde(await logoEntfernen()))}
              >
                Entfernen
              </Button>
            )}
          </form>
        )}
      </div>
      <p className="text-muted-foreground text-xs">PNG, JPG, SVG oder WebP, höchstens 2 MB.</p>
    </section>
  );
}
