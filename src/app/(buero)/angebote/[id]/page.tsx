import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Seitenkopf } from "@/components/seitenkopf";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { angebotsSumme } from "@/domain/angebot";
import { formatDatum } from "@/domain/datum";
import { formatEuro } from "@/domain/geld";
import { EINHEIT_TEXT, type Preiseinheit } from "@/domain/rechnung";
import { bueroKontext } from "@/lib/auth";
import { siteUrl } from "@/lib/env";
import { centZuEingabe } from "@/lib/schemas/helfer";
import { ANGEBOTSSTATUS } from "@/lib/schemas/anfrage";
import { rhythmusText } from "@/lib/pdf/angebot-pdf";
import {
  AngebotFormular,
  AngebotKnoepfe,
  LeistungDialog,
  LeistungLoeschen,
} from "../angebot-teile";

export const metadata: Metadata = { title: "Angebot" };

export default async function AngebotSeite({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const k = await bueroKontext();
  const [{ data: a }, { data: vorlagen }, { data: preise }] = await Promise.all([
    k.supabase
      .from("angebot")
      .select("*, angebotsleistung(*), vertrag(id, status, vertragsnummer), anfrage(id, nachricht)")
      .eq("id", id)
      .maybeSingle(),
    k.supabase
      .from("auftragsvorlage")
      .select("id, name")
      .eq("betrieb_id", k.betriebId)
      .eq("aktiv", true)
      .order("name"),
    k.supabase
      .from("preisliste")
      .select("id, name, preis_cent, einheit, vorlage_id")
      .eq("betrieb_id", k.betriebId)
      .eq("aktiv", true)
      .order("name"),
  ]);
  if (!a) notFound();
  const leistungen = [...a.angebotsleistung].sort((x, y) => x.pos - y.pos);
  const gesperrt = a.status === "angenommen" || a.status === "abgelehnt";
  const z = angebotsSumme(
    leistungen.map((l) => ({
      bezeichnung: l.bezeichnung,
      frequenz: l.frequenz,
      intervall: l.intervall,
      wochentage: l.wochentage,
      mengeJeEinsatz: Number(l.menge_je_einsatz),
      einheit: l.einheit as Preiseinheit,
      preisCent: l.preis_cent,
    })),
    a.abrechnungsart,
    a.pauschale_cent,
  );
  const vorlagenOptionen = (vorlagen ?? []).map((v) => ({ wert: v.id, text: v.name }));
  const preisOptionen = (preise ?? []).map((p) => ({
    wert: p.id,
    text: `${p.name} (${formatEuro(p.preis_cent)} ${EINHEIT_TEXT[p.einheit as Preiseinheit] ?? p.einheit})`,
    preisCent: p.preis_cent,
    einheit: p.einheit,
    name: p.name,
    vorlageId: p.vorlage_id,
  }));
  const link = `${siteUrl()}/angebot/${a.freigabe_token}`;
  const st = ANGEBOTSSTATUS[a.status];

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <Seitenkopf
        titel={`Angebot ${a.nummer}: ${a.titel}`}
        beschreibung={
          <>
            <Badge variant="secondary">{st?.text ?? a.status}</Badge>{" "}
            {a.versendet_am && `verschickt ${formatDatum(a.versendet_am.slice(0, 10))} · `}
            {a.angenommen_am &&
              `angenommen von ${a.angenommen_name} am ${new Date(a.angenommen_am).toLocaleString("de-DE", { timeZone: "Europe/Berlin" })} · `}
            {a.abgelehnt_am && `abgelehnt${a.ablehngrund ? `: ${a.ablehngrund}` : ""} · `}
            <Link href="/angebote" className="underline">
              alle Angebote
            </Link>
          </>
        }
        aktionen={
          <AngebotKnoepfe
            id={a.id}
            status={a.status}
            vertragId={a.vertrag?.id ?? null}
            vertragStatus={a.vertrag?.status ?? null}
          />
        }
      />

      {a.vertrag && (
        <p
          className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"
          data-vertrag
        >
          Kunde, Objekt und{" "}
          <Link href={`/vertraege/${a.vertrag.id}`} className="font-medium underline">
            Vertrag {a.vertrag.vertragsnummer}
          </Link>{" "}
          ({a.vertrag.status === "entwurf" ? "Entwurf – prüfen und aktivieren" : a.vertrag.status})
          wurden angelegt.
        </p>
      )}
      {a.status !== "entwurf" && (
        <p className="text-sm">
          Link für den Kunden:{" "}
          <a href={link} target="_blank" rel="noreferrer" className="break-all underline">
            {link}
          </a>{" "}
          ·{" "}
          <a
            href={`/angebot/${a.freigabe_token}/pdf`}
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            PDF
          </a>
        </p>
      )}
      {a.anfrage?.nachricht && (
        <p className="text-muted-foreground rounded-md border p-3 text-sm whitespace-pre-line">
          Aus der Anfrage: {a.anfrage.nachricht}
        </p>
      )}

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Leistungen</h2>
          {!gesperrt && (
            <LeistungDialog angebotId={a.id} vorlagen={vorlagenOptionen} preise={preisOptionen} />
          )}
        </div>
        {leistungen.length === 0 ? (
          <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-center text-sm">
            Noch keine Leistungen. Jede Leistung wird bei Annahme eine Vertragsleistung (mit Vorlage
            und Rhythmus).
          </p>
        ) : (
          <ul className="divide-y rounded-lg border text-sm" data-angebot-leistungen>
            {leistungen.map((l, i) => (
              <li key={l.id} className="flex flex-wrap items-center gap-3 px-3 py-2">
                <span className="flex-1">
                  <span className="font-medium">{l.bezeichnung}</span>
                  <span className="text-muted-foreground block text-xs">
                    {rhythmusText({
                      ...l,
                      menge_je_einsatz: Number(l.menge_je_einsatz),
                      einheit: l.einheit as Preiseinheit,
                      ust_satz: 19,
                      taetigkeiten: [],
                    })}
                    {l.preis_cent !== null &&
                      ` · ${Number(l.menge_je_einsatz).toLocaleString("de-DE")} × ${formatEuro(l.preis_cent)} ${EINHEIT_TEXT[l.einheit as Preiseinheit]} = ${formatEuro(z.zeilen[i]!.jeEinsatzCent)} je Einsatz`}
                  </span>
                </span>
                {a.abrechnungsart !== "pauschale" && z.zeilen[i]!.monatCent > 0 && (
                  <span className="tabular-nums">
                    ca. {formatEuro(z.zeilen[i]!.monatCent)}/Monat
                  </span>
                )}
                {!gesperrt && (
                  <>
                    <LeistungDialog
                      angebotId={a.id}
                      vorlagen={vorlagenOptionen}
                      preise={preisOptionen}
                      leistung={{
                        id: l.id,
                        angebot_id: a.id,
                        vorlage_id: l.vorlage_id,
                        preis_id: l.preis_id,
                        bezeichnung: l.bezeichnung,
                        beschreibung: l.beschreibung ?? "",
                        frequenz: l.frequenz,
                        intervall: l.intervall,
                        wochentage: l.wochentage.map(String),
                        menge_je_einsatz: String(Number(l.menge_je_einsatz)).replace(".", ","),
                        einheit: l.einheit as "einsatz",
                        preis_cent: centZuEingabe(l.preis_cent),
                      }}
                    />
                    <LeistungLoeschen id={l.id} angebotId={a.id} />
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
        <div className="bg-muted/50 rounded-lg p-3 text-sm" data-angebot-summe>
          {a.abrechnungsart === "pauschale" ? "Monatspauschale" : "voraussichtlich je Monat"}:{" "}
          <span className="font-semibold">{formatEuro(z.monatNettoCent)}</span> netto
          {z.einmaligNettoCent > 0 && ` · einmalig ${formatEuro(z.einmaligNettoCent)} netto`}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">Angaben</h2>
        <AngebotFormular
          id={a.id}
          gesperrt={gesperrt}
          werte={{
            kunde_id: a.kunde_id,
            objekt_id: a.objekt_id,
            kundentyp: a.kundentyp,
            empfaenger_name: a.empfaenger_name,
            empfaenger_firma: a.empfaenger_firma ?? "",
            empfaenger_email: a.empfaenger_email ?? "",
            empfaenger_telefon: a.empfaenger_telefon ?? "",
            strasse: a.strasse ?? "",
            plz: a.plz ?? "",
            ort: a.ort ?? "",
            objekt_name: a.objekt_name ?? "",
            objekt_strasse: a.objekt_strasse ?? "",
            objekt_plz: a.objekt_plz ?? "",
            objekt_ort: a.objekt_ort ?? "",
            titel: a.titel,
            einleitung: a.einleitung ?? "",
            beginn: a.beginn,
            gueltig_bis: a.gueltig_bis ?? "",
            abrechnungsart: a.abrechnungsart,
            pauschale_cent: centZuEingabe(a.pauschale_cent),
            laufzeit_monate: a.laufzeit_monate,
            kuendigungsfrist_monate: a.kuendigungsfrist_monate,
          }}
        />
        {a.status === "entwurf" && (
          <p className="text-muted-foreground text-xs">
            Vorschau als PDF gibt es nach dem Senden über den Kundenlink.{" "}
            <Button
              size="sm"
              variant="ghost"
              nativeButton={false}
              render={<Link href="/einstellungen/vertraege" />}
            >
              Vertragsbedingungen bearbeiten
            </Button>
          </p>
        )}
      </section>
    </div>
  );
}
