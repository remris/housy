import { SearchIcon } from "lucide-react";
import { Input } from "@/components/ui/input";

/** Suchfeld als GET-Formular (?q=), funktioniert ohne JavaScript. */
export function Suche({ wert, platzhalter }: { wert?: string; platzhalter: string }) {
  return (
    <form className="relative w-full sm:max-w-xs" role="search">
      <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
      <Input
        name="q"
        type="search"
        defaultValue={wert}
        placeholder={platzhalter}
        aria-label={platzhalter}
        className="pl-8"
      />
    </form>
  );
}

/** Escaped Sonderzeichen für PostgREST-ilike-Filter in .or(). */
export function suchMuster(q: string) {
  return `%${q.replace(/[%_\\]/g, (c) => `\\${c}`).replace(/[,()]/g, " ")}%`;
}
