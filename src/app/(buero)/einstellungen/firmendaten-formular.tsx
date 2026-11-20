"use client";

import {
  Formfehler,
  KontrollkaestchenFeld,
  MehrfachAuswahlFeld,
  TextFeld,
  useAktionsFormular,
} from "@/components/formular/formular";
import { Button } from "@/components/ui/button";
import { firmendatenSpeichern } from "@/lib/aktionen/betrieb";
import { type FirmendatenEingabe, firmendatenSchema } from "@/lib/schemas/betrieb";
import { BRANCHEN } from "@/lib/schemas/konto";

export function FirmendatenFormular({
  werte,
  darfAendern,
}: {
  werte: FirmendatenEingabe;
  darfAendern: boolean;
}) {
  const { form, absenden, serverFehler, laeuft } = useAktionsFormular(firmendatenSchema, {
    standard: werte,
    aktion: firmendatenSpeichern,
  });

  return (
    <form onSubmit={absenden} className="flex flex-col gap-8" noValidate>
      <fieldset disabled={!darfAendern || laeuft} className="flex flex-col gap-8">
        <Formfehler text={serverFehler} />
        <section className="flex flex-col gap-4">
          <h2 className="font-medium">Betrieb</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextFeld form={form} name="name" label="Kurzname (in der App)" />
            <TextFeld form={form} name="firmenname" label="Firmenname (auf Rechnungen)" />
          </div>
          <MehrfachAuswahlFeld form={form} name="branchen" label="Branchen" optionen={BRANCHEN} />
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="font-medium">Anschrift und Kontakt</h2>
          <TextFeld form={form} name="strasse" label="Straße und Hausnummer" />
          <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
            <TextFeld form={form} name="plz" label="PLZ" inputMode="numeric" />
            <TextFeld form={form} name="ort" label="Ort" />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <TextFeld form={form} name="telefon" label="Telefon" type="tel" />
            <TextFeld form={form} name="email" label="E-Mail" type="email" />
            <TextFeld form={form} name="website" label="Website" />
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="font-medium">Steuer</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextFeld form={form} name="steuernummer" label="Steuernummer" />
            <TextFeld form={form} name="ust_id" label="USt-IdNr." placeholder="DE123456789" />
          </div>
          <KontrollkaestchenFeld
            form={form}
            name="kleinunternehmer"
            label="Kleinunternehmer nach § 19 UStG"
            hinweis="Rechnungen ohne Umsatzsteuer mit Hinweis auf § 19 UStG."
          />
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="font-medium">Bankverbindung für Rechnungen</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextFeld form={form} name="kontoinhaber" label="Kontoinhaber" />
            <TextFeld form={form} name="bank_name" label="Bank" />
            <TextFeld form={form} name="iban" label="IBAN" autoComplete="off" />
            <TextFeld form={form} name="bic" label="BIC" autoComplete="off" />
          </div>
        </section>

        {darfAendern ? (
          <div>
            <Button type="submit" disabled={laeuft}>
              {laeuft ? "Speichern …" : "Speichern"}
            </Button>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            Nur der Inhaber kann die Firmendaten ändern.
          </p>
        )}
      </fieldset>
    </form>
  );
}
