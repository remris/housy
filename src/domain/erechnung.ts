/**
 * E-Rechnung nach EN 16931 im deutschen Profil XRechnung 3.0:
 * - XRechnung als UBL (Invoice bzw. CreditNote für Stornos)
 * - CII (UN/CEFACT Cross Industry Invoice) für das in ZUGFeRD eingebettete XML (Profil XRECHNUNG)
 * Kleinunternehmer: Steuerkategorie E mit Befreiungsgrund § 19 UStG.
 * Geprüft wird mit dem KoSIT-Validator (CI, `scripts/kosit.mjs`).
 */
import type { Iso } from "./datum";
import {
  EINHEIT_CODE,
  KLEINUNTERNEHMER_HINWEIS,
  type Rechnungsposition,
  type Summen,
} from "./rechnung";

export const XRECHNUNG_ID = "urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0";
export const PEPPOL_PROFIL = "urn:fdc:peppol.eu:2017:poacc:billing:01:1.0";

export type Partei = {
  name: string;
  strasse: string | null;
  plz: string | null;
  ort: string | null;
  land: string;
};

export type RechnungDokument = {
  art: "rechnung" | "storno";
  nummer: string;
  datum: Iso;
  faelligAm: Iso;
  leistungVon: Iso;
  leistungBis: Iso;
  /** Storno: die stornierte Rechnung */
  bezug: { nummer: string; datum: Iso } | null;
  verkaeufer: Partei & {
    steuernummer: string | null;
    ustId: string | null;
    email: string | null;
    telefon: string | null;
    kontakt: string | null;
    iban: string | null;
    bic: string | null;
    kontoinhaber: string | null;
  };
  kaeufer: Partei & {
    kundennummer: number;
    email: string | null;
    leitwegId: string | null;
    ustId: string | null;
    privat: boolean;
  };
  positionen: Rechnungsposition[];
  summen: Summen;
  kleinunternehmer: boolean;
  zahlungszielTage: number;
  hinweise: string[];
};

// ---------------------------------------------------------------------------
// Hilfen
// ---------------------------------------------------------------------------

export function xml(s: string | number): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Cent → "123.45" */
export const betrag = (cent: number) => (cent / 100).toFixed(2);
/** Menge ohne überflüssige Nachkommastellen, höchstens 4 */
export const mengeText = (m: number) => String(Math.round(m * 10_000) / 10_000);
const datum102 = (iso: Iso) => iso.replaceAll("-", "");

const kategorie = (doc: RechnungDokument, satz: number) =>
  doc.kleinunternehmer ? "E" : satz === 0 ? "Z" : "S";
const BEFREIUNG = "Kleinunternehmer gemäß § 19 UStG";

/** Wer die Rechnung bezahlt bzw. wohin: Leitweg-ID, sonst Kundennummer (BT-10 ist Pflicht). */
export const kaeuferReferenz = (doc: RechnungDokument) =>
  doc.kaeufer.leitwegId || `Kd-Nr. ${doc.kaeufer.kundennummer}`;

const zahlungsText = (doc: RechnungDokument) =>
  doc.art === "storno"
    ? `Gutschrift zur Rechnung ${doc.bezug?.nummer ?? ""}`
    : `Zahlbar ohne Abzug bis ${doc.faelligAm.split("-").reverse().join(".")} (${doc.zahlungszielTage} Tage)`;

/**
 * Prüft vor dem Festschreiben, ob alle Pflichtangaben für XRechnung/ZUGFeRD da sind
 * (EN 16931 und XRechnung-Regeln BR-DE-*). Leere Liste = in Ordnung.
 */
export function pruefeERechnung(doc: RechnungDokument): string[] {
  const v = doc.verkaeufer;
  const k = doc.kaeufer;
  const fehlt: string[] = [];
  if (!v.strasse || !v.plz || !v.ort) fehlt.push("Firmenadresse unvollständig (Straße, PLZ, Ort)");
  if (!v.email) fehlt.push("Firmen-E-Mail fehlt (Pflicht in der XRechnung)");
  if (!v.telefon) fehlt.push("Firmentelefon fehlt (Pflicht in der XRechnung)");
  if (!v.steuernummer && !v.ustId) fehlt.push("Steuernummer oder USt-IdNr. fehlt");
  if (doc.art === "rechnung" && !v.iban) fehlt.push("IBAN für die Zahlung fehlt");
  if (!k.plz || !k.ort) fehlt.push("Kundenadresse unvollständig (PLZ, Ort)");
  if (!k.email) fehlt.push("E-Mail des Kunden fehlt (Pflicht in der XRechnung)");
  if (doc.positionen.length === 0) fehlt.push("keine Positionen");
  return fehlt;
}

// ---------------------------------------------------------------------------
// XRechnung (UBL 2.1)
// ---------------------------------------------------------------------------

function ublPartei(
  p: RechnungDokument["verkaeufer"] | RechnungDokument["kaeufer"],
  verkaeufer: boolean,
  doc: RechnungDokument,
) {
  const v = verkaeufer ? (p as RechnungDokument["verkaeufer"]) : null;
  const zeilen: string[] = [];
  if (p.email) zeilen.push(`<cbc:EndpointID schemeID="EM">${xml(p.email)}</cbc:EndpointID>`);
  if (!verkaeufer) {
    zeilen.push(
      `<cac:PartyIdentification><cbc:ID>${xml(doc.kaeufer.kundennummer)}</cbc:ID></cac:PartyIdentification>`,
    );
  }
  zeilen.push(`<cac:PartyName><cbc:Name>${xml(p.name)}</cbc:Name></cac:PartyName>`);
  zeilen.push(
    `<cac:PostalAddress>${p.strasse ? `<cbc:StreetName>${xml(p.strasse)}</cbc:StreetName>` : ""}<cbc:CityName>${xml(p.ort ?? "")}</cbc:CityName><cbc:PostalZone>${xml(p.plz ?? "")}</cbc:PostalZone><cac:Country><cbc:IdentificationCode>${xml(p.land)}</cbc:IdentificationCode></cac:Country></cac:PostalAddress>`,
  );
  if (p.ustId) {
    zeilen.push(
      `<cac:PartyTaxScheme><cbc:CompanyID>${xml(p.ustId)}</cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>`,
    );
  }
  if (v?.steuernummer) {
    zeilen.push(
      `<cac:PartyTaxScheme><cbc:CompanyID>${xml(v.steuernummer)}</cbc:CompanyID><cac:TaxScheme><cbc:ID>FC</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>`,
    );
  }
  zeilen.push(
    `<cac:PartyLegalEntity><cbc:RegistrationName>${xml(p.name)}</cbc:RegistrationName></cac:PartyLegalEntity>`,
  );
  if (v) {
    zeilen.push(
      `<cac:Contact><cbc:Name>${xml(v.kontakt || v.name)}</cbc:Name>${v.telefon ? `<cbc:Telephone>${xml(v.telefon)}</cbc:Telephone>` : ""}${v.email ? `<cbc:ElectronicMail>${xml(v.email)}</cbc:ElectronicMail>` : ""}</cac:Contact>`,
    );
  }
  return `<cac:Party>${zeilen.join("")}</cac:Party>`;
}

function ublSteuer(doc: RechnungDokument, satz: number, zeile = false) {
  const kat = kategorie(doc, satz);
  // Befreiungsgrund nur im Steuerblock, nicht je Zeile (UBL-CR-Regeln)
  return `<cbc:ID>${kat}</cbc:ID><cbc:Percent>${mengeText(satz)}</cbc:Percent>${kat === "E" && !zeile ? `<cbc:TaxExemptionReason>${xml(BEFREIUNG)}</cbc:TaxExemptionReason>` : ""}<cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>`;
}

export function xrechnungUbl(doc: RechnungDokument): string {
  const gutschrift = doc.art === "storno";
  const root = gutschrift ? "CreditNote" : "Invoice";
  const zeile = gutschrift ? "CreditNoteLine" : "InvoiceLine";
  const menge = gutschrift ? "CreditedQuantity" : "InvoicedQuantity";
  const ns = gutschrift
    ? "urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2"
    : "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2";
  const s = doc.summen;
  const teile: string[] = [
    `<cbc:CustomizationID>${XRECHNUNG_ID}</cbc:CustomizationID>`,
    `<cbc:ProfileID>${PEPPOL_PROFIL}</cbc:ProfileID>`,
    `<cbc:ID>${xml(doc.nummer)}</cbc:ID>`,
    `<cbc:IssueDate>${doc.datum}</cbc:IssueDate>`,
    gutschrift ? "" : `<cbc:DueDate>${doc.faelligAm}</cbc:DueDate>`,
    gutschrift
      ? "<cbc:CreditNoteTypeCode>381</cbc:CreditNoteTypeCode>"
      : "<cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>",
    ...doc.hinweise.map((h) => `<cbc:Note>${xml(h)}</cbc:Note>`),
    "<cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>",
    `<cbc:BuyerReference>${xml(kaeuferReferenz(doc))}</cbc:BuyerReference>`,
    `<cac:InvoicePeriod><cbc:StartDate>${doc.leistungVon}</cbc:StartDate><cbc:EndDate>${doc.leistungBis}</cbc:EndDate></cac:InvoicePeriod>`,
    doc.bezug
      ? `<cac:BillingReference><cac:InvoiceDocumentReference><cbc:ID>${xml(doc.bezug.nummer)}</cbc:ID><cbc:IssueDate>${doc.bezug.datum}</cbc:IssueDate></cac:InvoiceDocumentReference></cac:BillingReference>`
      : "",
    `<cac:AccountingSupplierParty>${ublPartei(doc.verkaeufer, true, doc)}</cac:AccountingSupplierParty>`,
    `<cac:AccountingCustomerParty>${ublPartei(doc.kaeufer, false, doc)}</cac:AccountingCustomerParty>`,
    gutschrift || !doc.verkaeufer.iban
      ? "<cac:PaymentMeans><cbc:PaymentMeansCode>1</cbc:PaymentMeansCode></cac:PaymentMeans>"
      : `<cac:PaymentMeans><cbc:PaymentMeansCode>58</cbc:PaymentMeansCode><cbc:PaymentID>${xml(doc.nummer)}</cbc:PaymentID><cac:PayeeFinancialAccount><cbc:ID>${xml(doc.verkaeufer.iban.replace(/\s/g, ""))}</cbc:ID>${doc.verkaeufer.kontoinhaber ? `<cbc:Name>${xml(doc.verkaeufer.kontoinhaber)}</cbc:Name>` : ""}${doc.verkaeufer.bic ? `<cac:FinancialInstitutionBranch><cbc:ID>${xml(doc.verkaeufer.bic)}</cbc:ID></cac:FinancialInstitutionBranch>` : ""}</cac:PayeeFinancialAccount></cac:PaymentMeans>`,
    `<cac:PaymentTerms><cbc:Note>${xml(zahlungsText(doc))}</cbc:Note></cac:PaymentTerms>`,
    `<cac:TaxTotal><cbc:TaxAmount currencyID="EUR">${betrag(s.steuerCent)}</cbc:TaxAmount>${s.gruppen
      .map(
        (g) =>
          `<cac:TaxSubtotal><cbc:TaxableAmount currencyID="EUR">${betrag(g.nettoCent)}</cbc:TaxableAmount><cbc:TaxAmount currencyID="EUR">${betrag(g.steuerCent)}</cbc:TaxAmount><cac:TaxCategory>${ublSteuer(doc, g.satz)}</cac:TaxCategory></cac:TaxSubtotal>`,
      )
      .join("")}</cac:TaxTotal>`,
    `<cac:LegalMonetaryTotal><cbc:LineExtensionAmount currencyID="EUR">${betrag(s.nettoCent)}</cbc:LineExtensionAmount><cbc:TaxExclusiveAmount currencyID="EUR">${betrag(s.nettoCent)}</cbc:TaxExclusiveAmount><cbc:TaxInclusiveAmount currencyID="EUR">${betrag(s.bruttoCent)}</cbc:TaxInclusiveAmount><cbc:PayableAmount currencyID="EUR">${betrag(s.bruttoCent)}</cbc:PayableAmount></cac:LegalMonetaryTotal>`,
    ...doc.positionen.map(
      (p, i) =>
        `<cac:${zeile}><cbc:ID>${i + 1}</cbc:ID><cbc:${menge} unitCode="${EINHEIT_CODE[p.einheit]}">${mengeText(p.menge)}</cbc:${menge}><cbc:LineExtensionAmount currencyID="EUR">${betrag(p.nettoCent)}</cbc:LineExtensionAmount>${p.von && p.bis ? `<cac:InvoicePeriod><cbc:StartDate>${p.von}</cbc:StartDate><cbc:EndDate>${p.bis}</cbc:EndDate></cac:InvoicePeriod>` : ""}<cac:Item>${p.beschreibung ? `<cbc:Description>${xml(p.beschreibung)}</cbc:Description>` : ""}<cbc:Name>${xml(p.bezeichnung)}</cbc:Name><cac:ClassifiedTaxCategory>${ublSteuer(doc, doc.kleinunternehmer ? 0 : p.ustSatz, true)}</cac:ClassifiedTaxCategory></cac:Item><cac:Price><cbc:PriceAmount currencyID="EUR">${betrag(p.einzelpreisCent)}</cbc:PriceAmount></cac:Price></cac:${zeile}>`,
    ),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<ubl:${root} xmlns:ubl="${ns}" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">${teile.join("")}</ubl:${root}>\n`;
}

// ---------------------------------------------------------------------------
// CII (für ZUGFeRD, Profil XRECHNUNG)
// ---------------------------------------------------------------------------

const ciiDatum = (iso: Iso) =>
  `<udt:DateTimeString format="102">${datum102(iso)}</udt:DateTimeString>`;

function ciiAdresse(p: Partei) {
  return `<ram:PostalTradeAddress><ram:PostcodeCode>${xml(p.plz ?? "")}</ram:PostcodeCode>${p.strasse ? `<ram:LineOne>${xml(p.strasse)}</ram:LineOne>` : ""}<ram:CityName>${xml(p.ort ?? "")}</ram:CityName><ram:CountryID>${xml(p.land)}</ram:CountryID></ram:PostalTradeAddress>`;
}

export function zugferdCii(doc: RechnungDokument): string {
  const v = doc.verkaeufer;
  const k = doc.kaeufer;
  const s = doc.summen;
  const typ = doc.art === "storno" ? "381" : "380";
  const steuer = (satz: number) => {
    const kat = kategorie(doc, satz);
    return {
      kat,
      grund: kat === "E" ? `<ram:ExemptionReason>${xml(BEFREIUNG)}</ram:ExemptionReason>` : "",
    };
  };
  const zeilen = doc.positionen.map((p, i) => {
    const satz = doc.kleinunternehmer ? 0 : p.ustSatz;
    const { kat } = steuer(satz);
    return `<ram:IncludedSupplyChainTradeLineItem><ram:AssociatedDocumentLineDocument><ram:LineID>${i + 1}</ram:LineID></ram:AssociatedDocumentLineDocument><ram:SpecifiedTradeProduct><ram:Name>${xml(p.bezeichnung)}</ram:Name>${p.beschreibung ? `<ram:Description>${xml(p.beschreibung)}</ram:Description>` : ""}</ram:SpecifiedTradeProduct><ram:SpecifiedLineTradeAgreement><ram:NetPriceProductTradePrice><ram:ChargeAmount>${betrag(p.einzelpreisCent)}</ram:ChargeAmount></ram:NetPriceProductTradePrice></ram:SpecifiedLineTradeAgreement><ram:SpecifiedLineTradeDelivery><ram:BilledQuantity unitCode="${EINHEIT_CODE[p.einheit]}">${mengeText(p.menge)}</ram:BilledQuantity></ram:SpecifiedLineTradeDelivery><ram:SpecifiedLineTradeSettlement><ram:ApplicableTradeTax><ram:TypeCode>VAT</ram:TypeCode><ram:CategoryCode>${kat}</ram:CategoryCode><ram:RateApplicablePercent>${mengeText(satz)}</ram:RateApplicablePercent></ram:ApplicableTradeTax>${p.von && p.bis ? `<ram:BillingSpecifiedPeriod><ram:StartDateTime>${ciiDatum(p.von)}</ram:StartDateTime><ram:EndDateTime>${ciiDatum(p.bis)}</ram:EndDateTime></ram:BillingSpecifiedPeriod>` : ""}<ram:SpecifiedTradeSettlementLineMonetarySummation><ram:LineTotalAmount>${betrag(p.nettoCent)}</ram:LineTotalAmount></ram:SpecifiedTradeSettlementLineMonetarySummation></ram:SpecifiedLineTradeSettlement></ram:IncludedSupplyChainTradeLineItem>`;
  });
  const verkaeufer = `<ram:SellerTradeParty><ram:Name>${xml(v.name)}</ram:Name><ram:DefinedTradeContact><ram:PersonName>${xml(v.kontakt || v.name)}</ram:PersonName>${v.telefon ? `<ram:TelephoneUniversalCommunication><ram:CompleteNumber>${xml(v.telefon)}</ram:CompleteNumber></ram:TelephoneUniversalCommunication>` : ""}${v.email ? `<ram:EmailURIUniversalCommunication><ram:URIID>${xml(v.email)}</ram:URIID></ram:EmailURIUniversalCommunication>` : ""}</ram:DefinedTradeContact>${ciiAdresse(v)}${v.email ? `<ram:URIUniversalCommunication><ram:URIID schemeID="EM">${xml(v.email)}</ram:URIID></ram:URIUniversalCommunication>` : ""}${v.ustId ? `<ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">${xml(v.ustId)}</ram:ID></ram:SpecifiedTaxRegistration>` : ""}${v.steuernummer ? `<ram:SpecifiedTaxRegistration><ram:ID schemeID="FC">${xml(v.steuernummer)}</ram:ID></ram:SpecifiedTaxRegistration>` : ""}</ram:SellerTradeParty>`;
  const kaeufer = `<ram:BuyerTradeParty><ram:ID>${xml(k.kundennummer)}</ram:ID><ram:Name>${xml(k.name)}</ram:Name>${ciiAdresse(k)}${k.email ? `<ram:URIUniversalCommunication><ram:URIID schemeID="EM">${xml(k.email)}</ram:URIID></ram:URIUniversalCommunication>` : ""}${k.ustId ? `<ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">${xml(k.ustId)}</ram:ID></ram:SpecifiedTaxRegistration>` : ""}</ram:BuyerTradeParty>`;
  const zahlung =
    doc.art === "storno" || !v.iban
      ? "<ram:SpecifiedTradeSettlementPaymentMeans><ram:TypeCode>1</ram:TypeCode></ram:SpecifiedTradeSettlementPaymentMeans>"
      : `<ram:SpecifiedTradeSettlementPaymentMeans><ram:TypeCode>58</ram:TypeCode><ram:PayeePartyCreditorFinancialAccount><ram:IBANID>${xml(v.iban.replace(/\s/g, ""))}</ram:IBANID>${v.kontoinhaber ? `<ram:AccountName>${xml(v.kontoinhaber)}</ram:AccountName>` : ""}</ram:PayeePartyCreditorFinancialAccount>${v.bic ? `<ram:PayeeSpecifiedCreditorFinancialInstitution><ram:BICID>${xml(v.bic)}</ram:BICID></ram:PayeeSpecifiedCreditorFinancialInstitution>` : ""}</ram:SpecifiedTradeSettlementPaymentMeans>`;
  const steuern = s.gruppen
    .map((g) => {
      const { kat, grund } = steuer(g.satz);
      return `<ram:ApplicableTradeTax><ram:CalculatedAmount>${betrag(g.steuerCent)}</ram:CalculatedAmount><ram:TypeCode>VAT</ram:TypeCode>${grund}<ram:BasisAmount>${betrag(g.nettoCent)}</ram:BasisAmount><ram:CategoryCode>${kat}</ram:CategoryCode><ram:RateApplicablePercent>${mengeText(g.satz)}</ram:RateApplicablePercent></ram:ApplicableTradeTax>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100" xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100" xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100" xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100"><rsm:ExchangedDocumentContext><ram:BusinessProcessSpecifiedDocumentContextParameter><ram:ID>${PEPPOL_PROFIL}</ram:ID></ram:BusinessProcessSpecifiedDocumentContextParameter><ram:GuidelineSpecifiedDocumentContextParameter><ram:ID>${XRECHNUNG_ID}</ram:ID></ram:GuidelineSpecifiedDocumentContextParameter></rsm:ExchangedDocumentContext><rsm:ExchangedDocument><ram:ID>${xml(doc.nummer)}</ram:ID><ram:TypeCode>${typ}</ram:TypeCode><ram:IssueDateTime>${ciiDatum(doc.datum)}</ram:IssueDateTime>${doc.hinweise.map((h) => `<ram:IncludedNote><ram:Content>${xml(h)}</ram:Content></ram:IncludedNote>`).join("")}</rsm:ExchangedDocument><rsm:SupplyChainTradeTransaction>${zeilen.join("")}<ram:ApplicableHeaderTradeAgreement><ram:BuyerReference>${xml(kaeuferReferenz(doc))}</ram:BuyerReference>${verkaeufer}${kaeufer}</ram:ApplicableHeaderTradeAgreement><ram:ApplicableHeaderTradeDelivery/><ram:ApplicableHeaderTradeSettlement><ram:PaymentReference>${xml(doc.nummer)}</ram:PaymentReference><ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>${zahlung}${steuern}<ram:BillingSpecifiedPeriod><ram:StartDateTime>${ciiDatum(doc.leistungVon)}</ram:StartDateTime><ram:EndDateTime>${ciiDatum(doc.leistungBis)}</ram:EndDateTime></ram:BillingSpecifiedPeriod><ram:SpecifiedTradePaymentTerms><ram:Description>${xml(zahlungsText(doc))}</ram:Description>${doc.art === "storno" ? "" : `<ram:DueDateDateTime>${ciiDatum(doc.faelligAm)}</ram:DueDateDateTime>`}</ram:SpecifiedTradePaymentTerms><ram:SpecifiedTradeSettlementHeaderMonetarySummation><ram:LineTotalAmount>${betrag(s.nettoCent)}</ram:LineTotalAmount><ram:TaxBasisTotalAmount>${betrag(s.nettoCent)}</ram:TaxBasisTotalAmount><ram:TaxTotalAmount currencyID="EUR">${betrag(s.steuerCent)}</ram:TaxTotalAmount><ram:GrandTotalAmount>${betrag(s.bruttoCent)}</ram:GrandTotalAmount><ram:DuePayableAmount>${betrag(s.bruttoCent)}</ram:DuePayableAmount></ram:SpecifiedTradeSettlementHeaderMonetarySummation>${doc.bezug ? `<ram:InvoiceReferencedDocument><ram:IssuerAssignedID>${xml(doc.bezug.nummer)}</ram:IssuerAssignedID><ram:FormattedIssueDateTime><qdt:DateTimeString format="102">${datum102(doc.bezug.datum)}</qdt:DateTimeString></ram:FormattedIssueDateTime></ram:InvoiceReferencedDocument>` : ""}</ram:ApplicableHeaderTradeSettlement></rsm:SupplyChainTradeTransaction></rsm:CrossIndustryInvoice>
`;
}

/** Für Prüfungen: Kleinunternehmer-Hinweis gehört bei § 19 auf jede Rechnung. */
export const brauchtKleinunternehmerHinweis = (doc: RechnungDokument) =>
  doc.kleinunternehmer && !doc.hinweise.includes(KLEINUNTERNEHMER_HINWEIS);
