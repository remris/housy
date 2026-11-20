"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FeldRahmen, Formfehler } from "@/components/formular/formular";
import { UnterschriftFeld } from "@/components/unterschrift-feld";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

export function KundenUnterschrift({ token, kunde }: { token: string; kunde: string }) {
  const [name, setName] = useState("");
  const [bild, setBild] = useState<string | null>(null);
  const [zustimmung, setZustimmung] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, starte] = useTransition();
  const router = useRouter();

  return (
    <div className="flex flex-col gap-4">
      <Formfehler text={fehler} />
      <FeldRahmen id="name" label={`Name (für ${kunde})`}>
        <Input
          id="name"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </FeldRahmen>
      <UnterschriftFeld onChange={setBild} />
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-0.5 size-4"
          checked={zustimmung}
          onChange={(e) => setZustimmung(e.target.checked)}
        />
        Ich habe den Vertrag gelesen und bin berechtigt, ihn zu unterschreiben.
      </label>
      <Button
        disabled={laeuft || name.trim().length < 2 || !bild || !zustimmung}
        onClick={() =>
          starte(async () => {
            setFehler(null);
            const { error } = await createClient().rpc("vertrag_unterschreiben", {
              p_token: token,
              p_name: name,
              p_bild: bild!,
            });
            if (error) setFehler(error.message);
            else router.refresh();
          })
        }
      >
        Verbindlich unterschreiben
      </Button>
    </div>
  );
}
