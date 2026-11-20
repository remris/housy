"use server";

import { revalidatePath } from "next/cache";
import { type AktionErgebnis, dbFehler, fehler } from "@/lib/aktion";
import { bueroKontext } from "@/lib/auth";
import { parseCsv } from "@/domain/csv";
import { findeKunde, importiereKunden, importiereObjekte } from "@/domain/import";

type Bericht = { angelegt: number; uebersprungen: { zeile: number; fehler: string[] }[] };

const MAX_ZEILEN = 5000;

/**
 * Importiert Kunden. Der Client schickt den bereits dekodierten CSV-Text;
 * Prüfung erfolgt hier erneut mit derselben Fachlogik.
 */
export async function kundenImportieren(csvText: string): Promise<AktionErgebnis<Bericht>> {
  const k = await bueroKontext();
  const tabelle = parseCsv(csvText);
  if (tabelle.zeilen.length > MAX_ZEILEN)
    return fehler(`Höchstens ${MAX_ZEILEN} Zeilen je Import.`);
  const e = importiereKunden(tabelle);
  if (e.fehlendePflichtspalten.length) return fehler("Spalte für den Kundennamen fehlt.");

  const { data: vorhandene } = await k.supabase
    .from("kunde")
    .select("kundennummer")
    .eq("betrieb_id", k.betriebId);
  const belegt = new Set((vorhandene ?? []).map((x) => Number(x.kundennummer)));
  const uebersprungen = [...e.fehlerhaft];
  const neu = e.gueltig.filter((g) => {
    if (g.daten.kundennummer && belegt.has(g.daten.kundennummer)) {
      uebersprungen.push({
        zeile: g.zeile,
        fehler: [`Kundennummer ${g.daten.kundennummer} existiert bereits`],
      });
      return false;
    }
    return true;
  });

  // Eigene Nummern zuerst, damit automatische Nummern dahinter weiterlaufen
  neu.sort((a, b) => (b.daten.kundennummer ?? 0) - (a.daten.kundennummer ?? 0));
  for (let i = 0; i < neu.length; i += 500) {
    const block = neu.slice(i, i + 500).map((g) => ({
      ...g.daten,
      kundennummer: g.daten.kundennummer ?? 0,
      betrieb_id: k.betriebId,
    }));
    const { error } = await k.supabase.from("kunde").insert(block);
    if (error) return fehler(`Import nach ${i} Kunden abgebrochen: ${dbFehler(error)}`);
  }
  revalidatePath("/kunden");
  return {
    ok: true,
    daten: { angelegt: neu.length, uebersprungen: uebersprungen.sort((a, b) => a.zeile - b.zeile) },
    meldung: `${neu.length} Kunden importiert.`,
  };
}

export async function objekteImportieren(csvText: string): Promise<AktionErgebnis<Bericht>> {
  const k = await bueroKontext();
  const tabelle = parseCsv(csvText);
  if (tabelle.zeilen.length > MAX_ZEILEN)
    return fehler(`Höchstens ${MAX_ZEILEN} Zeilen je Import.`);
  const e = importiereObjekte(tabelle);
  if (e.fehlendePflichtspalten.length) return fehler("Spalte für den Kunden fehlt.");

  const { data: kunden } = await k.supabase
    .from("kunde")
    .select("id, kundennummer, name")
    .eq("betrieb_id", k.betriebId);
  const liste = (kunden ?? []).map((x) => ({ ...x, kundennummer: Number(x.kundennummer) }));
  const uebersprungen = [...e.fehlerhaft];
  const zeilen = [];
  for (const g of e.gueltig) {
    const treffer = findeKunde(g.daten.kunde, liste);
    if ("fehler" in treffer) {
      uebersprungen.push({ zeile: g.zeile, fehler: [treffer.fehler] });
      continue;
    }
    const { kunde: _kunde, ...rest } = g.daten;
    void _kunde;
    zeilen.push({ ...rest, kunde_id: treffer.id, betrieb_id: k.betriebId });
  }
  for (let i = 0; i < zeilen.length; i += 500) {
    const { error } = await k.supabase.from("objekt").insert(zeilen.slice(i, i + 500));
    if (error) return fehler(`Import nach ${i} Objekten abgebrochen: ${dbFehler(error)}`);
  }
  revalidatePath("/objekte");
  return {
    ok: true,
    daten: {
      angelegt: zeilen.length,
      uebersprungen: uebersprungen.sort((a, b) => a.zeile - b.zeile),
    },
    meldung: `${zeilen.length} Objekte importiert.`,
  };
}
