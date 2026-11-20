import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { bueroKontext } from "@/lib/auth";
import { qrSvg } from "@/lib/qr";
import { DruckenKnopf } from "./drucken-knopf";

export const metadata: Metadata = { title: "QR-Code" };

/** Druckansicht: QR-Code zum Aushängen im Objekt (Check-in der Mitarbeiter). */
export default async function QrSeite({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const k = await bueroKontext();
  const { data: o } = await k.supabase
    .from("objekt")
    .select("name, strasse, plz, ort, qr_kennung, betrieb(name)")
    .eq("id", id)
    .eq("betrieb_id", k.betriebId)
    .maybeSingle();
  if (!o) notFound();
  const svg = await qrSvg(o.qr_kennung);

  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-4 py-6 text-center">
      <div className="print:hidden">
        <DruckenKnopf />
      </div>
      <div className="flex w-full flex-col items-center gap-3 rounded-xl border-2 border-black p-6">
        <div className="text-sm">{o.betrieb?.name}</div>
        <div className="text-xl font-semibold">{o.name}</div>
        <div className="text-sm">
          {[o.strasse, [o.plz, o.ort].filter(Boolean).join(" ")].filter(Boolean).join(", ")}
        </div>
        <div
          className="w-64 [&_svg]:h-auto [&_svg]:w-full"
          // QR-Code aus eigener Bibliothek (qrcode), kein Nutzerinhalt
          dangerouslySetInnerHTML={{ __html: svg }}
        />
        <div className="text-sm font-medium">Check-in / Check-out mit der Housy-App</div>
        <div className="text-muted-foreground font-mono text-[10px]">{o.qr_kennung}</div>
      </div>
    </div>
  );
}
