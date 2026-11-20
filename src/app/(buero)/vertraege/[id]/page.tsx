import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Seitenkopf } from "@/components/seitenkopf";
import { Badge } from "@/components/ui/badge";
import { WOCHENTAGE_KURZ, formatDatum, heuteIso, plusTage, wochentag } from "@/domain/datum";
import { formatEuro } from "@/domain/geld";
import { beschreibeWiederholung } from "@/domain/serien";
import { kuendigenBis } from "@/domain/vertrag";
import { bueroKontext } from "@/lib/auth";
import { siteUrl } from "@/lib/env";
import { centZuEingabe } from "@/lib/schemas/helfer";
import { FEIERTAGREGELN, abrechnungsartText } from "@/lib/schemas/vertrag";
import { HORIZONT_WOCHEN, vorschau } from "@/lib/serienplanung";
import { cn } from "@/lib/utils";
import { StatusBadge } from "../status-badge";
import {
  AbrechnungFormular,
  LeistungDialog,
  LeistungEntfernen,
  NeueVersionDialog,
  StammFormular,
  UnterschriftDialog,
  VertragAktionen,
} from "./vertrag-teile";

export const metadata: Metadata = { title: "Vertrag" };

const uhr = (t: string | null) => (t ? t.slice(0, 5) : "");

export default async function VertragSeite({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ version?: string }>;
}) {
  const { id } = await params;
  const { version: versionParam } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const k = await bueroKontext();
  const heute = heuteIso();

  const [{ data: v }, { data: vorlagen }, { data: preise }] = await Promise.all([
    k.supabase
      .from("vertrag")
      .select(
        `*, kunde(id, name), objekt(id, name),
         vertragsversion(id, version, gueltig_ab, abrechnungsart, pauschale_cent, grund, quelle, erstellt_am,
           vertragsleistung(*, auftragsvorlage(name), preisliste(name, preis_cent, einheit)))`,
      )
      .eq("id", id)
      .eq("betrieb_id", k.betriebId)
      .maybeSingle(),
    k.supabase
      .from("auftragsvorlage")
      .select("id, name")
      .eq("betrieb_id", k.betriebId)
      .eq("aktiv", true)
      .order("name"),
    k.supabase
      .from("preisliste")
      .select("id, name, preis_cent, einheit")
      .eq("betrieb_id", k.betriebId)
      .eq("aktiv", true)
      .order("name"),
  ]);
  if (!v) notFound();

  const versionen = [...v.vertragsversion].sort((a, b) => a.version - b.version);
  const gueltige = [...versionen].reverse().find((x) => x.gueltig_ab <= heute) ?? versionen[0];
  const gewaehlt = versionen.find((x) => String(x.version) === versionParam) ?? versionen.at(-1)!;
  const bearbeitbar = v.status === "entwurf" || gewaehlt.gueltig_ab > heute;
  const entwurf = v.status === "entwurf";

  const vorlagenAuswahl = (vorlagen ?? []).map((x) => ({ wert: x.id, text: x.name }));
  const preisAuswahl = (preise ?? []).map((p) => ({
    wert: p.id,
    text: `${p.name} (${formatEuro(p.preis_cent)})`,
  }));

  // Einsätze: aktive Verträge aus der Datenbank, Entwürfe als Vorschau
  const bis = plusTage(heute, HORIZONT_WOCHEN * 7 - 1);
  let einsaetze: { datum: string; vorlage: string; von: string; bis: string; info?: string }[] = [];
  if (entwurf) {
    try {
      const von = v.beginn > heute ? v.beginn : heute;
      const soll = await vorschau(k.supabase, v.id, von, plusTage(von, HORIZONT_WOCHEN * 7 - 1));
      const namen = new Map((vorlagen ?? []).map((x) => [x.id, x.name]));
      einsaetze = soll.map((s) => ({
        datum: s.datum,
        vorlage: namen.get(s.vorlageId) ?? "",
        von: s.zeitfensterVon ?? "",
        bis: s.zeitfensterBis ?? "",
        info: s.verschobenVon ? `verschoben vom ${formatDatum(s.verschobenVon)}` : undefined,
      }));
    } catch {
      einsaetze = [];
    }
  } else {
    const { data } = await k.supabase
      .from("einsatz")
      .select(
        "datum, zeitfenster_von, zeitfenster_bis, status, verschoben_von, auftragsvorlage(name), mitglied(anzeigename)",
      )
      .eq("vertrag_id", v.id)
      .gte("datum", heute)
      .lte("datum", bis)
      .order("datum");
    einsaetze = (data ?? []).map((e) => ({
      datum: e.datum,
      vorlage: e.auftragsvorlage?.name ?? "",
      von: uhr(e.zeitfenster_von),
      bis: uhr(e.zeitfenster_bis),
      info: [
        e.status !== "geplant" ? e.status : null,
        e.mitglied?.anzeigename,
        e.verschoben_von ? `verschoben vom ${formatDatum(e.verschoben_von)}` : null,
      ]
        .filter(Boolean)
        .join(" · "),
    }));
  }

  const frist =
    v.status === "aktiv"
      ? kuendigenBis(
          {
            beginn: v.beginn,
            laufzeitMonate: v.laufzeit_monate,
            verlaengerungMonate: v.verlaengerung_monate,
            kuendigungsfristMonate: v.kuendigungsfrist_monate,
            fristZum: v.frist_zum as "laufzeitende" | "monatsende",
          },
          heute,
        )
      : null;

  return (
    <div className="flex max-w-5xl flex-col gap-10">
      <Seitenkopf
        titel={
          <span className="flex flex-wrap items-center gap-2">
            {v.titel} <StatusBadge status={v.status} unterschrieben={!!v.unterschrieben_am} />
          </span>
        }
        beschreibung={
          <>
            Vertrag {v.vertragsnummer} ·{" "}
            <Link href={`/kunden/${v.kunde?.id}`} className="underline">
              {v.kunde?.name}
            </Link>{" "}
            ·{" "}
            <Link href={`/objekte/${v.objekt?.id}`} className="underline">
              {v.objekt?.name}
            </Link>
            {v.endet_am && ` · endet am ${formatDatum(v.endet_am)}`}
            {frist && ` · nächste Kündigung möglich bis ${formatDatum(frist)}`}
          </>
        }
        aktionen={
          <VertragAktionen
            id={v.id}
            status={v.status}
            istInhaber={k.rolle === "inhaber"}
            freigabeLink={`${siteUrl()}/vertrag/${v.freigabe_token}`}
          />
        }
      />

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4 text-sm">
        {v.unterschrieben_am ? (
          <span>
            Unterschrieben von <span className="font-medium">{v.unterschrift_name}</span> am{" "}
            {new Date(v.unterschrieben_am).toLocaleString("de-DE", { timeZone: "Europe/Berlin" })}
          </span>
        ) : (
          <span className="text-muted-foreground">
            Noch nicht unterschrieben. Link an den Kunden schicken oder direkt hier unterschreiben
            lassen.
          </span>
        )}
        {!v.unterschrieben_am && entwurf && <UnterschriftDialog id={v.id} />}
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1">
            <h2 className="mr-2 font-medium">Leistungen</h2>
            {versionen.map((ver) => (
              <Link
                key={ver.id}
                href={`/vertraege/${v.id}?version=${ver.version}`}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs",
                  ver.id === gewaehlt.id ? "bg-foreground text-background" : "hover:bg-muted",
                )}
              >
                V{ver.version} ab {formatDatum(ver.gueltig_ab)}
                {ver.id === gueltige?.id && !entwurf ? " · gilt" : ""}
              </Link>
            ))}
          </div>
          {!entwurf && v.status !== "beendet" && (
            <NeueVersionDialog
              vertragId={v.id}
              abrechnungsart={gewaehlt.abrechnungsart}
              pauschaleCent={gewaehlt.pauschale_cent}
              morgen={plusTage(heute, 1)}
            />
          )}
        </div>

        {gewaehlt.grund && <p className="text-muted-foreground text-sm">Grund: {gewaehlt.grund}</p>}

        {bearbeitbar ? (
          <AbrechnungFormular
            versionId={gewaehlt.id}
            abrechnungsart={gewaehlt.abrechnungsart}
            pauschaleCent={gewaehlt.pauschale_cent}
          />
        ) : (
          <p className="text-sm">
            Abrechnung: {abrechnungsartText(gewaehlt.abrechnungsart)}
            {gewaehlt.abrechnungsart === "pauschale" && gewaehlt.pauschale_cent !== null
              ? `, ${formatEuro(gewaehlt.pauschale_cent)} pro Monat`
              : ""}
            <span className="text-muted-foreground"> · Version gilt bereits und ist gesperrt.</span>
          </p>
        )}

        {gewaehlt.vertragsleistung.length === 0 ? (
          <p className="text-muted-foreground text-sm">Noch keine Leistungen.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {[...gewaehlt.vertragsleistung]
              .sort((a, b) => a.reihenfolge - b.reihenfolge)
              .map((l) => (
                <li
                  key={l.id}
                  className="flex flex-wrap items-start justify-between gap-2 p-3 text-sm"
                >
                  <div>
                    <div className="font-medium">{l.bezeichnung ?? l.auftragsvorlage?.name}</div>
                    <div className="text-muted-foreground">
                      {beschreibeWiederholung(l)}
                      {l.zeitfenster_von &&
                        l.zeitfenster_bis &&
                        `, ${uhr(l.zeitfenster_von)}–${uhr(l.zeitfenster_bis)} Uhr`}
                      {l.erlaubte_wochentage.length > 0 &&
                        `, nur ${l.erlaubte_wochentage.map((t) => WOCHENTAGE_KURZ[t - 1]).join(", ")}`}
                      {" · "}
                      {FEIERTAGREGELN.find((f) => f.wert === l.feiertag_regel)?.text}
                    </div>
                    {(l.preis_cent !== null || l.preisliste) && (
                      <div className="text-muted-foreground">
                        {formatEuro(l.preis_cent ?? l.preisliste!.preis_cent)}
                        {l.preisliste ? ` · ${l.preisliste.name}` : ""}
                      </div>
                    )}
                  </div>
                  {bearbeitbar && (
                    <div className="flex gap-1">
                      <LeistungDialog
                        titel="Leistung bearbeiten"
                        ausloeserText="Bearbeiten"
                        variante="ghost"
                        vorlagen={vorlagenAuswahl}
                        preise={preisAuswahl}
                        werte={{
                          id: l.id,
                          version_id: gewaehlt.id,
                          vorlage_id: l.vorlage_id,
                          preis_id: l.preis_id,
                          bezeichnung: l.bezeichnung ?? "",
                          frequenz: l.frequenz,
                          intervall: l.intervall,
                          wochentage: l.wochentage.map(String),
                          monatstag: l.monatstag ?? "",
                          startdatum: l.startdatum ?? "",
                          zeitfenster_von: uhr(l.zeitfenster_von),
                          zeitfenster_bis: uhr(l.zeitfenster_bis),
                          erlaubte_wochentage: l.erlaubte_wochentage.map(String),
                          feiertag_regel: l.feiertag_regel,
                          menge_m2: l.menge_m2 === null ? "" : String(l.menge_m2).replace(".", ","),
                          menge_fenster: l.menge_fenster ?? "",
                          preis_cent: centZuEingabe(l.preis_cent),
                        }}
                      />
                      <LeistungEntfernen id={l.id} versionId={gewaehlt.id} />
                    </div>
                  )}
                </li>
              ))}
          </ul>
        )}
        {bearbeitbar && (
          <div>
            <LeistungDialog
              titel="Leistung hinzufügen"
              ausloeserText="Leistung hinzufügen"
              vorlagen={vorlagenAuswahl}
              preise={preisAuswahl}
              werte={{
                version_id: gewaehlt.id,
                vorlage_id: "",
                preis_id: null,
                bezeichnung: "",
                frequenz: "woechentlich",
                intervall: 1,
                wochentage: [String(wochentag(gewaehlt.gueltig_ab))],
                monatstag: "",
                startdatum: "",
                zeitfenster_von: "",
                zeitfenster_bis: "",
                erlaubte_wochentage: ["1", "2", "3", "4", "5"],
                feiertag_regel: "auslassen",
                menge_m2: "",
                menge_fenster: "",
                preis_cent: "",
              }}
            />
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">
          {entwurf
            ? "Vorschau: Einsätze nach Aktivierung"
            : `Einsätze der nächsten ${HORIZONT_WOCHEN} Wochen`}
        </h2>
        {einsaetze.length === 0 ? (
          <p className="text-muted-foreground text-sm">Keine Einsätze im Zeitraum.</p>
        ) : (
          <ul className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {einsaetze.map((e, i) => (
              <li key={i} className="flex gap-2">
                <span className="w-24 shrink-0 tabular-nums">
                  {WOCHENTAGE_KURZ[wochentag(e.datum) - 1]} {formatDatum(e.datum).slice(0, 6)}
                </span>
                <span className="truncate">
                  {e.vorlage}
                  {e.von && (
                    <span className="text-muted-foreground">
                      {" "}
                      {e.von}–{e.bis}
                    </span>
                  )}
                  {e.info && (
                    <Badge variant="outline" className="ml-1">
                      {e.info}
                    </Badge>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">Vertragsdaten</h2>
        <StammFormular
          id={v.id}
          entwurf={entwurf}
          werte={{
            titel: v.titel,
            beginn: v.beginn,
            laufzeit_monate: v.laufzeit_monate,
            verlaengerung_monate: v.verlaengerung_monate,
            kuendigungsfrist_monate: v.kuendigungsfrist_monate,
            frist_zum: v.frist_zum as "laufzeitende" | "monatsende",
            notiz: v.notiz ?? "",
          }}
        />
      </section>
    </div>
  );
}
