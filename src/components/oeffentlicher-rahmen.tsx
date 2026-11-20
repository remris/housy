import type { ReactNode } from "react";

/** Rahmen für öffentliche Seiten eines Betriebs (Anfrage, Buchung, Angebot), auch im iFrame. */
export function OeffentlicherRahmen({
  betrieb,
  logoUrl,
  titel,
  beschreibung,
  children,
  datenschutzUrl,
  impressumUrl,
}: {
  betrieb: string;
  logoUrl: string | null;
  titel: string;
  beschreibung?: ReactNode;
  children: ReactNode;
  datenschutzUrl: string | null;
  impressumUrl: string | null;
}) {
  return (
    <main className="bg-muted/40 min-h-dvh px-4 py-8">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
        <header className="flex items-center gap-3">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- Logo aus dem Storage
            <img src={logoUrl} alt={betrieb} className="h-10 max-w-40 object-contain" />
          ) : (
            <span className="text-lg font-semibold">{betrieb}</span>
          )}
        </header>
        <section className="bg-background flex flex-col gap-4 rounded-xl border p-5 shadow-xs sm:p-6">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{titel}</h1>
            {beschreibung && <p className="text-muted-foreground mt-1 text-sm">{beschreibung}</p>}
          </div>
          {children}
        </section>
        <footer className="text-muted-foreground flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs">
          {impressumUrl && (
            <a href={impressumUrl} target="_blank" rel="noreferrer" className="underline">
              Impressum
            </a>
          )}
          {datenschutzUrl && (
            <a href={datenschutzUrl} target="_blank" rel="noreferrer" className="underline">
              Datenschutz
            </a>
          )}
          <span>bereitgestellt mit Housy</span>
        </footer>
      </div>
    </main>
  );
}
