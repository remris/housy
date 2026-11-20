"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition, type ComponentProps, type ReactNode } from "react";
import {
  useForm,
  type DefaultValues,
  type FieldValues,
  type Path,
  type UseFormReturn,
} from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { AktionErgebnis } from "@/lib/aktion";
import { cn } from "@/lib/utils";

/**
 * react-hook-form + Zod im Client, dieselbe Zod-Prüfung nochmals in der Server Action.
 * Feldfehler vom Server werden in das Formular übernommen.
 */
export function useAktionsFormular<S extends z.ZodType<FieldValues, FieldValues>, T = unknown>(
  schema: S,
  optionen: {
    standard: DefaultValues<z.input<S>>;
    aktion: (daten: z.output<S>) => Promise<AktionErgebnis<T> | void>;
    erfolg?: (ergebnis: AktionErgebnis<T> & { ok: true }) => void;
    erfolgsMeldung?: string;
  },
) {
  const form = useForm<z.input<S>, unknown, z.output<S>>({
    resolver: zodResolver(schema as never) as never,
    defaultValues: optionen.standard,
  });
  const [serverFehler, setServerFehler] = useState<string | null>(null);
  const [laeuft, starte] = useTransition();

  const absenden = form.handleSubmit((daten) => {
    setServerFehler(null);
    starte(async () => {
      const e = await optionen.aktion(daten);
      if (!e) return; // redirect
      if (e.ok) {
        if (optionen.erfolgsMeldung || e.meldung)
          toast.success(e.meldung ?? optionen.erfolgsMeldung);
        optionen.erfolg?.(e);
      } else {
        setServerFehler(e.fehler);
        for (const [feld, texte] of Object.entries(e.feldfehler ?? {})) {
          if (texte?.[0]) form.setError(feld as Path<z.input<S>>, { message: texte[0] });
        }
      }
    });
  });

  return { form, absenden, serverFehler, laeuft };
}

export function Formfehler({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <Alert variant="destructive">
      <AlertDescription>{text}</AlertDescription>
    </Alert>
  );
}

type FeldProps<F extends FieldValues> = {
  form: UseFormReturn<F, unknown, FieldValues>;
  name: Path<F>;
  label: ReactNode;
  hinweis?: ReactNode;
  className?: string;
};

function fehlerVon<F extends FieldValues>(form: FeldProps<F>["form"], name: Path<F>) {
  const teile = name.split(".");
  let e: unknown = form.formState.errors;
  for (const t of teile) e = (e as Record<string, unknown> | undefined)?.[t];
  return (e as { message?: string } | undefined)?.message;
}

export function FeldRahmen({
  id,
  label,
  hinweis,
  fehler,
  className,
  children,
}: {
  id: string;
  label: ReactNode;
  hinweis?: ReactNode;
  fehler?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {fehler ? (
        <p className="text-destructive text-sm" role="alert">
          {fehler}
        </p>
      ) : hinweis ? (
        <p className="text-muted-foreground text-xs">{hinweis}</p>
      ) : null}
    </div>
  );
}

export function TextFeld<F extends FieldValues>({
  form,
  name,
  label,
  hinweis,
  className,
  ...rest
}: FeldProps<F> & Omit<ComponentProps<typeof Input>, "name" | "form">) {
  const fehler = fehlerVon(form, name);
  return (
    <FeldRahmen id={name} label={label} hinweis={hinweis} fehler={fehler} className={className}>
      <Input id={name} aria-invalid={!!fehler} {...rest} {...form.register(name)} />
    </FeldRahmen>
  );
}

export function TextbereichFeld<F extends FieldValues>({
  form,
  name,
  label,
  hinweis,
  className,
  ...rest
}: FeldProps<F> & Omit<ComponentProps<typeof Textarea>, "name" | "form">) {
  const fehler = fehlerVon(form, name);
  return (
    <FeldRahmen id={name} label={label} hinweis={hinweis} fehler={fehler} className={className}>
      <Textarea id={name} aria-invalid={!!fehler} {...rest} {...form.register(name)} />
    </FeldRahmen>
  );
}

export const auswahlKlasse =
  "border-input bg-background h-9 w-full rounded-lg border px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive";

export function AuswahlFeld<F extends FieldValues>({
  form,
  name,
  label,
  hinweis,
  className,
  optionen,
  leer,
  zahl,
}: FeldProps<F> & {
  optionen: readonly { wert: string; text: string }[];
  leer?: string;
  zahl?: boolean;
}) {
  const fehler = fehlerVon(form, name);
  return (
    <FeldRahmen id={name} label={label} hinweis={hinweis} fehler={fehler} className={className}>
      <select
        id={name}
        className={auswahlKlasse}
        aria-invalid={!!fehler}
        {...form.register(name, {
          setValueAs: (v: string) => (v === "" ? null : zahl ? Number(v) : v),
        })}
      >
        {leer !== undefined && <option value="">{leer}</option>}
        {optionen.map((o) => (
          <option key={o.wert} value={o.wert}>
            {o.text}
          </option>
        ))}
      </select>
    </FeldRahmen>
  );
}

export function KontrollkaestchenFeld<F extends FieldValues>({
  form,
  name,
  label,
  hinweis,
}: Omit<FeldProps<F>, "className">) {
  return (
    <label className="flex items-start gap-2 text-sm">
      <input type="checkbox" className="mt-0.5 size-4" {...form.register(name)} />
      <span>
        {label}
        {hinweis && <span className="text-muted-foreground block text-xs">{hinweis}</span>}
      </span>
    </label>
  );
}

export function MehrfachAuswahlFeld<F extends FieldValues>({
  form,
  name,
  label,
  optionen,
}: Omit<FeldProps<F>, "className"> & { optionen: readonly { wert: string; text: string }[] }) {
  const fehler = fehlerVon(form, name);
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1 text-sm font-medium">{label}</legend>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {optionen.map((o) => (
          <label key={o.wert} className="flex items-center gap-2 text-sm">
            <input type="checkbox" value={o.wert} className="size-4" {...form.register(name)} />
            {o.text}
          </label>
        ))}
      </div>
      {fehler && (
        <p className="text-destructive text-sm" role="alert">
          {fehler}
        </p>
      )}
    </fieldset>
  );
}
