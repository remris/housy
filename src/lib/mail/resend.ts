import "server-only";

/**
 * E-Mail-Versand über Resend (REST, ohne SDK). Ohne RESEND_API_KEY wird nichts verschickt
 * (Ergebnis „ohne_versand“), damit Entwicklung und Tests ohne Konto laufen.
 * Absender: MAIL_ABSENDER (Domain muss in Resend bestätigt sein), Antworten gehen an den Betrieb.
 */

export type Anhang = { dateiname: string; inhalt: Uint8Array };

export type Mail = {
  an: string[];
  kopie?: string[];
  betreff: string;
  text: string;
  html: string;
  /** Anzeigename im Absender, z. B. der Betrieb */
  absenderName?: string;
  antwortAn?: string | null;
  anhaenge?: Anhang[];
  /** verhindert Doppelversand bei Wiederholung (Resend: 24 h) */
  idempotenzSchluessel?: string;
};

export type Versandergebnis =
  { status: "gesendet"; id: string } | { status: "ohne_versand"; grund: string };

export class MailFehler extends Error {}

const ANHANG_BASE64 = (u: Uint8Array) => Buffer.from(u).toString("base64");

/** Absender mit Anzeigename; Sonderzeichen im Namen werden entfernt. */
export function absender(adresse: string, name?: string): string {
  const sauber = name?.replace(/["<>\r\n]/g, "").trim();
  const nurAdresse = /<([^>]+)>/.exec(adresse)?.[1] ?? adresse;
  return sauber ? `"${sauber}" <${nurAdresse}>` : adresse;
}

export async function sendeMail(m: Mail, fetchFn: typeof fetch = fetch): Promise<Versandergebnis> {
  const key = process.env.RESEND_API_KEY;
  const von = process.env.MAIL_ABSENDER;
  if (!key || !von) {
    return { status: "ohne_versand", grund: "Mail-Versand nicht eingerichtet (RESEND_API_KEY)" };
  }
  if (m.an.length === 0 && (m.kopie ?? []).length === 0) {
    return { status: "ohne_versand", grund: "keine Empfänger" };
  }
  const an = m.an.length > 0 ? m.an : (m.kopie ?? []);
  const kopie = m.an.length > 0 ? m.kopie : [];
  const antwort = await fetchFn("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(m.idempotenzSchluessel ? { "Idempotency-Key": m.idempotenzSchluessel } : {}),
    },
    body: JSON.stringify({
      from: absender(von, m.absenderName),
      to: an,
      ...(kopie && kopie.length > 0 ? { bcc: kopie } : {}),
      ...(m.antwortAn ? { reply_to: m.antwortAn } : {}),
      subject: m.betreff,
      text: m.text,
      html: m.html,
      ...(m.anhaenge && m.anhaenge.length > 0
        ? {
            attachments: m.anhaenge.map((a) => ({
              filename: a.dateiname,
              content: ANHANG_BASE64(a.inhalt),
            })),
          }
        : {}),
    }),
  });
  const daten = (await antwort.json().catch(() => ({}))) as { id?: string; message?: string };
  if (!antwort.ok || !daten.id) {
    throw new MailFehler(`Resend ${antwort.status}: ${daten.message ?? "unbekannter Fehler"}`);
  }
  return { status: "gesendet", id: daten.id };
}
