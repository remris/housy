import "server-only";
import QRCode from "qrcode";
import { siteUrl } from "@/lib/env";

/** Inhalt des Objekt-QR-Codes: Link, der mit der normalen Handykamera die App öffnet. */
export const qrInhalt = (kennung: string) => `${siteUrl()}/qr/${kennung}`;

/** QR-Code als SVG-Markup (für Anzeige und Druck). */
export function qrSvg(kennung: string): Promise<string> {
  return QRCode.toString(qrInhalt(kennung), {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 1,
    color: { dark: "#000000", light: "#ffffff" },
  });
}
