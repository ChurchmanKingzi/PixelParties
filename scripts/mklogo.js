// ════════════════════════════════════════════════════════════════
//  PIXEL-PARTIES-SCHRIFTZUG — GENERATOR
//  Zeichnet den Wortmarken-Schriftzug des Hauptmenues (und des Logins)
//  Pixel fuer Pixel und schreibt zwei PNGs nach data/:
//
//    logo.png            das fertige Bild: dunkle Kontur, 3D-Kante nach
//                        unten, graustufige Buchstabenflaechen mit
//                        Lichtkante, Glanzstrichen und Funkelsternen.
//    logo-tint-mask.png  weisse Maske = alle Stellen, die die Spielerfarbe
//                        annehmen (Flaechen + 3D-Kante). Glanzlichter und
//                        Kontur sind ausgespart, sie bleiben weiss bzw.
//                        schwarz. style.css (`.pp-logo-tint`) legt darauf
//                        einen Spielerfarben-Verlauf mit `mix-blend-mode:
//                        multiply` — die Graustufen der Flaechen werden so
//                        zu hellen/dunklen Toenen DER Spielerfarbe.
//
//  Die Glyphen sind von Hand gesetzt (siehe GLYPHEN), aeussere Ecken
//  werden automatisch um einen Pixel abgerundet. Der Schriftzug steht auf
//  einem Bogen (BOGEN), die Mitte liegt oben. Alles wird im Raster
//  gerechnet und dann um SCALE vergroessert — die Datei traegt also
//  scharfe Bloecke, und die CSS-Hoehe (`.pp-logo-img`) ist ein
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

const SCALE = 4;       // Dateipixel je Rasterpixel
const CAP = 20;        // Versalhoehe im Raster
const GAP = 2;         // Abstand der Buchstaben innerhalb eines Worts
const WORD_GAP = 9;    // Abstand zwischen PIXEL und PARTIES
const DEPTH = 4;       // Tiefe der 3D-Kante nach unten
const RAND = 3;        // freier Rand rundum (Kontur + Luft fuer Funkeln)

// ── Glyphen (# = Flaeche). Staemme 5 breit, Balken 4 hoch. ──
const GLYPHEN = {
  P: [
    '#############.',
    '##############',
    '##############',
    '##############',
    '#####....#####',
    '#####....#####',
    '#####....#####',
    '#####....#####',
    '##############',
    '##############',
    '##############',
    '#############.',
    ...Array(8).fill('#####.........'),
  ],
  I: [
    ...Array(4).fill('###########'),
    ...Array(12).fill('...#####...'),
    ...Array(4).fill('###########'),
  ],
  X: [
    '#####.....#####',
    '#####.....#####',
    '#####.....#####',
    '.#####...#####.',
    '.#####...#####.',
    '..#####.#####..',
    '..###########..',
    '...#########...',
    '....#######....',
    '.....#####.....',
    '.....#####.....',
    '....#######....',
    '...#########...',
    '..###########..',
    '..#####.#####..',
    '.#####...#####.',
    '.#####...#####.',
    '#####.....#####',
    '#####.....#####',
    '#####.....#####',
  ],
  E: [
    ...Array(4).fill('############'),
    ...Array(4).fill('#####.......'),
    ...Array(4).fill('##########..'),
    ...Array(4).fill('#####.......'),
    ...Array(4).fill('############'),
  ],
  L: [
    ...Array(16).fill('#####.......'),
    ...Array(4).fill('############'),
  ],
  A: [
    '...########...',
    '..##########..',
    '.############.',
    '##############',
    '#####....#####',
    '#####....#####',
    '#####....#####',
    '#####....#####',
    '##############',
    '##############',
    '##############',
    '##############',
    ...Array(8).fill('#####....#####'),
  ],
  R: [
    '#############.',
    '##############',
    '##############',
    '##############',
    '#####....#####',
    '#####....#####',
    '#####....#####',
    '#####....#####',
    '##############',
    '##############',
    '##############',
    '############..',
    '#####...#####.',
    '#####...#####.',
    ...Array(6).fill('#####....#####'),
  ],
  T: [
    ...Array(4).fill('###############'),
    ...Array(16).fill('.....#####.....'),
  ],
  S: [
    '.#############',
    '##############',
    '##############',
    '##############',
    '#####.........',
    '#####.........',
    '#####.........',
    '#####.........',
    '##############',
    '##############',
    '##############',
    '##############',
    '.........#####',
    '.........#####',
    '.........#####',
    '.........#####',
    '##############',
    '##############',
    '##############',
    '#############.',
  ],
};

const WORTE = ['PIXEL', 'PARTIES'];

// Bogen: der ganze Schriftzug woelbt sich nach oben. Jeder Buchstabe
// sitzt auf einer Parabel ueber die GESAMTBREITE — die Mitte liegt oben,
// die aeusseren Buchstaben um BOGEN Rasterpixel tiefer. Verschoben wird
// je Buchstabe (nicht je Spalte), damit die Glyphen nicht verzerren.
const BOGEN = 7;

// Aeussere Ecken abrunden: ein Flaechenpixel, das in zwei senkrecht
// zueinander stehenden Richtungen frei liegt, faellt weg.
function abrunden(rows) {
  const h = rows.length, w = rows[0].length;
  const an = (x, y) => y >= 0 && y < h && x >= 0 && x < w && rows[y][x] === '#';
  return rows.map((r, y) => r.split('').map((c, x) => {
    if (c !== '#') return '.';
    const o = !an(x, y - 1), u = !an(x, y + 1), l = !an(x - 1, y), re = !an(x + 1, y);
    return ((o || u) && (l || re)) ? '.' : '#';
  }).join(''));
}

// ── Raster aufbauen ──
let breite = 0;
const platz = [];   // { g, x, y }
WORTE.forEach((wort, wi) => {
  if (wi > 0) breite += WORD_GAP - GAP;
  wort.split('').forEach((ch) => {
    const g = abrunden(GLYPHEN[ch]);
    platz.push({ g, x: breite, y: 0, ch });
    breite += g[0].length + GAP;
  });
});
breite -= GAP;
for (const p of platz) {
  const t = (p.x + p.g[0].length / 2 - breite / 2) / (breite / 2);   // -1 … 1
  p.y = Math.round(BOGEN * t * t);
}

const W = breite + RAND * 2 + 1;               // +1: Kontur rechts
const H = CAP + BOGEN + DEPTH + RAND * 2 + 1;
const neu = (v) => Array.from({ length: H }, () => new Array(W).fill(v));
const flaeche = neu(0);     // 1 = Buchstabenflaeche
const zeile = neu(-1);      // Zeile innerhalb des Buchstabens (fuer Baender)
for (const p of platz) {
  p.g.forEach((r, y) => r.split('').forEach((c, x) => {
    if (c !== '#') return;
    const X = p.x + x + RAND, Y = p.y + y + RAND;
    flaeche[Y][X] = 1; zeile[Y][X] = y;
  }));
}
const ist = (a, x, y) => y >= 0 && y < H && x >= 0 && x < W && a[y][x];

// 3D-Kante: die Flaeche nach unten geschoben, nur wo keine Flaeche liegt.
// `kante` haelt die Tiefe (1..DEPTH), die Schattierung haengt daran.
const kante = neu(0);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  if (flaeche[y][x]) continue;
  for (let d = 1; d <= DEPTH; d++) if (ist(flaeche, x, y - d)) { kante[y][x] = d; break; }
}
const koerper = neu(0);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) koerper[y][x] = (flaeche[y][x] || kante[y][x]) ? 1 : 0;

// Kontur: zwei Ringe um den Koerper (innen fast schwarz, aussen ein
// Hauch heller, damit sie auf dunklem Grund noch als Kante liest).
const kontur = neu(0);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  if (koerper[y][x]) continue;
  let best = 0;
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    if (Math.abs(dx) + Math.abs(dy) > 3) continue;
    if (!ist(koerper, x + dx, y + dy)) continue;
    const ring = Math.max(Math.abs(dx), Math.abs(dy)) <= 1 ? 1 : 2;
    best = best === 0 ? ring : Math.min(best, ring);
  }
  kontur[y][x] = best;
}

// ── Farben ──
// Pixel: { rgb, a, tint } — tint = true → Spielerfarbe (Maske).
const bild = neu(null);
const grau = (v) => [v, v, v];
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  if (flaeche[y][x]) {
    const r = zeile[y][x];
    // Drei Baender von oben nach unten, dazu Kanten.
    let v = r < 7 ? 255 : r < 13 ? 232 : 204;
    const obenFrei = !ist(flaeche, x, y - 1);
    const untenFrei = !ist(flaeche, x, y + 1);
    const linksFrei = !ist(flaeche, x - 1, y);
    const rechtsFrei = !ist(flaeche, x + 1, y);
    if (untenFrei) v = 160;
    else if (rechtsFrei) v = Math.min(v, 190);
    bild[y][x] = { rgb: grau(v), a: 255, tint: true };
    // Weisse Lichtkante nur an der AEUSSEREN Oberseite (Kappe des
    // Buchstabens), nicht an den Innenkanten der Punzen.
    if (obenFrei && r <= 3) bild[y][x] = { rgb: [255, 255, 255], a: 255, tint: false };
    else if (linksFrei && !untenFrei) bild[y][x] = { rgb: grau(Math.max(v, 244)), a: 255, tint: true };
  } else if (kante[y][x]) {
    const d = kante[y][x];
    const v = d <= 1 ? 128 : d <= 3 ? 100 : 74;
    bild[y][x] = { rgb: grau(v), a: 255, tint: true };
  } else if (kontur[y][x] === 1) {
    bild[y][x] = { rgb: [8, 5, 14], a: 255, tint: false };
  } else if (kontur[y][x] === 2) {
    bild[y][x] = { rgb: [24, 16, 36], a: 255, tint: false };
  }
}

// Glanzstriche: in der zweiten und dritten Zeile jedes Buchstabens ein
// kurzer weisser Strich nahe der linken Kante — der klassische
// „Lack"-Glanz von Pixel-Schriftzuegen.
const setzeGlanz = (X, Y, a) => {
  const px = bild[Y] && bild[Y][X];
  if (!px || !flaeche[Y][X]) return;
  bild[Y][X] = { rgb: [255, 255, 255], a, tint: false };
};
for (const p of platz) {
  const top = p.y + RAND;
  const erste = (r) => p.g[r].indexOf('#');
  const s1 = erste(1), s2 = erste(2);
  const X0 = p.x + RAND;
  for (let k = 1; k <= 3; k++) setzeGlanz(X0 + s1 + k, top + 1, 255);
  setzeGlanz(X0 + s2 + 1, top + 2, 255);
  // Senkrechter Glanz am linken Stamm, ein Stueck unter der Kappe.
  for (let r = 5; r <= 7; r++) {
    const s = erste(r);
    if (s >= 0 && p.g[r][s + 1] === '#') setzeGlanz(X0 + s + 1, top + r, 200);
  }
}

// Funkelsterne (4-strahlig) — weiss, ungetoent, ueber allem. Sie sitzen
// auf der Kontur an zwei Ecken des Schriftzugs, wie ein Lichtblitz auf
// einer lackierten Kante.
function stern(cx, cy, arm) {
  const pkt = [[0, 0, 255]];
  const alpha = [240, 170, 90];
  for (let k = 1; k <= arm; k++) {
    const a = alpha[k - 1];
    pkt.push([-k, 0, a], [k, 0, a], [0, -k, a], [0, k, a]);
  }
  for (const [dx, dy, a] of pkt) {
    const X = cx + dx, Y = cy + dy;
    if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
    const alt = bild[Y][X];
    // Auf leerem Grund halbdurchsichtig weiss; auf Kontur/Flaeche deckend
    // aufhellen, damit der Stern nicht „Loecher" in die Kontur schneidet.
    if (!alt) bild[Y][X] = { rgb: [255, 255, 255], a, tint: false };
    else {
      const t = a / 255;
      bild[Y][X] = { rgb: alt.rgb.map(v => Math.round(v * (1 - t) + 255 * t)), a: 255, tint: false };
    }
  }
}
{
  const P = platz[0], S = platz[platz.length - 1];
  stern(P.x + RAND, P.y + RAND, 3);
  stern(S.x + RAND + S.g[0].length - 1, S.y + RAND, 3);
}

// ── PNG schreiben ──
function crc32(b) { let c = ~0; for (let i = 0; i < b.length; i++) { c ^= b[i]; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); } return (~c) >>> 0; }
function chunk(t, d) { const l = Buffer.alloc(4); l.writeUInt32BE(d.length, 0); const tt = Buffer.from(t, 'ascii'); const cc = Buffer.alloc(4); cc.writeUInt32BE(crc32(Buffer.concat([tt, d])), 0); return Buffer.concat([l, tt, d, cc]); }
function png(pixel) {  // pixel(x, y) → [r, g, b, a] im Raster
  const PW = W * SCALE, PH = H * SCALE;
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
const logoPx = (x, y) => { const q = bild[y][x]; return q ? [...q.rgb, q.a] : [0, 0, 0, 0]; };
const maskPx = (x, y) => { const q = bild[y][x]; return q && q.tint ? [255, 255, 255, 255] : [0, 0, 0, 0]; };

fs.writeFileSync(path.join(OUT, 'logo.png'), png(logoPx));
fs.writeFileSync(path.join(OUT, 'logo-tint-mask.png'), png(maskPx));
console.log(`wrote data/logo.png + data/logo-tint-mask.png  (${W * SCALE}x${H * SCALE}, Raster ${W}x${H})`);

// ── Vorschau (nur zum Pruefen, nicht fuer das Spiel) ──
const vi = process.argv.indexOf('--preview');
if (vi > 0) {
  const ziel = process.argv[vi + 1];
  const hex = (process.argv[vi + 2] || '#00f0ff').replace('#', '');
  const farbe = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16));
  const bg = [14, 10, 24];
  const PAD = 6;
  const VW = W + PAD * 2, VH = H + PAD * 2;
  const vorschau = (x, y) => {
    x -= PAD; y -= PAD;
    const q = (x >= 0 && y >= 0 && x < W && y < H) ? bild[y][x] : null;
    if (!q) return [...bg, 255];
    let c = q.rgb;
    if (q.tint) {
      // derselbe Verlauf wie .pp-logo-tint (hell → Spielerfarbe), multipliziert
      const t = x / W;
      const hell = farbe.map(v => Math.round(v + (255 - v) * 0.35 * (1 - t)));
      c = c.map((v, i) => Math.round(v * hell[i] / 255));
    }
    const a = q.a / 255;
    return [...c.map((v, i) => Math.round(v * a + bg[i] * (1 - a))), 255];
  };
  const alt = { W, H };
  // png() rechnet mit W/H — kurz auf die Vorschaugroesse umbiegen.
  const PW = VW * SCALE, PH = VH * SCALE;
  const raw = Buffer.alloc((PW * 4 + 1) * PH); let p = 0;
  for (let y = 0; y < PH; y++) {
    raw[p++] = 0;
    for (let x = 0; x < PW; x++) {
      const [r, g, b, a] = vorschau((x / SCALE) | 0, (y / SCALE) | 0);
      raw[p++] = r; raw[p++] = g; raw[p++] = b; raw[p++] = a;
    }
  }
  const ih = Buffer.alloc(13); ih.writeUInt32BE(PW, 0); ih.writeUInt32BE(PH, 4); ih[8] = 8; ih[9] = 6;
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  fs.writeFileSync(ziel, Buffer.concat([sig, chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
  console.log(`preview → ${ziel} (${alt.W}x${alt.H})`);
}
