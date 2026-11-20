import { NextResponse, type NextRequest } from "next/server";

/**
 * Ziel des Objekt-QR-Codes, wenn er mit der normalen Kamera gescannt wird: öffnet die App.
 * Der Check-in selbst passiert in der App (dort prüft der Scanner die Kennung gegen das Objekt).
 */
export function GET(request: NextRequest) {
  return NextResponse.redirect(new URL("/app", request.url));
}
