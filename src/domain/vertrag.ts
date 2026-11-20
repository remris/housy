/**
 * Vertragslaufzeit und Kündigung.
 *
 * - Laufzeit in Monaten ab Beginn (0 = unbefristet).
 * - Ohne Kündigung verlängert sich ein befristeter Vertrag um `verlaengerungMonate`
 *   (0 = endet zum Laufzeitende).
 * - Kündigungsfrist in Monaten: "zum Laufzeitende" oder "zum Monatsende".
 */
import { type Iso, monatsende, plusMonate, plusTage } from "./datum";

export type Laufzeit = {
  beginn: Iso;
  laufzeitMonate: number;
  verlaengerungMonate: number;
  kuendigungsfristMonate: number;
  fristZum: "laufzeitende" | "monatsende";
};

/** Letzter Tag der jeweiligen Laufzeitperiode, die `stichtag` enthält (null = unbefristet). */
export function periodenende(l: Laufzeit, stichtag: Iso): Iso | null {
  if (l.laufzeitMonate <= 0) return null;
  let ende = plusTage(plusMonate(l.beginn, l.laufzeitMonate), -1);
  let monate = l.laufzeitMonate;
  while (ende < stichtag) {
    if (l.verlaengerungMonate <= 0) return ende;
    monate += l.verlaengerungMonate;
    ende = plusTage(plusMonate(l.beginn, monate), -1);
  }
  return ende;
}

/**
 * Frühestes Vertragsende bei Kündigungseingang am `eingang`.
 * Unbefristet bzw. "zum Monatsende": Frist ab Eingang, dann Monatsende.
 * "zum Laufzeitende": erstes Periodenende, bis zu dem die Frist noch eingehalten ist.
 */
export function kuendigungZum(l: Laufzeit, eingang: Iso): Iso {
  const fruehestens = plusMonate(eingang, l.kuendigungsfristMonate);
  if (l.laufzeitMonate <= 0 || l.fristZum === "monatsende") {
    const ende = monatsende(plusTage(fruehestens, -1));
    // Während einer festen Mindestlaufzeit nicht vor deren Ende
    if (l.laufzeitMonate > 0) {
      const erste = plusTage(plusMonate(l.beginn, l.laufzeitMonate), -1);
      return ende < erste ? erste : ende;
    }
    return ende;
  }
  let ende = periodenende(l, eingang)!;
  // Frist muss bis Periodenende eingehalten sein: fruehestens - 1 Tag <= ende
  while (plusTage(fruehestens, -1) > ende) {
    if (l.verlaengerungMonate <= 0) return ende;
    ende = periodenende(l, plusTage(ende, 1))!;
  }
  return ende;
}

/** Letzter Termin, bis zu dem gekündigt werden muss, um zum Periodenende zu beenden. */
export function kuendigenBis(l: Laufzeit, stichtag: Iso): Iso | null {
  const ende = periodenende(l, stichtag);
  if (!ende) return null;
  return plusMonate(plusTage(ende, 1), -l.kuendigungsfristMonate);
}

export type Vertragsstatus = "entwurf" | "aktiv" | "gekuendigt" | "beendet";

/** Erlaubte Statuswechsel im Workflow. */
export const STATUS_WECHSEL: Record<Vertragsstatus, Vertragsstatus[]> = {
  entwurf: ["aktiv"],
  aktiv: ["gekuendigt", "beendet"],
  gekuendigt: ["aktiv", "beendet"],
  beendet: [],
};

export function darfWechseln(von: Vertragsstatus, nach: Vertragsstatus): boolean {
  return STATUS_WECHSEL[von].includes(nach);
}
