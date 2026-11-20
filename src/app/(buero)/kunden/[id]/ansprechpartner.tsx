"use client";

import { FormularDialog, LoeschenKnopf } from "@/components/aktion-knoepfe";
import {
  Formfehler,
  KontrollkaestchenFeld,
  TextFeld,
  useAktionsFormular,
} from "@/components/formular/formular";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ansprechpartnerLoeschen, ansprechpartnerSpeichern } from "@/lib/aktionen/kunden";
import { ansprechpartnerSchema } from "@/lib/schemas/kunde";

type Ansprechpartner = {
  id: string;
  name: string;
  funktion: string | null;
  email: string | null;
  telefon: string | null;
  ist_hauptkontakt: boolean;
};

function AnsprechpartnerFormular({
  kundeId,
  wert,
  fertig,
}: {
  kundeId: string;
  wert?: Ansprechpartner;
  fertig: () => void;
}) {
  const { form, absenden, serverFehler, laeuft } = useAktionsFormular(ansprechpartnerSchema, {
    standard: {
      id: wert?.id,
      kunde_id: kundeId,
      name: wert?.name ?? "",
      funktion: wert?.funktion ?? "",
      email: wert?.email ?? "",
      telefon: wert?.telefon ?? "",
      ist_hauptkontakt: wert?.ist_hauptkontakt ?? false,
    },
    aktion: ansprechpartnerSpeichern,
    erfolg: fertig,
  });
  return (
    <form onSubmit={absenden} className="flex flex-col gap-4" noValidate>
      <Formfehler text={serverFehler} />
      <TextFeld form={form} name="name" label="Name" autoFocus />
      <TextFeld form={form} name="funktion" label="Funktion" hinweis="z. B. Objektbetreuer" />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextFeld form={form} name="telefon" label="Telefon" type="tel" />
        <TextFeld form={form} name="email" label="E-Mail" type="email" />
      </div>
      <KontrollkaestchenFeld form={form} name="ist_hauptkontakt" label="Hauptkontakt" />
      <Button type="submit" disabled={laeuft}>
        Speichern
      </Button>
    </form>
  );
}

export function AnsprechpartnerListe({
  kundeId,
  liste,
}: {
  kundeId: string;
  liste: Ansprechpartner[];
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-medium">Ansprechpartner</h2>
        <FormularDialog
          titel="Ansprechpartner hinzufügen"
          ausloeser={
            <Button size="sm" variant="outline">
              Hinzufügen
            </Button>
          }
        >
          {(schliessen) => <AnsprechpartnerFormular kundeId={kundeId} fertig={schliessen} />}
        </FormularDialog>
      </div>
      {liste.length === 0 ? (
        <p className="text-muted-foreground text-sm">Noch keine Ansprechpartner.</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {liste.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
              <div className="text-sm">
                <div className="font-medium">
                  {a.name}
                  {a.ist_hauptkontakt && (
                    <Badge variant="secondary" className="ml-2">
                      Hauptkontakt
                    </Badge>
                  )}
                </div>
                <div className="text-muted-foreground">
                  {[a.funktion, a.telefon, a.email].filter(Boolean).join(" · ") || "–"}
                </div>
              </div>
              <div className="flex gap-1">
                <FormularDialog
                  titel="Ansprechpartner bearbeiten"
                  ausloeser={
                    <Button size="sm" variant="ghost">
                      Bearbeiten
                    </Button>
                  }
                >
                  {(schliessen) => (
                    <AnsprechpartnerFormular kundeId={kundeId} wert={a} fertig={schliessen} />
                  )}
                </FormularDialog>
                <LoeschenKnopf aktion={() => ansprechpartnerLoeschen(a.id, kundeId)} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
