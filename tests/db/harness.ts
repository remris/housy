/**
 * Lokaler Datenbank-Testaufbau ohne Docker: PGlite (Postgres als WASM) +
 * Supabase-Nachbau (supabase-stub.sql) + alle Migrationen in Reihenfolge.
 * Die maßgeblichen RLS-Tests laufen zusätzlich als pgTAP gegen echte Supabase (CI).
 */
import { PGlite, type Transaction } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const wurzel = join(__dirname, "..", "..");

export type Tx = Transaction;

export async function neueDatenbank(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(readFileSync(join(__dirname, "supabase-stub.sql"), "utf8"));
  const ordner = join(wurzel, "supabase", "migrations");
  for (const datei of readdirSync(ordner)
    .filter((d) => d.endsWith(".sql"))
    .sort()) {
    try {
      await db.exec(readFileSync(join(ordner, datei), "utf8"));
    } catch (e) {
      throw new Error(`Migration ${datei} fehlgeschlagen: ${(e as Error).message}`);
    }
  }
  return db;
}

/** Legt einen Auth-Benutzer an (als Superuser, wie GoTrue). */
export async function benutzer(
  db: PGlite,
  email: string,
  meta: Record<string, unknown> = {},
): Promise<string> {
  const r = await db.query<{ id: string }>(
    "insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id",
    [email, JSON.stringify(meta)],
  );
  return r.rows[0]!.id;
}

/** Führt fn als eingeloggter Benutzer (Rolle authenticated) bzw. anon in einer Transaktion aus. */
export async function als<T>(
  db: PGlite,
  userId: string | null,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    if (userId) {
      await tx.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ sub: userId, role: "authenticated" }),
      ]);
      await tx.exec("set local role authenticated");
    } else {
      await tx.query("select set_config('request.jwt.claims', '', true)");
      await tx.exec("set local role anon");
    }
    return fn(tx);
  });
}

/** Erste Spalte der ersten Zeile. */
export async function wert<T>(db: PGlite | Tx, sql: string, params: unknown[] = []): Promise<T> {
  const r = await db.query<Record<string, T>>(sql, params);
  const zeile = r.rows[0];
  if (!zeile) throw new Error(`Keine Zeile: ${sql}`);
  return Object.values(zeile)[0] as T;
}
