"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { mangelStatusSetzen } from "@/lib/aktionen/nachweise";
import { MANGELSTATUS } from "@/lib/schemas/nachweis";

type Status = (typeof MANGELSTATUS)[number]["wert"];

/** Status und Büro-Notiz eines Mangels ändern (Rückmeldungen, Objekt-Seite). */
export function MangelStatus({
  id,
  status,
  notiz,
}: {
  id: string;
  status: Status;
  notiz: string | null;
}) {
  const [wert, setWert] = useState<Status>(status);
  const [text, setText] = useState(notiz ?? "");
  const [laeuft, starte] = useTransition();
  const geaendert = wert !== status || text.trim() !== (notiz ?? "");

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        aria-label="Status"
        className="border-input bg-background h-8 rounded-lg border px-2 text-sm"
        value={wert}
        onChange={(e) => setWert(e.target.value as Status)}
      >
        {MANGELSTATUS.map((m) => (
          <option key={m.wert} value={m.wert}>
            {m.text}
          </option>
        ))}
      </select>
      <Input
        aria-label="Notiz"
        placeholder="Notiz (z. B. an Hausverwaltung gemeldet)"
        className="h-8 min-w-56 flex-1"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <Button
        size="sm"
        variant="outline"
        disabled={!geaendert || laeuft}
        onClick={() =>
          starte(async () => {
            const r = await mangelStatusSetzen({ id, status: wert, notiz_buero: text });
            if (r.ok) toast.success(r.meldung ?? "Gespeichert.");
            else toast.error(r.fehler);
          })
        }
      >
        Speichern
      </Button>
    </div>
  );
}
