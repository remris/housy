import type { Metadata } from "next";
import Link from "next/link";
import { Seitenkopf } from "@/components/seitenkopf";
import { bueroKontext } from "@/lib/auth";
import { ObjektFormular } from "../objekt-formular";

export const metadata: Metadata = { title: "Neues Objekt" };

export default async function NeuesObjektSeite({
  searchParams,
}: {
  searchParams: Promise<{ kunde?: string }>;
}) {
  const { kunde } = await searchParams;
  const k = await bueroKontext();
  const { data: kunden } = await k.supabase
    .from("kunde")
    .select("id, name, kundennummer")
    .eq("betrieb_id", k.betriebId)
    .eq("aktiv", true)
    .order("name");

  return (
    <div className="max-w-3xl">
      <Seitenkopf titel="Neues Objekt" />
      {kunden?.length ? (
        <ObjektFormular
          id={null}
          kunden={kunden}
          werte={{
            kunde_id: kunden.some((x) => x.id === kunde) ? kunde! : "",
            name: "",
            strasse: "",
            plz: "",
            ort: "",
            breitengrad: "",
            laengengrad: "",
            zugangshinweise: "",
            schluessel: "",
            notiz: "",
            aktiv: true,
          }}
        />
      ) : (
        <p className="text-muted-foreground text-sm">
          Lege zuerst einen{" "}
          <Link href="/kunden/neu" className="underline">
            Kunden
          </Link>{" "}
          an.
        </p>
      )}
    </div>
  );
}
