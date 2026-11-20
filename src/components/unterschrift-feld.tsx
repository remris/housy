"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * Unterschriftsfeld (Canvas, Maus/Finger/Stift). Liefert ein PNG als Data-URL
 * über `onChange`, oder null, solange nichts gezeichnet wurde.
 */
export function UnterschriftFeld({ onChange }: { onChange: (bild: string | null) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const zeichnet = useRef(false);
  const [leer, setLeer] = useState(true);

  useEffect(() => {
    const c = canvas.current!;
    const skala = window.devicePixelRatio || 1;
    c.width = c.offsetWidth * skala;
    c.height = c.offsetHeight * skala;
    const ctx = c.getContext("2d")!;
    ctx.scale(skala, skala);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111";
  }, []);

  const punkt = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    zeichnet.current = true;
    const ctx = e.currentTarget.getContext("2d")!;
    const p = punkt(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }

  function bewegen(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!zeichnet.current) return;
    const ctx = e.currentTarget.getContext("2d")!;
    const p = punkt(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }

  function ende() {
    if (!zeichnet.current) return;
    zeichnet.current = false;
    setLeer(false);
    onChange(canvas.current!.toDataURL("image/png"));
  }

  function leeren() {
    const c = canvas.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    setLeer(true);
    onChange(null);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <canvas
          ref={canvas}
          aria-label="Unterschriftsfeld"
          className="h-40 w-full touch-none rounded-lg border bg-white"
          onPointerDown={start}
          onPointerMove={bewegen}
          onPointerUp={ende}
          onPointerLeave={ende}
        />
        {leer && (
          <span className="text-muted-foreground pointer-events-none absolute inset-0 flex items-center justify-center text-sm">
            Hier unterschreiben
          </span>
        )}
      </div>
      <div>
        <Button type="button" size="sm" variant="ghost" onClick={leeren} disabled={leer}>
          Löschen
        </Button>
      </div>
    </div>
  );
}
