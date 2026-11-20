"use client";

import { FormularDialog, LoeschenKnopf } from "@/components/aktion-knoepfe";
import {
  AuswahlFeld,
  Formfehler,
  KontrollkaestchenFeld,
  MehrfachAuswahlFeld,
  TextFeld,
  useAktionsFormular,
} from "@/components/formular/formular";
import { Button } from "@/components/ui/button";
import {
  bereichLoeschen,
  bereichSpeichern,
  fensterLoeschen,
  fensterSpeichern,
} from "@/lib/aktionen/kunden";
import {
  BODENARTEN,
  FENSTERTYPEN,
  HILFSMITTEL,
  bereichSchema,
  fensterSchema,
} from "@/lib/schemas/kunde";

const zahl = (n: number | string | null) =>
  n === null || n === "" ? "" : Number(n).toLocaleString("de-DE", { maximumFractionDigits: 2 });

// ---------------------------------------------------------------------------
// Bereiche
// ---------------------------------------------------------------------------
type Bereich = {
  id: string;
  name: string;
  flaeche_m2: number | null;
  bodenart: string | null;
  etage: string | null;
  notiz: string | null;
};

function BereichFormular({
  objektId,
  wert,
  fertig,
}: {
  objektId: string;
  wert?: Bereich;
  fertig: () => void;
}) {
  const { form, absenden, serverFehler, laeuft } = useAktionsFormular(bereichSchema, {
    standard: {
      id: wert?.id,
      objekt_id: objektId,
      name: wert?.name ?? "",
      flaeche_m2: wert?.flaeche_m2 == null ? "" : zahl(wert.flaeche_m2),
      bodenart: wert?.bodenart ?? "",
      etage: wert?.etage ?? "",
      notiz: wert?.notiz ?? "",
    },
    aktion: bereichSpeichern,
    erfolg: fertig,
  });
  return (
    <form onSubmit={absenden} className="flex flex-col gap-4" noValidate>
      <Formfehler text={serverFehler} />
      <TextFeld
        form={form}
        name="name"
        label="Bereich"
        placeholder="z. B. Büro 1, Treppenhaus"
        autoFocus
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <TextFeld form={form} name="flaeche_m2" label="Fläche (m²)" inputMode="decimal" />
        <AuswahlFeld
          form={form}
          name="bodenart"
          label="Bodenart"
          leer="–"
          optionen={BODENARTEN.map((b) => ({ wert: b, text: b }))}
        />
        <TextFeld form={form} name="etage" label="Etage" />
      </div>
      <TextFeld form={form} name="notiz" label="Notiz" />
      <Button type="submit" disabled={laeuft}>
        Speichern
      </Button>
    </form>
  );
}

export function Bereiche({ objektId, liste }: { objektId: string; liste: Bereich[] }) {
  const summe = liste.reduce((s, b) => s + Number(b.flaeche_m2 ?? 0), 0);
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-medium">
          Raumbuch{" "}
          {summe > 0 && (
            <span className="text-muted-foreground font-normal">· {zahl(summe)} m²</span>
          )}
        </h2>
        <FormularDialog
          titel="Bereich hinzufügen"
          ausloeser={
            <Button size="sm" variant="outline">
              Bereich hinzufügen
            </Button>
          }
        >
          {(s) => <BereichFormular objektId={objektId} fertig={s} />}
        </FormularDialog>
      </div>
      {liste.length === 0 ? (
        <p className="text-muted-foreground text-sm">Noch keine Bereiche.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="text-muted-foreground border-b text-left">
              <tr>
                <th className="p-2 font-medium">Bereich</th>
                <th className="p-2 text-right font-medium">m²</th>
                <th className="p-2 font-medium">Boden</th>
                <th className="p-2 font-medium">Etage</th>
                <th className="p-2" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {liste.map((b) => (
                <tr key={b.id}>
                  <td className="p-2">
                    {b.name}
                    {b.notiz && <div className="text-muted-foreground text-xs">{b.notiz}</div>}
                  </td>
                  <td className="p-2 text-right tabular-nums">{zahl(b.flaeche_m2) || "–"}</td>
                  <td className="p-2">{b.bodenart ?? "–"}</td>
                  <td className="p-2">{b.etage ?? "–"}</td>
                  <td className="p-2 text-right whitespace-nowrap">
                    <FormularDialog
                      titel="Bereich bearbeiten"
                      ausloeser={
                        <Button size="sm" variant="ghost">
                          Bearbeiten
                        </Button>
                      }
                    >
                      {(s) => <BereichFormular objektId={objektId} wert={b} fertig={s} />}
                    </FormularDialog>
                    <LoeschenKnopf aktion={() => bereichLoeschen(b.id, objektId)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Fensteraufmaß
// ---------------------------------------------------------------------------
type Fenster = {
  id: string;
  bezeichnung: string | null;
  typ: string;
  anzahl: number;
  etage: string | null;
  mit_rahmen: boolean;
  hilfsmittel: string[];
  notiz: string | null;
};

type Fenstertyp = (typeof FENSTERTYPEN)[number]["wert"];
type Hilfsmittel = (typeof HILFSMITTEL)[number]["wert"];

function FensterFormular({
  objektId,
  wert,
  fertig,
}: {
  objektId: string;
  wert?: Fenster;
  fertig: () => void;
}) {
  const { form, absenden, serverFehler, laeuft } = useAktionsFormular(fensterSchema, {
    standard: {
      id: wert?.id,
      objekt_id: objektId,
      bezeichnung: wert?.bezeichnung ?? "",
      typ: (wert?.typ as Fenstertyp) ?? "standard",
      anzahl: wert?.anzahl ?? 1,
      etage: wert?.etage ?? "",
      mit_rahmen: wert?.mit_rahmen ?? false,
      hilfsmittel: (wert?.hilfsmittel as Hilfsmittel[]) ?? [],
      notiz: wert?.notiz ?? "",
    },
    aktion: fensterSpeichern,
    erfolg: fertig,
  });
  return (
    <form onSubmit={absenden} className="flex flex-col gap-4" noValidate>
      <Formfehler text={serverFehler} />
      <div className="grid gap-4 sm:grid-cols-[1fr_7rem]">
        <AuswahlFeld form={form} name="typ" label="Fenstertyp" optionen={FENSTERTYPEN} />
        <TextFeld form={form} name="anzahl" label="Anzahl" type="number" min={1} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextFeld
          form={form}
          name="bezeichnung"
          label="Bezeichnung"
          placeholder="z. B. Straßenseite"
        />
        <TextFeld form={form} name="etage" label="Etage" />
      </div>
      <KontrollkaestchenFeld form={form} name="mit_rahmen" label="Rahmen mitreinigen" />
      <MehrfachAuswahlFeld
        form={form}
        name="hilfsmittel"
        label="Hilfsmittel"
        optionen={HILFSMITTEL}
      />
      <TextFeld form={form} name="notiz" label="Notiz" />
      <Button type="submit" disabled={laeuft}>
        Speichern
      </Button>
    </form>
  );
}

const typText = (t: string) => FENSTERTYPEN.find((f) => f.wert === t)?.text ?? t;
const hilfsText = (h: string) => HILFSMITTEL.find((f) => f.wert === h)?.text ?? h;

export function Fensteraufmass({ objektId, liste }: { objektId: string; liste: Fenster[] }) {
  const summe = liste.reduce((s, f) => s + f.anzahl, 0);
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-medium">
          Fensteraufmaß{" "}
          {summe > 0 && (
            <span className="text-muted-foreground font-normal">· {summe} Fenster</span>
          )}
        </h2>
        <FormularDialog
          titel="Fenster hinzufügen"
          ausloeser={
            <Button size="sm" variant="outline">
              Fenster hinzufügen
            </Button>
          }
        >
          {(s) => <FensterFormular objektId={objektId} fertig={s} />}
        </FormularDialog>
      </div>
      {liste.length === 0 ? (
        <p className="text-muted-foreground text-sm">Noch kein Fensteraufmaß.</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {liste.map((f) => (
            <li
              key={f.id}
              className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm"
            >
              <div>
                <div className="font-medium">
                  {f.anzahl} × {typText(f.typ)}
                  {f.bezeichnung && <span className="font-normal"> · {f.bezeichnung}</span>}
                </div>
                <div className="text-muted-foreground">
                  {[
                    f.etage && `Etage ${f.etage}`,
                    f.mit_rahmen && "mit Rahmen",
                    f.hilfsmittel.map(hilfsText).join(", "),
                    f.notiz,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "–"}
                </div>
              </div>
              <div className="flex gap-1">
                <FormularDialog
                  titel="Fenster bearbeiten"
                  ausloeser={
                    <Button size="sm" variant="ghost">
                      Bearbeiten
                    </Button>
                  }
                >
                  {(s) => <FensterFormular objektId={objektId} wert={f} fertig={s} />}
                </FormularDialog>
                <LoeschenKnopf aktion={() => fensterLoeschen(f.id, objektId)} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
