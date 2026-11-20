"use client";

import {
  AuswahlFeld,
  Formfehler,
  KontrollkaestchenFeld,
  TextFeld,
  TextbereichFeld,
  useAktionsFormular,
} from "@/components/formular/formular";
import { Button } from "@/components/ui/button";
import { kundeSpeichern } from "@/lib/aktionen/kunden";
import { KUNDENTYPEN, kundeSchema } from "@/lib/schemas/kunde";
import type { z } from "zod";

export type KundeWerte = z.input<typeof kundeSchema>;

export const LEERER_KUNDE: KundeWerte = {
  typ: "firma",
  name: "",
  zusatz: "",
  strasse: "",
  plz: "",
  ort: "",
  email: "",
  telefon: "",
  rechnungs_email: "",
  leitweg_id: "",
  ust_id: "",
  zahlungsziel_tage: 14,
  notiz: "",
  aktiv: true,
};

export function KundeFormular({ id, werte }: { id: string | null; werte: KundeWerte }) {
  const { form, absenden, serverFehler, laeuft } = useAktionsFormular(kundeSchema, {
    standard: werte,
    aktion: (d) => kundeSpeichern(id, d),
  });
  const typ = form.watch("typ");

  return (
    <form onSubmit={absenden} className="flex flex-col gap-6" noValidate>
      <Formfehler text={serverFehler} />
      <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
        <AuswahlFeld form={form} name="typ" label="Kundentyp" optionen={KUNDENTYPEN} />
        <TextFeld
          form={form}
          name="name"
          label={typ === "privat" ? "Name" : "Firma / Name"}
          autoFocus={!id}
        />
      </div>
      <TextFeld form={form} name="zusatz" label="Zusatz" hinweis="z. B. Abteilung, z. Hd." />
      <div className="grid gap-4 sm:grid-cols-[1fr_8rem_1fr]">
        <TextFeld form={form} name="strasse" label="Straße" />
        <TextFeld form={form} name="plz" label="PLZ" inputMode="numeric" />
        <TextFeld form={form} name="ort" label="Ort" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <TextFeld form={form} name="telefon" label="Telefon" type="tel" />
        <TextFeld form={form} name="email" label="E-Mail" type="email" />
        <TextFeld
          form={form}
          name="rechnungs_email"
          label="Rechnungs-E-Mail"
          type="email"
          hinweis="falls abweichend"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <TextFeld form={form} name="zahlungsziel_tage" label="Zahlungsziel (Tage)" type="number" />
        <TextFeld form={form} name="ust_id" label="USt-IdNr. des Kunden" />
        <TextFeld
          form={form}
          name="leitweg_id"
          label="Leitweg-ID"
          hinweis={typ === "oeffentlich" ? "Pflicht für XRechnung" : "nur öffentliche Auftraggeber"}
        />
      </div>
      <TextbereichFeld form={form} name="notiz" label="Notiz" rows={3} />
      <KontrollkaestchenFeld form={form} name="aktiv" label="Aktiv" />
      <div>
        <Button type="submit" disabled={laeuft}>
          {laeuft ? "Speichern …" : id ? "Speichern" : "Kunde anlegen"}
        </Button>
      </div>
    </form>
  );
}
