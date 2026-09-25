// ════════════════════════════════════════════════════════════════
//  PIXEL-PARTIES-SCHRIFTZUG — GENERATOR
//  Zeichnet den Wortmarken-Schriftzug des Hauptmenues (und des Logins)
//  im Stil der Kartengrafiken und schreibt drei PNGs nach data/.
//
//  STIL (abgeschaut von den Karten, z. B. cards/3-Headed Giant.png):
//    • Schrift = die Kartentitel-Schrift „Pixel Intv" (data/Pixel Intv.otf),
//      Gross-/Kleinschreibung wie auf den Karten. Die Glyphen unten sind
//      aus der Schrift gerastert (7er-Raster, 2 Pixel breite Staemme) und
//      je Schriftpixel auf FS×FS Logopixel vergroessert.
//    • Keine weichen Verlaeufe: flache Farbflaechen, Uebergaenge mit
//      Schachbrett-Dithering (wie die Kartenrahmen).
//    • Kontur in einem DUNKLEN TON DER FLAECHENFARBE (wie das Weinrot um
//      die roten Kartenrahmen), aussen eine fast schwarze Kante.
//    • Helle Lichtkante oben, dunklerer Fuss unten, darunter eine
//      Schattenstufe (ein Schriftpixel tief).
//    • Der Schriftzug steht auf einem Bogen (BOGEN), die Mitte liegt oben.
//
//  DATEIEN — die Spielerfarbe kommt erst im Browser dazu:
//    logo.png             Grundbild (Graustufen + feste Farben). Auch ohne
//                         Einfaerbung lesbar.
//    logo-tint-mask.png   Flaechen, Fuss, Schattenstufe und Innenkontur.
//                         `.pp-logo-tint` legt dort die Spielerfarbe mit
//                         `mix-blend-mode: multiply` auf — die Graustufen
//                         werden zu den Toenen DER Spielerfarbe.
//    logo-licht-mask.png  Lichtkanten. `.pp-logo-licht` deckt sie mit einer
//                         aufgehellten Spielerfarbe ab (Multiplizieren kann
//                         nicht aufhellen, daher eine eigene Schicht).
//
//  Alles wird im Raster gerechnet und um SCALE vergroessert — die Dateien
//  tragen scharfe Bloecke; die CSS-Hoehe (`.pp-logo-img`) ist ein
//  Vielfaches der Rasterhoehe.
//
//  Aufruf:  node scripts/mklogo.js
//           node scripts/mklogo.js --preview out.png '#ff44cc'
//             (zusaetzlich eine eingefaerbte Vorschau auf dunklem Grund)
// ════════════════════════════════════════════════════════════════
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, '..', 'data');

const SCALE = 4;        // Dateipixel je Rasterpixel
const FS = 3;           // Rasterpixel je Schriftpixel
const ADV = 7;          // Vorschub je Zeichen in Schriftpixeln (6 + 1 Luft)
const SPACE = 4;        // Wortabstand in Schriftpixeln
const BOGEN = 12;       // Bogenhoehe in Rasterpixeln
const BAND_H = 13 * FS; // Hoehe des Titelbands (inkl. Rahmen)
const POLSTER = 3 * FS; // Luft links/rechts zwischen Schrift und Bandrand
const ENDE_L = 10 * FS; // Laenge der gefalteten Bandenden
const ENDE_TIEF = 2 * FS; // so viel tiefer haengen die Enden
const RAND = 2;

// ── Glyphen aus „Pixel Intv" (6×7 Schriftpixel, Grundlinie unten) ──
const GLYPHEN = {
  P: ['######', '##..##', '##..##', '##..##', '######', '##....', '##....'],
  i: ['..##..', '......', '.###..', '..##..', '..##..', '..##..', '######'],
  x: ['......', '......', '##..##', '.####.', '..##..', '.####.', '##..##'],
  e: ['......', '......', '######', '##..##', '######', '##....', '######'],
  l: ['.###..', '..##..', '..##..', '..##..', '..##..', '..##..', '######'],
  a: ['......', '......', '#####.', '...##.', '#####.', '##.##.', '######'],
  r: ['......', '......', '######', '.##.##', '.##...', '.##...', '.##...'],
  t: ['......', '.##...', '######', '.##...', '.##...', '.##...', '.#####'],
  s: ['......', '......', '######', '##....', '######', '....##', '######'],
};
const TEXT = 'Pixel Parties';

// ── Masse ──
let lauf = 0;
const zeichen = [];
for (const ch of TEXT) {
  if (ch === ' ') { lauf += SPACE; continue; }
  zeichen.push({ g: GLYPHEN[ch], fx: lauf });
  lauf += ADV;
}
const textB = (lauf - 1) * FS;                 // Textbreite im Raster
const bandB = textB + 2 * POLSTER + 8;         // + Rahmen (4 je Seite)
const W = bandB + 2 * (ENDE_L - 2 * FS) + RAND * 2;
const H = BAND_H + BOGEN + ENDE_TIEF + RAND * 2;
const bx0 = RAND + ENDE_L - 2 * FS, bx1 = bx0 + bandB - 1;
const cx = (bx0 + bx1) / 2, halb = (bx1 - bx0) / 2 + ENDE_L;
// Oberkante des Bands je Spalte: Parabel, Mitte oben (auch fuer die Enden).
const bogenY = (x) => RAND + Math.round(BOGEN * ((x - cx) / halb) ** 2);

const neu = (v) => Array.from({ length: H }, () => new Array(W).fill(v));
const ist = (a, x, y) => y >= 0 && y < H && x >= 0 && x < W && a[y][x];
const schach = (x, y) => (x + y) % 2 === 0;

// Formen: Hauptband und die beiden Enden (mit Kerbe aussen).
const band = neu(0), enden = neu(0);
for (let x = bx0; x <= bx1; x++) for (let y = bogenY(x); y < bogenY(x) + BAND_H; y++) band[y][x] = 1;
const endH = BAND_H - 2 * FS, kerbe = 5 * FS;
for (const seite of [-1, 1]) {
  const innen = seite < 0 ? bx0 + 2 * FS : bx1 - 2 * FS;   // unter dem Band versteckt
  for (let k = 0; k < ENDE_L + 2 * FS; k++) {
    const x = innen + seite * k;
    if (x < 0 || x >= W) continue;
    const top = bogenY(x) + ENDE_TIEF, mid = top + endH / 2;
    const aussen = ENDE_L + 2 * FS - 1 - k;         // Abstand zum aeusseren Ende
    for (let y = top; y < top + endH; y++) {
      if (aussen < kerbe && Math.abs(y + 0.5 - mid) < (kerbe - aussen) * (endH / 2) / kerbe) continue;
      enden[y][x] = 1;
    }
  }
}
// Chebyshev-Abstand zum Rand einer Form (0 = aeusserster Ring).
function randAbstand(form) {
  const e = neu(-1);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!form[y][x]) continue;
    let d = 0;
    outer: for (; d < 6; d++) {
      for (let dy = -d - 1; dy <= d + 1; dy++) for (let dx = -d - 1; dx <= d + 1; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== d + 1) continue;
        if (!ist(form, x + dx, y + dy)) break outer;
      }
    }
    e[y][x] = d;
  }
  return e;
}
// Liegt der naechste Rand oben/links (→ Lichtkante) oder unten/rechts?
const obenLinks = (form, x, y, d) => !ist(form, x, y - d - 1) || !ist(form, x - d - 1, y);

// ── Farben ──
//   { art: 'tint', g }   Graustufe, wird mit der Spielerfarbe multipliziert
//   { art: 'licht' }     Lichtkante, aufgehellte Spielerfarbe
//   { art: 'fest', rgb } feste Farbe (Aussenkante, Schrift)
const HELL = 228, FUSS = 186, SAUM = 150, DUNKEL = 78, ENDE = 172, ENDE_FUSS = 132;
const SCHWARZ = { art: 'fest', rgb: [10, 6, 18] };
const bild = neu(null);

// 1) Bandenden (hinten): Rahmen wie das Band, Flaeche dunkler, keine
//    Lichtkante — sie liegen im Schatten des Bands.
const eE = randAbstand(enden);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const d = eE[y][x];
  if (d < 0) continue;
  if (d === 0) bild[y][x] = SCHWARZ;
  else if (d <= 2) bild[y][x] = { art: 'tint', g: DUNKEL };
  else {
    const t = (y - bogenY(x) - ENDE_TIEF) / endH;
    const g = t > 0.7 ? ENDE_FUSS : t > 0.5 ? (schach(x, y) ? ENDE_FUSS : ENDE) : ENDE;
    bild[y][x] = { art: 'tint', g };
  }
}
// Faltschatten: wo das Ende unter dem Band hervorkommt, eine dunkle Kante.
for (let y = 0; y < H; y++) for (const x of [bx0 - 1, bx1 + 1]) {
  if (eE[y][x] > 0) bild[y][x] = { art: 'tint', g: DUNKEL };
  const x2 = x + (x < cx ? -1 : 1);
  if (eE[y][x2] > 2 && schach(x2, y)) bild[y][x2] = { art: 'tint', g: DUNKEL };
}

// 2) Hauptband: schwarze Aussenkante, 2 px dunkle Spielerfarbe, eine
//    Licht-/Schattenlinie (oben/links hell, unten/rechts dunkel), dann die
//    Flaeche mit gedithertem Licht oben und Fuss unten — wie die
//    Titelplatte einer Karte.
const eB = randAbstand(band);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const d = eB[y][x];
  if (d < 0) continue;
  if (d === 0) { bild[y][x] = SCHWARZ; continue; }
  if (d <= 2) { bild[y][x] = { art: 'tint', g: DUNKEL }; continue; }
  if (d === 3) { bild[y][x] = obenLinks(band, x, y, 3) ? { art: 'licht' } : { art: 'tint', g: SAUM }; continue; }
  const t = (y - bogenY(x) - 4) / (BAND_H - 8);
  let px = { art: 'tint', g: HELL };
  if (t < 0.1) px = schach(x, y) ? { art: 'licht' } : px;
  else if (t > 0.8) px = { art: 'tint', g: FUSS };
  else if (t > 0.62) px = { art: 'tint', g: schach(x, y) ? FUSS : HELL };
  bild[y][x] = px;
}

// 3) Schrift: weiss wie auf den Karten, mit 1-px-Kontur und hartem
//    Schatten in dunkler Spielerfarbe. Jeder Buchstabe folgt dem Bogen an seiner Mitte.
const schrift = neu(0), schatten = neu(0);
const textX0 = bx0 + 4 + POLSTER;
const textOben = Math.round((BAND_H - 7 * FS) / 2) - 1;
for (const z of zeichen) {
  const x0 = textX0 + z.fx * FS;
  const y0 = bogenY(x0 + 3 * FS) + textOben;
  z.g.forEach((r, gy) => r.split('').forEach((c, gx) => {
    if (c !== '#') return;
    for (let dy = 0; dy < FS; dy++) for (let dx = 0; dx < FS; dx++) {
      const X = x0 + gx * FS + dx, Y = y0 + gy * FS + dy;
      schrift[Y][X] = 1 + gy * FS + dy;   // Zeile im Buchstaben (1-basiert)
    }
  }));
}
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  if (schrift[y][x]) continue;
  // 1-px-Kontur rundum (Kontrast auch auf hellen Spielerfarben) plus ein
  // harter Schatten nach unten rechts.
  let kontur = false;
  for (let dy = -1; dy <= 1 && !kontur; dy++) for (let dx = -1; dx <= 1; dx++) if (ist(schrift, x + dx, y + dy)) { kontur = true; break; }
  if (kontur || ist(schrift, x - 1, y - 2) || ist(schrift, x, y - 2) || ist(schrift, x - 2, y - 2) || ist(schrift, x - 2, y - 1)) schatten[y][x] = 1;
}
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  if (schatten[y][x]) bild[y][x] = { art: 'tint', g: DUNKEL };
  const r = schrift[y][x];
  if (!r) continue;
  bild[y][x] = { art: 'fest', rgb: [255, 255, 255] };
}

// ── PNG schreiben ──
function crc32(b) { let c = ~0; for (let i = 0; i < b.length; i++) { c ^= b[i]; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); } return (~c) >>> 0; }
function chunk(t, d) { const l = Buffer.alloc(4); l.writeUInt32BE(d.length, 0); const tt = Buffer.from(t, 'ascii'); const cc = Buffer.alloc(4); cc.writeUInt32BE(crc32(Buffer.concat([tt, d])), 0); return Buffer.concat([l, tt, d, cc]); }
function png(RW, RH, pixel) {  // pixel(x, y) → [r, g, b, a] im Raster
  const PW = RW * SCALE, PH = RH * SCALE;
  const raw = Buffer.alloc((PW * 4 + 1) * PH); let p = 0;
  for (let y = 0; y < PH; y++) {
    raw[p++] = 0;
    for (let x = 0; x < PW; x++) {
      const [r, g, b, a] = pixel((x / SCALE) | 0, (y / SCALE) | 0);
      raw[p++] = r; raw[p++] = g; raw[p++] = b; raw[p++] = a;
    }
  }
  const ih = Buffer.alloc(13); ih.writeUInt32BE(PW, 0); ih.writeUInt32BE(PH, 4); ih[8] = 8; ih[9] = 6;
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([sig, chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
const LEER = [0, 0, 0, 0], WEISS = [255, 255, 255, 255];
const logoPx = (x, y) => {
  const q = bild[y][x];
  if (!q) return LEER;
  if (q.art === 'tint') return [q.g, q.g, q.g, 255];
  if (q.art === 'licht') return WEISS;
  return [...q.rgb, 255];
};
const tintPx = (x, y) => (bild[y][x] && bild[y][x].art === 'tint') ? WEISS : LEER;
const lichtPx = (x, y) => (bild[y][x] && bild[y][x].art === 'licht') ? WEISS : LEER;

fs.writeFileSync(path.join(OUT, 'logo.png'), png(W, H, logoPx));
fs.writeFileSync(path.join(OUT, 'logo-tint-mask.png'), png(W, H, tintPx));
fs.writeFileSync(path.join(OUT, 'logo-licht-mask.png'), png(W, H, lichtPx));
console.log(`wrote data/logo.png + logo-tint-mask.png + logo-licht-mask.png  (${W * SCALE}x${H * SCALE}, Raster ${W}x${H})`);

// ── Vorschau (nur zum Pruefen, nicht fuer das Spiel) ──
// Rechnet dieselben Schichten wie style.css: Multiplizieren mit der
// Spielerfarbe, Lichtkanten = Spielerfarbe 45 % mit Weiss gemischt.
const vi = process.argv.indexOf('--preview');
if (vi > 0) {
  const ziel = process.argv[vi + 1];
  const hex = (process.argv[vi + 2] || '#00f0ff').replace('#', '');
  const farbe = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16));
  const licht = farbe.map(v => Math.round(v * 0.45 + 255 * 0.55));
  const bg = [14, 10, 24];
  const PAD = 6;
  fs.writeFileSync(ziel, png(W + PAD * 2, H + PAD * 2, (x, y) => {
    x -= PAD; y -= PAD;
    const q = (x >= 0 && y >= 0 && x < W && y < H) ? bild[y][x] : null;
    if (!q) return [...bg, 255];
    if (q.art === 'tint') return [...farbe.map(v => Math.round(v * q.g / 255)), 255];
    if (q.art === 'licht') return [...licht, 255];
    return [...q.rgb, 255];
  }));
  console.log(`preview → ${ziel}`);
}
