import type { Metadata } from "next";
import Link from "next/link";
import { Seitenkopf } from "@/components/seitenkopf";
import { heuteIso, plusTage } from "@/domain/datum";
import { bueroKontext } from "@/lib/auth";
import { VertragNeuFormular } from "./vertrag-neu-formular";

export const metadata: Metadata = { title: "Neuer Vertrag" };

export default async function NeuerVertragSeite({
  searchParams,
}: {
  searchParams: Promise<{ kunde?: string; objekt?: string }>;
}) {
  const vorauswahl = await searchParams;
  const k = await bueroKontext();
  const { data: kunden } = await k.supabase
    .from("kunde")
    .select("id, name, objekt(id, name, aktiv)")
    .eq("betrieb_id", k.betriebId)
    .eq("aktiv", true)
    .order("name");

  // Beginn standardmäßig am nächsten Monatsersten
  const heute = heuteIso();
  const naechsterMonat = `${plusTage(`${heute.slice(0, 8)}28`, 7).slice(0, 8)}01`;

  return (
    <div className="max-w-3xl">
      <Seitenkopf titel="Neuer Vertrag" />
      {kunden?.length ? (
        <VertragNeuFormular
          kunden={kunden.map((x) => ({
            id: x.id,
            name: x.name,
            objekte: x.objekt.filter((o) => o.aktiv),
          }))}
          vorauswahl={vorauswahl}
          beginn={naechsterMonat}
        />
      ) : (
        <p className="text-muted-foreground text-sm">
          Lege zuerst einen{" "}
          <Link href="/kunden/neu" className="underline">
            Kunden
          </Link>{" "}
          mit Objekt an.
        </p>
      )}
    </div>
  );
}
