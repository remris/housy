import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { formatDatum } from "@/domain/datum";
import { formatEuro } from "@/domain/geld";
import { beschreibeWiederholung } from "@/domain/serien";
import { abrechnungsartText } from "@/lib/schemas/vertrag";
import { preiseinheitText } from "@/lib/schemas/vorlage";
import { SCHRIFT, schriftRegistrieren } from "./schrift";

export type VertragDokument = {
  vertrag: {
    vertragsnummer: number;
    titel: string;
    status: string;
    beginn: string;
    laufzeit_monate: number;
    verlaengerung_monate: number;
    kuendigungsfrist_monate: number;
    frist_zum: string;
    gekuendigt_am: string | null;
    endet_am: string | null;
    notiz: string | null;
    unterschrieben_am: string | null;
    unterschrift_name: string | null;
  };
  unterschrift_bild: string | null;
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
    vertragsbedingungen: string | null;
  };
  kunde: {
    name: string;
    zusatz: string | null;
    strasse: string | null;
    plz: string | null;
    ort: string | null;
    kundennummer: number;
  };
  objekt: { name: string; strasse: string | null; plz: string | null; ort: string | null };
  versionen: {
    version: number;
    gueltig_ab: string;
    abrechnungsart: string;
    pauschale_cent: number | null;
    leistungen: {
      bezeichnung: string;
      vorlage: string;
      frequenz: "taeglich" | "woechentlich" | "monatlich" | "einmalig";
      intervall: number;
      wochentage: number[];
      monatstag: number | null;
      zeitfenster_von: string | null;
      zeitfenster_bis: string | null;
      feiertag_regel: string;
      preis_cent: number | null;
      preis_einheit: string | null;
      taetigkeiten: string[];
    }[];
  }[];
};

const s = StyleSheet.create({
  seite: { padding: 48, fontSize: 10, fontFamily: SCHRIFT, lineHeight: 1.4, color: "#1a1a1a" },
  kopf: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24 },
  logo: { maxWidth: 140, maxHeight: 50, objectFit: "contain" },
  absender: { fontSize: 8, color: "#555", textAlign: "right" },
  titel: { fontSize: 16, fontWeight: "bold", lineHeight: 1.25, marginBottom: 4 },
  untertitel: { color: "#555", marginBottom: 16 },
  parteien: { flexDirection: "row", gap: 24, marginBottom: 16 },
  partei: { flex: 1 },
  label: { fontSize: 8, color: "#666", textTransform: "uppercase", marginBottom: 2 },
  h2: { fontSize: 11, fontWeight: "bold", marginTop: 14, marginBottom: 6 },
  leistung: { borderBottom: "0.5pt solid #ccc", paddingVertical: 6 },
  zeile: { flexDirection: "row", justifyContent: "space-between" },
  fett: { fontWeight: "bold" },
  klein: { fontSize: 8, color: "#555" },
  unterschriften: { flexDirection: "row", gap: 32, marginTop: 36 },
  unterschriftFeld: {
    flex: 1,
    borderTop: "0.5pt solid #333",
    paddingTop: 4,
    fontSize: 8,
    color: "#555",
  },
  unterschriftBild: { height: 50, objectFit: "contain", marginBottom: 2 },
  fuss: {
    position: "absolute",
    bottom: 24,
    left: 48,
    right: 48,
    fontSize: 7,
    color: "#888",
    textAlign: "center",
  },
});

const adresse = (x: { strasse: string | null; plz: string | null; ort: string | null }) =>
  [x.strasse, [x.plz, x.ort].filter(Boolean).join(" ")].filter(Boolean).join(", ");

const FEIERTAG: Record<string, string> = {
  auslassen: "nicht an Feiertagen",
  naechster_werktag: "an Feiertagen am nächsten Werktag",
  ignorieren: "auch an Feiertagen",
};

function laufzeitText(v: VertragDokument["vertrag"]) {
  if (v.laufzeit_monate === 0) {
    return `unbefristet ab ${formatDatum(v.beginn)}, kündbar mit einer Frist von ${v.kuendigungsfrist_monate} Monaten zum Monatsende`;
  }
  const verl = v.verlaengerung_monate
    ? `; verlängert sich jeweils um ${v.verlaengerung_monate} Monate, wenn nicht gekündigt wird`
    : "; endet ohne Verlängerung";
  const zum = v.frist_zum === "monatsende" ? "zum Monatsende" : "zum Ende der Laufzeit";
  return `${v.laufzeit_monate} Monate ab ${formatDatum(v.beginn)}${verl}. Kündigungsfrist ${v.kuendigungsfrist_monate} Monate ${zum}.`;
}

export function VertragPdf({ d, logoUrl }: { d: VertragDokument; logoUrl: string | null }) {
  const aktuelle = d.versionen.at(-1);
  return (
    <Document
      title={`Vertrag ${d.vertrag.vertragsnummer} – ${d.vertrag.titel}`}
      author={d.betrieb.name}
    >
      <Page size="A4" style={s.seite}>
        <View style={s.kopf}>
          {logoUrl ? (
            // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image hat kein alt
            <Image src={logoUrl} style={s.logo} />
          ) : (
            <Text style={s.fett}>{d.betrieb.name}</Text>
          )}
          <View>
            <Text style={s.absender}>{d.betrieb.name}</Text>
            <Text style={s.absender}>{adresse(d.betrieb)}</Text>
            <Text style={s.absender}>
              {[d.betrieb.telefon, d.betrieb.email].filter(Boolean).join(" · ")}
            </Text>
          </View>
        </View>

        <Text style={s.titel}>Dienstleistungsvertrag {d.vertrag.titel}</Text>
        <Text style={s.untertitel}>
          Vertragsnummer {d.vertrag.vertragsnummer}
          {aktuelle && aktuelle.version > 1
            ? ` · Version ${aktuelle.version} gültig ab ${formatDatum(aktuelle.gueltig_ab)}`
            : ""}
        </Text>

        <View style={s.parteien}>
          <View style={s.partei}>
            <Text style={s.label}>Auftragnehmer</Text>
            <Text style={s.fett}>{d.betrieb.name}</Text>
            <Text>{adresse(d.betrieb)}</Text>
          </View>
          <View style={s.partei}>
            <Text style={s.label}>Auftraggeber (Kd.-Nr. {d.kunde.kundennummer})</Text>
            <Text style={s.fett}>{d.kunde.name}</Text>
            {d.kunde.zusatz && <Text>{d.kunde.zusatz}</Text>}
            <Text>{adresse(d.kunde)}</Text>
          </View>
          <View style={s.partei}>
            <Text style={s.label}>Objekt</Text>
            <Text style={s.fett}>{d.objekt.name}</Text>
            <Text>{adresse(d.objekt)}</Text>
          </View>
        </View>

        {aktuelle && (
          <>
            <Text style={s.h2}>1. Leistungen</Text>
            {aktuelle.leistungen.map((l, i) => (
              <View key={i} style={s.leistung} wrap={false}>
                <View style={s.zeile}>
                  <Text style={s.fett}>{l.bezeichnung}</Text>
                  {l.preis_cent !== null && aktuelle.abrechnungsart !== "pauschale" && (
                    <Text>
                      {formatEuro(l.preis_cent)}{" "}
                      {l.preis_einheit ? preiseinheitText(l.preis_einheit) : ""}
                    </Text>
                  )}
                </View>
                <Text>
                  {beschreibeWiederholung(l)}
                  {l.zeitfenster_von && l.zeitfenster_bis
                    ? `, zwischen ${l.zeitfenster_von.slice(0, 5)} und ${l.zeitfenster_bis.slice(0, 5)} Uhr`
                    : ""}
                  , {FEIERTAG[l.feiertag_regel] ?? ""}
                </Text>
                {l.taetigkeiten.length > 0 && (
                  <Text style={s.klein}>{l.taetigkeiten.join(" · ")}</Text>
                )}
              </View>
            ))}

            <Text style={s.h2}>2. Vergütung</Text>
            <Text>
              {aktuelle.abrechnungsart === "pauschale" && aktuelle.pauschale_cent !== null
                ? `Monatspauschale ${formatEuro(aktuelle.pauschale_cent)} zzgl. gesetzlicher Umsatzsteuer. Sonderleistungen werden nach Preisliste gesondert berechnet.`
                : `${abrechnungsartText(aktuelle.abrechnungsart)} nach den oben genannten Preisen zzgl. gesetzlicher Umsatzsteuer.`}
            </Text>
          </>
        )}

        <Text style={s.h2}>3. Laufzeit und Kündigung</Text>
        <Text>{laufzeitText(d.vertrag)}</Text>
        {d.vertrag.gekuendigt_am && (
          <Text>
            Gekündigt am {formatDatum(d.vertrag.gekuendigt_am)} zum{" "}
            {formatDatum(d.vertrag.endet_am)}.
          </Text>
        )}

        {d.betrieb.vertragsbedingungen && (
          <>
            <Text style={s.h2}>4. Weitere Bedingungen</Text>
            <Text>{d.betrieb.vertragsbedingungen}</Text>
          </>
        )}
        {d.vertrag.notiz && (
          <>
            <Text style={s.h2}>Vereinbarungen</Text>
            <Text>{d.vertrag.notiz}</Text>
          </>
        )}

        <View style={s.unterschriften} wrap={false}>
          <View style={{ flex: 1 }}>
            <View style={{ height: 52 }} />
            <Text style={s.unterschriftFeld}>Ort, Datum, Auftragnehmer</Text>
          </View>
          <View style={{ flex: 1 }}>
            {d.unterschrift_bild ? (
              // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image hat kein alt
              <Image src={d.unterschrift_bild} style={s.unterschriftBild} />
            ) : (
              <View style={{ height: 52 }} />
            )}
            <Text style={s.unterschriftFeld}>
              {d.vertrag.unterschrieben_am
                ? `${d.vertrag.unterschrift_name}, digital unterschrieben am ${new Date(d.vertrag.unterschrieben_am).toLocaleString("de-DE", { timeZone: "Europe/Berlin" })}`
                : "Ort, Datum, Auftraggeber"}
            </Text>
          </View>
        </View>

        <Text
          style={s.fuss}
          fixed
          render={({ pageNumber, totalPages }) =>
            `${d.betrieb.name}${d.betrieb.steuernummer ? ` · St.-Nr. ${d.betrieb.steuernummer}` : ""}${d.betrieb.ust_id ? ` · USt-IdNr. ${d.betrieb.ust_id}` : ""} · Seite ${pageNumber} von ${totalPages}`
          }
        />
      </Page>
    </Document>
  );
}

export async function vertragPdfErzeugen(d: VertragDokument, logoUrl: string | null) {
  schriftRegistrieren();
  return renderToBuffer(<VertragPdf d={d} logoUrl={logoUrl} />);
}
