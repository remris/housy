"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { z } from "zod";
import {
  Formfehler,
  KontrollkaestchenFeld,
  TextFeld,
  useAktionsFormular,
} from "@/components/formular/formular";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatEuro } from "@/domain/geld";
import { type BuchungsEinstellungen, preisBerechnen } from "@/domain/preisrechner";
import { buchungEinstellungenSpeichern, websiteSpeichern } from "@/lib/aktionen/angebote";
import { websiteSchema } from "@/lib/schemas/anfrage";

export function Kopieren({ text, label }: { text: string; label: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex gap-2">
        <code className="bg-muted flex-1 overflow-x-auto rounded-md p-2 text-xs whitespace-pre">
          {text}
        </code>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            void navigator.clipboard.writeText(text);
            toast.success("Kopiert.");
          }}
        >
          Kopieren
        </Button>
      </div>
    </div>
  );
}

export function WebsiteFormular({
  werte,
  darfAendern,
}: {
  werte: z.input<typeof websiteSchema>;
  darfAendern: boolean;
}) {
  const { form, absenden, serverFehler, laeuft } = useAktionsFormular(websiteSchema, {
    standard: werte,
    aktion: websiteSpeichern,
  });
  return (
    <form onSubmit={absenden} className="flex flex-col gap-3" noValidate>
      <fieldset disabled={!darfAendern || laeuft} className="flex flex-col gap-3">
        <Formfehler text={serverFehler} />
        <KontrollkaestchenFeld
          form={form}
          name="anfrage_aktiv"
          label="Anfrageformular ist erreichbar"
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <TextFeld
            form={form}
            name="datenschutz_url"
            label="Link zur Datenschutzerklärung"
            placeholder="https://…"
          />
          <TextFeld
            form={form}
            name="impressum_url"
            label="Link zum Impressum"
            placeholder="https://…"
          />
        </div>
        {darfAendern && (
          <div>
            <Button type="submit">Speichern</Button>
          </div>
        )}
      </fieldset>
    </form>
  );
}

const euro = (cent: number) => (cent / 100).toFixed(2).replace(".", ",");
const zuCent = (text: string) => Math.max(0, Math.round(Number(text.replace(",", ".")) * 100) || 0);

export function BuchungsEditor({
  start,
  vorlagen,
  darfAendern,
  kleinunternehmer,
}: {
  start: BuchungsEinstellungen;
  vorlagen: { id: string; name: string }[];
  darfAendern: boolean;
  kleinunternehmer: boolean;
}) {
  const [e, setE] = useState(start);
  const [preise, setPreise] = useState(() => start.positionen.map((p) => euro(p.preisCent)));
  const [laeuft, starte] = useTransition();
  const setze = <K extends keyof BuchungsEinstellungen>(k: K, v: BuchungsEinstellungen[K]) =>
    setE((x) => ({ ...x, [k]: v }));
  const beispiel = preisBerechnen(
    e,
    { anzahl: { [e.positionen[0]?.id ?? ""]: 12 }, rahmen: false },
    kleinunternehmer,
  );

  const speichern = () =>
    starte(async () => {
      const r = await buchungEinstellungenSpeichern({
        ...e,
        positionen: e.positionen.map((p, i) => ({ ...p, preisCent: zuCent(preise[i] ?? "0") })),
      });
      if (r.ok) toast.success(r.meldung ?? "Gespeichert.");
      else toast.error(Object.values(r.feldfehler ?? {}).flat()[0] ?? r.fehler);
    });

  const zahl = (
    label: string,
    k: "rahmenProzent" | "vorlaufTage" | "horizontTage" | "ruestMinuten",
  ) => (
    <label className="flex flex-col gap-1 text-sm">
      {label}
      <Input
        inputMode="numeric"
        value={String(e[k])}
        onChange={(ev) => setze(k, Number(ev.target.value.replace(/\D/g, "")) || 0)}
      />
    </label>
  );
  const geld = (label: string, k: "anfahrtCent" | "mindestpreisCent") => (
    <label className="flex flex-col gap-1 text-sm">
      {label}
      <Input
        inputMode="decimal"
        defaultValue={euro(e[k])}
        onBlur={(ev) => setze(k, zuCent(ev.target.value))}
      />
    </label>
  );

  return (
    <fieldset disabled={!darfAendern || laeuft} className="flex flex-col gap-4">
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          className="size-4"
          checked={e.aktiv}
          onChange={(ev) => setze("aktiv", ev.target.checked)}
        />
        Online-Buchung ist aktiv
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Auftragsvorlage für gebuchte Einsätze
        <select
          className="border-input bg-background h-9 rounded-lg border px-2"
          value={e.vorlageId ?? ""}
          onChange={(ev) => setze("vorlageId", ev.target.value || null)}
        >
          <option value="">– wählen –</option>
          {vorlagen.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
      </label>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">
          Fensterarten (Preis netto je Stück, Minuten je Stück)
        </span>
        {e.positionen.map((p, i) => (
          <div key={p.id} className="grid grid-cols-[1fr_6rem_5rem_auto] items-center gap-2">
            <Input
              aria-label="Bezeichnung"
              value={p.name}
              onChange={(ev) =>
                setze(
                  "positionen",
                  e.positionen.map((x, j) => (j === i ? { ...x, name: ev.target.value } : x)),
                )
              }
            />
            <Input
              aria-label="Preis"
              inputMode="decimal"
              value={preise[i] ?? ""}
              onChange={(ev) =>
                setPreise((ps) => ps.map((x, j) => (j === i ? ev.target.value : x)))
              }
            />
            <Input
              aria-label="Minuten"
              inputMode="numeric"
              value={String(p.minuten)}
              onChange={(ev) =>
                setze(
                  "positionen",
                  e.positionen.map((x, j) =>
                    j === i
                      ? { ...x, minuten: Number(ev.target.value.replace(/\D/g, "")) || 0 }
                      : x,
                  ),
                )
              }
            />
            <Button
              size="icon"
              variant="ghost"
              aria-label="Entfernen"
              onClick={() => {
                setze(
                  "positionen",
                  e.positionen.filter((_, j) => j !== i),
                );
                setPreise((ps) => ps.filter((_, j) => j !== i));
              }}
            >
              <Trash2Icon />
            </Button>
          </div>
        ))}
        <Button
          size="sm"
          variant="outline"
          className="self-start"
          onClick={() => {
            setze("positionen", [
              ...e.positionen,
              {
                id: `art-${Date.now().toString(36)}`,
                name: "Neue Fensterart",
                preisCent: 0,
                minuten: 5,
              },
            ]);
            setPreise((ps) => [...ps, "0,00"]);
          }}
        >
          <PlusIcon /> Fensterart
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {zahl("Rahmen-Aufschlag (%)", "rahmenProzent")}
        {geld("Anfahrt netto (€)", "anfahrtCent")}
        {geld("Mindestauftrag netto (€)", "mindestpreisCent")}
        {zahl("Vorlauf (Tage)", "vorlaufTage")}
        {zahl("Buchbar im Voraus (Tage)", "horizontTage")}
        {zahl("Rüstzeit je Einsatz (Min.)", "ruestMinuten")}
      </div>
      {!kleinunternehmer && (
        <label className="flex items-center gap-2 text-sm">
          USt-Satz
          <select
            className="border-input bg-background h-9 rounded-lg border px-2"
            value={e.ustSatz}
            onChange={(ev) => setze("ustSatz", Number(ev.target.value) as 19 | 7)}
          >
            <option value={19}>19 %</option>
            <option value={7}>7 %</option>
          </select>
        </label>
      )}
      <p className="text-muted-foreground text-sm">
        Beispiel: 12 × {e.positionen[0]?.name ?? "Fenster"} ohne Rahmen ={" "}
        {formatEuro(beispiel.bruttoCent)}
        {kleinunternehmer ? "" : " inkl. USt."}, Dauer etwa {beispiel.minuten} Minuten. Freie
        Termine ergeben sich aus den Arbeitszeiten der Mitarbeiter (Planung → Arbeitszeiten) und der
        Planung.
      </p>
      {darfAendern && (
        <div>
          <Button onClick={speichern}>Speichern</Button>
        </div>
      )}
    </fieldset>
  );
}
