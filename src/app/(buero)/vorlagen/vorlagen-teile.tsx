"use client";

import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { FormularDialog, LoeschenKnopf } from "@/components/aktion-knoepfe";
import {
  AuswahlFeld,
  Formfehler,
  KontrollkaestchenFeld,
  TextFeld,
  TextbereichFeld,
  useAktionsFormular,
} from "@/components/formular/formular";
import { Button } from "@/components/ui/button";
import {
  bedarfHinzufuegen,
  bedarfLoeschen,
  branchenpaketInstallieren,
  taetigkeitHinzufuegen,
  taetigkeitLoeschen,
  taetigkeitVerschieben,
  vorlageSpeichern,
} from "@/lib/aktionen/vorlagen";
import { BRANCHEN } from "@/lib/schemas/konto";
import {
  BEDARFSBEZUEGE,
  bedarfSchema,
  taetigkeitSchema,
  vorlageSchema,
} from "@/lib/schemas/vorlage";
import type { z } from "zod";

// ---------------------------------------------------------------------------
// Branchenpaket
// ---------------------------------------------------------------------------
export function BranchenpaketKarte({ vorauswahl }: { vorauswahl: string[] }) {
  const [auswahl, setAuswahl] = useState<string[]>(vorauswahl);
  const [laeuft, starte] = useTransition();
  return (
    <div className="bg-muted/30 flex flex-col gap-3 rounded-lg border p-4">
      <div>
        <h2 className="font-medium">Branchenpaket übernehmen</h2>
        <p className="text-muted-foreground text-sm">
          Typische Vorlagen mit Checklisten, Sollzeiten und Materialbedarf, passende Artikel und
          eine Start-Preisliste. Bereits vorhandene Einträge mit gleichem Namen bleiben unverändert.
        </p>
      </div>
      <div className="flex flex-wrap gap-4">
        {BRANCHEN.map((b) => (
          <label key={b.wert} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4"
              checked={auswahl.includes(b.wert)}
              onChange={(e) =>
                setAuswahl((a) =>
                  e.target.checked ? [...a, b.wert] : a.filter((x) => x !== b.wert),
                )
              }
            />
            {b.text}
          </label>
        ))}
      </div>
      <div>
        <Button
          disabled={laeuft || auswahl.length === 0}
          onClick={() =>
            starte(async () => {
              const e = await branchenpaketInstallieren(auswahl);
              if (e.ok) toast.success(e.meldung ?? "Übernommen.");
              else toast.error(e.fehler);
            })
          }
        >
          {laeuft ? "Übernehme …" : "Mit einem Klick übernehmen"}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Vorlage (Kopfdaten)
// ---------------------------------------------------------------------------
export type VorlageWerte = z.input<typeof vorlageSchema>;

export function VorlageFormular({ id, werte }: { id: string | null; werte: VorlageWerte }) {
  const { form, absenden, serverFehler, laeuft } = useAktionsFormular(vorlageSchema, {
    standard: werte,
    aktion: (d) => vorlageSpeichern(id, d),
  });
  return (
    <form onSubmit={absenden} className="flex flex-col gap-4" noValidate>
      <Formfehler text={serverFehler} />
      <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
        <TextFeld form={form} name="name" label="Name" autoFocus={!id} />
        <AuswahlFeld form={form} name="branche" label="Branche" leer="–" optionen={BRANCHEN} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <TextFeld
          form={form}
          name="sollzeit_minuten"
          label="Grundzeit (Min.)"
          type="number"
          hinweis="je Einsatz"
        />
        <TextFeld
          form={form}
          name="minuten_pro_100m2"
          label="+ Min. je 100 m²"
          inputMode="decimal"
          hinweis="aus dem Raumbuch"
        />
        <TextFeld
          form={form}
          name="minuten_pro_fenster"
          label="+ Min. je Fenster"
          inputMode="decimal"
          hinweis="aus dem Fensteraufmaß"
        />
      </div>
      <TextbereichFeld form={form} name="beschreibung" label="Beschreibung" rows={2} />
      <KontrollkaestchenFeld form={form} name="aktiv" label="Aktiv" />
      <div>
        <Button type="submit" disabled={laeuft}>
          {id ? "Speichern" : "Vorlage anlegen"}
        </Button>
      </div>
    </form>
  );
}

export function NeueVorlage() {
  return (
    <FormularDialog titel="Neue Auftragsvorlage" ausloeser={<Button>Neue Vorlage</Button>}>
      {() => (
        <VorlageFormular
          id={null}
          werte={{
            name: "",
            branche: null,
            beschreibung: "",
            sollzeit_minuten: 60,
            minuten_pro_100m2: "",
            minuten_pro_fenster: "",
            aktiv: true,
          }}
        />
      )}
    </FormularDialog>
  );
}

// ---------------------------------------------------------------------------
// Tätigkeiten (Checkliste)
// ---------------------------------------------------------------------------
export function Taetigkeiten({
  vorlageId,
  liste,
}: {
  vorlageId: string;
  liste: { id: string; text: string; foto_pflicht: boolean }[];
}) {
  const [laeuft, starte] = useTransition();
  const { form, absenden, serverFehler } = useAktionsFormular(taetigkeitSchema, {
    standard: { vorlage_id: vorlageId, text: "", foto_pflicht: false },
    aktion: taetigkeitHinzufuegen,
    erfolg: () => form.reset({ vorlage_id: vorlageId, text: "", foto_pflicht: false }),
  });
  const verschiebe = (id: string, r: -1 | 1) =>
    starte(async () => {
      const e = await taetigkeitVerschieben(id, vorlageId, r);
      if (!e.ok) toast.error(e.fehler);
    });

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-medium">Checkliste</h2>
      {liste.length > 0 && (
        <ol className="divide-y rounded-lg border">
          {liste.map((t, i) => (
            <li key={t.id} className="flex items-center gap-2 p-2 text-sm">
              <span className="text-muted-foreground w-6 text-right tabular-nums">{i + 1}.</span>
              <span className="flex-1">
                {t.text}
                {t.foto_pflicht && <span className="text-muted-foreground"> · Foto Pflicht</span>}
              </span>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="nach oben"
                disabled={laeuft || i === 0}
                onClick={() => verschiebe(t.id, -1)}
              >
                <ArrowUpIcon />
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="nach unten"
                disabled={laeuft || i === liste.length - 1}
                onClick={() => verschiebe(t.id, 1)}
              >
                <ArrowDownIcon />
              </Button>
              <LoeschenKnopf
                aktion={() => taetigkeitLoeschen(t.id, vorlageId)}
                frage="Tätigkeit entfernen?"
                text="Entfernen"
              />
            </li>
          ))}
        </ol>
      )}
      <form onSubmit={absenden} className="flex flex-wrap items-start gap-3" noValidate>
        <TextFeld
          form={form}
          name="text"
          label="Neue Tätigkeit"
          className="min-w-64 flex-1"
          placeholder="z. B. Spiegel reinigen"
        />
        <div className="flex items-center gap-3 sm:mt-7">
          <KontrollkaestchenFeld form={form} name="foto_pflicht" label="Foto Pflicht" />
          <Button type="submit" size="sm" variant="outline">
            Hinzufügen
          </Button>
        </div>
      </form>
      <Formfehler text={serverFehler} />
    </section>
  );
}

// ---------------------------------------------------------------------------
// Material- und Werkzeugbedarf
// ---------------------------------------------------------------------------
export type BedarfZeile = {
  id: string;
  menge: number;
  bezug: string;
  artikel: { id: string; name: string; einheit: string; art: string };
};

export function Bedarf({
  vorlageId,
  liste,
  artikel,
}: {
  vorlageId: string;
  liste: BedarfZeile[];
  artikel: { id: string; name: string; einheit: string }[];
}) {
  const { form, absenden, serverFehler, laeuft } = useAktionsFormular(bedarfSchema, {
    standard: { vorlage_id: vorlageId, artikel_id: "", menge: "", bezug: "einsatz" },
    aktion: bedarfHinzufuegen,
    erfolg: () =>
      form.reset({ vorlage_id: vorlageId, artikel_id: "", menge: "", bezug: "einsatz" }),
  });
  const bezugText = (b: string) => BEDARFSBEZUEGE.find((x) => x.wert === b)?.text ?? b;

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="font-medium">Material und Werkzeug</h2>
        <p className="text-muted-foreground text-sm">
          Grundlage für Packliste, Abbuchung und Materialprognose. Verschleißteile und Geräte mit
          Menge 1 eintragen; gezählt wird nach der Lebensdauer am Artikel.
        </p>
      </div>
      {liste.length > 0 && (
        <ul className="divide-y rounded-lg border">
          {liste.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-2 p-2 text-sm">
              <span>
                <span className="font-medium">{b.artikel.name}</span>{" "}
                <span className="text-muted-foreground">
                  {b.menge.toLocaleString("de-DE", { maximumFractionDigits: 4 })}{" "}
                  {b.artikel.einheit} {bezugText(b.bezug)}
                </span>
              </span>
              <LoeschenKnopf
                aktion={() => bedarfLoeschen(b.id, vorlageId)}
                text="Entfernen"
                frage="Bedarf entfernen?"
              />
            </li>
          ))}
        </ul>
      )}
      <form
        onSubmit={absenden}
        className="grid items-start gap-3 sm:grid-cols-[1fr_7rem_9rem_auto]"
        noValidate
      >
        <AuswahlFeld
          form={form}
          name="artikel_id"
          label="Artikel"
          leer="Bitte wählen …"
          optionen={artikel.map((a) => ({ wert: a.id, text: `${a.name} (${a.einheit})` }))}
        />
        <TextFeld form={form} name="menge" label="Menge" inputMode="decimal" />
        <AuswahlFeld form={form} name="bezug" label="Bezug" optionen={BEDARFSBEZUEGE} />
        <Button type="submit" size="sm" variant="outline" disabled={laeuft} className="sm:mt-7">
          Hinzufügen
        </Button>
      </form>
      <Formfehler text={serverFehler} />
    </section>
  );
}
