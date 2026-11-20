import type { Metadata } from "next";
import Link from "next/link";
import { Seitenkopf } from "@/components/seitenkopf";
import { Badge } from "@/components/ui/badge";
import { formatDatum, heuteIso, plusTage } from "@/domain/datum";
import { formatEuro } from "@/domain/geld";
import { bueroKontext } from "@/lib/auth";
import { mitgliedName } from "@/lib/touren";
import { MangelStatus } from "@/components/mangel-status";
import {
  BestaetigungKnopf,
  ErledigtKnopf,
  PositionPruefen,
  UebernommenKnopf,
} from "./rueckmeldung-teile";

export const metadata: Metadata = { title: "Rückmeldungen" };

export default async function RueckmeldungenSeite() {
  const k = await bueroKontext();
  const seit = `${plusTage(heuteIso(), -30)}T00:00:00Z`;
  const [positionen, meldungen, verlauf, preise, mitglieder] = await Promise.all([
    k.supabase
      .from("einsatz_position")
      .select(
        `id, bezeichnung, menge, preis_cent, status, dauer, zustimmung, unterschrift_name, erstellt_am,
         erstellt_von, vertrag_uebernommen_am, bestaetigung_gesendet_am,
         einsatz(id, datum, vertrag_id, objekt(id, name))`,
      )
      .eq("betrieb_id", k.betriebId)
      .or(
        "status.eq.vorgeschlagen,and(dauer.eq.dauerhaft,status.eq.bestaetigt,vertrag_uebernommen_am.is.null),and(zustimmung.eq.muendlich,status.eq.bestaetigt,bestaetigung_gesendet_am.is.null)",
      )
      .order("erstellt_am"),
    k.supabase
      .from("einsatz_meldung")
      .select(
        "id, art, text, status, notiz_buero, erstellt_am, artikel(name), objekt(id, name), einsatz_foto(pfad)",
      )
      .eq("betrieb_id", k.betriebId)
      .is("erledigt_am", null)
      .order("erstellt_am", { ascending: false }),
    k.supabase
      .from("stammdaten_verlauf")
      .select("id, feld, alt, neu, geaendert_am, geaendert_von, objekt(id, name)")
      .eq("betrieb_id", k.betriebId)
      .gte("geaendert_am", seit)
      .order("geaendert_am", { ascending: false })
      .limit(100),
    k.supabase
      .from("preisliste")
      .select("id, name, preis_cent")
      .eq("betrieb_id", k.betriebId)
      .eq("aktiv", true)
      .order("name"),
    k.supabase.from("mitglied").select("user_id, anzeigename").eq("betrieb_id", k.betriebId),
  ]);
  const wer = (userId: string | null) =>
    mitgliedName(mitglieder.data?.find((m) => m.user_id === userId) ?? { anzeigename: null });

  const pruefen = (positionen.data ?? []).filter((p) => p.status === "vorgeschlagen");
  const uebernehmen = (positionen.data ?? []).filter(
    (p) => p.status === "bestaetigt" && p.dauer === "dauerhaft" && !p.vertrag_uebernommen_am,
  );
  const bestaetigen = (positionen.data ?? []).filter(
    (p) => p.status === "bestaetigt" && p.zustimmung === "muendlich" && !p.bestaetigung_gesendet_am,
  );
  const pfade = (meldungen.data ?? []).flatMap((m) => m.einsatz_foto.map((f) => f.pfad));
  const { data: signiert } = pfade.length
    ? await k.supabase.storage.from("einsatzfotos").createSignedUrls(pfade, 3600)
    : { data: [] };
  const fotoUrl = new Map((signiert ?? []).map((s) => [s.path, s.signedUrl]));

  return (
    <div className="flex max-w-4xl flex-col gap-8">
      <Seitenkopf
        titel="Rückmeldungen"
        beschreibung="Was die Mitarbeiter vor Ort gemeldet oder vereinbart haben"
      />

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">
          Leistungen prüfen <Badge variant="secondary">{pruefen.length}</Badge>
        </h2>
        <p className="text-muted-foreground text-sm">
          Freie Positionen haben noch keinen Preis. Erst nach der Prüfung kommen sie auf die
          Rechnung.
        </p>
        {pruefen.length === 0 ? (
          <Leer>Nichts zu prüfen.</Leer>
        ) : (
          <ul className="flex flex-col gap-3">
            {pruefen.map((p) => (
              <li key={p.id} className="rounded-lg border p-4" data-position={p.id}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium">
                    {Number(p.menge).toLocaleString("de-DE")} × {p.bezeichnung}
                  </span>
                  <span className="text-muted-foreground text-sm">
                    {wer(p.erstellt_von)} · {formatDatum(p.einsatz?.datum)} ·{" "}
                    <Link href={`/objekte/${p.einsatz?.objekt?.id}`} className="hover:underline">
                      {p.einsatz?.objekt?.name}
                    </Link>
                  </span>
                </div>
                <div className="text-muted-foreground mb-3 text-sm">
                  {p.dauer === "dauerhaft" ? "dauerhaft gewünscht" : "nur heute"} ·{" "}
                  {p.zustimmung === "unterschrift"
                    ? `unterschrieben von ${p.unterschrift_name}`
                    : "mündlich vereinbart"}
                </div>
                <PositionPruefen
                  id={p.id}
                  preise={(preise.data ?? []).map((x) => ({
                    wert: x.id,
                    text: `${x.name} (${formatEuro(x.preis_cent)})`,
                  }))}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {bestaetigen.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-medium">
            Mündlich vereinbart – Bestätigung an den Kunden offen{" "}
            <Badge variant="secondary">{bestaetigen.length}</Badge>
          </h2>
          <p className="text-muted-foreground text-sm">
            Die Bestätigung geht automatisch raus, sobald der Preis feststeht. Steht sie hier noch,
            fehlt beim Kunden die E-Mail-Adresse oder der Mail-Versand ist nicht eingerichtet.
          </p>
          <ul className="divide-y rounded-lg border">
            {bestaetigen.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
                <span className="font-medium">
                  {Number(p.menge).toLocaleString("de-DE")} × {p.bezeichnung}
                </span>
                <span className="text-muted-foreground flex-1">
                  {p.einsatz?.objekt?.name} · {formatDatum(p.einsatz?.datum)}
                  {p.preis_cent !== null && ` · ${formatEuro(p.preis_cent)}`}
                </span>
                <BestaetigungKnopf id={p.id} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {uebernehmen.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-medium">
            Dauerhaft vereinbart – in den Vertrag übernehmen{" "}
            <Badge variant="secondary">{uebernehmen.length}</Badge>
          </h2>
          <p className="text-muted-foreground text-sm">
            Heute ist die Leistung schon berechnet. Für künftige Einsätze im Vertrag eine neue
            Version ab heute anlegen und die Leistung ergänzen, dann hier abhaken.
          </p>
          <ul className="divide-y rounded-lg border">
            {uebernehmen.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
                <span className="font-medium">
                  {Number(p.menge).toLocaleString("de-DE")} × {p.bezeichnung}
                </span>
                <span className="text-muted-foreground flex-1">
                  {p.einsatz?.objekt?.name} · {formatDatum(p.einsatz?.datum)}
                  {p.preis_cent !== null && ` · ${formatEuro(p.preis_cent)}`}
                </span>
                {p.einsatz?.vertrag_id && (
                  <Link href={`/vertraege/${p.einsatz.vertrag_id}`} className="underline">
                    Vertrag öffnen
                  </Link>
                )}
                <UebernommenKnopf id={p.id} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">
          Mängel und Material <Badge variant="secondary">{meldungen.data?.length ?? 0}</Badge>
        </h2>
        {!meldungen.data?.length ? (
          <Leer>Keine offenen Meldungen.</Leer>
        ) : (
          <ul className="divide-y rounded-lg border">
            {meldungen.data.map((m) => (
              <li key={m.id} className="flex flex-col gap-2 px-3 py-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={m.art === "mangel" ? "destructive" : "outline"}>
                    {m.art === "mangel" ? "Mangel" : "Material leer"}
                  </Badge>
                  <Link href={`/objekte/${m.objekt?.id}`} className="font-medium hover:underline">
                    {m.objekt?.name}
                  </Link>
                  <span className="text-muted-foreground flex-1">
                    {new Date(m.erstellt_am).toLocaleString("de-DE", {
                      timeZone: "Europe/Berlin",
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </span>
                  {m.art === "material_leer" && <ErledigtKnopf id={m.id} />}
                </div>
                <div>{m.art === "mangel" ? m.text : m.artikel?.name}</div>
                {m.art === "mangel" && (
                  <MangelStatus id={m.id} status={m.status} notiz={m.notiz_buero} />
                )}
                {m.einsatz_foto.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {m.einsatz_foto.map((f) =>
                      fotoUrl.get(f.pfad) ? (
                        <a
                          key={f.pfad}
                          href={fotoUrl.get(f.pfad)!}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element -- signierte Storage-URL */}
                          <img
                            src={fotoUrl.get(f.pfad)!}
                            alt="Foto zur Meldung"
                            className="size-20 rounded-md border object-cover"
                          />
                        </a>
                      ) : null,
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">Stammdaten-Änderungen aus der App (30 Tage)</h2>
        {!verlauf.data?.length ? (
          <Leer>Keine Änderungen.</Leer>
        ) : (
          <ul className="divide-y rounded-lg border text-sm">
            {verlauf.data.map((v) => (
              <li key={v.id} className="flex flex-wrap gap-x-3 px-3 py-2">
                <span className="text-muted-foreground tabular-nums">
                  {new Date(v.geaendert_am).toLocaleString("de-DE", {
                    timeZone: "Europe/Berlin",
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </span>
                <Link href={`/objekte/${v.objekt?.id}`} className="font-medium hover:underline">
                  {v.objekt?.name}
                </Link>
                <span>
                  {v.feld.startsWith("fenster_anzahl") ? "Fensteranzahl" : "Zugangshinweise"}:{" "}
                  <span className="text-muted-foreground line-through">{v.alt ?? "–"}</span> →{" "}
                  {v.neu ?? "–"}
                </span>
                <span className="text-muted-foreground">({wer(v.geaendert_von)})</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Leer({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
      {children}
    </div>
  );
}
