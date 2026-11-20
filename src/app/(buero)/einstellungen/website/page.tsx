import type { Metadata } from "next";
import { STANDARD_BUCHUNG, type BuchungsEinstellungen } from "@/domain/preisrechner";
import { bueroKontext } from "@/lib/auth";
import { siteUrl } from "@/lib/env";
import { BuchungsEditor, Kopieren, WebsiteFormular } from "./website-teile";

export const metadata: Metadata = { title: "Website und Buchung" };

export default async function WebsiteSeite() {
  const k = await bueroKontext();
  const [{ data: b }, { data: vorlagen }] = await Promise.all([
    k.supabase
      .from("betrieb")
      .select(
        "oeffentlich_kennung, anfrage_aktiv, buchung, datenschutz_url, impressum_url, kleinunternehmer",
      )
      .eq("id", k.betriebId)
      .single(),
    k.supabase
      .from("auftragsvorlage")
      .select("id, name")
      .eq("betrieb_id", k.betriebId)
      .eq("aktiv", true)
      .order("name"),
  ]);
  if (!b) return null;
  const anfrageUrl = `${siteUrl()}/anfrage/${b.oeffentlich_kennung}`;
  const buchungUrl = `${siteUrl()}/buchen/${b.oeffentlich_kennung}`;
  const iframe = (url: string, hoehe: number) =>
    `<iframe src="${url}" style="width:100%;height:${hoehe}px;border:0" title="Housy" loading="lazy"></iframe>`;
  const buchung = { ...STANDARD_BUCHUNG, ...((b.buchung ?? {}) as Partial<BuchungsEinstellungen>) };
  const darf = k.rolle === "inhaber";

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h2 className="font-medium">Anfrageformular</h2>
        <p className="text-muted-foreground text-sm">
          Kunden fragen über deine Website an; die Anfrage landet unter „Anfragen“, du bekommst eine
          E-Mail.{" "}
          <a href={anfrageUrl} target="_blank" rel="noreferrer" className="underline">
            Formular ansehen
          </a>
        </p>
        <Kopieren label="Link (z. B. für Button oder E-Mail-Signatur)" text={anfrageUrl} />
        <Kopieren label="Zum Einbetten in deine Website" text={iframe(anfrageUrl, 900)} />
        <WebsiteFormular
          darfAendern={darf}
          werte={{
            anfrage_aktiv: b.anfrage_aktiv,
            datenschutz_url: b.datenschutz_url ?? "",
            impressum_url: b.impressum_url ?? "",
          }}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">Online-Buchung Fensterreinigung (Privatkunden)</h2>
        <p className="text-muted-foreground text-sm">
          Preisrechner mit sofortigem Endpreis, freie Termine aus deiner Planung, Buchung mit
          Bestätigungs-Mail. Gebuchte Einsätze erscheinen unter Planung → Offene Einsätze.{" "}
          <a href={buchungUrl} target="_blank" rel="noreferrer" className="underline">
            Buchungsseite ansehen
          </a>
        </p>
        <Kopieren label="Link" text={buchungUrl} />
        <Kopieren label="Zum Einbetten" text={iframe(buchungUrl, 1000)} />
        <BuchungsEditor
          start={buchung}
          vorlagen={vorlagen ?? []}
          darfAendern={darf}
          kleinunternehmer={b.kleinunternehmer}
        />
      </section>
    </div>
  );
}
