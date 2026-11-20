import Link from "next/link";
import type { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function AuthRahmen({
  titel,
  beschreibung,
  children,
  fuss,
}: {
  titel: string;
  beschreibung?: ReactNode;
  children: ReactNode;
  fuss?: ReactNode;
}) {
  return (
    <main className="bg-muted/40 flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="flex w-full max-w-md flex-col gap-6">
        <Link href="/" className="text-center text-xl font-semibold tracking-tight">
          Housy
        </Link>
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">{titel}</CardTitle>
            {beschreibung && <CardDescription>{beschreibung}</CardDescription>}
          </CardHeader>
          <CardContent>{children}</CardContent>
        </Card>
        {fuss && <div className="text-muted-foreground text-center text-sm">{fuss}</div>}
      </div>
    </main>
  );
}
