import type { Metadata } from "next";
import { bueroKontext } from "@/lib/auth";
import { RechnungEinstellungen } from "./rechnung-einstellungen";

export const metadata: Metadata = { title: "Einstellungen Rechnungen" };

export default async function RechnungEinstellungenSeite() {
  const k = await bueroKontext();
  const { data: b } = await k.supabase
    .from("betrieb")
    .select(
      "rechnung_praefix, rechnung_kontakt, rechnung_fusstext, datev_beraternummer, datev_mandantennummer, kontenrahmen, kleinunternehmer",
    )
    .eq("id", k.betriebId)
    .single();
  if (!b) return null;
  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <p className="text-muted-foreground text-sm">
        {b.kleinunternehmer
          ? "Kleinunternehmer (§ 19 UStG): Rechnungen ohne Umsatzsteuer, mit Hinweis."
          : "Regelbesteuerung: Umsatzsteuer je Position (19 % bzw. 7 %)."}{" "}
        Ändern unter Firmendaten.
      </p>
      <RechnungEinstellungen
        darfAendern={k.rolle === "inhaber"}
        werte={{
          rechnung_praefix: b.rechnung_praefix,
          rechnung_kontakt: b.rechnung_kontakt ?? "",
          rechnung_fusstext: b.rechnung_fusstext ?? "",
          datev_beraternummer: b.datev_beraternummer === null ? "" : String(b.datev_beraternummer),
          datev_mandantennummer:
            b.datev_mandantennummer === null ? "" : String(b.datev_mandantennummer),
          kontenrahmen: b.kontenrahmen as "skr03" | "skr04",
        }}
      />
    </div>
  );
}
