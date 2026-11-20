import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { type Arbeitszeitliste, ZEITHINWEIS_TEXT, stundenMinuten } from "@/domain/arbeitszeitliste";
import { WOCHENTAGE_KURZ, formatDatum, wochentag } from "@/domain/datum";
import { monatsname } from "@/domain/nachweis";
import { uhrzeitBerlin } from "@/domain/zeiterfassung";
import { SCHRIFT, schriftRegistrieren } from "./schrift";

export type ArbeitszeitDokument = {
  betrieb: string;
  monat: string;
  mitarbeiter: { name: string; liste: Arbeitszeitliste }[];
  erstelltAm: string;
};

const s = StyleSheet.create({
  seite: {
    padding: 40,
    paddingBottom: 56,
    fontSize: 9,
    fontFamily: SCHRIFT,
    lineHeight: 1.35,
    color: "#1a1a1a",
  },
  titel: { fontSize: 14, fontWeight: "bold", lineHeight: 1.25 },
  unter: { color: "#555", marginBottom: 12 },
  kopf: {
    flexDirection: "row",
    borderBottom: "0.75pt solid #333",
    paddingBottom: 2,
    fontWeight: "bold",
  },
  zeile: { flexDirection: "row", borderBottom: "0.5pt solid #ddd", paddingVertical: 2 },
  summe: { flexDirection: "row", paddingTop: 4, fontWeight: "bold" },
  unterschriften: { flexDirection: "row", gap: 32, marginTop: 40 },
  linie: { flex: 1, borderTop: "0.5pt solid #333", paddingTop: 3, fontSize: 8, color: "#555" },
  fuss: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    fontSize: 7,
    color: "#888",
    textAlign: "center",
  },
});

const B = { datum: 64, tag: 24, beginn: 40, ende: 40, pause: 44, dauer: 52 };

function Liste({ name, liste }: { name: string; liste: Arbeitszeitliste }) {
  return (
    <>
      <Text style={s.titel}>Arbeitszeitnachweis {monatsname(liste.monat)}</Text>
      <Text style={s.unter}>
        {name} · {liste.arbeitstage} Arbeitstage · {stundenMinuten(liste.summeMinuten)} Std.
      </Text>
      <View style={s.kopf} fixed>
        <Text style={{ width: B.datum }}>Datum</Text>
        <Text style={{ width: B.tag }}>Tag</Text>
        <Text style={{ width: B.beginn }}>Beginn</Text>
        <Text style={{ width: B.ende }}>Ende</Text>
        <Text style={{ width: B.pause, textAlign: "right" }}>Pause</Text>
        <Text style={{ width: B.dauer, textAlign: "right" }}>Dauer</Text>
        <Text style={{ flex: 1, paddingLeft: 10 }}>Hinweise</Text>
      </View>
      {liste.tage.length === 0 && <Text style={{ paddingTop: 6 }}>Keine Buchungen.</Text>}
      {liste.tage.map((t) => (
        <View key={t.datum} style={s.zeile} wrap={false}>
          <Text style={{ width: B.datum }}>{formatDatum(t.datum)}</Text>
          <Text style={{ width: B.tag }}>{WOCHENTAGE_KURZ[wochentag(t.datum) - 1]}</Text>
          <Text style={{ width: B.beginn }}>{t.beginn ? uhrzeitBerlin(t.beginn) : "–"}</Text>
          <Text style={{ width: B.ende }}>{t.ende ? uhrzeitBerlin(t.ende) : "–"}</Text>
          <Text style={{ width: B.pause, textAlign: "right" }}>{t.pauseMinuten} min</Text>
          <Text style={{ width: B.dauer, textAlign: "right" }}>
            {stundenMinuten(t.arbeitMinuten)}
          </Text>
          <Text style={{ flex: 1, paddingLeft: 10, color: "#555" }}>
            {[...t.hinweise.map((h) => ZEITHINWEIS_TEXT[h]), t.korrigiert ? "korrigiert" : ""]
              .filter(Boolean)
              .join(", ")}
          </Text>
        </View>
      ))}
      <View style={s.summe}>
        <Text style={{ width: B.datum + B.tag + B.beginn + B.ende + B.pause }}>Summe</Text>
        <Text style={{ width: B.dauer, textAlign: "right" }}>
          {stundenMinuten(liste.summeMinuten)}
        </Text>
      </View>
      <View style={s.unterschriften} wrap={false}>
        <Text style={s.linie}>Datum, Unterschrift Arbeitnehmer</Text>
        <Text style={s.linie}>Datum, Unterschrift Arbeitgeber</Text>
      </View>
    </>
  );
}

export function ArbeitszeitPdf({ d }: { d: ArbeitszeitDokument }) {
  return (
    <Document title={`Arbeitszeiten ${monatsname(d.monat)}`} author={d.betrieb}>
      {d.mitarbeiter.map((m) => (
        <Page key={m.name} size="A4" style={s.seite}>
          <Liste name={m.name} liste={m.liste} />
          <Text
            style={s.fuss}
            fixed
            render={({ pageNumber, totalPages }) =>
              `${d.betrieb} · Aufzeichnung nach § 17 MiLoG aus elektronischer Zeiterfassung · erstellt ${formatDatum(d.erstelltAm.slice(0, 10))} · Seite ${pageNumber} von ${totalPages}`
            }
          />
        </Page>
      ))}
    </Document>
  );
}

export async function arbeitszeitPdfErzeugen(d: ArbeitszeitDokument): Promise<Buffer> {
  schriftRegistrieren();
  return renderToBuffer(<ArbeitszeitPdf d={d} />);
}
