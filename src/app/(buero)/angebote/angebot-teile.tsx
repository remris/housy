"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { FormularDialog, LoeschenKnopf } from "@/components/aktion-knoepfe";
import {
  AuswahlFeld,
  Formfehler,
  MehrfachAuswahlFeld,
  TextFeld,
  TextbereichFeld,
  useAktionsFormular,
} from "@/components/formular/formular";
import { Button } from "@/components/ui/button";
import type { AktionErgebnis } from "@/lib/aktion";
import {
  angebotAnlegen,
  angebotLoeschen,
  angebotSenden,
  angebotSpeichern,
  angebotsleistungLoeschen,
  angebotsleistungSpeichern,
} from "@/lib/aktionen/angebote";
import { vertragAktivieren } from "@/lib/aktionen/vertraege";
import { angebotSchema, angebotsleistungSchema } from "@/lib/schemas/anfrage";
import { KUNDENTYPEN } from "@/lib/schemas/kunde";
import { ABRECHNUNGSARTEN, FREQUENZEN, WOCHENTAGE } from "@/lib/schemas/vertrag";
import type { z } from "zod";

type Option = { wert: string; text: string };

function Knopf({
  text,
  aktion,
  variante = "outline",
  frage,
}: {
  text: string;
  aktion: () => Promise<AktionErgebnis<unknown> | void>;
  variante?: "outline" | "default" | "ghost";
  frage?: string;
}) {
  const [laeuft, starte] = useTransition();
  return (
    <Button
      size="sm"
      variant={variante}
      disabled={laeuft}
      onClick={() => {
        if (frage && !window.confirm(frage)) return;
        starte(async () => {
          const r = await aktion();
          if (r && !r.ok) toast.error(r.fehler, { duration: 10_000 });
          else if (r?.meldung) toast.success(r.meldung, { duration: 10_000 });
        });
      }}
    >
      {laeuft ? "…" : text}
    </Button>
  );
}

export function NeuesAngebot() {
  return <Knopf text="Neues Angebot" variante="default" aktion={() => angebotAnlegen({})} />;
}

export function AngebotKnoepfe({
  id,
  status,
  vertragId,
  vertragStatus,
}: {
  id: string;
  status: string;
  vertragId: string | null;
  vertragStatus: string | null;
}) {
  return (
    <>
      {(status === "entwurf" || status === "versendet") && (
        <Knopf
          text={status === "entwurf" ? "Angebot senden" : "Erneut senden"}
          variante={status === "entwurf" ? "default" : "outline"}
          frage={status === "versendet" ? "Angebot noch einmal senden?" : undefined}
          aktion={() => angebotSenden(id)}
        />
      )}
      {vertragId && vertragStatus === "entwurf" && (
        <Knopf
          text="Vertrag aktivieren"
          variante="default"
          frage="Vertrag aktivieren? Danach werden die Einsätze geplant."
          aktion={() => vertragAktivieren(vertragId)}
        />
      )}
      {status === "entwurf" && (
        <LoeschenKnopf aktion={angebotLoeschen.bind(null, id)} frage="Angebotsentwurf löschen?" />
      )}
    </>
  );
}

export function AngebotFormular({
  id,
  werte,
  gesperrt,
}: {
  id: string;
  werte: z.input<typeof angebotSchema>;
  gesperrt: boolean;
}) {
  const { form, absenden, serverFehler, laeuft } = useAktionsFormular(angebotSchema, {
    standard: werte,
    aktion: (d) => angebotSpeichern(id, d),
  });
  const art = form.watch("abrechnungsart");
  const typ = form.watch("kundentyp");
  return (
    <form onSubmit={absenden} className="flex flex-col gap-4" noValidate>
      <fieldset disabled={gesperrt || laeuft} className="flex flex-col gap-4">
        <Formfehler text={serverFehler} />
        <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
          <TextFeld form={form} name="titel" label="Titel" />
          <AuswahlFeld form={form} name="kundentyp" label="Kundentyp" optionen={KUNDENTYPEN} />
        </div>
        <TextbereichFeld
          form={form}
          name="einleitung"
          label="Einleitung"
          rows={3}
          hinweis="erscheint oben im Angebot"
        />
        <h3 className="text-sm font-medium">Empfänger</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <TextFeld
            form={form}
            name="empfaenger_name"
            label={typ === "privat" ? "Name" : "Ansprechpartner"}
          />
          {typ !== "privat" && (
            <TextFeld form={form} name="empfaenger_firma" label="Firma / Verwaltung" />
          )}
          <TextFeld form={form} name="empfaenger_email" label="E-Mail" type="email" />
          <TextFeld form={form} name="empfaenger_telefon" label="Telefon" />
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_7rem_1fr]">
          <TextFeld
            form={form}
            name="strasse"
            label="Rechnungsadresse Straße"
            hinweis="leer = Objektadresse"
          />
          <TextFeld form={form} name="plz" label="PLZ" />
          <TextFeld form={form} name="ort" label="Ort" />
        </div>
        <h3 className="text-sm font-medium">Objekt</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <TextFeld
            form={form}
            name="objekt_name"
            label="Bezeichnung"
            placeholder="Treppenhaus Hauptstraße 12"
          />
          <TextFeld form={form} name="objekt_strasse" label="Straße" />
        </div>
        <div className="grid gap-3 sm:grid-cols-[7rem_1fr]">
          <TextFeld form={form} name="objekt_plz" label="PLZ" />
          <TextFeld form={form} name="objekt_ort" label="Ort" />
        </div>
        <h3 className="text-sm font-medium">Konditionen</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <TextFeld form={form} name="beginn" label="Beginn" type="date" />
          <TextFeld form={form} name="gueltig_bis" label="Gültig bis" type="date" />
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
          <TextFeld
            form={form}
            name="laufzeit_monate"
            label="Laufzeit (Monate, 0 = unbefristet)"
            type="number"
          />
          <TextFeld
            form={form}
            name="kuendigungsfrist_monate"
            label="Kündigungsfrist (Monate)"
            type="number"
          />
        </div>
        {!gesperrt && (
          <div>
            <Button type="submit">Speichern</Button>
          </div>
        )}
      </fieldset>
    </form>
  );
}

export type LeistungWerte = z.input<typeof angebotsleistungSchema>;

export function LeistungDialog({
  angebotId,
  leistung,
  vorlagen,
  preise,
}: {
  angebotId: string;
  leistung?: LeistungWerte;
  vorlagen: Option[];
  preise: (Option & {
    preisCent: number;
    einheit: string;
    name: string;
    vorlageId: string | null;
  })[];
}) {
  return (
    <FormularDialog
      titel={leistung ? "Leistung bearbeiten" : "Leistung hinzufügen"}
      ausloeser={
        <Button size="sm" variant={leistung ? "ghost" : "outline"}>
          {leistung ? "Bearbeiten" : "Leistung hinzufügen"}
        </Button>
      }
    >
      {(schliessen) => (
        <LeistungFormular
          angebotId={angebotId}
          leistung={leistung}
          vorlagen={vorlagen}
          preise={preise}
          fertig={schliessen}
        />
      )}
    </FormularDialog>
  );
}

const EINHEITEN = [
  { wert: "einsatz", text: "je Einsatz" },
  { wert: "stunde", text: "je Stunde" },
  { wert: "m2", text: "je m²" },
  { wert: "fenster", text: "je Fenster" },
  { wert: "stueck", text: "je Stück" },
  { wert: "pauschal", text: "pauschal" },
];

function LeistungFormular({
  angebotId,
  leistung,
  vorlagen,
  preise,
  fertig,
}: {
  angebotId: string;
  leistung?: LeistungWerte;
  vorlagen: Option[];
  preise: (Option & {
    preisCent: number;
    einheit: string;
    name: string;
    vorlageId: string | null;
  })[];
  fertig: () => void;
}) {
  const { form, absenden, serverFehler, laeuft } = useAktionsFormular(angebotsleistungSchema, {
    standard: leistung ?? {
      angebot_id: angebotId,
      vorlage_id: vorlagen[0]?.wert ?? "",
      preis_id: null,
      bezeichnung: vorlagen[0]?.text ?? "",
      beschreibung: "",
      frequenz: "woechentlich",
      intervall: 1,
      wochentage: ["1"],
      menge_je_einsatz: "1",
      einheit: "einsatz",
      preis_cent: "",
    },
    aktion: angebotsleistungSpeichern,
    erfolg: fertig,
  });
  const frequenz = form.watch("frequenz");
  return (
    <form onSubmit={absenden} className="flex flex-col gap-3">
      <Formfehler text={serverFehler} />
      <AuswahlFeld
        form={form}
        name="vorlage_id"
        label="Auftragsvorlage (Tätigkeiten, Material)"
        optionen={vorlagen}
      />
      <label className="flex flex-col gap-1 text-sm">
        Preis aus der Preisliste übernehmen
        <select
          className="border-input bg-background h-9 rounded-lg border px-2"
          defaultValue=""
          onChange={(e) => {
            const p = preise.find((x) => x.wert === e.target.value);
            form.setValue("preis_id", p?.wert ?? null);
            if (!p) return;
            form.setValue("preis_cent", (p.preisCent / 100).toFixed(2).replace(".", ","));
            form.setValue(
              "einheit",
              (p.einheit === "pauschal" ? "pauschal" : p.einheit) as LeistungWerte["einheit"],
            );
            form.setValue("bezeichnung", p.name);
            if (p.vorlageId) form.setValue("vorlage_id", p.vorlageId);
          }}
        >
          <option value="">– frei –</option>
          {preise.map((p) => (
            <option key={p.wert} value={p.wert}>
              {p.text}
            </option>
          ))}
        </select>
      </label>
      <TextFeld form={form} name="bezeichnung" label="Bezeichnung im Angebot" />
      <TextFeld form={form} name="beschreibung" label="Beschreibung (optional)" />
      <div className="grid gap-3 sm:grid-cols-2">
        <AuswahlFeld form={form} name="frequenz" label="Rhythmus" optionen={FREQUENZEN} />
        {frequenz !== "einmalig" && (
          <TextFeld
            form={form}
            name="intervall"
            label="alle … (Wochen/Tage/Monate)"
            type="number"
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
      <div className="grid gap-3 sm:grid-cols-3">
        <TextFeld
          form={form}
          name="menge_je_einsatz"
          label="Menge je Einsatz"
          inputMode="decimal"
        />
        <AuswahlFeld form={form} name="einheit" label="Einheit" optionen={EINHEITEN} />
        <TextFeld
          form={form}
          name="preis_cent"
          label="Preis netto (€)"
          inputMode="decimal"
          hinweis="bei Pauschale optional"
        />
      </div>
      <Button type="submit" disabled={laeuft}>
        Speichern
      </Button>
    </form>
  );
}

export function LeistungLoeschen({ id, angebotId }: { id: string; angebotId: string }) {
  return (
    <LoeschenKnopf
      aktion={angebotsleistungLoeschen.bind(null, id, angebotId)}
      frage="Leistung entfernen?"
      text="Entfernen"
    />
  );
}
