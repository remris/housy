import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { type Arbeitszeitliste, arbeitszeitliste } from "@/domain/arbeitszeitliste";
import { plusTage } from "@/domain/datum";
import { type Monat, monatsZeitraum } from "@/domain/nachweis";
import type { Buchung } from "@/domain/zeiterfassung";
import type { Database } from "@/lib/supabase/database.types";
import { mitgliedName } from "@/lib/touren";

type Client = SupabaseClient<Database>;

export type MitarbeiterZeiten = {
  id: string;
  name: string;
  aktiv: boolean;
  liste: Arbeitszeitliste;
};

const SEITE = 1000;

/**
 * Arbeitszeitlisten eines Monats für alle (oder einen) Mitarbeiter. Lädt seitenweise, weil ein
 * Monat mit vielen Mitarbeitern über die 1000-Zeilen-Grenze von PostgREST kommt.
 * Auch inaktive Mitglieder mit Buchungen im Monat erscheinen (Aufbewahrungspflicht).
 */
export async function ladeArbeitszeiten(
  supabase: Client,
  betriebId: string,
  monat: Monat,
  mitgliedId?: string,
): Promise<MitarbeiterZeiten[]> {
  const { von, bis } = monatsZeitraum(monat);
  const buchungen: (Buchung & { mitgliedId: string })[] = [];
  const korrigiert = new Set<string>();
  for (let start = 0; ; start += SEITE) {
    let q = supabase
      .from("zeitbuchung")
      .select(
        "id, mitglied_id, einsatz_id, art, zeitpunkt, storniert_am, zeitbuchung_protokoll(id)",
      )
      .eq("betrieb_id", betriebId)
      .gte("zeitpunkt", `${plusTage(von, -1)}T12:00:00Z`)
      .lte("zeitpunkt", `${plusTage(bis, 1)}T12:00:00Z`)
      .order("zeitpunkt")
      .order("id")
      .range(start, start + SEITE - 1);
    if (mitgliedId) q = q.eq("mitglied_id", mitgliedId);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    for (const b of data) {
      buchungen.push({
        id: b.id,
        mitgliedId: b.mitglied_id,
        art: b.art,
        zeitpunkt: b.zeitpunkt,
        einsatzId: b.einsatz_id,
        storniert: !!b.storniert_am,
      });
      if (b.zeitbuchung_protokoll.length > 0) korrigiert.add(b.id);
    }
    if (data.length < SEITE) break;
  }

  let mq = supabase
    .from("mitglied")
    .select("id, anzeigename, aktiv")
    .eq("betrieb_id", betriebId)
    .order("anzeigename");
  if (mitgliedId) mq = mq.eq("id", mitgliedId);
  const { data: mitglieder, error } = await mq;
  if (error) throw new Error(error.message);

  const mitBuchung = new Set(buchungen.map((b) => b.mitgliedId));
  return mitglieder
    .filter((m) => m.aktiv || mitBuchung.has(m.id))
    .map((m) => ({
      id: m.id,
      name: mitgliedName(m),
      aktiv: m.aktiv,
      liste: arbeitszeitliste(
        buchungen.filter((b) => b.mitgliedId === m.id),
        monat,
        korrigiert,
      ),
    }));
}
