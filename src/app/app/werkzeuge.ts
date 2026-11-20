"use client";

/** Verkleinert ein Foto auf höchstens 1600 px Kantenlänge als JPEG (spart Datenvolumen offline). */
export async function verkleinereFoto(datei: File, max = 1600): Promise<Blob> {
  try {
    const bild = await createImageBitmap(datei);
    const faktor = Math.min(1, max / Math.max(bild.width, bild.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bild.width * faktor);
    canvas.height = Math.round(bild.height * faktor);
    canvas.getContext("2d")!.drawImage(bild, 0, 0, canvas.width, canvas.height);
    bild.close();
    return await new Promise<Blob>((ok, fehler) =>
      canvas.toBlob((b) => (b ? ok(b) : fehler(new Error("toBlob"))), "image/jpeg", 0.8),
    );
  } catch {
    return datei; // z. B. HEIC ohne Unterstützung: Original hochladen
  }
}

export const neueId = () => crypto.randomUUID();
export const jetztIso = () => new Date().toISOString();

export function istApple(): boolean {
  return /iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent) && "ontouchend" in document;
}

export function istInstalliert(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** "135" → "2:15 h" */
export function dauer(minuten: number): string {
  return `${Math.floor(minuten / 60)}:${String(Math.round(minuten) % 60).padStart(2, "0")} h`;
}
