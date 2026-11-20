/** Prüft eine IBAN (Länge je Land für DE/AT/CH/NL/BE/LU/PL/FR, Prüfziffer mod 97). */
const LAENGEN: Record<string, number> = {
  DE: 22,
  AT: 20,
  CH: 21,
  NL: 18,
  BE: 16,
  LU: 20,
  PL: 28,
  FR: 27,
};

export function normalisiereIban(iban: string): string {
  return iban.replace(/\s+/g, "").toUpperCase();
}

export function pruefeIban(eingabe: string): boolean {
  const iban = normalisiereIban(eingabe);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(iban)) return false;
  const laenge = LAENGEN[iban.slice(0, 2)];
  if (laenge !== undefined && iban.length !== laenge) return false;
  const umgestellt = iban.slice(4) + iban.slice(0, 4);
  let rest = 0;
  for (const zeichen of umgestellt) {
    const ziffern = /\d/.test(zeichen) ? zeichen : String(zeichen.charCodeAt(0) - 55);
    for (const z of ziffern) rest = (rest * 10 + Number(z)) % 97;
  }
  return rest === 1;
}

/** Formatiert in Vierergruppen: DE89 3704 0044 0532 0130 00 */
export function formatiereIban(iban: string): string {
  return normalisiereIban(iban)
    .replace(/(.{4})/g, "$1 ")
    .trim();
}
