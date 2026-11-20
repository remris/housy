import type { Metadata } from "next";
import { CsvImport } from "@/components/csv-import";
import { Seitenkopf } from "@/components/seitenkopf";
import { bueroKontext } from "@/lib/auth";

export const metadata: Metadata = { title: "Objekte importieren" };

export default async function ImportSeite() {
  await bueroKontext();
  return (
    <div className="max-w-3xl">
      <Seitenkopf
        titel="Objekte importieren"
        beschreibung="Objekte aus Excel (CSV) übernehmen; der Kunde wird über Kundennummer oder Namen zugeordnet"
      />
      <CsvImport art="objekte" />
    </div>
  );
}
