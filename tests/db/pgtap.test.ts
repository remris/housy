/**
 * Führt die pgTAP-Dateien aus supabase/tests lokal in PGlite aus (pgTAP-Nachbau).
 * Erkennt Syntaxfehler und falsche Erwartungen schon ohne Docker.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { neueDatenbank } from "./harness";

const ordner = join(__dirname, "..", "..", "supabase", "tests");
const dateien = readdirSync(ordner)
  .filter((d) => d.endsWith(".test.sql"))
  .sort();

describe("pgTAP (lokal)", () => {
  for (const datei of dateien) {
    it(datei, async () => {
      const db = await neueDatenbank();
      await db.exec(readFileSync(join(__dirname, "pgtap-stub.sql"), "utf8"));
      await db.exec("set search_path = public, extensions");
      const sql = readFileSync(join(ordner, datei), "utf8")
        .replace(/create extension if not exists pgtap[^;]*;/i, "")
        // Ergebnisse vor dem ROLLBACK sichern
        .replace(/\brollback;\s*$/i, "commit;");
      await db.exec(sql);
      const plan = Number(/select plan\((\d+)\)/.exec(sql)?.[1]);
      const r = await db.query<{ ok: boolean; text: string }>(
        "select ok, text from extensions.tap_ergebnis order by nr",
      );
      const fehlgeschlagen = r.rows.filter((x) => !x.ok).map((x) => x.text);
      expect(fehlgeschlagen).toEqual([]);
      expect(r.rows).toHaveLength(plan);
    });
  }
});
