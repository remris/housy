"use client";

import { Button } from "@/components/ui/button";

export function DruckenKnopf() {
  return <Button onClick={() => window.print()}>Drucken</Button>;
}
