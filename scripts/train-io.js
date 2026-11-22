'use strict';
// ═══════════════════════════════════════════
//  PIXEL PARTIES — Lesehilfen für große Trainingsdateien
//
//  Die Sammel- und Trainingsskripte lasen Ausgabedateien bisher mit `fs.readFileSync(f, 'utf-8').split('\n')`. Eine Zeichenkette darf in Node
//  höchstens ~512 MB lang sein (`buffer.constants.MAX_STRING_LENGTH`); bei 37–113 KB je Partie ist das schon bei 5.000–14.000 Spielen je
//  Datei erreicht. Hier wird zeilenweise gelesen, ohne die Datei je als eine Zeichenkette zu halten. `.gz` (fertige Segmente, siehe
//  `train-all-decks.js --segment`) wird transparent entpackt.
// ═══════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const NL = 0x0a;

/** Ruft `fn(zeile)` für jede nichtleere Zeile auf (ohne den Zeilenumbruch). Wirft bei Lesefehlern — außer die Datei fehlt (dann: nichts). */
function forEachLine(file, fn) {
  const gz = file.endsWith('.gz');
  if (gz) {
    let buf;
    try { buf = zlib.gunzipSync(fs.readFileSync(file)); }
    catch (e) { if (e.code === 'ENOENT') return; throw e; }
    let start = 0;
    while (start < buf.length) {
      let end = buf.indexOf(NL, start);
      if (end < 0) end = buf.length;
      if (end > start) { const line = buf.toString('utf-8', start, end); if (line.trim()) fn(line); }
      start = end + 1;
    }
    return;
  }
  let fd;
  try { fd = fs.openSync(file, 'r'); }
  catch (e) { if (e.code === 'ENOENT') return; throw e; }
  try {
    const CH = 8 * 1024 * 1024;
    const chunk = Buffer.allocUnsafe(CH);
    let rest = Buffer.alloc(0);
    for (;;) {
      const n = fs.readSync(fd, chunk, 0, CH, null);
      if (n === 0) break;
      let buf = rest.length ? Buffer.concat([rest, chunk.subarray(0, n)]) : chunk.subarray(0, n);
      let start = 0;
      for (;;) {
        const end = buf.indexOf(NL, start);
        if (end < 0) break;
        if (end > start) { const line = buf.toString('utf-8', start, end); if (line.trim()) fn(line); }
        start = end + 1;
      }
      rest = Buffer.from(buf.subarray(start));          // Kopie: `chunk` wird gleich überschrieben
    }
    if (rest.length) { const line = rest.toString('utf-8'); if (line.trim()) fn(line); }
  } finally { fs.closeSync(fd); }
}

/** Anzahl der nichtleeren Zeilen (0, wenn die Datei fehlt). */
function countLines(file) {
  let n = 0;
  forEachLine(file, () => { n++; });
  return n;
}

/** Segmentdateien eines Ordners in Reihenfolge: `seg-0000.jsonl` oder `seg-0000.jsonl.gz`. */
function segmentFiles(dir) {
  let names;
  try { names = fs.readdirSync(dir); } catch { return []; }
  return names.filter(f => /^seg-\d+\.jsonl(\.gz)?$/.test(f)).sort().map(f => path.join(dir, f));
}

/** Eine Eingabe des Trainers → Dateiliste: ein Ordner (Segmente), sonst die Datei selbst. */
function expandInput(p) {
  try { if (fs.statSync(p).isDirectory()) return segmentFiles(p); } catch { /* fehlt */ }
  return [p];
}

/**
 * Wählt aus `total` Positionen genau `max` aus (mit festem Startwert, also wiederholbar). Zufällig statt „jedes k-te": die Rotation aus
 * Gegner und Sitz hat die Periode 2 × Gegnerzahl, ein festes Raster träfe sie und ließe ganze Matchups oder einen Sitz verschwinden.
 * Gibt ein `Uint8Array` (1 = behalten) zurück, oder `null`, wenn alles behalten wird.
 */
function thinMask(total, max, seed = 20260105) {
  if (!(max > 0) || total <= max) return null;
  let s = seed >>> 0;
  const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  const idx = new Uint32Array(total);
  for (let i = 0; i < total; i++) idx[i] = i;
  for (let i = 0; i < max; i++) {                          // Teil-Mischung: die ersten `max` Plätze genügen
    const j = i + Math.floor(rnd() * (total - i));
    const t = idx[i]; idx[i] = idx[j]; idx[j] = t;
  }
  const keep = new Uint8Array(total);
  for (let i = 0; i < max; i++) keep[idx[i]] = 1;
  return keep;
}

module.exports = { forEachLine, countLines, segmentFiles, expandInput, thinMask };
