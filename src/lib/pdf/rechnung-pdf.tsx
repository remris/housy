import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { formatDatum } from "@/domain/datum";
import type { RechnungDokument } from "@/domain/erechnung";
import { formatEuro } from "@/domain/geld";
import { EINHEIT_TEXT } from "@/domain/rechnung";
import type { PdfBild } from "./nachweis-pdf";
import { SCHRIFT, schriftRegistrieren } from "./schrift";

export type RechnungPdfDaten = {
  doc: RechnungDokument;
  logo: PdfBild | null;
  entwurf: boolean;
  fusstext: string | null;
  bank: string | null;
};

const s = StyleSheet.create({
  seite: {
    paddingTop: 40,
    paddingHorizontal: 50,
    paddingBottom: 80,
    fontSize: 9.5,
    fontFamily: SCHRIFT,
    lineHeight: 1.35,
    color: "#1a1a1a",
  },
  kopf: { flexDirection: "row", justifyContent: "space-between", marginBottom: 28, minHeight: 50 },
  logo: { maxWidth: 150, maxHeight: 50, objectFit: "contain" },
  absenderzeile: { fontSize: 7, color: "#666", marginBottom: 4 },
  anschrift: { width: 240, minHeight: 90 },
  info: { width: 200 },
  infoZeile: { flexDirection: "row", justifyContent: "space-between" },
  infoLabel: { color: "#666" },
  titel: { fontSize: 15, fontWeight: "bold", marginTop: 16, marginBottom: 10, lineHeight: 1.25 },
  tabKopf: {
    flexDirection: "row",
    borderBottom: "0.75pt solid #333",
    paddingBottom: 3,
    fontWeight: "bold",
    fontSize: 8.5,
  },
  zeile: { flexDirection: "row", borderBottom: "0.5pt solid #ddd", paddingVertical: 4 },
  klein: { fontSize: 8, color: "#555" },
  summen: { marginTop: 8, marginLeft: "auto", width: 230 },
  summeZeile: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 1.5 },
  gesamt: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTop: "0.75pt solid #333",
    marginTop: 3,
    paddingTop: 3,
    fontWeight: "bold",
    fontSize: 11,
  },
  absatz: { marginTop: 14 },
  fuss: {
    position: "absolute",
    bottom: 26,
    left: 50,
    right: 50,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    borderTop: "0.5pt solid #bbb",
    paddingTop: 5,
    fontSize: 7,
    color: "#666",
  },
  seitenzahl: { position: "absolute", bottom: 14, right: 50, fontSize: 7, color: "#888" },
  entwurf: {
    position: "absolute",
    top: 330,
    left: 90,
    fontSize: 90,
    color: "#e5e5e5",
    transform: "rotate(-30deg)",
    fontWeight: "bold",
  },
});

const B = { pos: 24, menge: 50, einheit: 46, preis: 66, gesamt: 70 };
const zahl = (m: number) => m.toLocaleString("de-DE", { maximumFractionDigits: 4 });
const adresse = (p: { strasse: string | null; plz: string | null; ort: string | null }) => [
  p.strasse,
  [p.plz, p.ort].filter(Boolean).join(" "),
];

export function RechnungPdf({ d }: { d: RechnungPdfDaten }) {
  const { doc } = d;
  const v = doc.verkaeufer;
  const k = doc.kaeufer;
  const storno = doc.art === "storno";
  const titel = storno ? `Stornorechnung ${doc.nummer}` : `Rechnung ${doc.nummer}`;
  return (
    <Document title={titel} author={v.name} language="de-DE">
      <Page size="A4" style={s.seite}>
        {d.entwurf && (
          <Text style={s.entwurf} fixed>
            ENTWURF
          </Text>
        )}
        <View style={s.kopf}>
          <View />
          {d.logo ? (
            // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image hat kein alt
            <Image src={d.logo} style={s.logo} />
          ) : (
            <Text style={{ fontWeight: "bold", fontSize: 12 }}>{v.name}</Text>
          )}
        </View>

        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <View style={s.anschrift}>
            <Text style={s.absenderzeile}>
              {[v.name, ...adresse(v)].filter(Boolean).join(" · ")}
            </Text>
            <Text>{k.name}</Text>
            {adresse(k)
              .filter(Boolean)
              .map((z, i) => (
                <Text key={i}>{z}</Text>
              ))}
          </View>
          <View style={s.info}>
            {[
              [
                storno ? "Storno-Nr." : "Rechnungs-Nr.",
                d.entwurf ? "(bei Festschreibung)" : doc.nummer,
              ],
              ["Datum", formatDatum(doc.datum)],
              ["Kunden-Nr.", String(k.kundennummer)],
              ...(k.leitwegId ? [["Leitweg-ID", k.leitwegId]] : []),
              [
                "Leistungszeitraum",
                doc.leistungVon === doc.leistungBis
                  ? formatDatum(doc.leistungVon)
                  : `${formatDatum(doc.leistungVon)} – ${formatDatum(doc.leistungBis)}`,
              ],
              ...(storno ? [] : [["Fällig am", formatDatum(doc.faelligAm)]]),
            ].map(([label, wert]) => (
              <View key={label} style={s.infoZeile}>
                <Text style={s.infoLabel}>{label}</Text>
                <Text>{wert}</Text>
              </View>
            ))}
          </View>
        </View>

        <Text style={s.titel}>{titel}</Text>
        {storno && doc.bezug && (
          <Text style={{ marginBottom: 8 }}>
            Hiermit stornieren wir die Rechnung {doc.bezug.nummer} vom{" "}
            {formatDatum(doc.bezug.datum)} in voller Höhe.
          </Text>
        )}

        <View style={s.tabKopf} fixed>
          <Text style={{ width: B.pos }}>Pos.</Text>
          <Text style={{ flex: 1 }}>Leistung</Text>
          <Text style={{ width: B.menge, textAlign: "right" }}>Menge</Text>
          <Text style={{ width: B.einheit, paddingLeft: 4 }}>Einheit</Text>
          <Text style={{ width: B.preis, textAlign: "right" }}>Einzelpreis</Text>
          <Text style={{ width: B.gesamt, textAlign: "right" }}>Gesamt</Text>
        </View>
        {doc.positionen.map((p, i) => (
          <View key={i} style={s.zeile} wrap={false}>
            <Text style={{ width: B.pos }}>{i + 1}</Text>
            <View style={{ flex: 1, paddingRight: 6 }}>
              <Text>{p.bezeichnung}</Text>
              {p.beschreibung && <Text style={s.klein}>{p.beschreibung}</Text>}
            </View>
            <Text style={{ width: B.menge, textAlign: "right" }}>{zahl(p.menge)}</Text>
            <Text style={{ width: B.einheit, paddingLeft: 4 }}>{EINHEIT_TEXT[p.einheit]}</Text>
            <Text style={{ width: B.preis, textAlign: "right" }}>
              {formatEuro(p.einzelpreisCent)}
            </Text>
            <Text style={{ width: B.gesamt, textAlign: "right" }}>{formatEuro(p.nettoCent)}</Text>
          </View>
        ))}

        <View style={s.summen} wrap={false}>
          <View style={s.summeZeile}>
            <Text>{doc.kleinunternehmer ? "Summe" : "Summe netto"}</Text>
            <Text>{formatEuro(doc.summen.nettoCent)}</Text>
          </View>
          {!doc.kleinunternehmer &&
            doc.summen.gruppen.map((g) => (
              <View key={g.satz} style={s.summeZeile}>
                <Text>
                  zzgl. {g.satz} % USt. auf {formatEuro(g.nettoCent)}
                </Text>
                <Text>{formatEuro(g.steuerCent)}</Text>
              </View>
            ))}
          <View style={s.gesamt}>
            <Text>{storno ? "Gutschrift" : "Rechnungsbetrag"}</Text>
            <Text>{formatEuro(doc.summen.bruttoCent)}</Text>
          </View>
        </View>

        <View style={s.absatz} wrap={false}>
          {doc.hinweise.map((h) => (
            <Text key={h}>{h}</Text>
          ))}
          {!storno && (
            <Text style={{ marginTop: 6 }}>
              Bitte überweisen Sie {formatEuro(doc.summen.bruttoCent)} bis zum{" "}
              {formatDatum(doc.faelligAm)}
              {v.iban ? ` auf das Konto IBAN ${v.iban}${v.bic ? ` (BIC ${v.bic})` : ""}` : ""} unter
              Angabe der Rechnungsnummer {d.entwurf ? "" : doc.nummer}.
            </Text>
          )}
          {storno && (
            <Text style={{ marginTop: 6 }}>Ein bereits gezahlter Betrag wird erstattet.</Text>
          )}
          {d.fusstext && <Text style={{ marginTop: 6 }}>{d.fusstext}</Text>}
        </View>

        <View style={s.fuss} fixed>
          <View>
            <Text>{v.name}</Text>
            {adresse(v)
              .filter(Boolean)
              .map((z, i) => (
                <Text key={i}>{z}</Text>
              ))}
          </View>
          <View>
            {v.telefon && <Text>Tel. {v.telefon}</Text>}
            {v.email && <Text>{v.email}</Text>}
          </View>
          <View>
            {v.ustId && <Text>USt-IdNr. {v.ustId}</Text>}
            {v.steuernummer && <Text>St.-Nr. {v.steuernummer}</Text>}
          </View>
          <View>
            {d.bank && <Text>{d.bank}</Text>}
            {v.iban && <Text>IBAN {v.iban}</Text>}
            {v.bic && <Text>BIC {v.bic}</Text>}
          </View>
        </View>
        <Text
          style={s.seitenzahl}
          fixed
          render={({ pageNumber, totalPages }) => `Seite ${pageNumber} von ${totalPages}`}
        />
      </Page>
    </Document>
  );
}

export async function rechnungPdfErzeugen(d: RechnungPdfDaten): Promise<Buffer> {
  schriftRegistrieren();
  return renderToBuffer(<RechnungPdf d={d} />);
}
