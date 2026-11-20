"use client";

import { MinusIcon, PlusIcon } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { WOCHENTAGE_KURZ, formatDatum, wochentag } from "@/domain/datum";
import { formatEuro } from "@/domain/geld";
import { type BuchungsEinstellungen, preisBerechnen } from "@/domain/preisrechner";
import { type FreierTermin, HALBTAGE } from "@/domain/termine";
import { type BuchungsErgebnis, buchungSenden, termineLaden } from "@/lib/aktionen/oeffentlich";
import { cn } from "@/lib/utils";

type Schritt = "fenster" | "termin" | "kontakt" | "fertig";

export function Buchung({
  kennung,
  einstellungen: e,
  kleinunternehmer,
  datenschutzUrl,
}: {
  kennung: string;
  einstellungen: BuchungsEinstellungen;
  kleinunternehmer: boolean;
  datenschutzUrl: string | null;
}) {
  const [schritt, setSchritt] = useState<Schritt>("fenster");
  const [anzahl, setAnzahl] = useState<Record<string, number>>({});
  const [rahmen, setRahmen] = useState(false);
  const [termine, setTermine] = useState<FreierTermin[] | null>(null);
  const [termin, setTermin] = useState<FreierTermin | null>(null);
  const [kontakt, setKontakt] = useState({
    name: "",
    email: "",
    telefon: "",
    strasse: "",
    plz: "",
    ort: "",
    nachricht: "",
    website: "",
  });
  const [datenschutz, setDatenschutz] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [ergebnis, setErgebnis] = useState<BuchungsErgebnis | null>(null);
  const [laeuft, starte] = useTransition();
  const preis = preisBerechnen(e, { anzahl, rahmen }, kleinunternehmer);

  useEffect(() => {
    if (schritt !== "termin") return;
    setTermine(null);
    void termineLaden(kennung, preis.minuten).then(setTermine);
    // nur beim Wechsel in den Schritt laden
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schritt]);

  const aendern = (id: string, d: number) =>
    setAnzahl((a) => ({ ...a, [id]: Math.max(0, Math.min(500, (a[id] ?? 0) + d)) }));

  const zusammenfassung = (
    <div className="bg-muted/50 flex flex-col gap-1 rounded-lg p-3 text-sm" data-preis>
      {preis.posten.map((p) => (
        <div key={p.id} className="flex justify-between gap-2">
          <span>
            {p.anzahl} × {p.name}
          </span>
          <span className="tabular-nums">{formatEuro(p.summeCent)}</span>
        </div>
      ))}
      {preis.rahmenCent > 0 && (
        <div className="flex justify-between">
          <span>Rahmen (+{e.rahmenProzent} %)</span>
          <span className="tabular-nums">{formatEuro(preis.rahmenCent)}</span>
        </div>
      )}
      {preis.anfahrtCent > 0 && (
        <div className="flex justify-between">
          <span>Anfahrt</span>
          <span className="tabular-nums">{formatEuro(preis.anfahrtCent)}</span>
        </div>
      )}
      {preis.mindestAufschlagCent > 0 && (
        <div className="flex justify-between">
          <span>Aufschlag auf Mindestauftrag {formatEuro(e.mindestpreisCent)}</span>
          <span className="tabular-nums">{formatEuro(preis.mindestAufschlagCent)}</span>
        </div>
      )}
      {!kleinunternehmer && (
        <>
          <div className="mt-1 flex justify-between border-t pt-1">
            <span>Summe netto</span>
            <span className="tabular-nums">{formatEuro(preis.nettoCent)}</span>
          </div>
          <div className="flex justify-between">
            <span>zzgl. {e.ustSatz} % USt.</span>
            <span className="tabular-nums">{formatEuro(preis.ustCent)}</span>
          </div>
        </>
      )}
      <div className="mt-1 flex justify-between border-t pt-1 text-base font-semibold">
        <span>Gesamtpreis</span>
        <span className="tabular-nums">{formatEuro(preis.bruttoCent)}</span>
      </div>
      {kleinunternehmer && (
        <div className="text-muted-foreground text-xs">
          Kein Ausweis der Umsatzsteuer (§ 19 UStG).
        </div>
      )}
    </div>
  );

  if (schritt === "fertig" && ergebnis) {
    return (
      <div className="flex flex-col gap-3 text-sm" data-buchung-fertig>
        <p className="rounded-md bg-emerald-50 p-4 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
          Vielen Dank! Ihre Buchung Nr. {ergebnis.vertragsnummer} ist eingegangen. Wir kommen am{" "}
          <b>
            {formatDatum(ergebnis.datum)} {HALBTAGE[ergebnis.halbtag].text}
          </b>
          . Eine Bestätigung haben wir an {kontakt.email} geschickt.
        </p>
        {zusammenfassung}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <ol className="text-muted-foreground flex gap-2 text-xs">
        {(["fenster", "termin", "kontakt"] as const).map((s, i) => (
          <li
            key={s}
            className={cn(
              "flex-1 border-t-2 pt-1",
              schritt === s ? "border-foreground text-foreground font-medium" : "border-muted",
            )}
          >
            {i + 1}. {s === "fenster" ? "Fenster" : s === "termin" ? "Termin" : "Ihre Daten"}
          </li>
        ))}
      </ol>

      {schritt === "fenster" && (
        <>
          <ul className="flex flex-col divide-y">
            {e.positionen.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-3 py-2"
                data-position={p.id}
              >
                <span className="text-sm">
                  {p.name}
                  <span className="text-muted-foreground block text-xs">
                    {formatEuro(
                      kleinunternehmer
                        ? p.preisCent
                        : Math.round((p.preisCent * (100 + e.ustSatz)) / 100),
                    )}{" "}
                    je Stück{kleinunternehmer ? "" : " inkl. USt."}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    aria-label={`${p.name} weniger`}
                    onClick={() => aendern(p.id, -1)}
                  >
                    <MinusIcon />
                  </Button>
                  <Input
                    aria-label={`Anzahl ${p.name}`}
                    inputMode="numeric"
                    className="w-16 text-center"
                    value={anzahl[p.id] ?? 0}
                    onChange={(ev) => {
                      const n = Number(ev.target.value.replace(/\D/g, ""));
                      setAnzahl((a) => ({ ...a, [p.id]: Math.min(500, n) }));
                    }}
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    aria-label={`${p.name} mehr`}
                    onClick={() => aendern(p.id, 1)}
                  >
                    <PlusIcon />
                  </Button>
                </span>
              </li>
            ))}
          </ul>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4"
              checked={rahmen}
              onChange={(ev) => setRahmen(ev.target.checked)}
            />
            Rahmen und Falze mitreinigen (+{e.rahmenProzent} %)
          </label>
          <p className="text-muted-foreground text-xs">
            Gezählt wird jedes Fenster einmal; innen und außen sind enthalten.
          </p>
          {preis.fenster > 0 && zusammenfassung}
          <Button disabled={preis.fenster === 0} onClick={() => setSchritt("termin")}>
            Weiter zur Terminwahl
          </Button>
        </>
      )}

      {schritt === "termin" && (
        <>
          {termine === null ? (
            <p className="text-muted-foreground text-sm">Freie Termine werden gesucht …</p>
          ) : termine.length === 0 ? (
            <p className="text-sm">
              Leider ist in den nächsten Wochen kein Termin frei. Bitte rufen Sie uns an.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2" data-termine>
              {termine.slice(0, 24).map((t) => {
                const gewaehlt = termin?.datum === t.datum && termin.halbtag === t.halbtag;
                return (
                  <button
                    key={`${t.datum}-${t.halbtag}`}
                    type="button"
                    onClick={() => setTermin(t)}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-left text-sm",
                      gewaehlt
                        ? "border-foreground bg-foreground text-background"
                        : "hover:bg-muted",
                    )}
                  >
                    <span className="font-medium">
                      {WOCHENTAGE_KURZ[wochentag(t.datum) - 1]}, {formatDatum(t.datum)}
                    </span>
                    <span className={cn("block text-xs", gewaehlt ? "" : "text-muted-foreground")}>
                      {HALBTAGE[t.halbtag].text}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => setSchritt("fenster")}>
              Zurück
            </Button>
            <Button disabled={!termin} onClick={() => setSchritt("kontakt")}>
              Weiter
            </Button>
          </div>
        </>
      )}

      {schritt === "kontakt" && termin && (
        <form
          className="flex flex-col gap-3"
          onSubmit={(ev) => {
            ev.preventDefault();
            starte(async () => {
              setFehler(null);
              const r = await buchungSenden(kennung, {
                ...kontakt,
                anzahl,
                rahmen,
                datum: termin.datum,
                halbtag: termin.halbtag,
                datenschutz: datenschutz as true,
              });
              if (!r.ok) {
                const feld = Object.values(r.feldfehler ?? {}).flat()[0];
                setFehler(feld ? `${r.fehler} ${feld}` : r.fehler);
              } else if (r.daten) {
                setErgebnis(r.daten);
                setSchritt("fertig");
              }
            });
          }}
        >
          <p className="text-sm">
            Termin:{" "}
            <b>
              {WOCHENTAGE_KURZ[wochentag(termin.datum) - 1]}, {formatDatum(termin.datum)}{" "}
              {HALBTAGE[termin.halbtag].text}
            </b>
          </p>
          {fehler && (
            <p className="text-destructive text-sm" role="alert">
              {fehler}
            </p>
          )}
          {(
            [
              ["name", "Ihr Name", "name", "text"],
              ["email", "E-Mail", "email", "email"],
              ["telefon", "Telefon (für Rückfragen)", "tel", "tel"],
              ["strasse", "Straße und Hausnummer", "street-address", "text"],
            ] as const
          ).map(([feld, label, auto, typ]) => (
            <label key={feld} className="flex flex-col gap-1 text-sm">
              {label}
              <Input
                type={typ}
                autoComplete={auto}
                value={kontakt[feld]}
                onChange={(ev) => setKontakt((k) => ({ ...k, [feld]: ev.target.value }))}
                required={feld !== "telefon"}
              />
            </label>
          ))}
          <div className="grid grid-cols-[7rem_1fr] gap-3">
            <label className="flex flex-col gap-1 text-sm">
              PLZ
              <Input
                inputMode="numeric"
                autoComplete="postal-code"
                value={kontakt.plz}
                onChange={(ev) => setKontakt((k) => ({ ...k, plz: ev.target.value }))}
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Ort
              <Input
                autoComplete="address-level2"
                value={kontakt.ort}
                onChange={(ev) => setKontakt((k) => ({ ...k, ort: ev.target.value }))}
                required
              />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-sm">
            Hinweise (optional)
            <Textarea
              rows={2}
              value={kontakt.nachricht}
              onChange={(ev) => setKontakt((k) => ({ ...k, nachricht: ev.target.value }))}
              placeholder="z. B. Klingel, Parken, Haustiere"
            />
          </label>
          <input
            type="text"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden
            className="absolute -left-[9999px] h-0 w-0 opacity-0"
            value={kontakt.website}
            onChange={(ev) => setKontakt((k) => ({ ...k, website: ev.target.value }))}
          />
          {zusammenfassung}
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 size-4"
              checked={datenschutz}
              onChange={(ev) => setDatenschutz(ev.target.checked)}
            />
            <span>
              Ich bin einverstanden, dass meine Angaben zur Durchführung des Auftrags gespeichert
              werden.
              {datenschutzUrl && (
                <>
                  {" "}
                  <a href={datenschutzUrl} target="_blank" rel="noreferrer" className="underline">
                    Datenschutzerklärung
                  </a>
                </>
              )}
            </span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" onClick={() => setSchritt("termin")}>
              Zurück
            </Button>
            <Button type="submit" disabled={laeuft || !datenschutz}>
              {laeuft ? "Wird gebucht …" : "Zahlungspflichtig buchen"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
