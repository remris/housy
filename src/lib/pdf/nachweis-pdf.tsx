import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { formatDatum } from "@/domain/datum";
import { monatsname } from "@/domain/nachweis";
import { zuDauer } from "@/domain/planung";
import { uhrzeitBerlin } from "@/domain/zeiterfassung";
import { SCHRIFT, schriftRegistrieren } from "./schrift";

/** Bild für react-pdf: Data-URL (Unterschrift) oder Bytes (Foto, Logo). */
export type PdfBild = string | { data: Buffer; format: "jpg" | "png" };

type Adresse = { strasse: string | null; plz: string | null; ort: string | null };

export type NachweisEinsatz = {
  datum: string;
  leistung: string;
  mitarbeiter: string | null;
  von: string | null;
  bis: string | null;
  minuten: number;
  aufgaben: { text: string; erledigt: boolean }[];
  positionen: {
    bezeichnung: string;
    menge: number;
    dauer: "heute" | "dauerhaft";
    status: "vorgeschlagen" | "bestaetigt" | "abgelehnt";
    zustimmung: "unterschrift" | "muendlich";
    unterschriftName: string | null;
  }[];
  maengel: { text: string; status: string }[];
  fotoAnzahl: number;
  fotos: PdfBild[];
  abnahme: { name: string; am: string; bild: PdfBild } | null;
};

export type NachweisDokument = {
  art: "einsatz" | "monat";
  von: string;
  bis: string;
  betrieb: Adresse & {
    name: string;
    telefon: string | null;
    email: string | null;
    steuernummer: string | null;
    ust_id: string | null;
  };
  logo: PdfBild | null;
  kunde: Adresse & { name: string; zusatz: string | null; kundennummer: number };
  objekt: Adresse & { name: string };
  einsaetze: NachweisEinsatz[];
  erstelltAm: string;
};

const s = StyleSheet.create({
  seite: {
    padding: 48,
    paddingBottom: 56,
    fontSize: 10,
    fontFamily: SCHRIFT,
    lineHeight: 1.4,
    color: "#1a1a1a",
  },
  kopf: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
  logo: { maxWidth: 140, maxHeight: 50, objectFit: "contain" },
  absender: { fontSize: 8, color: "#555", textAlign: "right" },
  titel: { fontSize: 16, fontWeight: "bold", lineHeight: 1.25, marginBottom: 2 },
  untertitel: { color: "#555", marginBottom: 14 },
  parteien: { flexDirection: "row", gap: 24, marginBottom: 14 },
  partei: { flex: 1 },
  label: { fontSize: 8, color: "#666", textTransform: "uppercase", marginBottom: 2 },
  h2: { fontSize: 11, fontWeight: "bold", marginTop: 12, marginBottom: 4 },
  fett: { fontWeight: "bold" },
  klein: { fontSize: 8, color: "#555" },
  block: { borderTop: "0.5pt solid #bbb", paddingTop: 8, marginTop: 10 },
  zeile: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  haken: { flexDirection: "row", gap: 6, alignItems: "center", marginBottom: 1 },
  kasten: { width: 8, height: 8, border: "0.75pt solid #333" },
  kastenVoll: { width: 8, height: 8, border: "0.75pt solid #333", backgroundColor: "#333" },
  fotos: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  foto: { width: 160, height: 120, objectFit: "cover" },
  unterschrift: { height: 46, width: 180, objectFit: "contain", objectPosition: "left" },
  tabKopf: {
    flexDirection: "row",
    borderBottom: "0.75pt solid #333",
    paddingBottom: 2,
    fontWeight: "bold",
    fontSize: 8,
  },
  tabZeile: { flexDirection: "row", borderBottom: "0.5pt solid #ddd", paddingVertical: 3 },
  summe: { flexDirection: "row", paddingTop: 4, fontWeight: "bold" },
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

const SPALTEN = { datum: 62, leistung: 150, zeit: 72, dauer: 46, check: 54, fotos: 34 };

const adresse = (x: Adresse) =>
  [x.strasse, [x.plz, x.ort].filter(Boolean).join(" ")].filter(Boolean).join(", ");

const zeitraum = (e: NachweisEinsatz) =>
  e.von ? `${uhrzeitBerlin(e.von)}–${e.bis ? uhrzeitBerlin(e.bis) : "?"}` : "–";

const MANGEL: Record<string, string> = {
  offen: "offen",
  in_bearbeitung: "in Bearbeitung",
  erledigt: "erledigt",
};

function Haken({ an, children }: { an: boolean; children: string }) {
  return (
    <View style={s.haken} wrap={false}>
      <View style={an ? s.kastenVoll : s.kasten} />
      <Text>{children}</Text>
    </View>
  );
}

function positionText(p: NachweisEinsatz["positionen"][number]) {
  const zustimmung =
    p.zustimmung === "unterschrift"
      ? `unterschrieben von ${p.unterschriftName ?? ""}`
      : "mündlich vereinbart";
  const status = p.status === "vorgeschlagen" ? ", Preis folgt" : "";
  return `${p.menge.toLocaleString("de-DE")} × ${p.bezeichnung}${p.dauer === "dauerhaft" ? " (ab sofort dauerhaft)" : ""} – ${zustimmung}${status}`;
}

function EinsatzBlock({ e, mitFotos }: { e: NachweisEinsatz; mitFotos: boolean }) {
  const positionen = e.positionen.filter((p) => p.status !== "abgelehnt");
  return (
    <View style={s.block}>
      <View style={s.zeile} wrap={false}>
        <Text style={s.fett}>
          {formatDatum(e.datum)} · {e.leistung}
        </Text>
        <Text>
          {zeitraum(e)}
          {e.minuten > 0 ? ` (${zuDauer(e.minuten)})` : ""}
        </Text>
      </View>
      {e.mitarbeiter && <Text style={s.klein}>Ausgeführt von {e.mitarbeiter}</Text>}

      {e.aufgaben.length > 0 && (
        <>
          <Text style={s.h2} minPresenceAhead={24}>
            Erledigte Arbeiten
          </Text>
          {e.aufgaben.map((a, i) => (
            <Haken key={i} an={a.erledigt}>
              {a.erledigt ? a.text : `${a.text} (nicht erledigt)`}
            </Haken>
          ))}
        </>
      )}

      {positionen.length > 0 && (
        <>
          <Text style={s.h2} minPresenceAhead={24}>
            Zusatzleistungen
          </Text>
          {positionen.map((p, i) => (
            <Text key={i}>{positionText(p)}</Text>
          ))}
        </>
      )}

      {e.maengel.length > 0 && (
        <>
          <Text style={s.h2} minPresenceAhead={24}>
            Gemeldete Mängel
          </Text>
          {e.maengel.map((m, i) => (
            <Text key={i}>
              {m.text} ({MANGEL[m.status] ?? m.status})
            </Text>
          ))}
        </>
      )}

      {mitFotos && e.fotos.length > 0 && (
        <>
          <Text style={s.h2} minPresenceAhead={24}>
            Fotos{e.fotoAnzahl > e.fotos.length ? ` (${e.fotos.length} von ${e.fotoAnzahl})` : ""}
          </Text>
          <View style={s.fotos}>
            {e.fotos.map((f, i) => (
              // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image hat kein alt
              <Image key={i} src={f} style={s.foto} />
            ))}
          </View>
        </>
      )}

      {e.abnahme && (
        <View wrap={false}>
          <Text style={s.h2} minPresenceAhead={24}>
            Abnahme
          </Text>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image hat kein alt */}
          <Image src={e.abnahme.bild} style={s.unterschrift} />
          <Text style={s.klein}>
            {e.abnahme.name}, unterschrieben am{" "}
            {new Date(e.abnahme.am).toLocaleString("de-DE", {
              timeZone: "Europe/Berlin",
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </Text>
        </View>
      )}
    </View>
  );
}

function Uebersicht({ einsaetze }: { einsaetze: NachweisEinsatz[] }) {
  const summe = einsaetze.reduce((x, e) => x + e.minuten, 0);
  return (
    <View>
      <View style={s.tabKopf} fixed>
        <Text style={{ width: SPALTEN.datum }}>Datum</Text>
        <Text style={{ width: SPALTEN.leistung }}>Leistung</Text>
        <Text style={{ width: SPALTEN.zeit }}>Zeit</Text>
        <Text style={{ width: SPALTEN.dauer, textAlign: "right" }}>Dauer</Text>
        <Text style={{ width: SPALTEN.check, textAlign: "right" }}>Checkliste</Text>
        <Text style={{ width: SPALTEN.fotos, textAlign: "right" }}>Fotos</Text>
      </View>
      {einsaetze.map((e, i) => {
        const erledigt = e.aufgaben.filter((a) => a.erledigt).length;
        return (
          <View key={i} style={s.tabZeile} wrap={false}>
            <Text style={{ width: SPALTEN.datum }}>{formatDatum(e.datum)}</Text>
            <Text style={{ width: SPALTEN.leistung }}>{e.leistung}</Text>
            <Text style={{ width: SPALTEN.zeit }}>{zeitraum(e)}</Text>
            <Text style={{ width: SPALTEN.dauer, textAlign: "right" }}>
              {e.minuten > 0 ? zuDauer(e.minuten) : "–"}
            </Text>
            <Text style={{ width: SPALTEN.check, textAlign: "right" }}>
              {e.aufgaben.length > 0 ? `${erledigt}/${e.aufgaben.length}` : "–"}
            </Text>
            <Text style={{ width: SPALTEN.fotos, textAlign: "right" }}>{e.fotoAnzahl || "–"}</Text>
          </View>
        );
      })}
      <View style={s.summe}>
        <Text style={{ width: SPALTEN.datum + SPALTEN.leistung + SPALTEN.zeit }}>
          {einsaetze.length} {einsaetze.length === 1 ? "Einsatz" : "Einsätze"}
        </Text>
        <Text style={{ width: SPALTEN.dauer, textAlign: "right" }}>{zuDauer(summe)}</Text>
      </View>
    </View>
  );
}

export function NachweisPdf({ d }: { d: NachweisDokument }) {
  const titel =
    d.art === "monat"
      ? `Leistungsnachweis ${monatsname(d.von.slice(0, 7))}`
      : `Leistungsnachweis vom ${formatDatum(d.von)}`;
  return (
    <Document title={`${titel} – ${d.objekt.name}`} author={d.betrieb.name}>
      <Page size="A4" style={s.seite}>
        <View style={s.kopf}>
          {d.logo ? (
            // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image hat kein alt
            <Image src={d.logo} style={s.logo} />
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

        <Text style={s.titel}>{titel}</Text>
        <Text style={s.untertitel}>
          {d.art === "monat"
            ? `Zeitraum ${formatDatum(d.von)} bis ${formatDatum(d.bis)}`
            : `Erstellt am ${formatDatum(d.erstelltAm.slice(0, 10))}`}
        </Text>

        <View style={s.parteien}>
          <View style={s.partei}>
            <Text style={s.label}>Kunde (Kd.-Nr. {d.kunde.kundennummer})</Text>
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

        {d.einsaetze.length === 0 && <Text>Keine erledigten Einsätze in diesem Zeitraum.</Text>}

        {d.art === "monat" && d.einsaetze.length > 0 && (
          <>
            <Text style={s.h2} minPresenceAhead={24}>
              Übersicht
            </Text>
            <Uebersicht einsaetze={d.einsaetze} />
            <Text style={[s.h2, { marginTop: 18 }]}>Einzelnachweise</Text>
          </>
        )}

        {d.einsaetze.map((e, i) => (
          <EinsatzBlock key={i} e={e} mitFotos={d.art === "einsatz"} />
        ))}

        <Text
          style={s.fuss}
          fixed
          render={({ pageNumber, totalPages }) =>
            `${d.betrieb.name}${d.betrieb.ust_id ? ` · USt-IdNr. ${d.betrieb.ust_id}` : d.betrieb.steuernummer ? ` · St.-Nr. ${d.betrieb.steuernummer}` : ""} · Zeiten aus elektronischer Zeiterfassung · Seite ${pageNumber} von ${totalPages}`
          }
        />
      </Page>
    </Document>
  );
}

export async function nachweisPdfErzeugen(d: NachweisDokument): Promise<Buffer> {
  schriftRegistrieren();
  return renderToBuffer(<NachweisPdf d={d} />);
}
