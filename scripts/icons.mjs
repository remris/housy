// Erzeugt die App-Icons (PNG) ohne Bildbibliothek: dunkles Quadrat mit weißem „H“
// und Akzentstrich. Aufruf: node scripts/icons.mjs → public/icons/*.png
import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const CRC = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
const crc32 = (buf) => {
  let c = -1;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};
const chunk = (typ, daten) => {
  const laenge = Buffer.alloc(4);
  laenge.writeUInt32BE(daten.length);
  const td = Buffer.concat([Buffer.from(typ), daten]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([laenge, td, crc]);
};

function png(groesse, { rand = 0 } = {}) {
  const bg = [15, 23, 42]; // slate-900
  const fg = [255, 255, 255];
  const akzent = [56, 189, 248]; // sky-400
  const s = groesse;
  // Zeichenfläche (bei maskierbaren Icons kleiner, Sicherheitszone 80 %)
  const innen = s * (1 - 2 * rand);
  const ox = s * rand;
  const zeilen = [];
  for (let y = 0; y < s; y++) {
    const zeile = Buffer.alloc(1 + s * 3);
    for (let x = 0; x < s; x++) {
      const u = (x - ox) / innen;
      const v = (y - ox) / innen;
      let c = bg;
      const stamm = (u > 0.28 && u < 0.4) || (u > 0.6 && u < 0.72);
      if (v > 0.24 && v < 0.76 && stamm) c = fg;
      if (u > 0.28 && u < 0.72 && v > 0.45 && v < 0.55) c = fg;
      if (u > 0.28 && u < 0.72 && v > 0.82 && v < 0.86) c = akzent;
      zeile.set(c, 1 + x * 3);
    }
    zeilen.push(zeile);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(s, 0);
  ihdr.writeUInt32BE(s, 4);
  ihdr[8] = 8; // Bittiefe
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(Buffer.concat(zeilen), { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

mkdirSync("public/icons", { recursive: true });
writeFileSync("public/icons/icon-192.png", png(192));
writeFileSync("public/icons/icon-512.png", png(512));
writeFileSync("public/icons/maskable-512.png", png(512, { rand: 0.1 }));
writeFileSync("public/icons/apple-touch-icon.png", png(180));
console.log("Icons geschrieben: public/icons");
