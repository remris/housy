import { readFileSync } from "node:fs";
import { join } from "node:path";
import { AFRelationship, PDFDocument, PDFHexString, PDFName, PDFString } from "pdf-lib";

/**
 * Macht aus dem Rechnungs-PDF eine ZUGFeRD-Rechnung (Profil XRECHNUNG): bettet das CII-XML als
 * „xrechnung.xml“ ein (AFRelationship Alternative), setzt PDF/A-3b-Metadaten (XMP mit
 * Factur-X-Erweiterung), sRGB-OutputIntent und Dokument-ID.
 * Hinweis: Volle PDF/A-Konformität (z. B. veraPDF) ist nicht automatisch geprüft; das XML prüft
 * der KoSIT-Validator.
 */
export const ZUGFERD_DATEI = "xrechnung.xml";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function xmp(p: { titel: string; autor: string; erstellt: string; produzent: string }) {
  return `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about="" xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/">
   <pdfaid:part>3</pdfaid:part>
   <pdfaid:conformance>B</pdfaid:conformance>
  </rdf:Description>
  <rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/">
   <dc:title><rdf:Alt><rdf:li xml:lang="x-default">${esc(p.titel)}</rdf:li></rdf:Alt></dc:title>
   <dc:creator><rdf:Seq><rdf:li>${esc(p.autor)}</rdf:li></rdf:Seq></dc:creator>
  </rdf:Description>
  <rdf:Description rdf:about="" xmlns:pdf="http://ns.adobe.com/pdf/1.3/">
   <pdf:Producer>${esc(p.produzent)}</pdf:Producer>
  </rdf:Description>
  <rdf:Description rdf:about="" xmlns:xmp="http://ns.adobe.com/xap/1.0/">
   <xmp:CreateDate>${p.erstellt}</xmp:CreateDate>
   <xmp:ModifyDate>${p.erstellt}</xmp:ModifyDate>
   <xmp:CreatorTool>Housy</xmp:CreatorTool>
  </rdf:Description>
  <rdf:Description rdf:about="" xmlns:fx="urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#">
   <fx:DocumentType>INVOICE</fx:DocumentType>
   <fx:DocumentFileName>${ZUGFERD_DATEI}</fx:DocumentFileName>
   <fx:Version>1.0</fx:Version>
   <fx:ConformanceLevel>XRECHNUNG</fx:ConformanceLevel>
  </rdf:Description>
  <rdf:Description rdf:about="" xmlns:pdfaExtension="http://www.aiim.org/pdfa/ns/extension/" xmlns:pdfaSchema="http://www.aiim.org/pdfa/ns/schema#" xmlns:pdfaProperty="http://www.aiim.org/pdfa/ns/property#">
   <pdfaExtension:schemas>
    <rdf:Bag>
     <rdf:li rdf:parseType="Resource">
      <pdfaSchema:schema>Factur-X PDFA Extension Schema</pdfaSchema:schema>
      <pdfaSchema:namespaceURI>urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#</pdfaSchema:namespaceURI>
      <pdfaSchema:prefix>fx</pdfaSchema:prefix>
      <pdfaSchema:property>
       <rdf:Seq>
        <rdf:li rdf:parseType="Resource"><pdfaProperty:name>DocumentFileName</pdfaProperty:name><pdfaProperty:valueType>Text</pdfaProperty:valueType><pdfaProperty:category>external</pdfaProperty:category><pdfaProperty:description>name of the embedded XML invoice file</pdfaProperty:description></rdf:li>
        <rdf:li rdf:parseType="Resource"><pdfaProperty:name>DocumentType</pdfaProperty:name><pdfaProperty:valueType>Text</pdfaProperty:valueType><pdfaProperty:category>external</pdfaProperty:category><pdfaProperty:description>INVOICE</pdfaProperty:description></rdf:li>
        <rdf:li rdf:parseType="Resource"><pdfaProperty:name>Version</pdfaProperty:name><pdfaProperty:valueType>Text</pdfaProperty:valueType><pdfaProperty:category>external</pdfaProperty:category><pdfaProperty:description>The actual version of the Factur-X XML schema</pdfaProperty:description></rdf:li>
        <rdf:li rdf:parseType="Resource"><pdfaProperty:name>ConformanceLevel</pdfaProperty:name><pdfaProperty:valueType>Text</pdfaProperty:valueType><pdfaProperty:category>external</pdfaProperty:category><pdfaProperty:description>The conformance level of the embedded Factur-X data</pdfaProperty:description></rdf:li>
       </rdf:Seq>
      </pdfaSchema:property>
     </rdf:li>
    </rdf:Bag>
   </pdfaExtension:schemas>
  </rdf:Description>
 </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}

let icc: Uint8Array | null = null;
const iccProfil = () =>
  (icc ??= readFileSync(join(process.cwd(), "src", "lib", "pdf", "schriften", "sRGB.icc")));

export async function zugferdEinbetten(
  pdf: Uint8Array,
  ciiXml: string,
  p: { titel: string; autor: string; nummer: string; datum: Date },
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdf, { updateMetadata: false });
  const erstellt = p.datum.toISOString().replace(/\.\d{3}Z$/, "Z");
  const produzent = "Housy (react-pdf, pdf-lib)";
  doc.setTitle(p.titel);
  doc.setAuthor(p.autor);
  doc.setProducer(produzent);
  doc.setCreator("Housy");
  doc.setCreationDate(p.datum);
  doc.setModificationDate(p.datum);

  await doc.attach(new TextEncoder().encode(ciiXml), ZUGFERD_DATEI, {
    mimeType: "text/xml",
    description: `E-Rechnung ${p.nummer} (XRechnung, CII)`,
    creationDate: p.datum,
    modificationDate: p.datum,
    afRelationship: AFRelationship.Alternative,
  });

  const ctx = doc.context;
  const metadaten = ctx.stream(xmp({ titel: p.titel, autor: p.autor, erstellt, produzent }), {
    Type: "Metadata",
    Subtype: "XML",
  });
  doc.catalog.set(PDFName.of("Metadata"), ctx.register(metadaten));

  const profil = ctx.stream(iccProfil(), { N: 3 });
  const intent = ctx.obj({
    Type: "OutputIntent",
    S: "GTS_PDFA1",
    OutputConditionIdentifier: PDFString.of("sRGB IEC61966-2.1"),
    Info: PDFString.of("sRGB IEC61966-2.1"),
    DestOutputProfile: ctx.register(profil),
  });
  doc.catalog.set(PDFName.of("OutputIntents"), ctx.obj([intent]));

  // stabile Dokument-ID aus der Rechnungsnummer
  const id = Array.from(new TextEncoder().encode(p.nummer.padEnd(16, "0").slice(0, 16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  ctx.trailerInfo.ID = ctx.obj([PDFHexString.of(id), PDFHexString.of(id)]);

  return doc.save({ useObjectStreams: false });
}
