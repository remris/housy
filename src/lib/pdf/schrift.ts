import { Font } from "@react-pdf/renderer";
import { join } from "node:path";

/**
 * Noto Sans (SIL Open Font License, siehe schriften/OFL.txt) statt der eingebauten Helvetica:
 * Helvetica kennt nur WinAnsi, Namen wie „Ayşe“ oder „Łukasz“ würden verstümmelt.
 * Die Dateien werden über `outputFileTracingIncludes` (next.config.ts) mit ausgeliefert.
 */
export const SCHRIFT = "NotoSans";

let registriert = false;

export function schriftRegistrieren() {
  if (registriert) return;
  const ordner = join(process.cwd(), "src", "lib", "pdf", "schriften");
  Font.register({
    family: SCHRIFT,
    fonts: [
      { src: join(ordner, "NotoSans-Regular.ttf"), fontWeight: "normal" },
      { src: join(ordner, "NotoSans-Bold.ttf"), fontWeight: "bold" },
    ],
  });
  // keine Silbentrennung (react-pdf trennt sonst englisch)
  Font.registerHyphenationCallback((wort) => [wort]);
  registriert = true;
}
