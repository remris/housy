import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { absender, sendeMail } = await import("./resend");
const { bestaetigungMail, nachweisMail } = await import("./texte");

const betrieb = { name: "Glanz & Co.", telefon: "0711 123", email: "info@glanz.de" };

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Mail-Texte", () => {
  it("Monatsnachweis nennt Monat, Objekt und Anzahl; HTML ist maskiert", () => {
    const m = nachweisMail({
      art: "monat",
      von: "2026-11-01",
      objekt: "Haus <A>",
      betrieb,
      einsaetze: 4,
    });
    expect(m.betreff).toBe("Leistungsnachweis November 2026 – Haus <A>");
    expect(m.text).toContain("(4 Einsätze)");
    expect(m.html).toContain("Haus &lt;A&gt;");
    expect(m.html).toContain("Glanz &amp; Co.");
  });

  it("Bestätigung nennt Leistung, Preis und Widerspruchsfrist", () => {
    const m = bestaetigungMail({
      datum: "2026-11-20",
      objekt: "Hauptstraße 12",
      bezeichnung: "Keller fegen",
      menge: 1.5,
      einheit: "je Stunde",
      preisCent: 3500,
      dauer: "dauerhaft",
      betrieb,
      kleinunternehmer: false,
    });
    expect(m.text).toContain("am 20.11.2026");
    expect(m.text).toContain("1,5 × Keller fegen");
    expect(m.text).toMatch(/35,00\s€ je Stunde zzgl\. USt\./);
    expect(m.text).toContain("dauerhaft");
    expect(m.text).toContain("7 Tagen");
  });
});

describe("Versand über Resend", () => {
  it("ohne Key wird nichts verschickt", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    const f = vi.fn<typeof fetch>();
    const r = await sendeMail({ an: ["a@b.de"], betreff: "x", text: "x", html: "x" }, f);
    expect(r.status).toBe("ohne_versand");
    expect(f).not.toHaveBeenCalled();
  });

  it("schickt Empfänger, BCC, Antwortadresse, Anhang und Idempotenz-Schlüssel", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("MAIL_ABSENDER", "Housy <nachweis@housy.test>");
    const f = vi.fn<typeof fetch>(async () => Response.json({ id: "mail-1" }));
    const r = await sendeMail(
      {
        an: ["kunde@x.de"],
        kopie: ["buero@x.de"],
        betreff: "Nachweis",
        text: "t",
        html: "<p>t</p>",
        absenderName: 'Glanz "&" Co',
        antwortAn: "buero@x.de",
        anhaenge: [{ dateiname: "n.pdf", inhalt: new Uint8Array([37, 80, 68, 70]) }],
        idempotenzSchluessel: "nachweis-1",
      },
      f,
    );
    expect(r).toEqual({ status: "gesendet", id: "mail-1" });
    const [, init] = f.mock.calls[0]!;
    const body = JSON.parse(String(init!.body));
    expect(body).toMatchObject({
      from: '"Glanz & Co" <nachweis@housy.test>',
      to: ["kunde@x.de"],
      bcc: ["buero@x.de"],
      reply_to: "buero@x.de",
      attachments: [{ filename: "n.pdf", content: "JVBERg==" }],
    });
    expect((init!.headers as Record<string, string>)["Idempotency-Key"]).toBe("nachweis-1");
  });

  it("nur Kopie: geht direkt an den Betrieb; Fehler von Resend werden gemeldet", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("MAIL_ABSENDER", "nachweis@housy.test");
    const f = vi.fn<typeof fetch>(async () =>
      Response.json({ message: "domain not verified" }, { status: 403 }),
    );
    await expect(
      sendeMail({ an: [], kopie: ["buero@x.de"], betreff: "x", text: "x", html: "x" }, f),
    ).rejects.toThrow(/403: domain not verified/);
    expect(JSON.parse(String(f.mock.calls[0]![1]!.body)).to).toEqual(["buero@x.de"]);
  });

  it("Absender ohne Namen bleibt unverändert", () => {
    expect(absender("a@b.de")).toBe("a@b.de");
  });
});
