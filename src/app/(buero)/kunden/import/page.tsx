import type { Metadata } from "next";
import { CsvImport } from "@/components/csv-import";
import { Seitenkopf } from "@/components/seitenkopf";
import { bueroKontext } from "@/lib/auth";

export const metadata: Metadata = { title: "Kunden importieren" };

export default async function ImportSeite() {
  await bueroKontext();
  return (
    <div className="max-w-3xl">
      <Seitenkopf
        titel="Kunden importieren"
        beschreibung="Kundenliste aus Excel (CSV) übernehmen"
      />
      <CsvImport art="kunden" />
    </div>
  );
}
