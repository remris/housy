"use client";

import { useRef, useTransition } from "react";
import { toast } from "sonner";
import { LoeschenKnopf } from "@/components/aktion-knoepfe";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { objektFotoHochladen, objektFotoLoeschen } from "@/lib/aktionen/kunden";

export function Fotos({
  objektId,
  fotos,
}: {
  objektId: string;
  fotos: { id: string; url: string | null; beschreibung: string | null }[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [laeuft, starte] = useTransition();
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-medium">Fotos</h2>
      <form
        ref={formRef}
        className="flex flex-wrap items-end gap-2"
        action={(fd) =>
          starte(async () => {
            const e = await objektFotoHochladen(objektId, fd);
            if (e.ok) {
              toast.success(e.meldung ?? "Gespeichert.");
              formRef.current?.reset();
            } else toast.error(e.fehler);
          })
        }
      >
        <input
          type="file"
          name="fotos"
          accept="image/jpeg,image/png,image/webp,image/heic"
          multiple
          required
          className="text-sm"
        />
        <Input name="beschreibung" placeholder="Beschreibung (optional)" className="w-56" />
        <Button type="submit" size="sm" disabled={laeuft}>
          {laeuft ? "Lädt hoch …" : "Hochladen"}
        </Button>
      </form>
      {fotos.length === 0 ? (
        <p className="text-muted-foreground text-sm">Noch keine Fotos.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {fotos.map((f) => (
            <li key={f.id} className="overflow-hidden rounded-lg border">
              {f.url ? (
                <a href={f.url} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element -- signierte Storage-URL */}
                  <img
                    src={f.url}
                    alt={f.beschreibung ?? "Objektfoto"}
                    className="aspect-square w-full object-cover"
                  />
                </a>
              ) : (
                <div className="bg-muted aspect-square" />
              )}
              <div className="flex items-center justify-between gap-1 p-2 text-xs">
                <span className="text-muted-foreground truncate">{f.beschreibung ?? ""}</span>
                <LoeschenKnopf
                  aktion={() => objektFotoLoeschen(f.id, objektId)}
                  frage="Foto löschen?"
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
