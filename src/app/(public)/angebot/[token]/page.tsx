import type { Metadata } from "next";
import { OeffentlicherRahmen } from "@/components/oeffentlicher-rahmen";
import { formatDatum } from "@/domain/datum";
import { formatEuro } from "@/domain/geld";
import { EINHEIT_TEXT } from "@/domain/rechnung";
import { type AngebotInfo, angebotsZahlen, rhythmusText } from "@/lib/pdf/angebot-pdf";
import { createClient } from "@/lib/supabase/server";
import { AngebotAntwort } from "./angebot-antwort";

export const metadata: Metadata = { title: "Angebot", robots: { index: false } };

export default async function AngebotSeite({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const { data } = /^[0-9a-f-]{36}$/i.test(token)
    ? await supabase.rpc("angebot_info", { p_token: token })
    : { data: null };
  const d = data as AngebotInfo | null;
  if (!d) {
    return (
      <OeffentlicherRahmen
        betrieb="Housy"
        logoUrl={null}
        titel="Angebot"
        datenschutzUrl={null}
        impressumUrl={null}
      >
        <p className="text-sm">Dieser Link ist ungültig.</p>
      </OeffentlicherRahmen>
    );
  }
  const a = d.angebot;
  const b = d.betrieb;
  const z = angebotsZahlen(d);
  const zzgl = b.kleinunternehmer ? "" : " zzgl. USt.";
  const logoUrl = b.logo_pfad
    ? supabase.storage.from("logos").getPublicUrl(b.logo_pfad).data.publicUrl
    : null;

  return (
    <OeffentlicherRahmen
      betrieb={b.name}
      logoUrl={logoUrl}
      titel={`Angebot ${a.nummer}: ${a.titel}`}
      beschreibung={`für ${a.empfaenger_firma || a.empfaenger_name}${a.gueltig_bis ? ` · gültig bis ${formatDatum(a.gueltig_bis)}` : ""}`}
      datenschutzUrl={b.datenschutz_url}
      impressumUrl={null}
    >
      {a.einleitung && <p className="text-sm whitespace-pre-line">{a.einleitung}</p>}
      <ul className="flex flex-col divide-y rounded-lg border text-sm" data-angebot-leistungen>
        {d.leistungen.map((l, i) => (
          <li key={i} className="flex flex-col gap-0.5 px-3 py-2">
            <span className="flex justify-between gap-2 font-medium">
              <span>{l.bezeichnung}</span>
              {a.abrechnungsart !== "pauschale" && l.preis_cent !== null && (
                <span className="tabular-nums">
                  {formatEuro(l.preis_cent)} je {EINHEIT_TEXT[l.einheit]}
                </span>
              )}
            </span>
            <span className="text-muted-foreground">
              {rhythmusText(l)}
              {a.abrechnungsart !== "pauschale" && l.preis_cent !== null
                ? ` · ${Number(l.menge_je_einsatz).toLocaleString("de-DE")} ${EINHEIT_TEXT[l.einheit]} je Einsatz = ${formatEuro(z.zeilen[i]!.jeEinsatzCent)}`
                : ""}
            </span>
            {l.taetigkeiten.length > 0 && (
              <span className="text-muted-foreground text-xs">{l.taetigkeiten.join(" · ")}</span>
            )}
          </li>
        ))}
      </ul>
      <div className="bg-muted/50 flex flex-col gap-1 rounded-lg p-3 text-sm">
        <div className="flex justify-between font-semibold">
          <span>
            {a.abrechnungsart === "pauschale" ? "Monatspauschale" : "voraussichtlich je Monat"}
          </span>
          <span className="tabular-nums">
            {a.abrechnungsart === "pauschale" ? "" : "ca. "}
            {formatEuro(z.monatNettoCent)}
            {zzgl}
          </span>
        </div>
        {z.einmaligNettoCent > 0 && (
          <div className="flex justify-between">
            <span>einmalig</span>
            <span className="tabular-nums">
              {formatEuro(z.einmaligNettoCent)}
              {zzgl}
            </span>
          </div>
        )}
        <div className="text-muted-foreground text-xs">
          Beginn ab {formatDatum(a.beginn)} ·{" "}
          {a.laufzeit_monate > 0
            ? `Laufzeit ${a.laufzeit_monate} Monate, Kündigungsfrist ${a.kuendigungsfrist_monate} Monate`
            : `unbefristet, ${a.kuendigungsfrist_monate} Monate Kündigungsfrist`}
        </div>
      </div>
      <a
        href={`/angebot/${token}/pdf`}
        target="_blank"
        rel="noreferrer"
        className="text-sm underline"
      >
        Angebot als PDF
      </a>
      {a.status === "angenommen" ? (
        <p
          className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"
          data-angenommen
        >
          Angenommen von {a.angenommen_name} am{" "}
          {new Date(a.angenommen_am!).toLocaleString("de-DE", { timeZone: "Europe/Berlin" })}.
          Vielen Dank für Ihren Auftrag!
        </p>
      ) : a.status === "abgelehnt" ? (
        <p className="text-sm">Dieses Angebot wurde abgelehnt.</p>
      ) : d.abgelaufen ? (
        <p className="text-sm">
          Dieses Angebot ist abgelaufen. Bitte wenden Sie sich an {b.name}
          {b.telefon ? ` (${b.telefon})` : ""}.
        </p>
      ) : (
        <AngebotAntwort token={token} name={a.empfaenger_name} />
      )}
    </OeffentlicherRahmen>
  );
}
