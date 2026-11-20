"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { auswahlKlasse } from "@/components/formular/formular";
import { einsatzZuweisen } from "@/lib/aktionen/planung";

export function Zuweisen({
  id,
  datum,
  optionen,
}: {
  id: string;
  datum: string;
  optionen: { wert: string; text: string }[];
}) {
  const [laeuft, starte] = useTransition();
  return (
    <select
      aria-label="Mitarbeiter zuweisen"
      className={auswahlKlasse}
      disabled={laeuft}
      defaultValue=""
      onChange={(ev) => {
        const mitarbeiter = ev.target.value;
        if (!mitarbeiter) return;
        starte(async () => {
          const e = await einsatzZuweisen({ id, mitarbeiter_id: mitarbeiter, datum });
          if (e.ok) toast.success(e.meldung ?? "Zugewiesen.");
          else toast.error(e.fehler);
        });
      }}
    >
      <option value="">Mitarbeiter wählen …</option>
      {optionen.map((o) => (
        <option key={o.wert} value={o.wert}>
          {o.text}
        </option>
      ))}
    </select>
  );
}
