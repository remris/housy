import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { FREQUENZ_TEXT, angebotsSumme, einsaetzeProMonat } from "@/domain/angebot";
import { WOCHENTAGE_KURZ, formatDatum } from "@/domain/datum";
import { formatEuro } from "@/domain/geld";
import { EINHEIT_TEXT, type Preiseinheit } from "@/domain/rechnung";
import { abrechnungsartText } from "@/lib/schemas/vertrag";
import { SCHRIFT, schriftRegistrieren } from "./schrift";

/** Daten aus `angebot_info` (öffentlich per Token) */
export type AngebotInfo = {
  abgelaufen: boolean;
  angebot: {
    id: string;
    nummer: number;
    status: "entwurf" | "versendet" | "angenommen" | "abgelehnt";
    titel: string;
    einleitung: string | null;
    beginn: string;
    gueltig_bis: string | null;
    abrechnungsart: "pauschale" | "aufwand" | "einzelauftrag";
    pauschale_cent: number | null;
    laufzeit_monate: number;
    kuendigungsfrist_monate: number;
    empfaenger_name: string;
    empfaenger_firma: string | null;
    strasse: string | null;
    plz: string | null;
    ort: string | null;
    objekt_name: string | null;
    objekt_strasse: string | null;
    objekt_plz: string | null;
    objekt_ort: string | null;
    versendet_am: string | null;
    angenommen_am: string | null;
    angenommen_name: string | null;
    erstellt_am: string;
  };
  betrieb: {
    name: string;
    strasse: string | null;
    plz: string | null;
    ort: string | null;
    telefon: string | null;
    email: string | null;
    website: string | null;
    steuernummer: string | null;
    ust_id: string | null;
    logo_pfad: string | null;
    kleinunternehmer: boolean;
    vertragsbedingungen: string | null;
    datenschutz_url: string | null;
  };
  leistungen: {
    bezeichnung: string;
    beschreibung: string | null;
    frequenz: "taeglich" | "woechentlich" | "monatlich" | "einmalig";
    intervall: number;
    wochentage: number[];
    monatstag: number | null;
    menge_je_einsatz: number;
    einheit: Preiseinheit;
    preis_cent: number | null;
    ust_satz: number;
    taetigkeiten: string[];
  }[];
};

export function rhythmusText(l: AngebotInfo["leistungen"][number]): string {
  const n = l.intervall > 1 ? ` (alle ${l.intervall})` : "";
  if (l.frequenz === "woechentlich") {
    const tage = l.wochentage.map((t) => WOCHENTAGE_KURZ[t - 1]).join(", ");
    return l.intervall > 1 ? `alle ${l.intervall} Wochen ${tage}` : `wöchentlich ${tage}`;
  }
  return `${FREQUENZ_TEXT[l.frequenz]}${n}`;
}

export function angebotsZahlen(d: AngebotInfo) {
  return angebotsSumme(
    d.leistungen.map((l) => ({
      bezeichnung: l.bezeichnung,
      frequenz: l.frequenz,
      intervall: l.intervall,
      wochentage: l.wochentage,
      mengeJeEinsatz: Number(l.menge_je_einsatz),
      einheit: l.einheit,
      preisCent: l.preis_cent,
    })),
    d.angebot.abrechnungsart,
    d.angebot.pauschale_cent,
  );
}

const s = StyleSheet.create({
  seite: {
    padding: 48,
    paddingBottom: 64,
    fontSize: 9.5,
    fontFamily: SCHRIFT,
    lineHeight: 1.4,
    color: "#1a1a1a",
  },
  kopf: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24 },
  logo: { maxWidth: 150, maxHeight: 50, objectFit: "contain" },
  klein: { fontSize: 8, color: "#555" },
  titel: { fontSize: 15, fontWeight: "bold", lineHeight: 1.25, marginTop: 18, marginBottom: 6 },
  h2: { fontSize: 11, fontWeight: "bold", marginTop: 14, marginBottom: 4 },
  leistung: { borderBottom: "0.5pt solid #ddd", paddingVertical: 6 },
  zeile: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  summe: { marginTop: 10, marginLeft: "auto", width: 260 },
  fuss: {
    position: "absolute",
    bottom: 26,
    left: 48,
    right: 48,
    fontSize: 7,
    color: "#777",
    textAlign: "center",
  },
});

export function AngebotPdf({ d, logoUrl }: { d: AngebotInfo; logoUrl: string | null }) {
  const a = d.angebot;
  const b = d.betrieb;
  const z = angebotsZahlen(d);
  const zzgl = b.kleinunternehmer ? "" : " zzgl. USt.";
  const objekt = [
    a.objekt_name,
    [a.objekt_strasse, [a.objekt_plz, a.objekt_ort].filter(Boolean).join(" ")]
      .filter(Boolean)
      .join(", "),
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <Document title={`Angebot ${a.nummer} – ${a.titel}`} author={b.name}>
      <Page size="A4" style={s.seite}>
        <View style={s.kopf}>
          <View>
            <Text style={s.klein}>
              {[b.name, b.strasse, [b.plz, b.ort].filter(Boolean).join(" ")]
                .filter(Boolean)
                .join(" · ")}
            </Text>
            <Text style={{ marginTop: 6 }}>{a.empfaenger_firma || a.empfaenger_name}</Text>
            {a.empfaenger_firma && <Text>z. Hd. {a.empfaenger_name}</Text>}
            {a.strasse && <Text>{a.strasse}</Text>}
            <Text>{[a.plz, a.ort].filter(Boolean).join(" ")}</Text>
          </View>
          {logoUrl ? (
            // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image hat kein alt
            <Image src={logoUrl} style={s.logo} />
          ) : (
            <Text style={{ fontWeight: "bold", fontSize: 12 }}>{b.name}</Text>
          )}
        </View>
        <Text style={s.klein}>
          Angebot Nr. {a.nummer} · {formatDatum((a.versendet_am ?? a.erstellt_am).slice(0, 10))}
          {a.gueltig_bis ? ` · gültig bis ${formatDatum(a.gueltig_bis)}` : ""}
        </Text>
        <Text style={s.titel}>Angebot: {a.titel}</Text>
        {objekt && <Text>Objekt: {objekt}</Text>}
        {a.einleitung && <Text style={{ marginTop: 8 }}>{a.einleitung}</Text>}

        <Text style={s.h2}>Leistungen</Text>
        {d.leistungen.map((l, i) => {
          const zeile = z.zeilen[i]!;
          return (
            <View key={i} style={s.leistung} wrap={false}>
              <View style={s.zeile}>
                <Text style={{ fontWeight: "bold" }}>{l.bezeichnung}</Text>
                {a.abrechnungsart !== "pauschale" && l.preis_cent !== null && (
                  <Text>
                    {formatEuro(l.preis_cent)} je {EINHEIT_TEXT[l.einheit]}
                    {zzgl}
                  </Text>
                )}
              </View>
              <Text>
                {rhythmusText(l)}
                {a.abrechnungsart !== "pauschale" && l.preis_cent !== null
                  ? ` · ${Number(l.menge_je_einsatz).toLocaleString("de-DE")} ${EINHEIT_TEXT[l.einheit]} je Einsatz = ${formatEuro(zeile.jeEinsatzCent)}${l.frequenz !== "einmalig" ? ` · ca. ${einsaetzeProMonat(l).toLocaleString("de-DE", { maximumFractionDigits: 1 })} Einsätze/Monat` : ""}`
                  : ""}
              </Text>
              {l.beschreibung && <Text>{l.beschreibung}</Text>}
              {l.taetigkeiten.length > 0 && (
                <Text style={s.klein}>{l.taetigkeiten.join(" · ")}</Text>
              )}
            </View>
          );
        })}

        <View style={s.summe} wrap={false}>
          {a.abrechnungsart === "pauschale" ? (
            <View style={s.zeile}>
              <Text style={{ fontWeight: "bold" }}>Monatspauschale</Text>
              <Text style={{ fontWeight: "bold" }}>
                {formatEuro(z.monatNettoCent)}
                {zzgl}
              </Text>
            </View>
          ) : (
            z.monatNettoCent > 0 && (
              <View style={s.zeile}>
                <Text>voraussichtlich je Monat</Text>
                <Text>
                  ca. {formatEuro(z.monatNettoCent)}
                  {zzgl}
                </Text>
              </View>
            )
          )}
          {z.einmaligNettoCent > 0 && (
            <View style={s.zeile}>
              <Text>einmalig</Text>
              <Text>
                {formatEuro(z.einmaligNettoCent)}
                {zzgl}
              </Text>
            </View>
          )}
          <Text style={s.klein}>
            Abrechnung: {abrechnungsartText(a.abrechnungsart)}
            {a.abrechnungsart === "aufwand" ? " nach tatsächlichem Aufwand" : ""}
            {b.kleinunternehmer ? " · Gemäß § 19 UStG wird keine Umsatzsteuer berechnet." : ""}
          </Text>
        </View>

        <Text style={s.h2}>Bedingungen</Text>
        <Text>
          Beginn ab {formatDatum(a.beginn)}.{" "}
          {a.laufzeit_monate > 0
            ? `Laufzeit ${a.laufzeit_monate} Monate, Kündigungsfrist ${a.kuendigungsfrist_monate} Monate.`
            : `Unbefristet, kündbar mit ${a.kuendigungsfrist_monate} Monaten Frist.`}
        </Text>
        {b.vertragsbedingungen && <Text style={{ marginTop: 4 }}>{b.vertragsbedingungen}</Text>}
        {a.angenommen_am && (
          <Text style={{ marginTop: 10, fontWeight: "bold" }}>
            Angenommen von {a.angenommen_name} am{" "}
            {new Date(a.angenommen_am).toLocaleString("de-DE", { timeZone: "Europe/Berlin" })}
          </Text>
        )}
        <Text style={s.fuss} fixed>
          {[
            b.name,
            b.telefon,
            b.email,
            b.ust_id
              ? `USt-IdNr. ${b.ust_id}`
              : b.steuernummer
                ? `St.-Nr. ${b.steuernummer}`
                : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </Text>
      </Page>
    </Document>
  );
}

export async function angebotPdfErzeugen(d: AngebotInfo, logoUrl: string | null) {
  schriftRegistrieren();
  return renderToBuffer(<AngebotPdf d={d} logoUrl={logoUrl} />);
}
