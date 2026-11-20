"use client";

import { FormularDialog, LoeschenKnopf } from "@/components/aktion-knoepfe";
import {
  AuswahlFeld,
  Formfehler,
  KontrollkaestchenFeld,
  TextFeld,
  useAktionsFormular,
} from "@/components/formular/formular";
import { Button } from "@/components/ui/button";
import { artikelLoeschen, artikelSpeichern } from "@/lib/aktionen/vorlagen";
import { centZuEingabe } from "@/lib/schemas/helfer";
import { ARTIKELARTEN, LEBENSDAUER_EINHEITEN, artikelSchema } from "@/lib/schemas/vorlage";

export type ArtikelZeile = {
  id: string;
  name: string;
  art: "verbrauch" | "verschleiss" | "geraet";
  einheit: string;
  gebinde_name: string | null;
  gebinde_menge: number;
  preis_cent: number | null;
  lieferant: string | null;
  bestellnummer: string | null;
  mindestbestand: number;
  lieferzeit_tage: number;
  lebensdauer: number | null;
  lebensdauer_einheit: "einsaetze" | "fenster" | "m2" | "stunden" | "waeschen" | "tage" | null;
  auto_wechsel: boolean;
  pruefintervall_monate: number | null;
  notiz: string | null;
  aktiv: boolean;
};

const zahlText = (n: number | null) =>
  n === null ? "" : n.toLocaleString("de-DE", { maximumFractionDigits: 3 });

function ArtikelFormular({ wert, fertig }: { wert?: ArtikelZeile; fertig: () => void }) {
  const { form, absenden, serverFehler, laeuft } = useAktionsFormular(artikelSchema, {
    standard: {
      id: wert?.id,
      name: wert?.name ?? "",
      art: wert?.art ?? "verbrauch",
      einheit: wert?.einheit ?? "Stk",
      gebinde_name: wert?.gebinde_name ?? "",
      gebinde_menge: zahlText(wert?.gebinde_menge ?? 1),
      preis_cent: centZuEingabe(wert?.preis_cent),
      lieferant: wert?.lieferant ?? "",
      bestellnummer: wert?.bestellnummer ?? "",
      mindestbestand: zahlText(wert?.mindestbestand ?? 0),
      lieferzeit_tage: wert?.lieferzeit_tage ?? 5,
      lebensdauer: zahlText(wert?.lebensdauer ?? null),
      lebensdauer_einheit: wert?.lebensdauer_einheit ?? null,
      auto_wechsel: wert?.auto_wechsel ?? false,
      pruefintervall_monate: wert?.pruefintervall_monate ?? "",
      notiz: wert?.notiz ?? "",
      aktiv: wert?.aktiv ?? true,
    },
    aktion: artikelSpeichern,
    erfolg: fertig,
  });
  const art = form.watch("art");

  return (
    <form onSubmit={absenden} className="flex flex-col gap-4" noValidate>
      <Formfehler text={serverFehler} />
      <div className="grid gap-4 sm:grid-cols-[1fr_11rem]">
        <TextFeld form={form} name="name" label="Bezeichnung" autoFocus={!wert} />
        <AuswahlFeld form={form} name="art" label="Art" optionen={ARTIKELARTEN} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <TextFeld form={form} name="einheit" label="Einheit" hinweis="z. B. l, Stk, kg" />
        <TextFeld form={form} name="gebinde_name" label="Gebinde" hinweis="z. B. Kanister" />
        <TextFeld form={form} name="gebinde_menge" label="Menge je Gebinde" inputMode="decimal" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <TextFeld
          form={form}
          name="preis_cent"
          label="Einkaufspreis (€)"
          inputMode="decimal"
          hinweis="netto je Gebinde"
        />
        <TextFeld form={form} name="mindestbestand" label="Mindestbestand" inputMode="decimal" />
        <TextFeld form={form} name="lieferzeit_tage" label="Lieferzeit (Tage)" type="number" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextFeld form={form} name="lieferant" label="Lieferant" />
        <TextFeld form={form} name="bestellnummer" label="Bestellnummer" />
      </div>
      {art === "verschleiss" && (
        <div className="bg-muted/40 flex flex-col gap-4 rounded-lg border p-3">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextFeld
              form={form}
              name="lebensdauer"
              label="Lebensdauer"
              inputMode="decimal"
              hinweis="Empfehlung, gezählt ab echtem Wechsel"
            />
            <AuswahlFeld
              form={form}
              name="lebensdauer_einheit"
              label="gezählt in"
              leer="Bitte wählen …"
              optionen={LEBENSDAUER_EINHEITEN}
            />
          </div>
          <KontrollkaestchenFeld
            form={form}
            name="auto_wechsel"
            label="Automatisch wechseln"
            hinweis="Für billige Teile: bei Erreichen der Lebensdauer wird ein Wechsel angenommen."
          />
        </div>
      )}
      {art === "geraet" && (
        <TextFeld
          form={form}
          name="pruefintervall_monate"
          label="Prüfintervall (Monate)"
          type="number"
          hinweis="z. B. 12 für jährliche Prüfung elektrischer Geräte und Leitern"
        />
      )}
      <TextFeld form={form} name="notiz" label="Notiz" />
      <KontrollkaestchenFeld form={form} name="aktiv" label="Aktiv" />
      <Button type="submit" disabled={laeuft}>
        Speichern
      </Button>
    </form>
  );
}

export function NeuerArtikel() {
  return (
    <FormularDialog titel="Neuer Artikel" ausloeser={<Button>Neuer Artikel</Button>}>
      {(s) => <ArtikelFormular fertig={s} />}
    </FormularDialog>
  );
}

export function ArtikelAktionen({ artikel }: { artikel: ArtikelZeile }) {
  return (
    <div className="flex justify-end gap-1">
      <FormularDialog
        titel="Artikel bearbeiten"
        ausloeser={
          <Button size="sm" variant="ghost">
            Bearbeiten
          </Button>
        }
      >
        {(s) => <ArtikelFormular wert={artikel} fertig={s} />}
      </FormularDialog>
      <LoeschenKnopf
        aktion={() => artikelLoeschen(artikel.id)}
        frage={`„${artikel.name}“ löschen?`}
      />
    </div>
  );
}
