import type { ReactNode } from "react";

export function Seitenkopf({
  titel,
  beschreibung,
  aktionen,
}: {
  titel: ReactNode;
  beschreibung?: ReactNode;
  aktionen?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{titel}</h1>
        {beschreibung && <p className="text-muted-foreground mt-1 text-sm">{beschreibung}</p>}
      </div>
      {aktionen && <div className="flex flex-wrap gap-2">{aktionen}</div>}
    </div>
  );
}
