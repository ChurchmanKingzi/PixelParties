#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════
//  Motiv-Masken fürs Laufzeitladen (Umbra / Stained Rare)
//
//  Quelle:  data/subject-masks.json  (RLE je Karte, ~1 MB JSON mit Metadaten wie "src", "score", …)
//  Ausgabe: public/cardgen/masks.bin (nur Name, Größe, Lauflängen und die "lift"-Pixel der Regenkarten; Varints, ~250 KB)
//
//  Format (alles Little-Endian / Varints):
//    "PPM1" | varint Kartenzahl | je Karte:
//      varint Namenslänge | Name (UTF-8) | varint w | varint h | varint n | n Lauflängen (rle, beginnt mit Hintergrund) |
//      varint m | m Lauflängen (lift; m = 0 ohne Regenpixel)
//  Gelesen von public/rarity-fx.js (`PpRarityFx.loadMasks`). Aufruf: node scripts/build-masks.js [--pruefen]
//  (`--pruefen`: Exit 1, wenn die Ausgabe veraltet ist; scripts/build.js ruft ohne den Schalter auf.)
// ════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'data', 'subject-masks.json');
const OUT = path.join(__dirname, '..', 'public', 'cardgen', 'masks.bin');

function varint(out, v) { while (v >= 128) { out.push((v & 127) | 128); v = Math.floor(v / 128); } out.push(v); }

function encode() {
  const src = JSON.parse(fs.readFileSync(SRC, 'utf8'));
  const out = [0x50, 0x50, 0x4d, 0x31];
  const names = Object.keys(src.cards).sort();
  varint(out, names.length);
  for (const n of names) {
    const e = src.cards[n], nb = Buffer.from(n, 'utf8');
    varint(out, nb.length); for (const b of nb) out.push(b);
    varint(out, e.w); varint(out, e.h);
    varint(out, e.rle.length); for (const v of e.rle) varint(out, v);
    const lift = e.lift || [];
    varint(out, lift.length); for (const v of lift) varint(out, v);
  }
  return Buffer.from(out);
}

function build({ pruefen = false, quiet = false } = {}) {
  if (!fs.existsSync(SRC)) return false;
  const buf = encode();
  const alt = fs.existsSync(OUT) ? fs.readFileSync(OUT) : null;
  if (alt && alt.equals(buf)) { if (!quiet) console.log('[masks] up to date (' + buf.length + ' B)'); return true; }
  if (pruefen) return false;
  fs.writeFileSync(OUT, buf);
  if (!quiet) console.log('[masks] public/cardgen/masks.bin  ' + (buf.length / 1024).toFixed(0) + ' KB');
  return true;
}
module.exports = { build, encode };
if (require.main === module) { const ok = build({ pruefen: process.argv.includes('--pruefen') }); if (!ok) { console.error('[masks] masks.bin ist veraltet: node scripts/build-masks.js'); process.exit(1); } }
