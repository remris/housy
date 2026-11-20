import type { Metadata } from "next";
import { Seitenkopf } from "@/components/seitenkopf";
import { bueroKontext } from "@/lib/auth";
import { KundeFormular, LEERER_KUNDE } from "../kunde-formular";

export const metadata: Metadata = { title: "Neuer Kunde" };

export default async function NeuerKundeSeite() {
  await bueroKontext();
  return (
    <div className="max-w-3xl">
      <Seitenkopf titel="Neuer Kunde" />
      <KundeFormular id={null} werte={LEERER_KUNDE} />
    </div>
  );
}
