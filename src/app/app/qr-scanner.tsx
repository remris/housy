"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { Uebersetzer } from "@/lib/i18n";

type Detektor = { detect: (quelle: CanvasImageSource) => Promise<{ rawValue: string }[]> };
type DetektorKlasse = new (o: { formats: string[] }) => Detektor;

/**
 * QR-Scanner über die Kamera (BarcodeDetector, z. B. Chrome auf Android).
 * Ohne Unterstützung oder Kamera meldet er das; dann gibt es „Ohne QR-Code einchecken“.
 */
export function QrScanner({
  t,
  onCode,
  onAbbruch,
}: {
  t: Uebersetzer;
  onCode: (code: string) => void;
  onAbbruch: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [fehler, setFehler] = useState(false);

  useEffect(() => {
    let strom: MediaStream | null = null;
    let aktiv = true;
    let takt = 0;
    const Klasse = (window as unknown as { BarcodeDetector?: DetektorKlasse }).BarcodeDetector;
    if (!Klasse || !navigator.mediaDevices?.getUserMedia) {
      setFehler(true);
      return;
    }
    const detektor = new Klasse({ formats: ["qr_code"] });
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" }, audio: false })
      .then(async (s) => {
        strom = s;
        if (!aktiv || !video.current) return;
        video.current.srcObject = s;
        await video.current.play();
        takt = window.setInterval(async () => {
          if (!video.current || video.current.readyState < 2) return;
          try {
            const treffer = await detektor.detect(video.current);
            if (treffer[0]?.rawValue && aktiv) {
              aktiv = false;
              onCode(treffer[0].rawValue);
            }
          } catch {
            /* nächster Versuch */
          }
        }, 300);
      })
      .catch(() => setFehler(true));
    return () => {
      aktiv = false;
      window.clearInterval(takt);
      strom?.getTracks().forEach((s) => s.stop());
    };
  }, [onCode]);

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3">
      {fehler ? (
        <p className="text-sm text-amber-700 dark:text-amber-400">{t("kameraFehlt")}</p>
      ) : (
        <>
          <video
            ref={video}
            className="aspect-square w-full rounded-md bg-black object-cover"
            muted
            playsInline
          />
          <p className="text-muted-foreground text-center text-sm">{t("qrHalten")}</p>
        </>
      )}
      <Button variant="outline" onClick={onAbbruch}>
        {t("abbrechen")}
      </Button>
    </div>
  );
}
