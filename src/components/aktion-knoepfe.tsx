"use client";

import { useState, useTransition, type ReactElement, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { AktionErgebnis } from "@/lib/aktion";

/** Knopf mit Rückfrage, der eine Server Action ausführt und das Ergebnis als Toast meldet. */
export function LoeschenKnopf({
  aktion,
  frage = "Wirklich löschen?",
  text = "Löschen",
  variante = "ghost",
}: {
  aktion: () => Promise<AktionErgebnis<unknown> | void>;
  frage?: string;
  text?: string;
  variante?: "ghost" | "destructive" | "outline";
}) {
  const [laeuft, starte] = useTransition();
  return (
    <Button
      type="button"
      size="sm"
      variant={variante}
      disabled={laeuft}
      onClick={() => {
        if (!window.confirm(frage)) return;
        starte(async () => {
          const e = await aktion();
          if (!e) return;
          if (e.ok) toast.success(e.meldung ?? "Gelöscht.");
          else toast.error(e.fehler);
        });
      }}
    >
      {text}
    </Button>
  );
}

/** Dialog mit Formular; `children` bekommt `schliessen`, um nach Erfolg zu schließen. */
export function FormularDialog({
  titel,
  ausloeser,
  children,
}: {
  titel: string;
  ausloeser: ReactElement;
  children: (schliessen: () => void) => ReactNode;
}) {
  const [offen, setOffen] = useState(false);
  return (
    <Dialog open={offen} onOpenChange={setOffen}>
      <DialogTrigger render={ausloeser} />
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{titel}</DialogTitle>
        </DialogHeader>
        {offen && children(() => setOffen(false))}
      </DialogContent>
    </Dialog>
  );
}
