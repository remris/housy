import Link from "next/link";
import { Button } from "@/components/ui/button";

const punkte = [
  {
    titel: "Objekte & Verträge",
    text: "Kunden, Raumbuch, Fensteraufmaß und Verträge mit Versionen.",
  },
  {
    titel: "Planung & Touren",
    text: "Einsätze entstehen automatisch aus dem Vertrag und landen in der Tour.",
  },
  {
    titel: "Mitarbeiter-App",
    text: "Heute-Ansicht, Checkliste, Fotos und Zeiterfassung – auch offline.",
  },
  {
    titel: "Materialprognose",
    text: "Housy weiß, wann der Reiniger leer ist, und schreibt die Einkaufsliste.",
  },
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-4xl flex-col gap-10 px-4 py-16">
      <header className="flex flex-col gap-4">
        <p className="text-muted-foreground text-sm font-medium tracking-wide uppercase">Housy</p>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Die schlanke Software für Gebäudereinigung, Hausmeister und Fensterreinigung.
        </h1>
        <p className="text-muted-foreground max-w-2xl text-lg">
          Von der Anfrage über Vertrag, Einsatz und Leistungsnachweis bis zur Monatsrechnung – mit
          Materialprognose statt Notfahrt zum Großhandel.
        </p>
        <div className="flex gap-3">
          <Button nativeButton={false} render={<Link href="/login" />}>
            Anmelden
          </Button>
        </div>
      </header>
      <section className="grid gap-4 sm:grid-cols-2">
        {punkte.map((p) => (
          <div key={p.titel} className="rounded-xl border p-5">
            <h2 className="font-medium">{p.titel}</h2>
            <p className="text-muted-foreground mt-1 text-sm">{p.text}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
