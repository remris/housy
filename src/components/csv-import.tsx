"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { dekodiere, parseCsv } from "@/domain/csv";
import { importiereKunden, importiereObjekte } from "@/domain/import";
import { kundenImportieren, objekteImportieren } from "@/lib/aktionen/import";

const KONFIG = {
  kunden: {
    pruefen: importiereKunden,
    importieren: kundenImportieren,
    einheit: "Kunden",
    zurueck: "/kunden",
    vorlage:
      "Kundennummer;Name;Typ;Straße;PLZ;Ort;E-Mail;Telefon;Leitweg-ID;Notiz\n1001;Hausverwaltung Müller;Verwaltung;Hauptstraße 12;70173;Stuttgart;info@beispiel.de;0711 123456;;\n;Familie Schmidt;Privat;Gartenweg 3;72070;Tübingen;;;;\n",
  },
  objekte: {
    pruefen: importiereObjekte,
    importieren: objekteImportieren,
    einheit: "Objekte",
    zurueck: "/objekte",
    vorlage:
      "Kunde;Objekt;Straße;PLZ;Ort;Zugang;Notiz\n1001;Hauptstraße 12;Hauptstraße 12;70173;Stuttgart;Schlüssel Nr. 14;\nFamilie Schmidt;Wohnhaus;Gartenweg 3;72070;Tübingen;;\n",
  },
} as const;

type Fehlerzeile = { zeile: number; fehler: string[] };

export function CsvImport({ art }: { art: keyof typeof KONFIG }) {
  const k = KONFIG[art];
  const [text, setText] = useState<string | null>(null);
  const [dateiname, setDateiname] = useState("");
  const [bericht, setBericht] = useState<{ angelegt: number; uebersprungen: Fehlerzeile[] } | null>(
    null,
  );
  const [laeuft, starte] = useTransition();

  const vorschau = text ? k.pruefen(parseCsv(text)) : null;

  async function dateiGewaehlt(datei: File | undefined) {
    setBericht(null);
    if (!datei) return setText(null);
    setDateiname(datei.name);
    setText(dekodiere(new Uint8Array(await datei.arrayBuffer())));
  }

  const vorlageUrl = `data:text/csv;charset=utf-8,${encodeURIComponent(`﻿${k.vorlage}`)}`;

  return (
    <div className="flex flex-col gap-6">
      <ol className="text-muted-foreground list-inside list-decimal space-y-1 text-sm">
        <li>
          In Excel: <em>Datei → Speichern unter → CSV UTF-8 (durch Trennzeichen getrennt)</em>. Die
          erste Zeile enthält die Spaltennamen.
        </li>
        <li>
          Spalten werden automatisch erkannt.{" "}
          <a href={vorlageUrl} download={`vorlage-${art}.csv`} className="underline">
            Vorlage herunterladen
          </a>
        </li>
        <li>Vorschau prüfen, dann importieren. Fehlerhafte Zeilen werden übersprungen.</li>
      </ol>

      <input
        type="file"
        accept=".csv,text/csv,text/plain"
        onChange={(e) => dateiGewaehlt(e.target.files?.[0])}
        className="text-sm"
        aria-label="CSV-Datei wählen"
      />

      {vorschau && !bericht && (
        <div className="flex flex-col gap-4">
          {vorschau.fehlendePflichtspalten.length > 0 ? (
            <Alert variant="destructive">
              <AlertDescription>
                In „{dateiname}“ fehlt eine Pflichtspalte (
                {vorschau.fehlendePflichtspalten.join(", ")}). Bitte Spaltennamen prüfen.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <div className="text-sm">
                <span className="font-medium">Erkannte Spalten: </span>
                {Object.entries(vorschau.erkannteSpalten)
                  .map(([csv, feld]) => `${csv} → ${feld}`)
                  .join(", ")}
              </div>
              <div className="flex flex-wrap gap-4 text-sm">
                <span>
                  <span className="font-medium">{vorschau.gueltig.length}</span> gültige Zeilen
                </span>
                <span className={vorschau.fehlerhaft.length ? "text-destructive" : ""}>
                  <span className="font-medium">{vorschau.fehlerhaft.length}</span> mit Fehlern
                </span>
              </div>
              <FehlerListe zeilen={vorschau.fehlerhaft} />
              <div>
                <Button
                  disabled={laeuft || vorschau.gueltig.length === 0}
                  onClick={() =>
                    starte(async () => {
                      const e = await k.importieren(text!);
                      if (e.ok && e.daten) {
                        setBericht(e.daten);
                        toast.success(e.meldung ?? "Import abgeschlossen.");
                      } else if (!e.ok) toast.error(e.fehler);
                    })
                  }
                >
                  {laeuft ? "Importiere …" : `${vorschau.gueltig.length} ${k.einheit} importieren`}
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {bericht && (
        <div className="flex flex-col gap-4">
          <Alert>
            <AlertDescription>
              {bericht.angelegt} {k.einheit} angelegt
              {bericht.uebersprungen.length > 0 &&
                `, ${bericht.uebersprungen.length} Zeilen übersprungen`}
              .
            </AlertDescription>
          </Alert>
          <FehlerListe zeilen={bericht.uebersprungen} />
          <Link href={k.zurueck} className="text-sm underline">
            Zur Liste
          </Link>
        </div>
      )}
    </div>
  );
}

function FehlerListe({ zeilen }: { zeilen: Fehlerzeile[] }) {
  if (!zeilen.length) return null;
  return (
    <div className="max-h-72 overflow-y-auto rounded-lg border text-sm">
      <table className="w-full">
        <thead className="bg-muted/50 sticky top-0 text-left">
          <tr>
            <th className="w-20 p-2 font-medium">Zeile</th>
            <th className="p-2 font-medium">Problem</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {zeilen.slice(0, 200).map((z) => (
            <tr key={z.zeile}>
              <td className="p-2 tabular-nums">{z.zeile}</td>
              <td className="p-2">{z.fehler.join("; ")}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {zeilen.length > 200 && (
        <p className="text-muted-foreground p-2">… und {zeilen.length - 200} weitere</p>
      )}
    </div>
  );
}
