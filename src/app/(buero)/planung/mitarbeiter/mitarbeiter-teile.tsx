"use client";

import {
  AuswahlFeld,
  Formfehler,
  TextFeld,
  useAktionsFormular,
} from "@/components/formular/formular";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WOCHENTAGE_KURZ, heuteIso } from "@/domain/datum";
import { abwesenheitSpeichern, arbeitszeitenSpeichern } from "@/lib/aktionen/planung";
import { ABWESENHEITSARTEN, abwesenheitSchema, arbeitszeitenSchema } from "@/lib/schemas/planung";

export function AbwesenheitFormular({
  mitarbeiter,
}: {
  mitarbeiter: { wert: string; text: string }[];
}) {
  const heute = heuteIso();
  const { form, absenden, serverFehler, laeuft } = useAktionsFormular(abwesenheitSchema, {
    standard: { mitglied_id: "", art: "urlaub", von: heute, bis: heute, notiz: "" },
    aktion: abwesenheitSpeichern,
    erfolg: () => form.reset({ ...form.getValues(), notiz: "" }),
  });
  return (
    <form onSubmit={absenden} className="flex flex-col gap-3 rounded-lg border p-4">
      <Formfehler text={serverFehler} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <AuswahlFeld
          form={form}
          name="mitglied_id"
          label="Mitarbeiter"
          leer="wählen …"
          optionen={mitarbeiter}
        />
        <AuswahlFeld form={form} name="art" label="Art" optionen={ABWESENHEITSARTEN} />
        <TextFeld form={form} name="von" label="Von" type="date" />
        <TextFeld form={form} name="bis" label="Bis" type="date" />
        <TextFeld form={form} name="notiz" label="Notiz" />
      </div>
      <Button type="submit" size="sm" disabled={laeuft} className="self-start">
        Eintragen
      </Button>
    </form>
  );
}

export function ArbeitszeitenFormular({
  mitgliedId,
  name,
  zeiten,
}: {
  mitgliedId: string;
  name: string;
  zeiten: { wochentag: number; von: string; bis: string }[];
}) {
  const leer = zeiten.length === 0;
  const tage = Array.from({ length: 7 }, (_, i) => {
    const z = zeiten.find((x) => x.wochentag === i + 1);
    return z
      ? { aktiv: true, von: z.von, bis: z.bis }
      : { aktiv: leer && i < 5, von: "07:00", bis: "15:00" };
  });
  const { form, absenden, serverFehler, laeuft } = useAktionsFormular(arbeitszeitenSchema, {
    standard: { mitglied_id: mitgliedId, tage },
    aktion: arbeitszeitenSpeichern,
  });
  const fehler = form.formState.errors.tage;
  return (
    <form onSubmit={absenden} className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-medium">{name}</h3>
        {leer && <span className="text-muted-foreground text-xs">noch nicht hinterlegt</span>}
      </div>
      <Formfehler text={serverFehler} />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {WOCHENTAGE_KURZ.map((tag, i) => (
          <fieldset key={tag} className="flex flex-col gap-1 rounded-md border p-2">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" className="size-4" {...form.register(`tage.${i}.aktiv`)} />
              {tag}
            </label>
            <Input type="time" aria-label={`${tag} von`} {...form.register(`tage.${i}.von`)} />
            <Input type="time" aria-label={`${tag} bis`} {...form.register(`tage.${i}.bis`)} />
            {(fehler?.[i]?.von?.message || fehler?.[i]?.bis?.message) && (
              <p className="text-destructive text-xs" role="alert">
                {fehler?.[i]?.von?.message ?? fehler?.[i]?.bis?.message}
              </p>
            )}
          </fieldset>
        ))}
      </div>
      <Button type="submit" size="sm" variant="outline" disabled={laeuft} className="self-start">
        Arbeitszeiten speichern
      </Button>
    </form>
  );
}
