"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { FormularDialog, LoeschenKnopf } from "@/components/aktion-knoepfe";
import {
  AuswahlFeld,
  FeldRahmen,
  Formfehler,
  MehrfachAuswahlFeld,
  TextFeld,
  TextbereichFeld,
  useAktionsFormular,
} from "@/components/formular/formular";
import { UnterschriftFeld } from "@/components/unterschrift-feld";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDatum } from "@/domain/datum";
import type { AktionErgebnis } from "@/lib/aktion";
import {
  einsaetzeNeuPlanen,
  imBueroUnterschreiben,
  kuendigungsVorschau,
  leistungLoeschen,
  leistungSpeichern,
  versionAbrechnungSpeichern,
  versionAnlegen,
  vertragAktivieren,
  vertragBeenden,
  vertragKuendigen,
  vertragLoeschen,
  vertragStammSpeichern,
} from "@/lib/aktionen/vertraege";
import { centZuEingabe } from "@/lib/schemas/helfer";
import {
  ABRECHNUNGSARTEN,
  FEIERTAGREGELN,
  FREQUENZEN,
  WOCHENTAGE,
  leistungSchema,
  versionAbrechnungSchema,
  versionSchema,
  vertragStammSchema,
} from "@/lib/schemas/vertrag";
import type { z } from "zod";

function melde(e: AktionErgebnis<unknown> | void) {
  if (!e) return;
  if (e.ok) toast.success(e.meldung ?? "Erledigt.");
  else toast.error(e.fehler);
}

function AktionsKnopf({
  aktion,
  text,
  frage,
  variante = "outline",
}: {
  aktion: () => Promise<AktionErgebnis<unknown> | void>;
  text: string;
  frage?: string;
  variante?: "default" | "outline" | "ghost";
}) {
  const [laeuft, starte] = useTransition();
  return (
    <Button
      size="sm"
      variant={variante}
      disabled={laeuft}
      onClick={() => {
        if (frage && !window.confirm(frage)) return;
        starte(async () => melde(await aktion()));
      }}
    >
      {text}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Status-Aktionen
// ---------------------------------------------------------------------------
export function VertragAktionen({
  id,
  status,
  istInhaber,
  freigabeLink,
}: {
  id: string;
  status: "entwurf" | "aktiv" | "gekuendigt" | "beendet";
  istInhaber: boolean;
  freigabeLink: string;
}) {
  return (
    <>
      <Button
        size="sm"
        variant="outline"
        nativeButton={false}
        render={<a href={`/vertraege/${id}/pdf`} target="_blank" rel="noreferrer" />}
      >
        PDF
      </Button>
      {status === "entwurf" && (
        <Button
          size="sm"
          variant="outline"
          onClick={async () => {
            await navigator.clipboard.writeText(freigabeLink);
            toast.success("Link zum Unterschreiben kopiert.");
          }}
        >
          Link für Kunden
        </Button>
      )}
      {(status === "entwurf" || status === "gekuendigt") && (
        <AktionsKnopf
          aktion={() => vertragAktivieren(id)}
          text={status === "entwurf" ? "Aktivieren" : "Kündigung zurücknehmen"}
          frage={
            status === "entwurf"
              ? "Vertrag aktivieren? Die Einsätze der nächsten 8 Wochen werden geplant."
              : "Kündigung zurücknehmen und Vertrag wieder aktivieren?"
          }
          variante="default"
        />
      )}
      {(status === "aktiv" || status === "gekuendigt") && (
        <AktionsKnopf aktion={() => einsaetzeNeuPlanen(id)} text="Neu planen" />
      )}
      {istInhaber && status === "aktiv" && <KuendigenDialog id={id} />}
      {istInhaber && (status === "aktiv" || status === "gekuendigt") && (
        <AktionsKnopf
          aktion={() => vertragBeenden(id)}
          text="Sofort beenden"
          frage="Vertrag heute beenden? Künftige Einsätze werden entfernt."
          variante="ghost"
        />
      )}
      {istInhaber && status === "entwurf" && (
        <LoeschenKnopf
          aktion={() => vertragLoeschen(id)}
          frage="Entwurf löschen?"
          variante="ghost"
        />
      )}
    </>
  );
}

function KuendigenDialog({ id }: { id: string }) {
  const heute = new Date().toISOString().slice(0, 10);
  const [eingang, setEingang] = useState(heute);
  const [ende, setEnde] = useState<string | null>(null);
  const [laeuft, starte] = useTransition();

  const pruefen = (d: string) =>
    starte(async () =>
      setEnde((await kuendigungsVorschau({ vertrag_id: id, eingang: d })) ?? null),
    );

  return (
    <FormularDialog
      titel="Vertrag kündigen"
      ausloeser={
        <Button size="sm" variant="outline" onClick={() => pruefen(eingang)}>
          Kündigen
        </Button>
      }
    >
      {(schliessen) => (
        <div className="flex flex-col gap-4">
          <FeldRahmen id="eingang" label="Kündigung eingegangen am">
            <Input
              id="eingang"
              type="date"
              value={eingang}
              onChange={(e) => {
                setEingang(e.target.value);
                if (e.target.value) pruefen(e.target.value);
              }}
            />
          </FeldRahmen>
          <p className="text-sm">
            Vertrag endet zum{" "}
            <span className="font-medium">{laeuft ? "…" : ende ? formatDatum(ende) : "–"}</span>.
            Einsätze danach werden entfernt.
          </p>
          <Button
            disabled={laeuft || !ende}
            onClick={() =>
              starte(async () => {
                const e = await vertragKuendigen({ vertrag_id: id, eingang });
                melde(e);
                if (e.ok) schliessen();
              })
            }
          >
            Kündigung erfassen
          </Button>
        </div>
      )}
    </FormularDialog>
  );
}

// ---------------------------------------------------------------------------
// Unterschrift im Büro (Tablet)
// ---------------------------------------------------------------------------
export function UnterschriftDialog({ id }: { id: string }) {
  const [name, setName] = useState("");
  const [bild, setBild] = useState<string | null>(null);
  const [laeuft, starte] = useTransition();
  return (
    <FormularDialog
      titel="Kunde unterschreibt"
      ausloeser={
        <Button size="sm" variant="outline">
          Hier unterschreiben lassen
        </Button>
      }
    >
      {(schliessen) => (
        <div className="flex flex-col gap-4">
          <FeldRahmen id="name" label="Name des Unterzeichners">
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
          </FeldRahmen>
          <UnterschriftFeld onChange={setBild} />
          <Button
            disabled={laeuft || name.trim().length < 2 || !bild}
            onClick={() =>
              starte(async () => {
                const e = await imBueroUnterschreiben(id, name, bild!);
                melde(e);
                if (e.ok) schliessen();
              })
            }
          >
            Unterschrift speichern
          </Button>
        </div>
      )}
    </FormularDialog>
  );
}

// ---------------------------------------------------------------------------
// Stammdaten
// ---------------------------------------------------------------------------
export function StammFormular({
  id,
  werte,
  entwurf,
}: {
  id: string;
  werte: z.input<typeof vertragStammSchema>;
  entwurf: boolean;
}) {
  const { form, absenden, serverFehler, laeuft } = useAktionsFormular(vertragStammSchema, {
    standard: werte,
    aktion: (d) => vertragStammSpeichern(id, d),
  });
  return (
    <form onSubmit={absenden} className="flex flex-col gap-4" noValidate>
      <Formfehler text={serverFehler} />
      <div className="grid gap-4 sm:grid-cols-[1fr_11rem]">
        <TextFeld form={form} name="titel" label="Bezeichnung" />
        <TextFeld form={form} name="beginn" label="Beginn" type="date" disabled={!entwurf} />
      </div>
      <fieldset disabled={!entwurf} className="grid gap-4 sm:grid-cols-4">
        <TextFeld
          form={form}
          name="laufzeit_monate"
          label="Laufzeit (Monate)"
          type="number"
          hinweis="0 = unbefristet"
        />
        <TextFeld
          form={form}
          name="verlaengerung_monate"
          label="Verlängerung (Monate)"
          type="number"
        />
        <TextFeld
          form={form}
          name="kuendigungsfrist_monate"
          label="Kündigungsfrist (Monate)"
          type="number"
        />
        <AuswahlFeld
          form={form}
          name="frist_zum"
          label="Frist zum"
          optionen={[
            { wert: "laufzeitende", text: "Laufzeitende" },
            { wert: "monatsende", text: "Monatsende" },
          ]}
        />
      </fieldset>
      <TextbereichFeld form={form} name="notiz" label="Besondere Vereinbarungen" rows={2} />
      <div>
        <Button type="submit" size="sm" disabled={laeuft}>
          Speichern
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Version: Abrechnung und neue Version
// ---------------------------------------------------------------------------
export function AbrechnungFormular({
  versionId,
  abrechnungsart,
  pauschaleCent,
}: {
  versionId: string;
  abrechnungsart: "pauschale" | "aufwand" | "einzelauftrag";
  pauschaleCent: number | null;
}) {
  const { form, absenden, serverFehler, laeuft } = useAktionsFormular(versionAbrechnungSchema, {
    standard: {
      version_id: versionId,
      abrechnungsart,
      pauschale_cent: centZuEingabe(pauschaleCent),
    },
    aktion: versionAbrechnungSpeichern,
  });
  const art = form.watch("abrechnungsart");
  return (
    <form onSubmit={absenden} className="flex flex-wrap items-start gap-3" noValidate>
      <AuswahlFeld
        form={form}
        name="abrechnungsart"
        label="Abrechnung"
        optionen={ABRECHNUNGSARTEN}
        className="w-48"
      />
      {art === "pauschale" && (
        <TextFeld
          form={form}
          name="pauschale_cent"
          label="Monatspauschale netto (€)"
          inputMode="decimal"
          className="w-48"
        />
      )}
      <Button type="submit" size="sm" variant="outline" disabled={laeuft} className="mt-6">
        Speichern
      </Button>
      <div className="basis-full">
        <Formfehler text={serverFehler} />
      </div>
    </form>
  );
}

export function NeueVersionDialog({
  vertragId,
  abrechnungsart,
  pauschaleCent,
  morgen,
}: {
  vertragId: string;
  abrechnungsart: "pauschale" | "aufwand" | "einzelauftrag";
  pauschaleCent: number | null;
  morgen: string;
}) {
  return (
    <FormularDialog
      titel="Neue Vertragsversion"
      ausloeser={
        <Button size="sm" variant="outline">
          Neue Version
        </Button>
      }
    >
      {(schliessen) => (
        <NeueVersionFormular
          vertragId={vertragId}
          abrechnungsart={abrechnungsart}
          pauschaleCent={pauschaleCent}
          morgen={morgen}
          fertig={schliessen}
        />
      )}
    </FormularDialog>
  );
}

function NeueVersionFormular({
  vertragId,
  abrechnungsart,
  pauschaleCent,
  morgen,
  fertig,
}: {
  vertragId: string;
  abrechnungsart: "pauschale" | "aufwand" | "einzelauftrag";
  pauschaleCent: number | null;
  morgen: string;
  fertig: () => void;
}) {
  const { form, absenden, serverFehler, laeuft } = useAktionsFormular(versionSchema, {
    standard: {
      vertrag_id: vertragId,
      gueltig_ab: morgen,
      grund: "",
      abrechnungsart,
      pauschale_cent: centZuEingabe(pauschaleCent),
    },
    aktion: versionAnlegen,
    erfolg: fertig,
  });
  const art = form.watch("abrechnungsart");
  return (
    <form onSubmit={absenden} className="flex flex-col gap-4" noValidate>
      <p className="text-muted-foreground text-sm">
        Die Leistungen der bisherigen Version werden übernommen und können danach angepasst werden.
        Einsätze vor dem Stichtag bleiben unverändert.
      </p>
      <Formfehler text={serverFehler} />
      <TextFeld form={form} name="gueltig_ab" label="Gültig ab" type="date" min={morgen} />
      <div className="grid gap-4 sm:grid-cols-2">
        <AuswahlFeld
          form={form}
          name="abrechnungsart"
          label="Abrechnung"
          optionen={ABRECHNUNGSARTEN}
        />
        {art === "pauschale" && (
          <TextFeld
            form={form}
            name="pauschale_cent"
            label="Monatspauschale netto (€)"
            inputMode="decimal"
          />
        )}
      </div>
      <TextFeld
        form={form}
        name="grund"
        label="Grund"
        placeholder="z. B. Kellerfenster dauerhaft dazu"
      />
      <Button type="submit" disabled={laeuft}>
        Version anlegen
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Leistungen
// ---------------------------------------------------------------------------
export type LeistungWerte = z.input<typeof leistungSchema>;
type Auswahl = { wert: string; text: string }[];

function LeistungFormular({
  werte,
  vorlagen,
  preise,
  fertig,
}: {
  werte: LeistungWerte;
  vorlagen: Auswahl;
  preise: Auswahl;
  fertig: () => void;
}) {
  const { form, absenden, serverFehler, laeuft } = useAktionsFormular(leistungSchema, {
    standard: werte,
    aktion: leistungSpeichern,
    erfolg: fertig,
  });
  const frequenz = form.watch("frequenz");
  return (
    <form onSubmit={absenden} className="flex flex-col gap-4" noValidate>
      <Formfehler text={serverFehler} />
      <AuswahlFeld
        form={form}
        name="vorlage_id"
        label="Leistung (Auftragsvorlage)"
        leer="Bitte wählen …"
        optionen={vorlagen}
      />
      <TextFeld
        form={form}
        name="bezeichnung"
        label="Bezeichnung im Vertrag"
        hinweis="leer = Name der Vorlage"
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <AuswahlFeld form={form} name="frequenz" label="Wiederholung" optionen={FREQUENZEN} />
        {frequenz !== "einmalig" && (
          <TextFeld
            form={form}
            name="intervall"
            label={
              frequenz === "woechentlich"
                ? "alle … Wochen"
                : frequenz === "monatlich"
                  ? "alle … Monate"
                  : "alle … Tage"
            }
            type="number"
            min={1}
          />
        )}
      </div>
      {frequenz === "woechentlich" && (
        <MehrfachAuswahlFeld
          form={form}
          name="wochentage"
          label="an Wochentagen"
          optionen={WOCHENTAGE}
        />
      )}
      {frequenz === "monatlich" && (
        <TextFeld
          form={form}
          name="monatstag"
          label="am Tag des Monats"
          type="number"
          min={1}
          max={31}
          hinweis="31 = Monatsletzter"
        />
      )}
      <TextFeld
        form={form}
        name="startdatum"
        label={frequenz === "einmalig" ? "Datum" : "Serie beginnt am"}
        type="date"
        hinweis={
          frequenz === "einmalig"
            ? undefined
            : "leer = ab Gültigkeit der Version; bestimmt den Rhythmus bei „alle n Wochen“"
        }
      />
      <fieldset className="bg-muted/40 flex flex-col gap-4 rounded-lg border p-3">
        <legend className="px-1 text-sm font-medium">Reinigungsfenster</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextFeld form={form} name="zeitfenster_von" label="von" type="time" />
          <TextFeld form={form} name="zeitfenster_bis" label="bis" type="time" />
        </div>
        <MehrfachAuswahlFeld
          form={form}
          name="erlaubte_wochentage"
          label="nur an (leer = alle Tage)"
          optionen={WOCHENTAGE}
        />
        <AuswahlFeld
          form={form}
          name="feiertag_regel"
          label="Feiertage"
          optionen={FEIERTAGREGELN}
        />
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextFeld
          form={form}
          name="menge_m2"
          label="Fläche abweichend (m²)"
          inputMode="decimal"
          hinweis="leer = Raumbuch"
        />
        <TextFeld
          form={form}
          name="menge_fenster"
          label="Fenster abweichend"
          type="number"
          hinweis="leer = Fensteraufmaß"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <AuswahlFeld
          form={form}
          name="preis_id"
          label="Preis aus Preisliste"
          leer="– keiner –"
          optionen={preise}
        />
        <TextFeld form={form} name="preis_cent" label="Preis abweichend (€)" inputMode="decimal" />
      </div>
      <Button type="submit" disabled={laeuft}>
        Speichern
      </Button>
    </form>
  );
}

export function LeistungDialog({
  titel,
  ausloeserText,
  werte,
  vorlagen,
  preise,
  variante = "outline",
}: {
  titel: string;
  ausloeserText: string;
  werte: LeistungWerte;
  vorlagen: Auswahl;
  preise: Auswahl;
  variante?: "outline" | "ghost";
}) {
  return (
    <FormularDialog
      titel={titel}
      ausloeser={
        <Button size="sm" variant={variante}>
          {ausloeserText}
        </Button>
      }
    >
      {(s) => <LeistungFormular werte={werte} vorlagen={vorlagen} preise={preise} fertig={s} />}
    </FormularDialog>
  );
}

export function LeistungEntfernen({ id, versionId }: { id: string; versionId: string }) {
  return (
    <LoeschenKnopf
      aktion={() => leistungLoeschen(id, versionId)}
      frage="Leistung entfernen?"
      text="Entfernen"
    />
  );
}
