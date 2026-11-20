"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { UnterschriftFeld } from "@/components/unterschrift-feld";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { angebotBeantworten } from "@/lib/aktionen/oeffentlich";

export function AngebotAntwort({ token, name: vorschlag }: { token: string; name: string }) {
  const [name, setName] = useState(vorschlag);
  const [bild, setBild] = useState<string | null>(null);
  const [zustimmung, setZustimmung] = useState(false);
  const [ablehnen, setAblehnen] = useState(false);
  const [grund, setGrund] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [laeuft, starte] = useTransition();
  const router = useRouter();

  const senden = (antwort: Parameters<typeof angebotBeantworten>[1]) =>
    starte(async () => {
      setFehler(null);
      const r = await angebotBeantworten(token, antwort);
      if (r.ok) {
        setMeldung(r.meldung ?? null);
        router.refresh();
      } else setFehler(r.fehler);
    });

  if (meldung) return <p className="text-sm font-medium">{meldung}</p>;

  if (ablehnen) {
    return (
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Was passt nicht? (optional)
          <Textarea rows={2} value={grund} onChange={(e) => setGrund(e.target.value)} />
        </label>
        {fehler && <p className="text-destructive text-sm">{fehler}</p>}
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={() => setAblehnen(false)}>
            Zurück
          </Button>
          <Button
            variant="destructive"
            disabled={laeuft}
            onClick={() => senden({ annehmen: false, grund })}
          >
            Angebot ablehnen
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 border-t pt-4" data-annahme>
      <h2 className="font-medium">Angebot annehmen</h2>
      <label className="flex flex-col gap-1 text-sm">
        Ihr Name
        <Input value={name} autoComplete="name" onChange={(e) => setName(e.target.value)} />
      </label>
      <div className="flex flex-col gap-1 text-sm">
        Unterschrift (optional)
        <UnterschriftFeld onChange={setBild} />
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-0.5 size-4"
          checked={zustimmung}
          onChange={(e) => setZustimmung(e.target.checked)}
        />
        Ich nehme das Angebot verbindlich an und bin dazu berechtigt.
      </label>
      {fehler && <p className="text-destructive text-sm">{fehler}</p>}
      <Button
        disabled={laeuft || name.trim().length < 2 || !zustimmung}
        onClick={() => senden({ annehmen: true, name, bild })}
      >
        {laeuft ? "Bitte warten …" : "Verbindlich annehmen"}
      </Button>
      <button
        type="button"
        className="text-muted-foreground self-start text-sm underline"
        onClick={() => setAblehnen(true)}
      >
        Angebot ablehnen
      </button>
    </div>
  );
}
