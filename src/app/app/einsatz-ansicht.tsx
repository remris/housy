"use client";

import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  CameraIcon,
  KeyRoundIcon,
  NavigationIcon,
  PackageXIcon,
  PencilIcon,
  PlusIcon,
} from "lucide-react";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import { UnterschriftFeld } from "@/components/unterschrift-feld";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { type AppEinsatz, fehltVorCheckout, navigationsLink, phase, qrPasst } from "@/domain/app";
import { formatEuro } from "@/domain/geld";
import { uhrzeitBerlin } from "@/domain/zeiterfassung";
import { cn } from "@/lib/utils";
import { useAppKontext } from "./kontext";
import { QrScanner } from "./qr-scanner";
import { dauer, istApple, jetztIso, neueId, verkleinereFoto } from "./werkzeuge";

export function EinsatzAnsicht({ einsatz: e }: { einsatz: AppEinsatz }) {
  const { t, daten, oeffne } = useAppKontext();
  const p = phase(e);
  const [apple, setApple] = useState(false);
  useEffect(() => setApple(istApple()), []);
  const checkin = daten.buchungen.find(
    (b) => b.einsatzId === e.id && b.art === "checkin" && !b.storniert,
  );

  return (
    <div className="flex flex-col gap-3 pt-1" data-einsatz-ansicht={e.id}>
      <button
        className="text-muted-foreground flex items-center gap-1 self-start text-sm"
        onClick={() => oeffne(null)}
      >
        <ArrowLeftIcon className="size-4" /> {t("zurueck")}
      </button>

      <section className="bg-background flex flex-col gap-1 rounded-lg border p-3">
        <h2 className="text-lg font-semibold">{e.objekt.name}</h2>
        <p className="text-muted-foreground text-sm">
          {[e.objekt.strasse, [e.objekt.plz, e.objekt.ort].filter(Boolean).join(" ")]
            .filter(Boolean)
            .join(", ")}
        </p>
        <p className="text-sm">
          {e.vorlage} · {t("sollzeit", { dauer: dauer(e.sollzeitMinuten) })}
        </p>
        {e.zeitfensterVon && e.zeitfensterBis && (
          <p className="text-sm">
            {t("zeitfenster", { von: e.zeitfensterVon, bis: e.zeitfensterBis })}
          </p>
        )}
        {e.objekt.zugangshinweise && (
          <p className="mt-1 flex gap-2 rounded-md bg-amber-50 p-2 text-sm dark:bg-amber-950/40">
            <KeyRoundIcon className="mt-0.5 size-4 shrink-0" />
            <span>
              <span className="font-medium">{t("zugang")}: </span>
              {e.objekt.zugangshinweise}
            </span>
          </p>
        )}
        <a
          href={navigationsLink(e.objekt, apple)}
          target="_blank"
          rel="noreferrer"
          className="mt-1 flex items-center gap-2 text-sm font-medium text-blue-700 dark:text-blue-300"
        >
          <NavigationIcon className="size-4" /> {t("navigation")}
        </a>
      </section>

      {p === "offen" ? (
        <Einchecken e={e} />
      ) : (
        <>
          {checkin && (
            <p className="text-muted-foreground text-sm">
              {t("eingechecktUm", { zeit: uhrzeitBerlin(checkin.zeitpunkt) })}
            </p>
          )}
          <Checkliste e={e} />
          <Fotos e={e} />
          <Notiz e={e} />
          <Meldungen e={e} />
          <Leistungen e={e} />
          <Korrektur e={e} />
          {p === "laeuft" && <Auschecken e={e} />}
        </>
      )}
    </div>
  );
}

function Abschnitt({
  titel,
  children,
  icon,
}: {
  titel: string;
  children: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <section className="bg-background flex flex-col gap-2 rounded-lg border p-3">
      <h3 className="flex items-center gap-2 font-medium">
        {icon}
        {titel}
      </h3>
      {children}
    </section>
  );
}

function Einchecken({ e }: { e: AppEinsatz }) {
  const { t, ausfuehren } = useAppKontext();
  const [scannen, setScannen] = useState(false);
  const [falsch, setFalsch] = useState(false);
  const buchen = useCallback(
    (quelle: "qr" | "app") =>
      ausfuehren({
        typ: "zeit",
        id: neueId(),
        art: "checkin",
        zeitpunkt: jetztIso(),
        einsatzId: e.id,
        quelle,
      }),
    [ausfuehren, e.id],
  );
  const onCode = useCallback(
    (code: string) => {
      setScannen(false);
      if (qrPasst(code, e.objekt.qrKennung)) {
        setFalsch(false);
        buchen("qr");
      } else {
        setFalsch(true);
      }
    },
    [buchen, e.objekt.qrKennung],
  );

  return (
    <section className="flex flex-col gap-2">
      {falsch && (
        <p className="rounded-md bg-red-50 p-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {t("qrFalsch")}
        </p>
      )}
      {scannen ? (
        <QrScanner t={t} onCode={onCode} onAbbruch={() => setScannen(false)} />
      ) : (
        <Button size="lg" className="h-12 text-base" onClick={() => setScannen(true)}>
          {t("einchecken")}
        </Button>
      )}
      <Button variant="outline" onClick={() => buchen("app")}>
        {t("ohneQr")}
      </Button>
    </section>
  );
}

function Checkliste({ e }: { e: AppEinsatz }) {
  const { t, ausfuehren } = useAppKontext();
  if (!e.aufgaben.length) return null;
  return (
    <Abschnitt titel={t("checkliste")}>
      <ul className="flex flex-col">
        {e.aufgaben.map((a) => (
          <li key={a.taetigkeitId}>
            <label className="flex items-center gap-3 py-2 text-base">
              <input
                type="checkbox"
                className="size-6 shrink-0"
                checked={a.erledigt}
                onChange={(ev) =>
                  ausfuehren({
                    typ: "aufgabe",
                    id: neueId(),
                    einsatzId: e.id,
                    taetigkeitId: a.taetigkeitId,
                    erledigt: ev.target.checked,
                    zeit: jetztIso(),
                  })
                }
              />
              <span className={cn(a.erledigt && "text-muted-foreground line-through")}>
                {a.text}
              </span>
              {a.fotoPflicht && (
                <CameraIcon
                  className="text-muted-foreground ml-auto size-4"
                  aria-label={t("pflichtfoto")}
                />
              )}
            </label>
          </li>
        ))}
      </ul>
    </Abschnitt>
  );
}

function FotoKnopf({
  e,
  meldungId = null,
  text,
}: {
  e: AppEinsatz;
  meldungId?: string | null;
  text: string;
}) {
  const { ausfuehren, betriebId } = useAppKontext();
  return (
    <label className="border-input flex cursor-pointer items-center justify-center gap-2 rounded-lg border py-3 text-sm font-medium">
      <CameraIcon className="size-4" />
      {text}
      <input
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={async (ev) => {
          const datei = ev.target.files?.[0];
          ev.target.value = "";
          if (!datei) return;
          const blob = await verkleinereFoto(datei);
          const id = neueId();
          ausfuehren(
            { typ: "foto", id, einsatzId: e.id, pfad: `${betriebId}/${e.id}/${id}.jpg`, meldungId },
            blob,
          );
        }}
      />
    </label>
  );
}

function Fotos({ e }: { e: AppEinsatz }) {
  const { t } = useAppKontext();
  return (
    <Abschnitt titel={`${t("fotos")} · ${t("fotoAnzahl", { n: e.fotos })}`}>
      <FotoKnopf e={e} text={t("fotoAufnehmen")} />
    </Abschnitt>
  );
}

function Notiz({ e }: { e: AppEinsatz }) {
  const { t, ausfuehren } = useAppKontext();
  const [text, setText] = useState(e.notiz ?? "");
  const [gespeichert, setGespeichert] = useState(false);
  return (
    <Abschnitt titel={t("notiz")}>
      <Textarea
        value={text}
        onChange={(ev) => {
          setText(ev.target.value);
          setGespeichert(false);
        }}
        rows={3}
      />
      <Button
        variant="outline"
        size="sm"
        className="self-start"
        disabled={text === (e.notiz ?? "")}
        onClick={() => {
          ausfuehren({ typ: "notiz", id: neueId(), einsatzId: e.id, text, zeit: jetztIso() });
          setGespeichert(true);
        }}
      >
        {gespeichert ? t("gespeichert") : t("speichern")}
      </Button>
    </Abschnitt>
  );
}

function Meldungen({ e }: { e: AppEinsatz }) {
  const { t, daten, ausfuehren } = useAppKontext();
  const [offen, setOffen] = useState<"mangel" | "material" | null>(null);
  const [text, setText] = useState("");
  const [artikel, setArtikel] = useState("");
  const [letzteMeldung, setLetzteMeldung] = useState<string | null>(null);

  const senden = () => {
    const id = neueId();
    ausfuehren({
      typ: "meldung",
      id,
      einsatzId: e.id,
      art: offen === "mangel" ? "mangel" : "material_leer",
      text: text.trim() || null,
      artikelId: offen === "material" ? artikel : null,
    });
    setLetzteMeldung(offen === "mangel" ? id : null);
    setOffen(null);
    setText("");
    setArtikel("");
  };

  return (
    <Abschnitt titel={`${t("mangelMelden")} / ${t("materialLeer")}`}>
      {e.meldungen.length > 0 && (
        <ul className="flex flex-col gap-1 text-sm">
          {e.meldungen.map((m) => (
            <li key={m.id} className="text-muted-foreground">
              ✓ {t("gemeldet")}:{" "}
              {m.art === "mangel"
                ? m.text
                : `${t("materialLeer")} – ${daten.artikel.find((a) => a.id === m.artikelId)?.name ?? ""}`}
            </li>
          ))}
        </ul>
      )}
      {letzteMeldung && <FotoKnopf e={e} meldungId={letzteMeldung} text={t("fotoAufnehmen")} />}
      {offen === null ? (
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={() => setOffen("mangel")}>
            <AlertTriangleIcon /> {t("mangelMelden")}
          </Button>
          <Button
            variant="outline"
            onClick={() => setOffen("material")}
            disabled={!daten.artikel.length}
          >
            <PackageXIcon /> {t("materialLeer")}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {offen === "mangel" ? (
            <Textarea
              placeholder={t("mangelText")}
              value={text}
              onChange={(ev) => setText(ev.target.value)}
              rows={3}
              autoFocus
            />
          ) : (
            <select
              aria-label={t("welcherArtikel")}
              className="border-input bg-background h-10 rounded-lg border px-2"
              value={artikel}
              onChange={(ev) => setArtikel(ev.target.value)}
            >
              <option value="">{t("welcherArtikel")}</option>
              {daten.artikel.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => setOffen(null)}>
              {t("abbrechen")}
            </Button>
            <Button onClick={senden} disabled={offen === "mangel" ? !text.trim() : !artikel}>
              {t("senden")}
            </Button>
          </div>
        </div>
      )}
    </Abschnitt>
  );
}

function Leistungen({ e }: { e: AppEinsatz }) {
  const { t, daten, ausfuehren } = useAppKontext();
  const [offen, setOffen] = useState(false);
  const [preisId, setPreisId] = useState("");
  const [frei, setFrei] = useState("");
  const [menge, setMenge] = useState("1");
  const [dauerhaft, setDauerhaft] = useState(false);
  const [name, setName] = useState("");
  const [bild, setBild] = useState<string | null>(null);
  const [ohne, setOhne] = useState(false);

  const mengeZahl = Number(menge.replace(",", "."));
  const gueltig =
    (preisId !== "" && preisId !== "frei") || (preisId === "frei" && frei.trim().length > 0);
  const zustimmungOk = ohne || (bild !== null && name.trim().length > 0);

  const hinzufuegen = () => {
    ausfuehren({
      typ: "position",
      id: neueId(),
      einsatzId: e.id,
      preisId: preisId === "frei" ? null : preisId,
      bezeichnung: preisId === "frei" ? frei.trim() : "",
      menge: mengeZahl,
      dauer: dauerhaft ? "dauerhaft" : "heute",
      zustimmung: ohne ? "muendlich" : "unterschrift",
      unterschriftName: ohne ? null : name.trim(),
      unterschriftBild: ohne ? null : bild,
    });
    setOffen(false);
    setPreisId("");
    setFrei("");
    setMenge("1");
    setDauerhaft(false);
    setName("");
    setBild(null);
    setOhne(false);
  };

  return (
    <Abschnitt titel={t("leistungHinzufuegen")}>
      {e.positionen.length > 0 && (
        <ul className="flex flex-col gap-1 text-sm">
          {e.positionen.map((p) => (
            <li key={p.id} className="flex justify-between gap-2">
              <span>
                {p.menge.toLocaleString("de-DE")} × {p.bezeichnung}
                {p.dauer === "dauerhaft" && ` (${t("dauerhaft")})`}
              </span>
              <span className="text-muted-foreground shrink-0">
                {p.status === "bestaetigt"
                  ? p.preisCent !== null
                    ? formatEuro(p.preisCent)
                    : t("statusBestaetigt")
                  : p.status === "vorgeschlagen"
                    ? t("statusVorgeschlagen")
                    : t("statusAbgelehnt")}
              </span>
            </li>
          ))}
        </ul>
      )}
      {!offen ? (
        <Button variant="outline" onClick={() => setOffen(true)}>
          <PlusIcon /> {t("leistungHinzufuegen")}
        </Button>
      ) : (
        <div className="flex flex-col gap-3">
          <select
            aria-label={t("ausPreisliste")}
            className="border-input bg-background h-10 rounded-lg border px-2"
            value={preisId}
            onChange={(ev) => setPreisId(ev.target.value)}
          >
            <option value="">{t("ausPreisliste")} …</option>
            {daten.preisliste.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} – {formatEuro(p.preisCent)}
              </option>
            ))}
            <option value="frei">{t("andereLeistung")}</option>
          </select>
          {preisId === "frei" && (
            <Input
              placeholder={t("bezeichnung")}
              value={frei}
              onChange={(ev) => setFrei(ev.target.value)}
            />
          )}
          <label className="flex items-center gap-2 text-sm">
            {t("menge")}
            <Input
              inputMode="decimal"
              className="w-24"
              value={menge}
              onChange={(ev) => setMenge(ev.target.value)}
            />
          </label>
          <div className="bg-muted grid grid-cols-2 rounded-lg p-1 text-sm">
            {[false, true].map((d) => (
              <button
                key={String(d)}
                type="button"
                onClick={() => setDauerhaft(d)}
                className={cn(
                  "rounded-md py-2",
                  dauerhaft === d && "bg-background font-medium shadow-xs",
                )}
              >
                {d ? t("dauerhaft") : t("nurHeute")}
              </button>
            ))}
          </div>
          {!ohne && (
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">{t("unterschriftKunde")}</span>
              <UnterschriftFeld onChange={setBild} />
              <Input
                placeholder={t("nameKunde")}
                value={name}
                onChange={(ev) => setName(ev.target.value)}
              />
            </div>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-5"
              checked={ohne}
              onChange={(ev) => setOhne(ev.target.checked)}
            />
            {t("ohneUnterschrift")}
          </label>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => setOffen(false)}>
              {t("abbrechen")}
            </Button>
            <Button onClick={hinzufuegen} disabled={!gueltig || !zustimmungOk || !(mengeZahl > 0)}>
              {t("hinzufuegen")}
            </Button>
          </div>
        </div>
      )}
    </Abschnitt>
  );
}

function Korrektur({ e }: { e: AppEinsatz }) {
  const { t, ausfuehren } = useAppKontext();
  const [offen, setOffen] = useState(false);
  const [zugang, setZugang] = useState(e.objekt.zugangshinweise ?? "");
  const [fenster, setFenster] = useState(() =>
    Object.fromEntries(e.objekt.fenster.map((f) => [f.id, String(f.anzahl)])),
  );

  const speichern = () => {
    if (zugang.trim() !== (e.objekt.zugangshinweise ?? "")) {
      ausfuehren({
        typ: "korrektur",
        id: neueId(),
        einsatzId: e.id,
        feld: "zugangshinweise",
        wert: zugang,
        fensterId: null,
      });
    }
    for (const f of e.objekt.fenster) {
      const neu = fenster[f.id];
      if (neu && /^[1-9]\d{0,4}$/.test(neu) && Number(neu) !== f.anzahl) {
        ausfuehren({
          typ: "korrektur",
          id: neueId(),
          einsatzId: e.id,
          feld: "fenster_anzahl",
          wert: neu,
          fensterId: f.id,
        });
      }
    }
    setOffen(false);
  };

  if (!offen) {
    return (
      <Button variant="ghost" className="self-start" onClick={() => setOffen(true)}>
        <PencilIcon /> {t("datenKorrigieren")}
      </Button>
    );
  }
  return (
    <Abschnitt titel={t("datenKorrigieren")}>
      <label className="flex flex-col gap-1 text-sm">
        {t("zugangshinweise")}
        <Textarea value={zugang} onChange={(ev) => setZugang(ev.target.value)} rows={2} />
      </label>
      {e.objekt.fenster.length > 0 && (
        <div className="flex flex-col gap-1 text-sm">
          {t("fenster")}
          {e.objekt.fenster.map((f) => (
            <label key={f.id} className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">{f.bezeichnung ?? t("fenster")}</span>
              <Input
                inputMode="numeric"
                aria-label={`${f.bezeichnung ?? t("fenster")} ${t("anzahl")}`}
                className="w-24"
                value={fenster[f.id] ?? ""}
                onChange={(ev) => setFenster((x) => ({ ...x, [f.id]: ev.target.value }))}
              />
            </label>
          ))}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" onClick={() => setOffen(false)}>
          {t("abbrechen")}
        </Button>
        <Button onClick={speichern}>{t("speichern")}</Button>
      </div>
    </Abschnitt>
  );
}

function Auschecken({ e }: { e: AppEinsatz }) {
  const { t, ausfuehren, oeffne } = useAppKontext();
  const [warnung, setWarnung] = useState(false);
  const fehlt = fehltVorCheckout(e);
  const unvollstaendig = fehlt.offeneAufgaben > 0 || fehlt.fotoFehlt;
  const buchen = () => {
    ausfuehren({
      typ: "zeit",
      id: neueId(),
      art: "checkout",
      zeitpunkt: jetztIso(),
      einsatzId: e.id,
      quelle: "app",
    });
    oeffne(null);
  };
  return (
    <section className="flex flex-col gap-2 pt-2">
      {warnung && unvollstaendig && (
        <div className="rounded-md bg-amber-50 p-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          {fehlt.offeneAufgaben > 0 && <p>{t("offenePunkte", { n: fehlt.offeneAufgaben })}</p>}
          {fehlt.fotoFehlt && <p>{t("fotoFehlt")}</p>}
        </div>
      )}
      <Button
        size="lg"
        className="h-12 text-base"
        variant={warnung && unvollstaendig ? "destructive" : "default"}
        onClick={() => (unvollstaendig && !warnung ? setWarnung(true) : buchen())}
      >
        {warnung && unvollstaendig ? t("trotzdemAuschecken") : t("auschecken")}
      </Button>
    </section>
  );
}
