/**
 * Erzeugt src/lib/supabase/database.types.ts ohne Docker:
 * spielt Supabase-Nachbau + Migrationen in PGlite ein und liest den Katalog.
 * Ausgabeformat entspricht `supabase gen types typescript` (Tables/Views/Functions/Enums,
 * inkl. Relationships). Mit laufendem Docker ist `npm run db:types` maßgeblich.
 */
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const wurzel = join(dirname(fileURLToPath(import.meta.url)), "..");
const db = new PGlite();
await db.exec(readFileSync(join(wurzel, "tests/db/supabase-stub.sql"), "utf8"));
const ordner = join(wurzel, "supabase/migrations");
for (const d of readdirSync(ordner)
  .filter((x) => x.endsWith(".sql"))
  .sort()) {
  await db.exec(readFileSync(join(ordner, d), "utf8"));
}

const enums = (
  await db.query(`
    select t.typname as name, array_agg(e.enumlabel order by e.enumsortorder) as werte
    from pg_type t join pg_enum e on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' group by t.typname order by t.typname`)
).rows;
const enumNamen = new Set(enums.map((e) => e.name));

function tsTyp(udt, istArray) {
  const basis = udt.replace(/^_/, "");
  let t;
  if (enumNamen.has(basis)) t = `Database["public"]["Enums"]["${basis}"]`;
  else if (["int2", "int4", "int8", "numeric", "float4", "float8"].includes(basis)) t = "number";
  else if (basis === "bool") t = "boolean";
  else if (["json", "jsonb"].includes(basis)) t = "Json";
  else if (basis === "void") t = "undefined";
  else t = "string";
  return istArray || udt.startsWith("_") ? `${t}[]` : t;
}

const spalten = (
  await db.query(`
    select c.table_name, c.column_name, c.udt_name, c.data_type, c.is_nullable = 'YES' as nullable,
           (c.column_default is not null or c.is_identity = 'YES' or c.is_generated = 'ALWAYS') as hat_default,
           t.table_type
    from information_schema.columns c
    join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name
    where c.table_schema = 'public'
    order by c.table_name, c.ordinal_position`)
).rows;

const fks = (
  await db.query(`
    select con.conname, rel.relname as tabelle, frel.relname as ziel,
      array(select a.attname from unnest(con.conkey) with ordinality as u(k, i) join pg_attribute a on a.attrelid = con.conrelid and a.attnum = u.k order by u.i) as spalten,
      array(select a.attname from unnest(con.confkey) with ordinality as u(k, i) join pg_attribute a on a.attrelid = con.confrelid and a.attnum = u.k order by u.i) as zielspalten,
      exists (select 1 from pg_constraint u where u.conrelid = con.conrelid and u.contype in ('u','p')
              and u.conkey::int[] @> con.conkey::int[] and u.conkey::int[] <@ con.conkey::int[]) as eins_zu_eins
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_class frel on frel.oid = con.confrelid
    join pg_namespace n on n.oid = rel.relnamespace
    join pg_namespace fn on fn.oid = frel.relnamespace
    where con.contype = 'f' and n.nspname = 'public' and fn.nspname = 'public'
    order by con.conname`)
).rows;

const funktionen = (
  await db.query(`
    select p.proname as name, p.proretset as set_of,
      coalesce(p.proargnames, '{}') as argnamen,
      coalesce(p.proargmodes::text[], '{}') as argmodi,
      array(select ty.typname from unnest(coalesce(p.proallargtypes, p.proargtypes::oid[])) with ordinality as u(t, i) join pg_type ty on ty.oid = u.t order by u.i) as argtypen,
      p.pronargdefaults as anzahl_defaults, p.pronargs as anzahl_args,
      rt.typname as rueckgabe
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    join pg_type rt on rt.oid = p.prorettype
    where n.nspname = 'public' and rt.typname <> 'trigger'
      and has_function_privilege('authenticated', p.oid, 'execute')
    order by p.proname`)
).rows;

const tabellen = new Map();
for (const s of spalten) {
  if (!tabellen.has(s.table_name))
    tabellen.set(s.table_name, { view: s.table_type === "VIEW", spalten: [] });
  tabellen.get(s.table_name).spalten.push(s);
}

const ind = (n) => "  ".repeat(n);
let out = `// Automatisch erzeugt (scripts/db-types-pglite.mjs bzw. supabase gen types). Nicht von Hand ändern.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
`;
function relationships(name) {
  const r = fks.filter((f) => f.tabelle === name);
  if (!r.length) return "[]";
  return (
    "[\n" +
    r
      .map(
        (f) =>
          `${ind(6)}{\n${ind(7)}foreignKeyName: "${f.conname}";\n${ind(7)}columns: [${f.spalten.map((c) => `"${c}"`).join(", ")}];\n${ind(7)}isOneToOne: ${f.eins_zu_eins};\n${ind(7)}referencedRelation: "${f.ziel}";\n${ind(7)}referencedColumns: [${f.zielspalten.map((c) => `"${c}"`).join(", ")}];\n${ind(6)}},\n`,
      )
      .join("") +
    `${ind(5)}]`
  );
}
for (const [name, t] of [...tabellen].filter(([, t]) => !t.view)) {
  const row = t.spalten
    .map(
      (s) =>
        `${ind(5)}${s.column_name}: ${tsTyp(s.udt_name, s.data_type === "ARRAY")}${s.nullable ? " | null" : ""};`,
    )
    .join("\n");
  const ins = t.spalten
    .map(
      (s) =>
        `${ind(5)}${s.column_name}${s.nullable || s.hat_default ? "?" : ""}: ${tsTyp(s.udt_name, s.data_type === "ARRAY")}${s.nullable ? " | null" : ""};`,
    )
    .join("\n");
  const upd = t.spalten
    .map(
      (s) =>
        `${ind(5)}${s.column_name}?: ${tsTyp(s.udt_name, s.data_type === "ARRAY")}${s.nullable ? " | null" : ""};`,
    )
    .join("\n");
  out += `${ind(3)}${name}: {\n${ind(4)}Row: {\n${row}\n${ind(4)}};\n${ind(4)}Insert: {\n${ins}\n${ind(4)}};\n${ind(4)}Update: {\n${upd}\n${ind(4)}};\n${ind(4)}Relationships: ${relationships(name)};\n${ind(3)}};\n`;
}
out += `${ind(2)}};\n${ind(2)}Views: {\n`;
for (const [name, t] of [...tabellen].filter(([, t]) => t.view)) {
  const row = t.spalten
    .map((s) => `${ind(5)}${s.column_name}: ${tsTyp(s.udt_name, s.data_type === "ARRAY")} | null;`)
    .join("\n");
  out += `${ind(3)}${name}: {\n${ind(4)}Row: {\n${row}\n${ind(4)}};\n${ind(4)}Relationships: [];\n${ind(3)}};\n`;
}
if (![...tabellen.values()].some((t) => t.view)) out += `${ind(3)}[_ in never]: never;\n`;
out += `${ind(2)}};\n${ind(2)}Functions: {\n`;
const gruppiert = new Map();
for (const f of funktionen) {
  if (!gruppiert.has(f.name)) gruppiert.set(f.name, []);
  gruppiert.get(f.name).push(f);
}
for (const [name, varianten] of gruppiert) {
  const teile = varianten.map((f) => {
    const args = [];
    const ret = [];
    const nDefaults = f.anzahl_defaults;
    let eingabeIndex = 0;
    const eingaben = f.argtypen.filter(
      (_, i) => !f.argmodi[i] || ["i", "b", "v"].includes(f.argmodi[i]),
    ).length;
    f.argtypen.forEach((typ, i) => {
      const modus = f.argmodi[i] ?? "i";
      const n = f.argnamen[i] || `arg${i}`;
      if (["i", "b", "v"].includes(modus)) {
        const optional = eingabeIndex >= eingaben - nDefaults;
        args.push(`${ind(6)}${n}${optional ? "?" : ""}: ${tsTyp(typ, false)};`);
        eingabeIndex++;
      }
      if (["o", "b", "t"].includes(modus)) ret.push(`${ind(6)}${n}: ${tsTyp(typ, false)};`);
    });
    const argsTs = args.length ? `{\n${args.join("\n")}\n${ind(5)}}` : "Record<PropertyKey, never>";
    let retTs;
    if (ret.length) retTs = `{\n${ret.join("\n")}\n${ind(5)}}${f.set_of ? "[]" : ""}`;
    else if (tabellen.has(f.rueckgabe))
      retTs = `Database["public"]["Tables"]["${f.rueckgabe}"]["Row"]${f.set_of ? "[]" : ""}`;
    else retTs = `${tsTyp(f.rueckgabe, false)}${f.set_of ? "[]" : ""}`;
    return `{\n${ind(5)}Args: ${argsTs};\n${ind(5)}Returns: ${retTs};\n${ind(4)}}`;
  });
  out += `${ind(3)}${name}:\n${ind(4)}| ${teile.join(`\n${ind(4)}| `)};\n`;
}
out += `${ind(2)}};\n${ind(2)}Enums: {\n`;
for (const e of enums) out += `${ind(3)}${e.name}: ${e.werte.map((w) => `"${w}"`).join(" | ")};\n`;
if (!enums.length) out += `${ind(3)}[_ in never]: never;\n`;
out += `${ind(2)}};\n${ind(2)}CompositeTypes: {\n${ind(3)}[_ in never]: never;\n${ind(2)}};\n  };\n};

type PublicSchema = Database["public"];
export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"];
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T];
`;
writeFileSync(join(wurzel, "src/lib/supabase/database.types.ts"), out);
console.log(
  `database.types.ts: ${tabellen.size} Tabellen/Views, ${gruppiert.size} Funktionen, ${enums.length} Enums`,
);
