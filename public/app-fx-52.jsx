// app-fx-52: PFEILSALVE — Angriff eines Helden mit angeketteten „Arrow“-Artefakten: eine Salve aller geschossenen Pfeile statt der Standard-Angriffsanimation (Pixelart-Leinwand)
//
// ═════════════════════════════════════════════════════════════════
//  Vorlage: Prototyp „Pfeil-Salve“ (Zeichenroutinen `PfeilFx`, hier 1:1 übernommen und für das Spiel angepasst).
//  ABLAUF: Die Engine (`cards/effects/_arrows-shared.js`, `pfeilSalve`) meldet vor dem HP-Abzug `play_arrow_salvo` (Pfeile in Kettenreihenfolge, reeller Schaden am Ziel, Status je Pfeil,
//  Status/HP vorher) und wartet die Salvendauer (1,55 s) ab, bevor sie die HP abzieht. Der Client (app-board.jsx, `onArrowSalvo`) ruft `window.ppFx52Salve(payload, { myIdx })`:
//    • Sammeln am Angreifer (0,26 s) → Bogenflug aller Pfeile (Wolke, nicht Reihe) → Einschläge am Ziel; je Pfeil Schadenszahl, HP-Balken und Status-Symbol zählen BEIM Einschlag mit.
//    • Schadensverteilung: je Pfeil Math.round(reell / Anzahl), der LETZTE Pfeil trägt den Rest (Summe stimmt exakt). Reeller Schaden 0 (Hydra Blood Arrow): alle Teilbeträge 0, angezeigt wird EINE
//      gedämpfte „0“ beim letzten Einschlag (statt einer Null-Wand); Gift-Einschläge und Stapelzahl laufen trotzdem.
//    • Status-Anzeige (Burn-Flamme, Poison-Tropfen „x12“) erscheint erst beim Einschlag des jeweiligen Pfeils; der echte Zustand folgt nach der Salve (die Engine zieht erst dann die HP ab und wendet
//      die Status an). Die Standard-Anzeigen des Spiels, die dabei aus dem Zustandsvergleich entstehen (Schadenszahl, rotes Zonenblitzen, Flammenschlag des Brandes), werden für genau diesen
//      Treffer geschluckt (`ppFx52Schlucken`/`ppFx52Geschluckt`).
//    • Fällt die Salve aus (Animationen aus, Retro, `__ppFxAlt`, reduzierte Bewegung, Zone nicht gefunden), liefert `ppFx52Salve` false zurück: der Aufrufer spielt dann die mitgeschickten
//      Standard-Animationen (`ersatz`) ab — „sonst läuft alles unverändert“.
//  GRÖSSE: Pfeilgröße RELATIV zur Heldenkarte wie im Prototyp (dort 1 Art-Pixel = 1 Rasterzelle, Kartenhöhe ≈ 36–43 Zellen): Rasterzelle S = clamp(round(Zonenhöhe / 36), 2, 6).
//  TECHNIK: eine Leinwand in der Weltschicht (`ppFxWeltSchicht`, Feldkoordinaten wie Feuerball), 30 Hz auf `ppTaktRaf`, nur bei neuem Bild zeichnen, Schmutzrechteck, Bayer-Dither statt Alpha, Palette über
//  `ppSnapRgb`, 32 vorgedrehte Pfeil-Ausrichtungen einmalig (Aufwärmen im Leerlauf), `data-pp-px="aus"`, ab 9 Pfeilen Detailstufe `lod`, Handy: `ppFxN`-Skalierung der Teilchen.
//  Wiederverwendbare Bausteine: `window.PpFx52.hpBar(m, cx, y, w, frac, num, flash)`, `window.PpFx52.statusIcon(m, 'burn'|'poison', x, y)`, `window.PpFx52.glyph(m, text, x, y, sc, fill, shadow, outline)`.
//  Test: `window.__ppFx52Aus = true` schaltet die Salve ab; `window.__ppFx52Messen = true` → `window.__ppFx52Zeiten` = Zeichenzeit je Bild (ms).
// ═════════════════════════════════════════════════════════════════
(function (root) {
  const FX = {};
  const memo = new Map();
  const TAKT = 30;
  const fl = (x) => Math.floor(x * TAKT + 1e-4);
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOut = (t) => 1 - Math.pow(1 - clamp(t), 3);
  const rd = Math.round;
  function H(a, b) {
    let h = Math.imul((a | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b | 0) + 0x7f4a7c15, 0xc2b2ae35);
    h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  }
  FX.H = H;
  // ── Palette: jede Farbe ist eine Palettenfarbe (Einrasten auf die 256 Farben, `ppSnapRgb` aus public/palette.js) ──
  function snap(hex) {
    if (memo.has(hex)) return memo.get(hex);
    const h = hex.replace('#', ''), r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    let c = [r, g, b];
    try { if (root.ppSnapRgb) { const q = root.ppSnapRgb(r, g, b); if (q && q.length >= 3) c = [q[0], q[1], q[2]]; } } catch (e) { /* ungerastet */ }
    memo.set(hex, c); return c;
  }
  FX.snap = snap;
  const C = {};
  const CN = {
    tinte: '#12101f', nacht: '#08060c', creme: '#fffbd2', weiss: '#ffffff', hell: '#d2d2db', grau: '#9aa3b6', mittel: '#686868', asche: '#59606e', rauch: '#3e3e51', dunkelgrau: '#282834',
    gelb: '#ffe23d', org: '#ff9a1a', rot: '#fe5154', rotD: '#c0141c', dunkel: '#8b0d0d', blut: '#520a0c',
    braun: '#9d612f', braunH: '#ca874e', holz: '#7d3911', holzH: '#ad6100', holzD: '#1f0f04', sand: '#e0c085',
    gruen: '#1aff73', gruenM: '#20ac37', gruenH: '#66ff71', gruenD: '#167927', gruenDD: '#18300a', gift: '#4ceb70',
    lila: '#7e41ba', lilaD: '#47117e', lilaDD: '#2e0a51',
    gold: '#ffb91a', goldH: '#ffe469', goldD: '#a87c00', goldM: '#f8ca21',
    bombe: '#222222', bombeH: '#535353', glutG: '#ffeb1a', glutD: '#c79e05',
    rbR: '#ef2929', rbO: '#ff8b1a', rbY: '#ffeb1a', rbG: '#20ac37', rbC: '#08d3ef', rbB: '#4580f6', rbP: '#702db3',
    zahl: '#ff1a1a', zahlD: '#8b0d0d', bluD: '#780000', blauK: '#4580f6', blauH: '#b3d8f9', bluR: '#c80000', bluH: '#fe5154', blau: '#3866f0', rosa: '#f8b4df',
  };
  const LET = { // Buchstaben der Sprite-Zeilen → Farbname
    v: 'blauK', V: 'blauH',
    K: 'tinte', k: 'dunkelgrau', g: 'mittel', l: 'hell', w: 'creme', W: 'weiss', D: 'holzD', S: 'holz', s: 'holzH',
    R: 'blut', r: 'rotD', o: 'org', y: 'gelb', c: 'creme', G: 'gruenDD', h: 'gruenD', H: 'gruenM', E: 'gruen', e: 'gruenM', P: 'lilaDD', p: 'lila',
    a: 'gold', A: 'goldH', Q: 'goldD', m: 'goldM', b: 'bombe', B: 'bombeH', j: 'glutG', J: 'glutD', '1': 'rbR', '2': 'rbO', '3': 'rbY', '4': 'rbG', '5': 'rbC', '6': 'rbB', '7': 'rbP', x: 'blut', z: 'rot', u: 'grau',
  };

  // ── Rastermaler (RGBA-Puffer, Schmutzrechteck) ──
  const BAY = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
  function maler(buf, gw, gh) {
    const d = { x0: gw, y0: gh, x1: 0, y1: 0 };
    const px = (x, y, c) => {
      if (x < 0 || y < 0 || x >= gw || y >= gh) return;
      if (x < d.x0) d.x0 = x; if (y < d.y0) d.y0 = y; if (x + 1 > d.x1) d.x1 = x + 1; if (y + 1 > d.y1) d.y1 = y + 1;
      const i = (y * gw + x) * 4; buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2]; buf[i + 3] = 255;
    };
    const rect = (x, y, w, h, c) => {
      let x0 = x, y0 = y, x1 = x + w, y1 = y + h;
      if (x0 < 0) x0 = 0; if (y0 < 0) y0 = 0; if (x1 > gw) x1 = gw; if (y1 > gh) y1 = gh;
      if (x0 >= x1 || y0 >= y1) return;
      if (x0 < d.x0) d.x0 = x0; if (y0 < d.y0) d.y0 = y0; if (x1 > d.x1) d.x1 = x1; if (y1 > d.y1) d.y1 = y1;
      const r = c[0], g = c[1], b = c[2];
      for (let j = y0; j < y1; j++) { let i = (j * gw + x0) * 4; for (let q = x0; q < x1; q++, i += 4) { buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = 255; } }
    };
    const disc = (X, Y, r, c) => { for (let yy = -r; yy <= r; yy++) { const xr = rd(Math.sqrt(Math.max(0, r * r + r * 0.6 - yy * yy))); rect(X - xr, Y + yy, 2 * xr + 1, 1, c); } };
    const linie = (x0, y0, x1, y1, th, c) => {
      x0 = rd(x0); y0 = rd(y0); x1 = rd(x1); y1 = rd(y1);
      const o = Math.floor(th / 2); x0 -= o; y0 -= o; x1 -= o; y1 -= o;
      const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let err = dx + dy;
      for (let n = 0; n < 400; n++) { rect(x0, y0, th, th, c); if (x0 === x1 && y0 === y1) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; } }
    };
    /** Ellipsenring (Bresenham-artig über Winkelschritte), ry = rx * flat; dither = jede zweite Zelle */
    const ell = (cx, cy, rx, ry, th, c, dither) => {
      const n = Math.max(12, rd(Math.max(rx, ry) * 5)); let lx = 1e9, ly = 1e9;
      for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2, x = rd(cx + Math.cos(a) * rx), y = rd(cy + Math.sin(a) * ry); if (x === lx && y === ly) continue; lx = x; ly = y; if (dither && ((x + y) & 1)) continue; rect(x, y, th, th, c); }
    };
    const ring = (cx, cy, r, th, c, dither) => ell(cx, cy, r, r, th, c, dither);
    /** gefüllte Ellipse als Bayer-Dither (level 0..16 Zellen von 16) */
    const dith = (cx, cy, rx, ry, level, c, hole) => {
      const x0 = Math.floor(cx - rx), x1 = Math.ceil(cx + rx), y0 = Math.floor(cy - ry), y1 = Math.ceil(cy + ry);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const a = (x - cx) / rx, b = (y - cy) / ry, q = a * a + b * b; if (q > 1 || (hole && q < hole * hole)) continue;
        if (BAY[y & 3][x & 3] < level) px(x, y, c);
      }
    };
    return { px, rect, disc, linie, ring, ell, dith, d };
  }
  FX.maler = maler;

  // ── Pixelziffern 5×7 (wie im Trailer) ──
  const GLYPH = { '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'], '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
    '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'], '3': ['#####', '...#.', '..#..', '...#.', '....#', '#...#', '.###.'],
    '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'], '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
    '6': ['.###.', '#....', '#....', '####.', '#...#', '#...#', '.###.'], '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
    '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'], '9': ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
    '-': ['.....', '.....', '.....', '#####', '.....', '.....', '.....'], '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'], 'x': ['.....', '.....', '#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
    'H': ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'], 'P': ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'], '/': ['....#', '....#', '...#.', '..#..', '.#...', '#....', '#....'],
    '=': ['.....', '.....', '#####', '.....', '#####', '.....', '.....'], ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'] };
  /** Ziffernfolge mit Kontur (Tinte), Schatten, Füllung; (x,y) = obere linke Ecke der Füllung; sc = Zellen je Schriftpixel */
  const GLYPH_ZEILEN = new Map();
  function glyph(m, str, x, y, sc, fill, shadow, outline) {
    let rows = GLYPH_ZEILEN.get(str);                                       // Pixelliste je Zeichenfolge einmalig (keine Allokation je Bild)
    if (!rows) {
      rows = [];
      [...str].forEach((ch, k) => { const g = GLYPH[ch]; if (g) g.forEach((row, yy) => [...row].forEach((v, xx) => { if (v === '#') rows.push([k * 6 + xx, yy]); })); });
      if (GLYPH_ZEILEN.size > 400) GLYPH_ZEILEN.clear();
      GLYPH_ZEILEN.set(str, rows);
    }
    const bits = (ox, oy, c) => { for (const [gx, gy] of rows) m.rect(x + (gx + ox) * sc, y + (gy + oy) * sc, sc, sc, c); };
    if (outline) for (const [dx, dy] of [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1], [2, 1], [2, 2], [1, 2], [0, 2]]) bits(dx, dy, outline);
    if (shadow) bits(1, 1, shadow);
    bits(0, 0, fill);
    return str.length * 6 * sc - sc;   // Breite
  }
  FX.glyph = glyph;
  FX.glyphW = (str, sc) => str.length * 6 * sc - sc;

  // ═════════ Pfeil-Sprites (aus den Card Arts nachgezeichnet, Spitze nach rechts) ═════════
  // Schichten: [x, y, Zeilen]; '.' = leer. Farben über LET. tip = Spitzenpunkt, tail = Befiederung (Zellen im Sprite).
  const SHAFT = (len, cy, mid) => [0, cy - 1, ['D'.repeat(len), (mid || 'SSsssssSSS'.padEnd(len, 's')).slice(0, len), 'D'.repeat(len)]];
  const ARTS = {
    // Poisoned Arrow: dunkelgrüne Befiederung, Holzschaft, schwarz-graue Spitze mit lila Stich
    poison: { h: 7, glow: 'gruen', ol: 'gruenM', layers: [
      [0, 1, ['GGGGG', 'GhhhG', 'GGGGG', 'GhhhG', 'GGGGG']], [5, 2, ['DDDDDDDDDD', 'SSsssssSSS', 'DDDDDDDDDD']],
      [15, 0, ['K......', 'KKK....', 'KkgKK..', 'KkggKPp', 'KkgKK..', 'KKK....', 'K......']]] },
    // Flame Arrow: rotes Gefieder, dunkelrot-brauner Schaft, vorn die Flamme (dynamisch)
    flame: { h: 7, glow: 'org', ol: 'tinte', layers: [
      [0, 1, ['.rrrr', 'rrzrr', 'rzzzr', 'rrzrr', '.rrrr']], [5, 2, ['RRRRRRRR', 'rrrzrrrr', 'RRRRRRRR']], [13, 2, ['.KK', 'KkK', '.KK']]] },
    // Bomb Arrow: gelber Funkenfächer hinten, Schaft, schwarze Bombenkugel als Spitze
    bomb: { h: 9, glow: 'glutG', ol: 'glutD', layers: [
      [0, 0, ['j....', '.jj..', 'jjjj.', 'cjjjj', 'ccjjj', 'cjjjj', 'jjjj.', '.jj..', 'j....']], [5, 3, ['DDDDDDDDD', 'SSsssssSS', 'DDDDDDDDD']],
      [14, 0, ['..KKKKK..', '.KbbbbbK.', 'KbbbbBBbK', 'KbbbbbBBK', 'KbbbbbbbK', 'KbbbbbbbK', 'KbbbbbbbK', '.KbbbbbK.', '..KKKKK..']]] },
    // Hydra Blood Arrow: schwarzes Gefieder, dunkler Schaft, graue Spitze mit Blut und grünem Gift (tropft)
    hydra: { h: 9, glow: 'gruenD', ol: 'gruenM', layers: [
      [0, 2, ['.kkkkk', 'kkKkkk', 'kkkkkk', 'kkKkkk', '.kkkkk']], [6, 3, ['DDDDDDDDD', 'SSssssSSS', 'DDDDDDDDD']],
      [15, 1, ['.......', '.KKK...', 'RkgkKK.', 'RkgggkE', 'RkgkKKe', '.KKK.E.', '.....E.', '.....e.']]] },
    // Angelfeather Arrow: großer weißer Federschwung über dem Schaft, graue Unterseite, dunkle Spitze
    angel: { h: 9, glow: 'weiss', ol: 'tinte', layers: [
      [0, 3, ['DDDDDDDDDDDDDDDDDDDDDDDD', 'DSSssssSSSSDDDDDDDDDDDDD', 'DDDDDDDDDDDDDDDDDDDDDDDD']],
      [0, 0, ['......wwwWWWWw.........', '....wWWWWWWWWWWw.......', '..wWWWWWWWWWWWWWWl.....', '.wWWWWWWWWWWWWWlllu....', 'wWWWWWWWWWWWWWlllluug..', '.wWWWWWWWWWWlllluuggg..', '..wWWWWWWlllluuuggg....', '....wwwwllluuugg.......']],
      [22, 1, ['K......', 'KKK....', 'KkgKK..', 'KkggkKK', 'KkgKK..', 'KKK....', 'K......']]] },
    // Rainbow's Arrow: Regenbogen-Fächer als Gefieder, schwarze Spitze
    rainbow: { h: 7, glow: 'weiss', ol: 'hell', layers: [
      [0, 0, ['11111', '22222', '33333', '44444', '55555', '66666', '77777']], [5, 2, ['DDDDDDDDDD', 'SSsssssSSS', 'DDDDDDDDDD']],
      [15, 0, ['K......', 'KKK....', 'KkgKK..', 'KkggkKK', 'KkgKK..', 'KKK....', 'K......']]] },
    // Golden Arrow: goldgelber Pfeil mit hellen Schwungfedern und Glitzer
    golden: { h: 9, glow: 'goldH', ol: 'goldD', layers: [
      [0, 0, ['A.....', 'AAa...', '.AAAa.', 'AAAAAa', 'aaAAAA', 'AAAAAa', '.AAAa.', 'AAa...', 'A.....']],
      [6, 3, ['QQQQQQQQQQQQ', 'aAAmAAAmAAAm', 'QQQQQQQQQQQQ']], [18, 1, ['Q......', 'QaQ....', 'QAaQQ..', 'QAAAaQA', 'QAaQQ..', 'QaQ....', 'Q......']]] },
    // Racket Arrow: goldene Glocke/Trichter als Spitze
    racket: { h: 9, glow: 'gold', ol: 'tinte', layers: [] },
    // Holzpfeil (Archer, Card Art: Holzbogen, blaue Spitzen): cremefarbene Federn, Holzschaft, blaue Stahlspitze
    holz: { h: 7, glow: 'hell', ol: 'tinte', layers: [
      [0, 1, ['.wwww', 'wwlww', 'wwwww', 'wwlww', '.wwww']], [5, 2, ['DDDDDDDDDD', 'SSsssssSSS', 'DDDDDDDDDD']],
      [15, 0, ['v......', 'vvv....', 'vVVvv..', 'vVVVvvv', 'vVVvv..', 'vvv....', 'v......']]] },
  };
  // Trichter der Racket-Pfeil-Spitze (Glocke, nach vorn aufgeweitet) programmatisch
  (function () {
    const rows = []; for (let r = 0; r < 9; r++) rows.push('.'.repeat(9).split(''));
    for (let c = 0; c < 9; c++) {
      const hh = Math.min(4, Math.round(0.5 + c * 0.5));
      for (let r = 4 - hh; r <= 4 + hh; r++) rows[r][c] = r === 4 - hh ? 'A' : (r === 4 + hh ? 'Q' : (r > 4 ? 'm' : 'a'));
    }
    for (let r = 1; r <= 7; r++) rows[r][8] = 'A'; rows[0][8] = 'A'; rows[8][8] = 'Q';
    for (let r = 3; r <= 5; r++) rows[r][7] = 'K'; rows[4][6] = 'K';
    ARTS.racket.layers = [[0, 3, ['DDDDDDDDD', 'SSsssssSS', 'DDDDDDDDD']], [9, 0, rows.map((r) => r.join(''))]];
  })();
  const GOLD = [];   // feste Gold-Palette des Spielgestalters (data/palette-fest.json): hell, orange, dunkelorange, Kontur, Glanz
  const KINDS = ['angel', 'bomb', 'flame', 'golden', 'hydra', 'poison', 'racket', 'rainbow', 'holz'];
  FX.KINDS = KINDS;
  FX.NAMES = { angel: 'Angelfeather Arrow', bomb: 'Bomb Arrow', flame: 'Flame Arrow', golden: 'Golden Arrow', hydra: 'Hydra Blood Arrow', poison: 'Poisoned Arrow', racket: 'Racket Arrow', rainbow: "Rainbow's Arrow", holz: 'Archer Arrow' };
  const STATUS = { flame: 'burn', poison: 'poison', hydra: 'poison' };
  FX.STATUS = STATUS;

  const NANG = 32;
  const SPR = {};      // kind → { w, h, cx, cy, tip:[x,y], grid, rots: [ {cells, outline, tipV:[dx,dy]} ] }
  function buildSprites() {
    for (const kind of KINDS) {
      const A = ARTS[kind];
      const wMax = Math.max(...A.layers.map(([x, y, rows]) => x + Math.max(...rows.map((r) => r.length))));
      const w = wMax, h = A.h, grid = Array.from({ length: h }, () => new Array(w).fill(null));
      for (const [x, y, rows] of A.layers) rows.forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== '.' && y + j < h && y + j >= 0) grid[y + j][x + i] = snap(CN[LET[ch]]); }));
      let tipX = 0; for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) if (grid[yy][xx]) tipX = Math.max(tipX, xx);
      const cx = (w - 1) / 2, cy = (h - 1) / 2;
      let tailX = w; for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) if (grid[yy][xx]) tailX = Math.min(tailX, xx);
      const S = { kind, w, h, cx, cy, grid, tip: [tipX, cy], tail: [tailX, cy], rots: [], ol: snap(CN[A.ol]), glow: A.glow, len: tipX - tailX };
      const at = (x, y) => { const xi = rd(x), yi = rd(y); return (xi >= 0 && yi >= 0 && xi < w && yi < h) ? grid[yi][xi] : null; };
      for (let k = 0; k < NANG; k++) {
        const th = k * Math.PI * 2 / NANG, co = Math.cos(th), si = Math.sin(th), flip = co < -0.02;
        const R = Math.ceil(Math.hypot(w, h) / 2) + 2, cells = new Map();
        for (let oy = -R; oy <= R; oy++) for (let ox = -R; ox <= R; ox++) {
          const votes = new Map(); let n = 0;
          for (const [sx_, sy_] of [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]]) {
            const qx = ox + sx_, qy = oy + sy_;
            let sx = cx + qx * co + qy * si, sy = cy - qx * si + qy * co;
            if (flip) sy = 2 * cy - sy;
            const c = at(sx, sy); if (c) { n++; votes.set(c, (votes.get(c) || 0) + 1); }
          }
          if (n >= 2) { let best = null, bv = 0; for (const [c, v] of votes) if (v > bv) { bv = v; best = c; } cells.set(ox + ',' + oy, [ox, oy, best]); }
        }
        const list = [...cells.values()], outline = [];
        for (const [ox, oy] of list) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const key = (ox + dx) + ',' + (oy + dy); if (!cells.has(key)) { cells.set(key, null); outline.push([ox + dx, oy + dy]); } }
        // Spitze/Schwanz in gedrehten Zellen
        const rv = (px, py) => { const qx = px - cx, qy = (flip ? -1 : 1) * (py - cy); return [qx * co - qy * si * 1, qx * si + qy * co]; };
        const rvv = (px, py) => { const qx = px - cx, qy = py - cy; const fy = flip ? -qy : qy; return [qx * co - fy * si, qx * si + fy * co]; };
        void rv;
        S.rots.push({ cells: list, outline, tipV: rvv(S.tip[0], S.tip[1]), tailV: rvv(S.tail[0], S.tail[1]), ang: th, ux: co, uy: si, flip });
      }
      SPR[kind] = S;
    }
  }

  let bereit = false;
  FX.init = () => {
    if (bereit) return;
    for (const k in CN) C[k] = snap(CN[k]);
    for (const h of ['#fad54a', '#f29a3e', '#ee6428', '#b62600', '#f7f7ad']) GOLD.push(snap(h));
    buildSprites();
    FX.C = C; FX.SPR = SPR; bereit = true;
  };
  FX.bereit = () => bereit;

  // ═════════ Flugplan ═════════
  // opts: { kinds, total, A:{x,y,z}, B:{x,y,z,rx,ry,zr}, seed, windup, startSpread, fMin, fMax, arcMin, arcMax, fan, hydraDiv }
  FX.plan = (o) => {
    const n = o.kinds.length, seed = o.seed || 1;
    const P = Object.assign({ windup: 0.26, startSpread: 0.30, fMin: 0.55, fMax: 0.85, arcMin: 120, arcMax: 250, fan: 60, scatter: 1, hydraDiv: 30 }, o);
    const order = [...Array(n).keys()].sort((a, b) => H(seed, a + 100) - H(seed, b + 100));   // Startreihenfolge gemischt
    const each = Math.round(P.total / n);
    // Zielpunkte: Sonnenblumenmuster im Streukreis, dann gemischt vergeben
    const pts = [...Array(n).keys()].map((j) => { const r = Math.sqrt((j + 0.5) / n), a = j * 2.39996 + H(seed, 7) * 6.28; return [Math.cos(a) * r, Math.sin(a) * r]; });
    const tgtOrder = [...Array(n).keys()].sort((a, b) => H(seed, a + 300) - H(seed, b + 300));
    const arrows = o.kinds.map((kind, i) => {
      const rank = order.indexOf(i), tg = pts[tgtOrder[i]];
      const t0 = P.windup + (n === 1 ? 0 : P.startSpread * clamp((rank + H(seed, i + 1) * 0.9) / (n - 0.1)));
      const T = lerp(P.fMin, P.fMax, H(seed, i + 2));
      const B = P.B, A = P.A;
      return {
        i, kind, t0, T, tHit: t0 + T, rank,
        apex: lerp(P.arcMin, P.arcMax, H(seed, i + 3)) * (n === 1 ? 1.1 : 1),
        fan: (H(seed, i + 4) - 0.5) * 2 * P.fan * (n === 1 ? 0.3 : 1),
        A: { x: A.x + (H(seed, i + 5) - 0.5) * 36, y: A.y + (H(seed, i + 6) - 0.5) * 22, z: A.z + (H(seed, i + 8) - 0.5) * 36 },
        B: { x: B.x + tg[0] * (B.rx || 55) * P.scatter + (H(seed, i + 9) - 0.5) * 8, y: B.y + tg[1] * (B.ry || 22) * P.scatter, z: B.z + tg[1] * (B.zr || 40) * -1 + (H(seed, i + 10) - 0.5) * 10 },
        dmg: o.perArrow ? o.perArrow[i] : each, status: STATUS[kind] || null,
        stacks: kind === 'hydra' ? Math.max(1, Math.floor(P.total / P.hydraDiv)) : (kind === 'poison' ? 1 : 0),
        seed: seed * 977 + i * 31,
      };
    });
    const hits = [...arrows].sort((a, b) => a.tHit - b.tHit);
    hits.forEach((a, j) => { a.hitIdx = j; });
    const tEnd = Math.max(...arrows.map((a) => a.tHit)) + 1.3;
    return Object.assign({ n, arrows, hits, each, tEnd, tLast: Math.max(...arrows.map((a) => a.tHit)), tFirst: Math.min(...arrows.map((a) => a.tHit)) }, { P });
  };
  /** Weltposition (x, y, z) und Fortschritt u einer Pfeilbahn zur Zeit t (Bogen: Parabel + seitliche Streuung) */
  function pos(a, t) {
    const u = clamp((t - a.t0) / a.T), A = a.A, B = a.B, sw = Math.sin(Math.PI * u);
    const dx = B.x - A.x, dy = B.y - A.y, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
    return { x: lerp(A.x, B.x, u) + nx * a.fan * sw, y: lerp(A.y, B.y, u) + ny * a.fan * sw * 0.5, z: lerp(A.z, B.z, u) + a.apex * 4 * u * (1 - u), u };
  }
  FX.pos = pos;

  // ═════════ Zeichnen: Pfeile ═════════
  const angIdx = (vx, vy) => ((rd(Math.atan2(vy, vx) / (Math.PI * 2 / NANG)) % NANG) + NANG) % NANG;
  function drawSprite(m, S, k, X, Y, ol) {
    const R = S.rots[k];
    if (ol !== false) for (const [x, y] of R.outline) m.px(X + x, Y + y, S.ol);
    for (const [x, y, c] of R.cells) m.px(X + x, Y + y, c);
  }
  const ramp = (L, u) => L[Math.min(L.length - 1, Math.max(0, Math.floor(u * L.length)))];
  const FLAME_RAMP = () => [C.creme, C.gelb, C.org, C.rot, C.dunkel];

  function drawHalo(m, S, cx, cy, tq, kind) {
    // gedithertes Glühen um den Pfeil (statt weichem Schein): Ellipse, Bayer-Stufe flackert leicht
    const lv = 4 + ((fl(tq) >> 1) & 1) * 2;
    if (kind === 'poison') m.dith(cx, cy, 15, 8, lv, C.gruenM, 0); else if (kind === 'bomb') m.dith(cx, cy, 14, 9, lv, C.glutD, 0);
    else if (kind === 'hydra') m.dith(cx, cy, 13, 7, lv - 1, C.gruenD, 0); else if (kind === 'flame') m.dith(cx + 3, cy, 12, 7, lv - 1, C.rotD, 0);
    else if (kind === 'angel') m.dith(cx - 4, cy, 18, 8, lv - 2, C.hell, 0); else if (kind === 'golden') m.dith(cx, cy, 15, 8, lv, C.goldD, 0);
    else if (kind === 'rainbow') m.dith(cx, cy, 13, 7, lv - 2, C.hell, 0); else if (kind === 'racket') m.dith(cx + 3, cy, 12, 8, lv - 1, C.goldD, 0);
  }

  /** Schweif und Zusatzglanz, rein zeitabhängig (keine Zustände): frühere Bildzeiten werden erneut ausgewertet */
  function drawTrail(ctx, a, tq, S) {
    const m = ctx.m, kind = a.kind, id0 = a.seed, NK = kind === 'rainbow' ? 14 : (kind === 'angel' ? 11 : 10);
    const pts = [];
    for (let k = 0; k <= NK; k++) {
      const te = tq - k / TAKT; if (te < a.t0 || te > a.tHit) { pts.push(null); continue; }
      const p = pos(a, te), g = ctx.proj(p.x, p.y, p.z); pts.push({ gx: g[0], gy: g[1], te, k, u: p.u });
    }
    const cur = pts[0] || pts.find((q) => q);
    if (!cur) return;
    const fi = fl(tq);
    // Richtung am Kopf (Bildschirm)
    let vx = 1, vy = 0; { const q1 = pts.find((q, k) => q && k >= 1); if (q1 && pts[0]) { vx = pts[0].gx - q1.gx; vy = pts[0].gy - q1.gy; } }
    const vl = Math.hypot(vx, vy) || 1; vx /= vl; vy /= vl; const pxv = -vy, pyv = vx;
    if (kind === 'flame') {
      for (let k = 1; k <= 9; k++) { const q = pts[k]; if (!q) continue; const age = k / TAKT;
        for (let j = 0; j < 2; j++) { const id = fl(q.te) * 3 + j + id0, X = q.gx + (H(id, 1) - 0.5) * 6 + pxv * (H(id, 5) - 0.5) * 4, Y = q.gy + (H(id, 2) - 0.5) * 5 - age * 22, c = ramp(FLAME_RAMP(), age / 0.31 + (H(id, 3) - 0.5) * 0.25);
          if (age < 0.1) m.disc(rd(X), rd(Y), 1, c); else m.rect(rd(X), rd(Y), 1, 1, c); } }
      for (let k = 2; k <= 9; k += 2) { const q = pts[k]; if (!q) continue; const id = fl(q.te) + id0; m.px(rd(q.gx + (H(id, 7) - 0.5) * 12), rd(q.gy - 3 - k * 2 - H(id, 8) * 6), C.org); }
    } else if (kind === 'poison' || kind === 'hydra') {
      const bub = kind === 'poison' ? [C.gruen, C.gruenM, C.gruenH] : [C.gruenD, C.gruenM, C.lila];
      for (let k = 1; k <= 12; k++) { const q = pts[k]; if (!q) continue; const age = k / TAKT, id = fl(q.te) + id0;
        if ((id & 1) === 0 && age > 0.03) { const X = rd(q.gx + (H(id, 1) - 0.5) * 9), Y = rd(q.gy + (H(id, 2) - 0.5) * 6 - age * 8), r = age < 0.25 ? 1 : 0;
          if (r) { m.ring(X, Y, 1, 1, bub[0], false); m.px(X, Y, bub[2]); } else m.px(X, Y, bub[1]); }
        if (k % 3 === 0) { const X = rd(q.gx + (H(id, 3) - 0.5) * 6), Y = rd(q.gy + 2 + age * age * 90); m.rect(X, Y, 1, 2, bub[0]); } }
    } else if (kind === 'bomb') {
      for (let k = 1; k <= 10; k++) { const q = pts[k]; if (!q) continue; const age = k / TAKT, id = fl(q.te) + id0;
        if (k % 2) { const X = rd(q.gx - vx * 6 + (H(id, 1) - 0.5) * 7), Y = rd(q.gy - vy * 6 + (H(id, 2) - 0.5) * 7 - age * 12), r = age < 0.2 ? 2 : 1;
          m.dith(X, Y, r + 1, r + 1, 9, k < 5 ? C.asche : C.rauch, 0); }
        if (H(id, 4) < 0.5) { const X = rd(q.gx - vx * 4 + (H(id, 5) - 0.5) * 12), Y = rd(q.gy - vy * 4 + (H(id, 6) - 0.5) * 12); m.px(X, Y, C.glutG); if (H(id, 7) < 0.4) { m.px(X + 1, Y, C.creme); m.px(X - 1, Y, C.gelb); m.px(X, Y + 1, C.gelb); m.px(X, Y - 1, C.gelb); } } }
    } else if (kind === 'angel') {
      for (let k = 1; k <= 11; k++) { const q = pts[k]; if (!q) continue; const age = k / TAKT;
        for (const off of [-3, 0, 3]) { if (((k + off) & 1) === 0) continue; m.px(rd(q.gx + pxv * off - vx * 5), rd(q.gy + pyv * off - vy * 5), off === 0 ? C.weiss : (k < 6 ? C.hell : C.grau)); }
        if (k % 3 === 0) { const id = fl(q.te) + id0, X = rd(q.gx + Math.sin(age * 9 + id) * 4), Y = rd(q.gy + age * 16); m.rect(X, Y, 3, 1, C.weiss); m.px(X + 3, Y + 1, C.hell); m.px(X - 1, Y + 1, C.grau); } }
    } else if (kind === 'rainbow') {
      const cols = [C.rbR, C.rbO, C.rbY, C.rbG, C.rbC, C.rbB, C.rbP];
      for (let b = 0; b < 7; b++) { let last = null;
        for (let k = 1; k <= 14; k++) { const q = pts[k]; if (!q) { last = null; continue; } const sw = (b - 3) * (1.0 - k / 24) * 1.1, X = rd(q.gx + pxv * sw - vx * 4), Y = rd(q.gy + pyv * sw - vy * 4 + Math.sin(k * 0.5 + fi * 0.2) * 0.8 * (k / 14));
          if (k > 9 && ((k + b) & 1)) { last = null; continue; }
          if (last) m.linie(last[0], last[1], X, Y, 1, cols[b]); else m.px(X, Y, cols[b]); last = [X, Y]; } }
    } else if (kind === 'golden') {
      for (let k = 1; k <= 10; k++) { const q = pts[k]; if (!q) continue; const age = k / TAKT, id = fl(q.te) + id0;
        if (H(id, 1) < 0.7) { const X = rd(q.gx + (H(id, 2) - 0.5) * 14), Y = rd(q.gy + (H(id, 3) - 0.5) * 9 + age * 14);
          if (age < 0.16 && H(id, 4) < 0.45) { m.px(X, Y, C.creme); m.px(X + 1, Y, C.goldH); m.px(X - 1, Y, C.goldH); m.px(X, Y + 1, C.goldH); m.px(X, Y - 1, C.goldH); } else m.px(X, Y, ramp([C.goldH, C.goldM, C.gold, C.goldD], age / 0.34)); } }
    } else if (kind === 'racket') {
      for (let k = 2; k <= 10; k += 4) { const q = pts[k]; if (!q) continue; const age = k / TAKT, id = fl(q.te) + id0, X = rd(q.gx + (H(id, 1) - 0.5) * 8 + Math.sin(age * 12 + id) * 2), Y = rd(q.gy - 2 - age * 14); drawNote(m, X, Y, (id & 1) ? C.rot : C.goldH, k > 7); }
      for (let k = 1; k <= 8; k++) { const q = pts[k]; if (!q) continue; if (k % 2) continue; const id = fl(q.te) + id0; m.px(rd(q.gx + (H(id, 5) - 0.5) * 14), rd(q.gy + (H(id, 6) - 0.5) * 9), C.goldH); }
    }
    return { vx, vy };
  }
  const NOTE = ['...##.', '...#.#', '...#..', '...#..', '.###..', '####..', '.##...'];
  function drawNote(m, x, y, c, dither) { NOTE.forEach((row, j) => [...row].forEach((ch, i) => { if (ch === '#' && !(dither && ((i + j) & 1))) m.px(x + i - 2, y + j - 3, c); })); }

  /** Kopf-Zusatz (dynamisch): Flammenball, Bomben-Lunte, Funkeln */
  function drawHead(ctx, a, tq, hx, hy, ux, uy) {
    const m = ctx.m, fi = fl(tq), kind = a.kind;
    if (kind === 'flame') {
      const bx = rd(hx), by = rd(hy), R = 3, rr = [C.creme, C.gelb, C.org, C.rot];
      // Flammenzungen nach hinten (wackeln mit dem Takt)
      for (let tg = 0; tg < 4; tg++) { const len = 5 + ((fi + tg * 2) % 4) + (tg === 1 ? 2 : 0), off = (tg - 1.5) * 1.7;
        for (let s = 0; s < len; s++) { const wob = Math.sin(s * 0.7 + fi * 1.3 + tg * 2) * 0.9 * (s / len), X = rd(hx - ux * (R + s) - uy * (off + wob)), Y = rd(hy - uy * (R + s) + ux * (off + wob)); m.px(X, Y, s < len * 0.35 ? C.org : (s < len * 0.7 ? C.rot : C.dunkel)); if (s < len * 0.3) m.px(rd(X + uy), rd(Y - ux), C.gelb); } }
      m.disc(bx, by, R + 1, C.rot); m.disc(bx, by, R, C.org); m.disc(bx, by, R - 1, C.gelb); m.px(bx, by, C.creme); m.px(bx - 1, by, C.creme); m.px(bx, by - 1, C.creme);
      if (fi % 3 === 0) m.px(rd(bx + 2), rd(by - R - 1), C.gelb);
    } else if (kind === 'bomb') {
      // Lunte oben auf der Kugel + Funke
      const fx = rd(hx - ux * 3 + uy * 0 + (uy < 0 ? 0 : 0)), fy = rd(hy - 6);
      m.rect(fx, fy + 1, 1, 2, C.nacht); m.px(fx, fy, (fi & 1) ? C.glutG : C.creme);
      m.px(fx + 1, fy - 1, C.gelb); m.px(fx - 1, fy - 1, (fi & 2) ? C.org : C.glutG); if (fi % 3 === 0) m.px(fx, fy - 2, C.creme);
    } else if (kind === 'golden') {
      const tw = fi % 6; if (tw < 3) { const bx = rd(hx), by = rd(hy); m.px(bx, by, C.creme); m.px(bx + 1, by, C.goldH); m.px(bx - 1, by, C.goldH); m.px(bx, by + 1, C.goldH); m.px(bx, by - 1, C.goldH); if (tw === 1) { m.px(bx + 2, by, C.creme); m.px(bx - 2, by, C.creme); m.px(bx, by + 2, C.creme); m.px(bx, by - 2, C.creme); } }
    } else if (kind === 'rainbow') {
      const bx = rd(hx), by = rd(hy), cols = [C.rbR, C.rbY, C.rbG, C.rbC, C.rbP]; const c = cols[fi % 5]; m.px(bx, by, C.weiss); m.px(bx + 1, by, c); m.px(bx - 1, by, c); m.px(bx, by + 1, c); m.px(bx, by - 1, c);
    } else if (kind === 'poison') {
      if (fi % 2) { m.rect(rd(hx - 1), rd(hy + 2 + (fi % 4)), 1, 2, C.gruen); }
    }
  }

  // ═════════ Zeichnen: Einschläge ═════════
  function spark(m, X, Y, c, big) { m.px(X, Y, c); if (big) { m.px(X + 1, Y, c); m.px(X, Y + 1, c); } }
  function sparks(m, hx, hy, dt, n, cols, spd, life, g, seed, up) {
    for (let j = 0; j < n; j++) {
      const lf = life * (0.6 + 0.4 * H(seed, j * 3 + 1)); if (dt > lf) continue;
      const an = (up ? -Math.PI * (0.05 + 0.9 * H(seed, j * 3 + 2)) : H(seed, j * 3 + 2) * Math.PI * 2), sp = spd * (0.45 + 0.55 * H(seed, j * 3 + 3));
      const X = hx + Math.cos(an) * sp * dt, Y = hy + Math.sin(an) * sp * dt * 0.8 + 0.5 * g * dt * dt, c = ramp(cols, dt / lf);
      spark(m, rd(X), rd(Y), c, dt < 0.1);
      const dt2 = Math.max(0, dt - 0.033); m.px(rd(hx + Math.cos(an) * sp * dt2), rd(hy + Math.sin(an) * sp * dt2 * 0.8 + 0.5 * g * dt2 * dt2), cols[Math.min(cols.length - 1, 1)]);
    }
  }
  function cross(m, X, Y, c, c2) { m.px(X, Y, c); m.px(X + 1, Y, c2); m.px(X - 1, Y, c2); m.px(X, Y + 1, c2); m.px(X, Y - 1, c2); }

  function impact(ctx, a, dt, hx, hy) {
    const m = ctx.m, kind = a.kind, lod = ctx.lod || 0, fr = ctx.flat || 0.6, sd = a.seed, R = (v) => Math.max(1, rd(v * (lod ? 0.7 : 1)));
    const nS = lod ? 5 : 9;
    // gemeinsamer Treffer: Blitzstern (2 Bilder), Ring (flach), Splitter
    if (dt < 0.034) { m.disc(hx, hy, R(4), C.creme); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) m.linie(hx + dx * 3, hy + dy * 3, hx + dx * R(9), hy + dy * R(9) * 0.8, 1, C.creme); }
    else if (dt < 0.067) { m.disc(hx, hy, R(3), C.gelb); m.disc(hx, hy, R(1), C.creme); }
    const ringCol = { flame: C.org, poison: C.gruen, hydra: C.gruenD, bomb: C.gelb, angel: C.creme, rainbow: C.creme, golden: C.goldH, racket: C.goldH, holz: C.creme }[kind];
    if (dt > 0.03 && dt < 0.30) { const u = (dt - 0.03) / 0.27, r = 2 + rd(easeOut(u) * (lod ? 9 : 13)); m.ell(hx, hy + 1, r, r * fr, 1, ringCol, u > 0.55); if (!lod && dt > 0.07 && dt < 0.26) m.ell(hx, hy + 1, rd(r * 0.6), rd(r * 0.6 * fr), 1, C.creme, true); }
    // Holzsplitter / Splitter (nicht bei Gift/Hydra/Bombe)
    if (!lod && (kind === 'angel' || kind === 'flame' || kind === 'golden' || kind === 'rainbow' || kind === 'racket' || kind === 'holz')) sparks(m, hx, hy, dt, 4, [C.holzH, C.holz, C.holzD], 38, 0.34, 150, sd + 11, true);
    const cols = {
      holz: [C.creme, C.hell, C.holzH, C.holz], angel: [C.weiss, C.creme, C.goldH, C.hell], flame: [C.gelb, C.org, C.rot, C.dunkel], poison: [C.gruenH, C.gruen, C.gruenM, C.gruenD], hydra: [C.gruen, C.gruenM, C.lila, C.gruenD],
      bomb: [C.creme, C.gelb, C.org, C.rauch], rainbow: [C.rbR, C.rbY, C.rbG, C.rbB], golden: [C.creme, C.goldH, C.goldM, C.gold], racket: [C.goldH, C.rot, C.gold, C.rotD],
    }[kind];
    if (kind === 'rainbow') { const sc = [C.rbR, C.rbO, C.rbY, C.rbG, C.rbC, C.rbB, C.rbP]; for (let j = 0; j < nS + 2; j++) { const lf = 0.42; if (dt > lf) continue; const an = -Math.PI * (0.02 + 0.96 * H(sd, j * 3 + 2)), sp = 62 * (0.5 + 0.5 * H(sd, j * 3 + 3)); const X = hx + Math.cos(an) * sp * dt, Y = hy + Math.sin(an) * sp * dt * 0.8 + 0.5 * 130 * dt * dt; spark(m, rd(X), rd(Y), sc[(j + fl(dt * 30)) % 7], dt < 0.12); } }
    else sparks(m, hx, hy, dt, nS, cols, 62, 0.42, 130, sd, true);
    // Besonderes je Pfeilart
    if (kind === 'flame') {
      for (let j = 0; j < (lod ? 3 : 5); j++) { const dx = (j - (lod ? 1 : 2)) * 3 + rd((H(sd, j + 40) - 0.5) * 3), life = 0.42, d0 = 0.04 + H(sd, j + 50) * 0.08, q = dt - d0; if (q < 0 || q > life) continue; const u = q / life, hgt = rd(Math.sin(Math.min(1, u * 1.2) * Math.PI * 0.85) * (7 + H(sd, j + 60) * 6)), wd = u < 0.6 ? 2 : 1;
        for (let s = 0; s < hgt; s++) { const v = s / Math.max(1, hgt), c = v < 0.3 ? C.gelb : (v < 0.65 ? C.org : C.rot); m.rect(hx + dx + rd(Math.sin(s * 0.8 + fl(dt * 30) * 1.1 + j) * 0.8), hy - s, wd, 1, u > 0.7 && s > hgt * 0.6 ? C.dunkel : c); } }
      if (dt > 0.08 && dt < 0.6) for (let j = 0; j < (lod ? 2 : 5); j++) { const q = dt - 0.08, X = hx + rd((H(sd, j + 70) - 0.5) * 16 + Math.sin(q * 9 + j) * 2), Y = hy - rd(q * (14 + H(sd, j + 80) * 18)); if (H(sd, j + 90) < 0.8) m.px(X, Y, (fl(dt * 30) + j) % 3 ? C.org : C.rot); }
    } else if (kind === 'poison' || kind === 'hydra') {
      const dark = kind === 'hydra';
      if (dt > 0.04 && dt < 0.7) { const u = (dt - 0.04) / 0.66, r = 4 + rd(easeOut(u) * (lod ? 5 : 8)), lv = rd(11 * (1 - u * u) + 1); m.dith(hx, hy - rd(u * 3), r, r * 0.8, lv, dark ? C.gruenD : C.gruenM, 0); if (u < 0.6) m.dith(hx, hy - rd(u * 3), rd(r * 0.55), rd(r * 0.45), rd(lv * 0.8), dark ? C.lilaDD : C.gruen, 0); }
      for (let j = 0; j < (lod ? 3 : 6); j++) { const d0 = 0.05 + H(sd, j + 40) * 0.12, q = dt - d0; if (q < 0 || q > 0.45) continue; const X = hx + rd((H(sd, j + 41) - 0.5) * 18), Y = hy - rd(q * (10 + H(sd, j + 42) * 14)), r = q < 0.28 ? 1 : 0; if (r) { m.ring(X, Y, 1, 1, dark ? C.gruenM : C.gruen, false); m.px(X, Y, C.gruenH); } else m.px(X, Y, C.creme); }
      for (let j = 0; j < (lod ? 2 : 4); j++) { const q = dt - 0.06; if (q < 0 || q > 0.4) continue; const X = hx + rd((H(sd, j + 120) - 0.5) * 14), Y = hy + rd(q * q * 120 - 4); m.rect(X, Y, 1, 2, dark ? C.gruenM : C.gruen); }
      if (dark && dt > 0.05 && dt < 0.4) for (let j = 0; j < 3; j++) { const an = H(sd, j + 130) * Math.PI * 2, rr = (dt - 0.05) * 40; m.px(rd(hx + Math.cos(an) * rr), rd(hy + Math.sin(an) * rr * 0.6), C.lila); }
    } else if (kind === 'bomb') {
      // richtige kleine Explosion: Feuerball (Kern gelb, Mantel orange/rot), zwei Druckringe, Funkenregen, Trümmer, aufsteigender Rauch
      const K = lod ? 0.75 : 1;
      if (dt < 0.36) { const fr_ = fl(dt), r = [6, 10, 13, 12, 10, 8, 6, 4, 3, 2, 1, 0][Math.min(11, fr_)] * K;
        if (r >= 1) { m.disc(hx, hy, rd(r), fr_ < 4 ? C.org : C.rot); m.disc(hx, hy, rd(r * 0.78), fr_ < 6 ? C.org : C.rotD); m.disc(hx, hy, rd(r * 0.55), fr_ < 5 ? C.gelb : C.org); m.disc(hx, hy, rd(r * 0.3), fr_ < 4 ? C.creme : C.gelb); }
        if (dt > 0.03) m.ell(hx, hy, rd(r + 6), rd((r + 6) * fr), 1, C.rauch, true); }
      if (dt > 0.02 && dt < 0.34) { const u = (dt - 0.02) / 0.32; m.ell(hx, hy + 1, 3 + rd(easeOut(u) * 20 * K), (3 + rd(easeOut(u) * 20 * K)) * fr, 1, C.gelb, u > 0.5);
        if (u > 0.12) m.ell(hx, hy + 1, 2 + rd(easeOut((u - 0.12) / 0.88) * 13 * K), (2 + rd(easeOut((u - 0.12) / 0.88) * 13 * K)) * fr, 2, C.org, u > 0.45); }
      for (let j = 0; j < (lod ? 5 : 10); j++) { const an = H(sd, j + 150) * Math.PI * 2, q = dt, sp = 55 + H(sd, j + 160) * 40; if (q > 0.5) continue;
        const X = rd(hx + Math.cos(an) * sp * q), Y = rd(hy + Math.sin(an) * sp * q * 0.6 + 90 * q * q); m.px(X, Y, q < 0.2 ? C.glutG : C.org); if (q < 0.12) m.px(X + 1, Y, C.creme); else m.px(rd(hx + Math.cos(an) * sp * (q - 0.033)), rd(hy + Math.sin(an) * sp * (q - 0.033) * 0.6 + 90 * (q - 0.033) ** 2), C.rot); }
      for (let j = 0; j < (lod ? 3 : 7); j++) { const d0 = 0.06 + H(sd, j + 40) * 0.1, q = dt - d0; if (q < 0 || q > 0.75) continue; const X = hx + rd((H(sd, j + 41) - 0.5) * 20 + q * (H(sd, j + 43) - 0.5) * 8), Y = hy - 3 - rd(q * 18), r = q < 0.25 ? 4 : (q < 0.5 ? 3 : 2); m.dith(X, Y, r, r, rd(12 - q * 14), q < 0.3 ? C.asche : C.rauch, 0); }
      if (!lod) for (let j = 0; j < 6; j++) { const an = H(sd, j + 180) * Math.PI * 2, q = dt, sp = 40 + H(sd, j + 190) * 30; if (q > 0.4) continue; m.px(rd(hx + Math.cos(an) * sp * q), rd(hy + Math.sin(an) * sp * q * 0.6 + 70 * q * q), C.nacht); m.px(rd(hx + Math.cos(an) * sp * q) + 1, rd(hy + Math.sin(an) * sp * q * 0.6 + 70 * q * q), C.rauch); }
    } else if (kind === 'angel') {
      for (let j = 0; j < (lod ? 3 : 7); j++) { const d0 = 0.03 + H(sd, j + 40) * 0.1, q = dt - d0; if (q < 0 || q > 0.8) continue; const X = hx + rd((H(sd, j + 41) - 0.5) * 22 + Math.sin(q * 7 + j * 2) * 5), Y = hy - 6 + rd(q * 12 - Math.sin(Math.min(1, q * 5) * 2) * 6), c = (j & 1) ? C.weiss : C.goldH;
        m.rect(X, Y, 3, 1, c); m.px(X + 3, Y + 1, C.hell); m.px(X - 1, Y + 1, C.grau); if (q < 0.2) m.px(X + 1, Y - 1, C.creme); }
      if (dt > 0.04 && dt < 0.4) m.ell(hx, hy - 2, 3 + rd(easeOut((dt - 0.04) / 0.36) * 9), 3 + rd(easeOut((dt - 0.04) / 0.36) * 9), 1, C.goldH, true);
    } else if (kind === 'rainbow') {
      // Regenbogen-Burst: sieben gestaffelte Ringe (rot bis violett, je einer eine Zelle weiter), Strahlen in Regenbogenfarben, Funkenfächer
      const rc = [C.rbR, C.rbO, C.rbY, C.rbG, C.rbC, C.rbB, C.rbP], nR = lod ? 4 : 7;
      for (let b = 0; b < nR; b++) { const u = (dt - 0.02 - b * 0.026) / 0.30; if (u < 0 || u > 1) continue; const r = 2 + rd(easeOut(u) * 14) + b * 2; m.ell(hx, hy + 1, r, r * fr, 1 + (u < 0.3 ? 1 : 0), rc[b % 7], u > 0.62); }
      if (dt < 0.34 && !lod) for (let r = 0; r < 12; r++) { const an = r * Math.PI / 6 + 0.2, len = (dt < 0.1 ? easeOut(dt / 0.1) : 1 - (dt - 0.1) / 0.24) * 20; if (len > 1) m.linie(hx, hy, rd(hx + Math.cos(an) * len), rd(hy + Math.sin(an) * len * 0.8), 1, rc[r % 7]); }
      for (let j = 0; j < (lod ? 6 : 14); j++) { const q = dt - H(sd, j + 60) * 0.06; if (q < 0 || q > 0.5) continue; const an = -Math.PI * (0.02 + 0.96 * H(sd, j + 61)), sp = 55 * (0.5 + 0.5 * H(sd, j + 62)); cross(m, rd(hx + Math.cos(an) * sp * q), rd(hy + Math.sin(an) * sp * q * 0.8 + 70 * q * q), j & 1 ? C.creme : rc[(j + fl(dt)) % 7], rc[(j * 3 + fl(dt)) % 7]); }
    } else if (kind === 'golden') {
      // Gold-Partikelregen (feste Münzfarben aus data/palette-fest.json): Münzen fallen aus der Höhe auf das Ziel und prallen, dazu Glitzerkreuze
      for (let j = 0; j < (lod ? 4 : 12); j++) { const d0 = H(sd, j + 40) * 0.28, q = dt - d0; if (q < 0 || q > 0.62) continue;
        const X = hx + rd((H(sd, j + 41) - 0.5) * 30), top = 16 + H(sd, j + 42) * 12, yy = q < 0.36 ? -top + (top * (q / 0.36) * (q / 0.36)) : -Math.abs(Math.sin((q - 0.36) * 11)) * 5 * (1 - (q - 0.36) / 0.26), Y = hy + rd(yy);
        const col = GOLD[(j + fl(q)) % 5]; m.rect(X, Y, 2, 2, col); m.px(X, Y, GOLD[4]); if (q < 0.36 && (fl(q) & 1)) m.rect(X, Y - 2, 1, 2, GOLD[3]); }
      for (let j = 0; j < (lod ? 3 : 7); j++) { const d0 = 0.02 + H(sd, j + 140) * 0.2, q = dt - d0; if (q < 0 || q > 0.32) continue; const X = hx + rd((H(sd, j + 141) - 0.5) * 26), Y = hy + rd((H(sd, j + 142) - 0.5) * 18 - q * 6); if (fl(q) % 2 === 0) cross(m, X, Y, C.creme, GOLD[4]); else m.px(X, Y, GOLD[0]); }
      if (dt > 0.03 && dt < 0.4) m.ell(hx, hy + 1, 3 + rd(easeOut((dt - 0.03) / 0.37) * 12), (3 + rd(easeOut((dt - 0.03) / 0.37) * 12)) * fr, 1, GOLD[0], (dt > 0.2));
    } else if (kind === 'racket') {
      // dissonanter Klang (zwei gleichzeitige Pings, Rate 1,0 und 1,09): rot-goldene Notenfunken, versetzte Schallringe (rot gegen gold), gezackte Schallbögen
      for (let j = 0; j < (lod ? 3 : 6); j++) { const d0 = 0.02 + j * 0.045, q = dt - d0; if (q < 0 || q > 0.62) continue; const side = (j % 2 ? 1 : -1) * (6 + (j >> 1) * 5);
        drawNote(m, hx + side + rd(Math.sin(q * 11 + j) * 3), hy - 4 - rd(q * (24 + (j % 3) * 6)), (j % 2) ? C.rot : C.goldH, q > 0.42); }
      for (let b = 0; b < (lod ? 2 : 4); b++) { const u = (dt - 0.02 - b * 0.055) / 0.34; if (u < 0 || u > 1) continue; const r = 3 + rd(easeOut(u) * (12 + b * 3)); m.ell(hx, hy, r, r * fr, 1 + (u < 0.25 ? 1 : 0), (b % 2) ? C.rot : C.goldH, u > 0.55); }
      if (dt > 0.03 && dt < 0.32 && !lod) for (let sgn = -1; sgn <= 1; sgn += 2) for (let b = 0; b < 2; b++) { const u = (dt - 0.03 - b * 0.06) / 0.22; if (u < 0 || u > 1) continue; const r = 6 + rd(easeOut(u) * 14) + b * 3, col = b ? C.rot : C.goldH;
        for (let k = -3; k <= 3; k++) { const an = k * 0.2 + (sgn < 0 ? Math.PI : 0), jag = ((k & 1) ? 2 : 0); m.px(rd(hx + Math.cos(an) * (r + jag)), rd(hy + Math.sin(an) * (r + jag) * 0.8), col); } }
      for (let j = 0; j < (lod ? 3 : 8); j++) { const q = dt - 0.03 - H(sd, j + 50) * 0.05; if (q < 0 || q > 0.38) continue; const an = H(sd, j + 51) * Math.PI * 2, sp = 50 * (0.5 + 0.5 * H(sd, j + 52)); spark(m, rd(hx + Math.cos(an) * sp * q), rd(hy + Math.sin(an) * sp * q * 0.8), (j & 1) ? C.rot : C.goldH, q < 0.1); }
    }
    // Staub/Holz am Boden (dither) – nur bei wenigen Pfeilen
    if (!lod && dt > 0.04 && dt < 0.45) { const u = (dt - 0.04) / 0.41; m.dith(hx, hy + 3, 3 + rd(u * 8), (3 + rd(u * 8)) * fr, rd(7 * (1 - u)), C.asche, 0); }
  }

  // ═════════ Hauptfunktion ═════════
  FX.salve = (t, ctx) => {
    const plan = ctx.plan, m = ctx.m, tq = fl(t) / TAKT, lod = ctx.lod || 0, st = ctx.state || {};
    const hitsOut = [];
    // 1) Sammeln: Funken laufen auf den Bogen zu, Aufleuchten
    const A0 = plan.P.A;
    if (t >= 0 && t < plan.P.windup + 0.08) {
      const g = ctx.proj(A0.x, A0.y, A0.z), u = clamp(t / plan.P.windup);
      for (let j = 0; j < (lod ? 8 : 14); j++) { const an = H(plan.P.seed || 1, j + 500) * Math.PI * 2, r = (1 - u) * (26 + 14 * H(plan.P.seed || 1, j + 520)) + 2, ph = (j + fl(tq)) % 3; if (ph === 2) continue;
        m.px(rd(g[0] + Math.cos(an) * r), rd(g[1] + Math.sin(an) * r * 0.7), (j & 1) ? C.creme : C.goldH); }
      if (u > 0.55) { m.ell(rd(g[0]), rd(g[1]), rd(8 + (1 - u) * 14), rd((8 + (1 - u) * 14) * 0.7), 1, C.creme, (fl(tq) & 1) === 0); }
    }
    // 2) Pfeile
    const drawOrder = [...plan.arrows].sort((a, b) => pos(a, Math.max(a.t0, Math.min(a.tHit, t))).y - pos(b, Math.max(b.t0, Math.min(b.tHit, t))).y);
    for (const a of drawOrder) {
      const S = SPR[a.kind], vis0 = a.t0 - (plan.P.windup - plan.P.windup * (a.rank / plan.n) * 0.9);   // Sichtbar werden beim Sammeln (gestaffelt)
      if (t < vis0 - 0.001) continue;
      // Wartepose: am Bogen, leicht aufgefächert, Spitze zeigt schon zum Ziel
      const launch = t < a.t0, ts = launch ? a.t0 : Math.min(t, a.tHit), ps = pos(a, ts), g0 = ctx.proj(ps.x, ps.y, ps.z);
      let X, Y, k;
      const pPrev = pos(a, Math.max(a.t0, ts - 0.04)), pNext = pos(a, Math.min(a.tHit, ts + 0.04)), gp = ctx.proj(pPrev.x, pPrev.y, pPrev.z), gn = ctx.proj(pNext.x, pNext.y, pNext.z);
      let dvx = gn[0] - gp[0], dvy = gn[1] - gp[1]; if (Math.hypot(dvx, dvy) < 0.01) { dvx = 1; dvy = 0; }
      if (launch) {
        const q = clamp((t - vis0) / Math.max(0.05, a.t0 - vis0)), bob = Math.round(Math.sin((fl(t) + a.i * 3) * 0.7) * 1);
        const fan = (H(a.seed, 21) - 0.5) * 1.1 * (1 - q * 0.8);
        const ang0 = Math.atan2(dvy, dvx) + fan; k = angIdx(Math.cos(ang0), Math.sin(ang0));
        const back = 10 + 6 * (1 - q), ox = -Math.cos(ang0) * back * 0.5 + (H(a.seed, 22) - 0.5) * 10, oy = (H(a.seed, 23) - 0.5) * 10 + bob;
        X = rd(g0[0] + ox); Y = rd(g0[1] + oy);
        if (q < 0.15 && ((fl(t) & 1) === 0)) { drawSprite(m, S, k, X, Y, true); m.px(X, Y, C.weiss); continue; }
      } else {
        k = angIdx(dvx, dvy);
        const emb = clamp((ps.u - 0.78) / 0.22), R = S.rots[k], off = -(S.len * 0.5) * 0.55 * emb;   // beim Treffer steckt die Spitze im Ziel
        X = rd(g0[0] - R.tipV[0] * 0.0 + R.ux * off); Y = rd(g0[1] + R.uy * off);
        if (t >= a.tHit) { /* steckt */ const sinceHit = t - a.tHit; if (sinceHit > 0.34 || (sinceHit > 0.2 && (fl(t) & 1))) continue; }
      }
      const flying = !launch && t < a.tHit;
      const R = S.rots[k], cx = X + R.ux * 0, cy = Y;
      if (flying || launch) drawHalo(m, S, cx, cy, tq, a.kind);
      if (flying) drawTrail(ctx, a, tq, S);
      drawSprite(m, S, k, X, Y, true);
      const tipX = X + R.tipV[0], tipY = Y + R.tipV[1];
      if (flying || launch) drawHead(ctx, a, tq, tipX, tipY, R.ux, R.uy);
    }
    // 3) Einschläge + Zahlen
    const B = plan.P.B, nTot = plan.n;
    for (const a of plan.hits) {
      const dt = tq - a.tHit; if (dt < -1e-6) continue;
      const pe = pos(a, a.tHit), g = ctx.proj(pe.x, pe.y, pe.z);
      if (dt < 0.9) impact(ctx, a, fl(dt) / TAKT, rd(g[0]), rd(g[1]));
      hitsOut.push(a);
    }
    // Zahlen (nach allen Einschlägen, damit sie oben liegen). Reeller Schaden 0 (Hydra Blood Arrow): statt einer Null-Wand EINE gedämpfte „0“ beim letzten Einschlag.
    const top = ctx.proj(B.x, B.y, B.zTop || 90), nullFall = plan.arrows.every((a) => !a.dmg), nZ = nullFall ? 1 : nTot, cols = nZ <= 5 ? nZ : (nZ <= 8 ? 4 : 5), sc = ctx.numSc || (nZ > 8 ? 1 : 2), digitW = (s) => FX.glyphW(s, sc) + 2 * sc + 2;
    const txtOf = (a) => (ctx.numText ? ctx.numText(a) : '' + a.dmg);
    const zahlHits = ctx.keineZahlen ? [] : (nullFall ? [plan.hits[plan.hits.length - 1]] : plan.hits);
    zahlHits.forEach((a, jj) => {
      const dt = t - a.tHit - 0.02; if (dt < 0) return;
      const j = nullFall ? 0 : a.hitIdx, row = Math.floor(j / cols), cc = j % cols, rowCount = Math.min(cols, nZ - row * cols);
      const str = txtOf(a), w = FX.glyphW(str, sc), cw = digitW('00'), x0 = rd(top[0] - (rowCount * cw) / 2 + cc * cw + (cw - w) / 2), life = 1.45;
      const rise = rd(easeOut(dt / 0.22) * (2 * sc + 1)), hold = (plan.tLast + 1.15) - a.tHit, endT = Math.max(life, hold);
      if (dt > endT + 0.2) return;
      if (dt > endT && (fl(dt) & 1)) return;   // blinkt zum Schluss aus
      const y0 = rd(top[1] - (ctx.numLift || 0) - 8 * sc - row * (8 * sc + 3) - rise + 2 * sc * (dt < 0.1 ? 1 : 0));
      const q = fl(dt), fill = nullFall ? (q < 2 ? C.creme : C.hell) : (q < 2 ? C.creme : (q < 4 ? C.gelb : C.zahl)), shadow = nullFall ? C.mittel : (q < 4 ? C.org : C.zahlD);
      glyph(m, str, x0, y0, sc, fill, shadow, C.tinte);
    });
    return hitsOut;
  };

  // ═════════ HUD-Helfer: HP-Balken, Statussymbole ═════════
  const ICON = {
    burn: ['...r...', '..rro..', '..roo..', '.rooyo.', '.rooyo.', 'rooyyyo', 'rooycyo', '.ooyyo.', '..rooo.'],
    poison: ['...e...', '...E...', '..EEe..', '.EEEEe.', 'EEHEEee', 'EEHEEee', 'EEEEeee', '.EEEee.', '..eee..'],
    // Blutung: ein Blutstropfen mit zweitem, fallendem Tropfen (Form und Farbe unterscheiden sich von Gift/Brand)
    bleed: ['..d.......', '.dRd......', '.dRd......', 'dRhRd.....', 'dRRRd..d..', 'dRRRd.dRd.', '.dRd..dRd.', '..d....d..'],
  };
  const ICOL = { r: 'rotD', o: 'org', y: 'gelb', c: 'creme', e: 'gruenM', E: 'gruen', H: 'gruenH', d: 'bluD', R: 'bluR', h: 'bluH' };
  const iconBreite = (kind) => Math.max(...ICON[kind].map((r) => r.length));
  FX.statusIcon = (m, kind, x, y, pop) => {
    const rows = ICON[kind], W = iconBreite(kind);
    rows.forEach((row, j) => [...row].forEach((ch, i) => { if (ch === '.') return; m.px(x + i, y + j, snap(CN[ICOL[ch]])); }));
    // dunkle Kontur
    const filled = (i, j) => rows[j] && rows[j][i] && rows[j][i] !== '.';
    for (let j = -1; j <= rows.length; j++) for (let i = -1; i <= W; i++) if (!filled(i, j) && (filled(i + 1, j) || filled(i - 1, j) || filled(i, j + 1) || filled(i, j - 1))) m.px(x + i, y + j, C.tinte);
    void pop;
  };
  FX.statusIconBreite = (kind) => iconBreite(kind) + 2;
  /** Dauer-Anzeige: das Symbol als kleines Bild (data-URL, 1 Zelle = 1 Bildpunkt; im Abzeichen ganzzahlig vergrößert), mit oder ohne dunkle Kontur. Zwischengespeichert. */
  const iconUrls = new Map();
  FX.iconUrl = (kind, outline) => {
    const key = kind + (outline ? '+' : '-');
    if (iconUrls.has(key)) return iconUrls.get(key);
    if (!ICON[kind]) return null;
    FX.init();
    const W = iconBreite(kind), H = ICON[kind].length, o = outline ? 1 : 0, gw = W + 2 * o, gh = H + 2 * o;
    const cv = document.createElement('canvas'); cv.width = gw; cv.height = gh;
    const g = cv.getContext('2d'), img = g.createImageData(gw, gh), m = maler(img.data, gw, gh);
    if (outline) FX.statusIcon(m, kind, 1, 1); else ICON[kind].forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== '.') m.px(i, j, snap(CN[ICOL[ch]])); }));
    g.putImageData(img, 0, 0);
    const r = { url: cv.toDataURL('image/png'), w: gw, h: gh };
    iconUrls.set(key, r); return r;
  };
  FX.hpBar = (m, cx, y, w, frac, num, flash, label) => {
    const x = cx - Math.floor(w / 2), h = 5;
    m.rect(x - 2, y - 2, w + 4, h + 4, C.creme); m.rect(x - 1, y - 1, w + 2, h + 2, C.tinte);
    const fw = rd(w * clamp(frac)), c = frac > 0.5 ? C.gruen : (frac > 0.25 ? C.gelb : C.rot);
    m.rect(x, y, fw, h, flash ? C.weiss : c); m.rect(x, y + h - 1, fw, 1, flash ? C.creme : (frac > 0.5 ? C.gruenM : (frac > 0.25 ? C.org : C.rotD))); m.rect(x, y, fw, 1, flash ? C.weiss : (frac > 0.5 ? C.gruenH : C.creme));
    for (let i = 1; i < 5; i++) if (BAY[0][0] === 0) { const gx = x + rd(w * i / 5); m.rect(gx, y, 1, h, C.tinte); }
    const s = '' + num; glyph(m, s, cx - Math.floor(FX.glyphW(s, 1) / 2), y - 11, 1, C.creme, null, C.tinte);
    void label;
  };
  // ── Animierter Lebensbalken (Kampfspiel-Art) ──
  //  Schaden: der Balken schrumpft in 9 Stufen (je ein 30-Hz-Bild, RAMPE = 300 ms) von ALT auf NEU; der verlorene Teil bleibt als dunkelroter „Verlustteil" (weiße Kante, gedithert) stehen,
  //  bleibt nach der Rampe HALTEN (250 ms) und rutscht dann in 8 Stufen (DRAIN = 270 ms) nach. Heilung: der Zuwachs füllt sich in 9 Stufen, der neue Teil steht dunkelgrün (bis HALTEN endet), die
  //  Zahl zählt in denselben Stufen mit. Reine Funktion der Zeit: `ev` = [{ t (ms), to (HP) }] in Reihenfolge, `hp0` = Anfangswert; mehrere Änderungen (Pfeile der Salve, schnelle Ticks) laufen
  //  aus dem jeweils gerade gezeigten Wert weiter und zählen mit.
  const RAMPE = 300, HALTEN = 250, DRAIN = 270, STUFEN = 9, DSTUFEN = 8, BILD_MS = 1000 / 30;
  const qRampe = (dt) => (dt <= -1e8 ? 1 : clamp((Math.floor(dt / BILD_MS) + 1) / STUFEN));
  const qDrain = (dt) => (dt <= 0 ? 0 : clamp(Math.floor(dt / BILD_MS) / DSTUFEN));
  FX.hpAnim = (ev, hp0, t) => {
    let from0 = hp0, to0 = hp0, ta0 = -1e9, chipTop = null, gainBase = null, ts = -1e9;
    const shownAt = (tt) => from0 + (to0 - from0) * qRampe(tt - ta0);
    const chipAt = (tt) => (chipTop == null ? null : (tt < ts ? chipTop : chipTop + (shownAt(tt) - chipTop) * qDrain(tt - ts)));
    for (const e of ev) {
      if (e.t > t) break;
      const cur = shownAt(e.t), chip = chipAt(e.t);
      if (chip != null && chip > cur + 0.5 && e.t < ts + DRAIN) chipTop = chip; else if (e.t >= ts + DRAIN) chipTop = null;
      if (e.t >= ts) gainBase = null;
      if (e.to < cur) { chipTop = Math.max(chipTop == null ? cur : chipTop, cur); gainBase = null; }
      else if (e.to > cur) { gainBase = Math.min(gainBase == null ? cur : gainBase, cur); chipTop = null; }
      from0 = cur; to0 = e.to; ta0 = e.t; ts = e.t + RAMPE + HALTEN;
    }
    const shown = shownAt(t);
    let chip = chipAt(t); if (chip != null && (chip <= shown + 0.5 || (t >= ts + DRAIN))) chip = null;
    const gain = (gainBase != null && t < ts && gainBase < shown - 0.5) ? gainBase : null;
    return { shown, chip, gain, ziel: to0 };
  };
  /** Balken mit Verlust-/Zuwachsteil. o = { max, shown, chip (obere Grenze des Verlustteils | null), gain (untere Grenze des Zuwachsteils | null), ziel, flash }; Zahl = gerundeter gezeigter Wert. */
  FX.hpBar2 = (m, cx, y, w, o) => {
    const x = cx - Math.floor(w / 2), h = 5, mx = Math.max(1, o.max), frac = clamp(o.ziel / mx);
    m.rect(x - 2, y - 2, w + 4, h + 4, C.creme); m.rect(x - 1, y - 1, w + 2, h + 2, C.tinte);
    const fw = rd(w * clamp(o.shown / mx)), flash = !!o.flash;
    const c = frac > 0.5 ? C.gruen : (frac > 0.25 ? C.gelb : C.rot), cd = frac > 0.5 ? C.gruenM : (frac > 0.25 ? C.org : C.rotD), ch = frac > 0.5 ? C.gruenH : C.creme;
    m.rect(x, y, fw, h, flash ? C.weiss : c); m.rect(x, y + h - 1, fw, 1, flash ? C.creme : cd); m.rect(x, y, fw, 1, flash ? C.weiss : ch);
    if (o.gain != null) {                                                   // Zuwachs: dunkelgrüner Teil
      const gl = rd(w * clamp(o.gain / mx));
      if (fw > gl) { m.rect(x + gl, y, fw - gl, h, C.gruenD); m.rect(x + gl, y, fw - gl, 1, C.gruenM); }
    }
    if (o.chip != null) {                                                   // Verlustteil: dunkelrot mit weißer, gedithert Kante
      const cw = rd(w * clamp(o.chip / mx));
      if (cw > fw) { m.rect(x + fw, y, cw - fw, h, C.rotD); m.rect(x + fw, y + h - 1, cw - fw, 1, C.dunkel); for (let yy = 0; yy < h; yy++) if (!(yy & 1)) m.px(x + cw - 1, y + yy, C.weiss); else if (cw - fw > 1) m.px(x + cw - 2, y + yy, C.hell); }
    }
    for (let i = 1; i < 5; i++) { const gx = x + rd(w * i / 5); m.rect(gx, y, 1, h, C.tinte); }
    const sNum = '' + rd(o.shown); glyph(m, sNum, cx - Math.floor(FX.glyphW(sNum, 1) / 2), y - 11, 1, C.creme, null, C.tinte);
  };
  /** Klangliste relativ zum Salvenstart: [t, name, { volume, rate }] — Lautstärke wurzelskaliert mit der Pfeilzahl; Racket Arrow: zwei gleichzeitige Pings (Rate 1,0 und 1,09 = dissonant). */
  FX.sfxPlan = (plan) => {
    const ev = [], n = plan.n, vs = 1 / Math.sqrt(Math.max(1, n / 2));
    ev.push([0.0, 'spell_cast', { volume: 0.45 }], [plan.P.windup - 0.04, 'projectile', { volume: 0.5 }]);
    for (const a of plan.arrows) {
      ev.push([a.t0, 'projectile', { volume: Math.min(0.5, 0.42 * vs + 0.08) }]);
      const hs = { flame: 'burn', poison: 'poison', hydra: 'poison', bomb: 'heavy_impact', angel: 'slash', golden: 'gold_gain', rainbow: 'pull_sparkle' }[a.kind];
      ev.push([a.tHit, 'damage', { volume: Math.min(0.9, 0.62 * vs + 0.12) }]);
      if (a.kind === 'flame') ev.push([a.tHit, 'elem_fire', { volume: 0.3 * vs + 0.1 }]);
      if (a.kind === 'poison' || a.kind === 'hydra') ev.push([a.tHit, 'elem_acid', { volume: 0.3 * vs + 0.1 }]);
      if (a.kind === 'bomb') ev.push([a.tHit + 0.05, 'elem_fire', { volume: 0.35 * Math.max(0.5, vs), rate: 0.8 }]);
      if (a.kind === 'racket') { ev.push([a.tHit + 0.01, 'ping', { volume: 0.42 * Math.max(0.5, vs), rate: 1.0 }], [a.tHit + 0.01, 'ping', { volume: 0.42 * Math.max(0.5, vs), rate: 1.09 }]); }
      else if (hs) ev.push([a.tHit + 0.01, hs, { volume: (a.kind === 'bomb' ? 0.6 : (a.kind === 'rainbow' || a.kind === 'golden' ? 0.4 : 0.35)) * Math.max(0.5, vs) }]);
    }
    return ev;
  };
  root.PpFx52 = FX;
})(typeof window !== 'undefined' ? window : globalThis);

// ═════════════════════════════════════════════════════════════════
//  TREIBER: Salve im Spiel (DOM-Zonen → Rasterleinwand → 30-Hz-Takt)
// ═════════════════════════════════════════════════════════════════
(function () {
  const PF = window.PpFx52;
  const ZELLEN_JE_KARTE = 36;                     // Heldenkarte ≈ 36–43 Rasterzellen hoch (Prototyp: Zelle = 1 Art-Pixel)
  const WELT_JE_KARTE = 170;                      // Prototyp-Weltmaß: Kartenhöhe 170 Einheiten
  const KIND = { 'Angelfeather Arrow': 'angel', 'Bomb Arrow': 'bomb', 'Flame Arrow': 'flame', 'Golden Arrow': 'golden', 'Hydra Blood Arrow': 'hydra', 'Poisoned Arrow': 'poison', 'Racket Arrow': 'racket', "Rainbow's Arrow": 'rainbow', 'Archer Arrow': 'holz' };
  const kl = (v, a, b) => Math.max(a, Math.min(b, v));
  const rd = Math.round;
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));

  // ── Geschluckte Standard-Anzeigen (Zustandsvergleich des Bretts, app-board.jsx) ──
  const schluck = new Map();
  /** Merkt für ein Ziel den erwarteten Zustand nach der Salve: die Schadenszahl/der Zonenblitz zum Abzug und der Flammenschlag des Brandes entfallen dort einmal. */
  window.ppFx52Schlucken = function (key, hpNach, burn) { schluck.set(key, { hp: hpNach, burn: !!burn, bis: performance.now() + 9000 }); };
  /** art 'hp' (wert = neue HP) oder 'burn': true, wenn die Salve diese Anzeige schon gezeigt hat (wird dabei verbraucht). */
  window.ppFx52Geschluckt = function (key, art, wert) {
    const e = schluck.get(key); if (!e) return false;
    if (performance.now() > e.bis) { schluck.delete(key); return false; }
    if (art === 'hp') { if (e.hp != null && wert === e.hp) { e.hp = null; if (!e.burn) schluck.delete(key); return true; } return false; }
    if (art === 'burn') { if (e.burn) { e.burn = false; if (e.hp == null) schluck.delete(key); return true; } return false; }
    return false;
  };

  /** Kann dieser Client die Salve spielen? (ohne Tab-Sichtbarkeit) — wird dem Server gemeldet (`client_fx`), damit er nur dann wartet. */
  window.ppFx52KannSalve = function () {
    try {
      if (window.PP_RETRO || window._playAnimations === false || window.__ppFxAlt || window.__ppFx52Aus || typeof ppFx30Maler !== 'function') return false;
      if (window.PPPixelAnim && window.PPPixelAnim.KONFIG && window.PPPixelAnim.KONFIG.aktiv === false) return false;
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
      return true;
    } catch (e) { return false; }
  };
  function erlaubt() {
    try {
      if (window.PP_RETRO || window._playAnimations === false || window.__ppFxAlt || window.__ppFx52Aus || typeof ppFx30Maler !== 'function') return false;
      if (window.PPPixelAnim && window.PPPixelAnim.KONFIG && window.PPPixelAnim.KONFIG.aktiv === false) return false;
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
      if (document.hidden) return false;
      return true;
    } catch (e) { return false; }
  }
  const lblOf = (owner, myIdx) => (typeof ownerLbl === 'function' ? ownerLbl(owner, myIdx) : (owner === myIdx ? 'me' : 'opp'));
  function zone(t, myIdx) {
    const l = lblOf(t.owner, myIdx);
    if (t.kind === 'creature') return document.querySelector(`[data-support-zone][data-support-owner="${l}"][data-support-hero="${t.heroIdx}"][data-support-slot="${t.zoneSlot}"]`);
    return document.querySelector(`[data-hero-zone][data-hero-owner="${l}"][data-hero-idx="${t.heroIdx}"]`);
  }

  /** Fensterkoordinate der Oberkante des KOPFES der animierten Heldenfigur dieser Zone (Bezug für HP-Balken/Zahlen: über dem Kopf, nicht an der Zonenkante); null ohne sichtbare Figur. */
  function kopfOben(el) {
    try {
      const platz = el && el._ppFigurPlatz;
      if (!platz || !platz.isConnected || platz.style.display === 'none') return null;
      const cl = platz.classList;
      if (cl.contains('hero-idle-weg') || cl.contains('hero-idle-unsichtbar')) return null;
      const cv = platz.querySelector('canvas.hero-idle-canvas'), e = platz._ppEintrag;
      if (!cv || !e || !e.kern || !e.meta) return null;
      const r = cv.getBoundingClientRect();
      if (!(r.height > 0)) return null;
      return r.top + e.kern.y0 * (r.height / e.meta.frameHeight);
    } catch (err) { return null; }
  }
  window.ppFx52KopfOben = kopfOben;

  /** Verteilung des reellen Schadens: je Pfeil round(reell / n), der LETZTE Pfeil trägt den Rest (Summe exakt). Wäre der Rest negativ (aufgerundete Teilbeträge), wird abgerundet. */
  function verteilung(total, n) {
    total = Math.max(0, Math.round(total || 0));
    if (!total) return new Array(n).fill(0);
    let each = Math.round(total / n), rest = total - each * (n - 1);
    if (rest < 0) { each = Math.floor(total / n); rest = total - each * (n - 1); }
    const out = new Array(n).fill(each); out[n - 1] = rest; return out;
  }
  window.ppFx52Verteilung = verteilung;

  /**
   * Spielt die Salve. P = Nutzlast von `play_arrow_salvo`; o = { myIdx }. true = läuft (der Aufrufer spielt die Standard-Animation NICHT), false = nicht möglich (Aufrufer spielt `P.ersatz`).
   * Test: o.trocken → liefert { plan, ... } ohne Leinwand.
   */
  window.ppFx52Salve = function (P, o) {
    try {
      if (!erlaubt() || !P || !Array.isArray(P.arrows)) return false;
      const myIdx = o && o.myIdx;
      const arrows = P.arrows.filter((a) => KIND[a.n]);
      if (!arrows.length) return false;
      PF.init();
      const einzel = !!P.einzel;                                               // Archer: ein einzelner Pfeil von der Zone der Kreatur (ohne HUD/Zahlen: Schaden, HP-Anzeige und Blitz kommen vom Zustandsvergleich beim Einschlag)
      // Creature als Quelle (Archer): steht ihre Idle-Figur auf der Zone (`zone._ppFigurPlatz`, Creature-Idle-Animationen), startet der Pfeil an der FIGUR — Standpunkt Zonenmitte,
      // Höhe ≈ 60 % der Figurenhöhe (`figZ`, unten); ohne Figur (keine Animation, Figuren aus, eingefahren) wie bisher knapp über der Karte der Support-Zone.
      const srcEl = P.srcKind === 'creature' ? zone({ kind: 'creature', owner: P.srcOwner, heroIdx: P.srcHeroIdx, zoneSlot: P.srcZoneSlot }, myIdx) : zone({ kind: 'hero', owner: P.srcOwner, heroIdx: P.srcHeroIdx }, myIdx), tgtEl = zone(P.tgt, myIdx);
      if (!srcEl || !tgtEl) return false;
      const sr = srcEl.getBoundingClientRect(), tr = tgtEl.getBoundingClientRect();
      if (!(sr.width > 8 && sr.height > 8 && tr.width > 8 && tr.height > 8)) return false;
      const phone = (() => { try { return !!(window.ppIsPhone && window.ppIsPhone()); } catch (e) { return false; } })();
      const n = arrows.length, lod = (n > 8 || phone) ? 1 : 0;
      const hzEl0 = (einzel || P.srcKind === 'creature') ? document.querySelector('[data-hero-zone]') : null;
      const zoneH = Math.max(hzEl0 ? hzEl0.getBoundingClientRect().height : sr.height, 40), S = (typeof ppFxZelle === 'function' ? ppFxZelle(tgtEl) : kl(rd(zoneH / ZELLEN_JE_KARTE), 2, 6)), u = zoneH / WELT_JE_KARTE;   // Rasterzelle = Hero-Pixel des Ziels (vorher aus der Zonenhöhe)   // u: Bildschirmpixel je Welteinheit
      const figZ = (() => {
        if (P.srcKind !== 'creature') return null;
        try {
          const pl = srcEl._ppFigurPlatz;
          if (!pl || !pl.isConnected || pl.style.display === 'none' || pl.classList.contains('hero-idle-weg') || pl.classList.contains('hero-idle-unsichtbar')) return null;
          const cv = pl.querySelector('canvas.hero-idle-canvas'), e = pl._ppEintrag;
          if (!cv || !e || !e.kern || !e.meta) return null;
          const r = cv.getBoundingClientRect(), fuss = typeof e.meta.footY === 'number' ? e.meta.footY : e.kern.y1;
          const h = (fuss - e.kern.y0) * (r.height / e.meta.frameHeight);
          return h > 0 ? kl(0.6 * h / u, 10, 80) : null;
        } catch (err) { return null; }
      })();
      const fo = window.ppFxScrollOffset ? window.ppFxScrollOffset() : { dx: 0, dy: 0 };
      const welt = !!window.ppFxWeltSchicht;
      const sx0 = sr.left + fo.dx, sy0 = sr.top + fo.dy, tx0 = tr.left + fo.dx, ty0 = tr.top + fo.dy;
      const M = rd(2.6 * zoneH);                                               // Rand: Bögen steigen bis ≈ 1,5 Kartenhöhen, Zahlen/Balken über dem Ziel
      const L = Math.min(sx0, tx0) - M, T = Math.min(sy0, ty0) - M, R = Math.max(sx0 + sr.width, tx0 + tr.width) + M, Bt = Math.max(sy0 + sr.height, ty0 + tr.height) + M * 0.5;
      const lx = Math.floor(L / S) * S, ly = Math.floor(T / S) * S;
      const gw = Math.min(1000, Math.ceil((R - lx) / S)), gh = Math.min(800, Math.ceil((Bt - ly) / S));
      if (gw < 16 || gh < 16) return false;
      // Weltkoordinaten (Einheiten) relativ zur Leinwand: x = (Feld-px − lx) / u
      const wx = (px) => (px - lx) / u, wy = (py) => (py - ly) / u;
      const acx = wx(sx0 + sr.width / 2), acy = wy(sy0 + sr.height / 2), bcx = wx(tx0 + tr.width / 2), bcy = wy(ty0 + tr.height / 2);
      const isHero = P.tgt.kind !== 'creature';
      const hzU = tr.height / u, wzU = tr.width / u;
      const feet = 0.2 * hzU, zHit = 0.30 * hzU;
      // Zahlen/HP-Balken nicht aus dem Fenster schieben: reicht die Höhe über dem Ziel nicht, rutschen sie ins Ziel hinein
      const spaltenN = n <= 5 ? n : (n <= 8 ? 4 : 5), zeilen = Math.ceil(n / spaltenN);
      const numSc = n <= 5 ? 2 : 1;
      const blockZellen = zeilen * (8 * numSc + 3) + 8 * numSc + 9 + 14;
      let zTop = 0.74 * hzU;
      { const kt = isHero ? kopfOben(tgtEl) : null;                           // über dem Kopf der Figur (Bezug: Kopfpunkt des Sprites, nicht Zonenkante)
        if (kt != null) { const barTopWin = Math.min(kt, tr.top) - 11 * S; zTop = bcy + feet - 12 - (barTopWin + fo.dy - ly) / u; } }
      const topScreenPx = tr.top + tr.height / 2 + (feet - zTop - 12) * u;                  // Fensterkoordinate der Balkenkante
      const brauchtPx = blockZellen * S + 6;
      if (topScreenPx - brauchtPx < 2) zTop = Math.max(0.2 * hzU, zTop - (brauchtPx - topScreenPx + 2) / u);
      const dir = bcx > acx ? 1 : -1;
      const per = verteilung(P.total, n);
      const plan = PF.plan({
        kinds: arrows.map((a) => KIND[a.n]), total: P.total, perArrow: per, seed: (P.seed || 1) + 1, windup: einzel ? 0.1 : 0.26,
        A: { x: acx + dir * (P.srcKind === 'creature' ? 8 : 22), y: acy + (P.srcKind === 'creature' ? (figZ != null ? 0 : 6) : 34), z: P.srcKind === 'creature' ? (figZ != null ? figZ : 26) : 58 }, B: { x: bcx, y: bcy + feet, z: zHit, rx: Math.min(60, wzU * 0.36), ry: Math.min(14, hzU * 0.09), zr: Math.min(30, hzU * 0.18), zTop },
        fMin: einzel ? 0.62 : (n > 8 ? 0.58 : 0.55), fMax: einzel ? 0.62 : (n > 8 ? 0.85 : 0.82), fan: einzel ? 20 : (n > 8 ? 85 : 62),
      });
      // Anzeige-Status je Pfeil (Engine-Daten) statt Prototyp-Annahme
      plan.arrows.forEach((a, i) => { const pa = arrows[i]; a.burn = pa.burn ? 1 : 0; a.poisonN = pa.poison || 0; a.status = a.burn ? 'burn' : (a.poisonN ? 'poison' : null); a.stacks = a.poisonN; a.dmg = per[i]; });
      if (o && o.trocken) return { plan, S, u, gw, gh, per, isHero };

      // Leinwand (Weltschicht, Feldkoordinaten)
      const wurzel = document.createElement('div');
      wurzel.setAttribute('aria-hidden', 'true'); wurzel.setAttribute('data-pp-px', 'aus');
      wurzel.style.cssText = `position:fixed;left:${lx}px;top:${ly}px;pointer-events:none;z-index:10140;`;
      const cv = document.createElement('canvas');
      cv.width = gw; cv.height = gh;
      cv.style.cssText = `width:${gw * S}px;height:${gh * S}px;image-rendering:pixelated;display:block;`;
      wurzel.appendChild(cv);
      const g2 = cv.getContext('2d'), img = g2.createImageData(gw, gh), m = PF.maler(img.data, gw, gh);
      const proj = (x, y, z) => [(x * u) / S, ((y - z) * u) / S];
      const C = PF.C;
      const hpVor = Math.max(0, P.hpVor | 0), maxHp = Math.max(1, P.maxHp | 0);
      const hits = plan.hits;
      const cum = []; { let c = 0; for (const h of hits) { c += h.dmg; cum.push(c); } }
      const hpEv = hits.map((h, j) => ({ t: h.tHit * 1000, to: Math.max(0, hpVor - cum[j]) }));   // kumulativ angezeigter Schaden in Einschlagsreihenfolge
      const bw = Math.max(18, rd(tr.width / S)), barP = proj(bcx, bcy + feet, zTop + 12), bx = rd(barP[0]), by = rd(barP[1]);
      const zielKey = P.tgt.kind === 'creature' ? `c:${P.tgt.owner}-${P.tgt.heroIdx}-${P.tgt.zoneSlot}` : `h:${P.tgt.owner}-${P.tgt.heroIdx}`;
      const hatBrand = arrows.some((a) => a.burn);
      if (!einzel) window.ppFx52Schlucken(zielKey, P.hpNach, hatBrand && !P.vorBurn);
      if (!einzel) window.ppFx52SalveAktiv(zielKey, performance.now() + (Math.max(plan.tEnd, Math.max(plan.tLast + 0.9, 1.7)) + 0.9) * 1000);   // die allgemeine HP-Anzeige schweigt für dieses Ziel (kein Doppelbild)
      const tHud = Math.max(plan.tLast + 0.9, 1.7);                          // Balken/Status bleiben, bis der echte Zustand da ist
      const ctx = { m, plan, proj, flat: 0.72, lod, G: S, numSc, numLift: 9, keineZahlen: einzel };

      const t0 = performance.now();
      let letzte = -1, vor = null, aus = false, raf = 0;
      const malen = (t) => {
        PF.salve(t, ctx);
        // HUD: HP-Balken und Status wachsen mit den Einschlägen
        let j = -1; for (let k = 0; k < hits.length; k++) if (hits[k].tHit <= t + 1e-6) j = k;
        const dmgNow = j >= 0 ? cum[j] : 0, hpNow = Math.max(0, hpVor - dmgNow), q = j >= 0 ? Math.floor((t - hits[j].tHit) * 30 + 1e-4) : 99;
        if (!einzel && !(t > tHud && (Math.floor(t * 30) & 1))) {
          PF.hpBar2(m, bx, by, bw, Object.assign(PF.hpAnim(hpEv, hpVor, t * 1000), { max: maxHp, flash: q >= 0 && q < 2 }));   // Balken schrumpft/steigt je Pfeil-Einschlag in Stufen (Verlustteil, Zahl zählt mit)
          let ix = bx + Math.floor(bw / 2) + 3; const sy_ = by + 6;
          let burn = P.vorBurn ? 1 : 0, poison = P.vorPoison | 0, popB = false, popP = false;
          for (let k = 0; k <= j; k++) { const a = hits[k], pq = Math.floor((t - a.tHit) * 30 + 1e-4); if (a.burn) { burn = 1; if (pq < 4) popB = true; } if (a.poisonN) { poison += a.poisonN; if (pq < 4) popP = true; } }
          if (burn) { PF.statusIcon(m, 'burn', ix, sy_ - (popB ? 2 : 0)); ix += 10; }
          if (poison) { PF.statusIcon(m, 'poison', ix, sy_ - (popP ? 2 : 0)); PF.glyph(m, 'x' + poison, ix + 9, sy_ + 1, 1, C.creme, null, C.tinte); }
        }
      };
      const stopp = () => { if (aus) return; aus = true; try { cancelAnimationFrame(raf); } catch (e) { /* weg */ } wurzel.remove(); };
      /** Ein Bild zur Effektzeit t (s) zeichnen und hochladen (Schmutzrechteck). */
      const bildBei = (t) => {
        const d = m.d, buf = img.data;
        if (vor) { for (let jj = vor.y0; jj < vor.y1; jj++) buf.fill(0, (jj * gw + vor.x0) * 4, (jj * gw + vor.x1) * 4); }
        d.x0 = gw; d.y0 = gh; d.x1 = 0; d.y1 = 0;
        malen(Math.max(0, t));
        const ux0 = Math.min(vor ? vor.x0 : gw, d.x0), uy0 = Math.min(vor ? vor.y0 : gh, d.y0), ux1 = Math.max(vor ? vor.x1 : 0, d.x1), uy1 = Math.max(vor ? vor.y1 : 0, d.y1);
        if (ux1 > ux0 && uy1 > uy0) g2.putImageData(img, 0, 0, ux0, uy0, ux1 - ux0, uy1 - uy0);
        vor = d.x1 > d.x0 ? { x0: d.x0, y0: d.y0, x1: d.x1, y1: d.y1 } : null;
      };
      if (o && o.manuell) { (welt ? window.ppFxWeltSchicht() : document.body).appendChild(wurzel); return { bildBei, stopp, plan, ende: einzel ? plan.tLast + 0.95 : Math.max(plan.tEnd, tHud + 0.25), sfx: einzel ? [[0.04, 'projectile'], [plan.tLast, 'damage']] : null }; }   // Testhaken: Bilder einzeln zeichnen (Frame-genaue Aufnahme)
      const takt = window.ppTaktRaf || window.requestAnimationFrame;
      const schritt = (jetzt) => {
        if (aus) return;
        if (typeof jetzt !== 'number') jetzt = performance.now();
        const t = (jetzt - t0) / 1000;
        if (t > (einzel ? plan.tLast + 0.95 : Math.max(plan.tEnd, tHud + 0.25))) { stopp(); return; }
        const fr = Math.floor(t * 30 + 1e-4);
        if (fr !== letzte) {
          letzte = fr;
          const mess = window.__ppFx52Messen ? performance.now() : 0;
          if (mess && einzel) (window.__ppFx52Takte || (window.__ppFx52Takte = [])).push([+jetzt.toFixed(2), fr, +(jetzt - t0).toFixed(1)]);   // Messung: Zeitpunkt jedes gezeichneten Takts (Archer-Pfeil)
          bildBei(t);
          if (mess) (window.__ppFx52Zeiten || (window.__ppFx52Zeiten = [])).push(+(performance.now() - mess).toFixed(3));
        }
        raf = takt(schritt);
      };
      (welt ? window.ppFxWeltSchicht() : document.body).appendChild(wurzel);
      raf = takt(schritt);
      setTimeout(stopp, (Math.max(plan.tEnd, tHud) + 2.5) * 1000);          // Notnagel (Tab im Hintergrund: rAF ruht)
      // Heldenfigur: bei jedem Einschlag ein kurzer dunkelroter Blitz (Treffer-Reaktion der Figur, app-fx-31), zeitgleich mit dem Pfeil
      if (!einzel && isHero && window.ppFx31Treffer) for (const h of hits) if (h.dmg > 0) setTimeout(() => { try { window.ppFx31Treffer(tgtEl, h.dmg); } catch (e) { /* weg */ } }, Math.max(0, rd(h.tHit * 1000)));
      // Klang zeitgenau zum Einschlag (Lautstärke wurzelskaliert mit der Pfeilzahl)
      if (window.playSFX) for (const [t, name, op] of (einzel ? [[0.04, 'projectile', { volume: 0.5 }], [plan.tLast, 'damage', { volume: 0.55 }]] : PF.sfxPlan(plan))) window.playSFX(name, Object.assign({ dedupe: 0, category: null, delay: Math.max(0, rd(t * 1000)) }, op));
      window.__ppFx52Letzte = { plan, S, u, gw, gh, per, zielKey };
      return true;
    } catch (e) { try { console.warn('ppFx52Salve', e); } catch (e2) { /* still */ } return false; }
  };

  // ═════════ Allgemeine HP-Anzeige: bei JEDER HP-Änderung (Schaden, Heilung, jede Quelle) kurz am Ziel ═════════
  //  Der Zustandsvergleich des Bretts (app-board.jsx, dort wo die Schaden-/Heilzahlen entstehen) ruft `ppFx52Hp`; die Anzeige erscheint also zeitgleich mit der Zahl. Je Ziel EIN Eintrag
  //  (Balken + aktuelle HP-Zahl, wie in der Salve), weitere Änderungen aktualisieren ihn und verlängern die Anzeige (HP_LEBEN); höchstens HP_MAX gleichzeitig (Handy weniger).
  //  TECHNIK (Kosten): je Eintrag eine eigene KLEINE Leinwand (nur Balken + Zahl), die Bitmaps (weiß blitzend / normal) je (HP, Max, Breite, Zelle) werden einmalig gezeichnet und gecacht;
  //  in der Haltephase wird NICHTS gezeichnet oder hochgeladen (nur Zeitprüfung), beim Ausblinken schaltet nur `visibility`. Die Lage der Zone wird einmal beim Start des Eintrags gelesen
  //  (alle neuen Einträge eines Bildes zusammen: ein einziges erzwungenes Layout). Die Schleife (`ppTaktRaf`) läuft nur, solange Einträge laufen. Die native HP-Anzeige der Karte bleibt unberührt;
  //  der Balken liegt über der Oberkante der Zone. Läuft gerade die Salve für dasselbe Ziel, zeigt nur sie (kein Doppelbild).
  const HP_LEBEN = 1250, HP_FLASH = 3, HP_BLINK = 260, ANIM_ENDE = 300 + 250 + 270 + 80;   // Rampe + Halten + Nachrutschen
  const hpMap = new Map(), salveBis = new Map(), hpCache = new Map(), hpPool = [];
  let hpRaf = 0, hpLetzte = -1, hpS = 0;
  const hpMax = () => { try { return (window.ppIsPhone && window.ppIsPhone()) ? 4 : 8; } catch (e) { return 8; } };
  window.ppFx52SalveAktiv = (key, bis) => { salveBis.set(key, bis); const e = hpMap.get(key); if (e) { hpFrei(e); hpMap.delete(key); } };
  const hpMessen = (name, ms) => { if (window.__ppFx52Messen) (window[name] || (window[name] = [])).push(+ms.toFixed(3)); };
  /** Bitmap (ImageData, auf den Inhalt beschnitten) des Balkens; Schlüssel = alles, was das Bild bestimmt (Zellenbreiten von Füllung/Verlust/Zuwachs, Zahl, Farbband, Blitz). */
  function hpBitmap(smp, max, bw, flash) {
    const w2 = (v) => (v == null ? -1 : rd(bw * clamp(v / max))), fq = clamp(smp.ziel / Math.max(1, max)), band = fq > 0.5 ? 2 : (fq > 0.25 ? 1 : 0);
    const key = w2(smp.shown) + '|' + w2(smp.chip) + '|' + w2(smp.gain) + '|' + rd(smp.shown) + '|' + bw + '|' + band + '|' + (flash ? 1 : 0), hit = hpCache.get(key);
    if (hit) return hit;
    const W = Math.max(bw + 8, 48), H = 20, cx = rd(W / 2), by = 12, out = new ImageData(W, H), m = PF.maler(out.data, W, H);   // feste Größe je Breite: die Leinwand wird nie neu dimensioniert
    PF.hpBar2(m, cx, by, bw, { max, shown: smp.shown, chip: smp.chip, gain: smp.gain, ziel: smp.ziel, flash });
    const r = { id: out, w: W, h: H, ox: -cx, oy: -by, key };
    if (hpCache.size > 160) hpCache.clear();
    hpCache.set(key, r); return r;
  }
  function hpFrei(e) { if (e.cv) { e.cv.remove(); hpPool.push({ cv: e.cv, g: e.g }); e.cv = null; e.g = null; e.bw = e.bh = 0; } }
  function hpStop() { if (hpRaf) { try { cancelAnimationFrame(hpRaf); } catch (e) { /* weg */ } hpRaf = 0; } hpLetzte = -1; }
  function hpNeueLeinwand() {
    const cv = document.createElement('canvas');
    cv.setAttribute('aria-hidden', 'true'); cv.setAttribute('data-pp-px', 'aus');
    cv.style.cssText = 'position:fixed;pointer-events:none;z-index:10139;image-rendering:pixelated;display:block;';
    return { cv, g: cv.getContext('2d') };
  }
  /** Warmlauf im Leerlauf: Leinwände vorbereiten, den Bitmap-Zeichner einmal heiß laufen lassen (kein erstes kaltes Bild beim ersten Treffer). */
  window.ppFx52HpWarm = function () { try { PF.init(); if (window.ppFxWeltSchicht) window.ppFxWeltSchicht(); if (hpPool.length < 8) {                                                // Leinwände vorab anlegen UND einmal sichtbar bemalen (das erste Zeichnen in eine frische Leinwand kostet sonst 10–40 ms)
          const lay = window.ppFxWeltSchicht ? window.ppFxWeltSchicht() : document.body, neu = [];
          while (hpPool.length + neu.length < 8) { const pe = hpNeueLeinwand(); pe.cv.width = 48; pe.cv.height = 20; pe.cv.style.width = '96px'; pe.cv.style.height = '40px'; pe.cv.style.visibility = 'hidden'; pe.cv.style.left = '0px'; pe.cv.style.top = '0px'; lay.appendChild(pe.cv); pe.g.putImageData(new ImageData(48, 20), 0, 0); neu.push(pe); }
          setTimeout(() => { for (const pe of neu) { pe.cv.remove(); hpPool.push(pe); } }, 200);
        } for (const [hp, mx, bw] of [[700, 800, 24], [64, 400, 20], [1234, 2000, 24], [0, 90, 16], [9, 10, 22]]) { for (const t of [0, 40, 120, 260, 400, 700]) { const sm = PF.hpAnim([{ t: 0, to: hp }], Math.min(mx, hp + 60), t); hpBitmap(sm, mx, bw, t < 100); } const sg = PF.hpAnim([{ t: 0, to: Math.min(mx, hp + 90) }], hp, 80); hpBitmap(sg, mx, bw, false); } hpCache.clear(); } catch (e) { /* weg */ } };
  /** Bitmap in die Leinwand des Eintrags schreiben (Größe nur bei Änderung neu setzen: das löscht die Fläche). */
  function hpMalen(e, smp, flash) {
    const t0 = window.__ppFx52Messen ? performance.now() : 0;
    const bmp = hpBitmap(smp, e.max, e.rc.bw, flash);
    if (!e.cv) {
      const pe = hpPool.pop() || hpNeueLeinwand();
      (window.ppFxWeltSchicht ? window.ppFxWeltSchicht() : document.body).appendChild(pe.cv);
      e.cv = pe.cv; e.g = pe.g; e.aus = null;
    }
    const S = e.rc.S;
    if (e.bw !== bmp.w || e.bh !== bmp.h) { e.cv.width = bmp.w; e.cv.height = bmp.h; e.cv.style.width = bmp.w * S + 'px'; e.cv.style.height = bmp.h * S + 'px'; e.bw = bmp.w; e.bh = bmp.h; }
    e.g.putImageData(bmp.id, 0, 0);
    e.cv.style.left = e.rc.x + bmp.ox * S + 'px'; e.cv.style.top = e.rc.y + bmp.oy * S + 'px';
    e.sig = bmp.key;
    if (t0) hpMessen('__ppFx52HpMalen', performance.now() - t0);
  }
  function hpSchritt(jetzt) {
    hpRaf = 0;
    if (!hpMap.size) { hpStop(); return; }
    if (typeof jetzt !== 'number') jetzt = performance.now();
    const fr = Math.floor(jetzt / (1000 / 30)), t0 = window.__ppFx52Messen ? performance.now() : 0;
    if (fr !== hpLetzte) {
      hpLetzte = fr;
      let pending = false; for (const e of hpMap.values()) if (!e.rc) { pending = true; break; }
      if (pending) {                                                        // Lage neuer Einträge: einmal lesen (ein erzwungenes Layout für alle)
        const tr0 = t0 ? performance.now() : 0;
        const fo = window.ppFxScrollOffset ? window.ppFxScrollOffset() : { dx: 0, dy: 0 };
        let S = hpS; if (!S) { const he = document.querySelector('[data-hero-zone]'), hh = he ? he.getBoundingClientRect().height : 60; S = hpS = (typeof ppFxZelle === 'function' ? ppFxZelle(he) : kl(rd(Math.max(hh, 40) / ZELLEN_JE_KARTE), 2, 6)); }   // Zelle = Hero-Pixel
        for (const [key, e] of hpMap) {
          if (e.rc) continue;
          const el = zone({ kind: e.kind, owner: e.owner, heroIdx: e.heroIdx, zoneSlot: e.zoneSlot }, e.myIdx), r = el && el.getBoundingClientRect();
          if (!r || !(r.width > 8 && r.height > 8)) { hpMap.delete(key); continue; }
          const kt = e.kind === 'hero' ? kopfOben(el) : null;                // Balken über dem Kopf der Figur (sonst über der Zone)
          let top = (kt != null ? Math.min(kt, r.top) : r.top) - 11 * S; if (top < 13 * S) top = 13 * S;
          e.rc = { S, bw: Math.max(16, rd(r.width / S)), x: rd(r.left + r.width / 2 + fo.dx), y: rd(top + fo.dy) };
          { const dt = performance.now() - e.t; e.t += dt; for (const v of e.ev) v.t += dt; }   // Lebensdauer und Animation beginnen mit dem ersten sichtbaren Bild
        }
        if (t0) hpMessen('__ppFx52HpRect', performance.now() - tr0);
        if (t0) hpMessen('__ppFx52HpZeiten', performance.now() - t0);
        hpRaf = (window.ppTaktRaf || window.requestAnimationFrame)(hpSchritt);   // Lage lesen und Malen auf getrennte Bilder legen (kein Spitzenbild aus Layout + Zeichnen)
        return;
      }
      const jetztP = performance.now();
      let gemalt = 0, neuAn = 0;                                            // höchstens 4 Bitmaps je Bild (viele Ziele verteilen sich über mehrere Bilder statt ein Bild zu sprengen)
      for (const [key, e] of hpMap) {
        if (!e.rc) continue;
        const alt = jetztP - e.t;
        if (alt > HP_LEBEN) { hpFrei(e); hpMap.delete(key); continue; }
        // Animation (Rampe, Halten, Nachrutschen, Zahl zählt) nur solange sie läuft; danach steht das Bild (nichts zeichnen, nichts hochladen)
        if (alt < ANIM_ENDE || !e.cv) {
          const flash = alt < HP_FLASH * (1000 / 30), smp = PF.hpAnim(e.ev, e.hp0, jetztP);
          const w2 = (v) => (v == null ? -1 : rd(e.rc.bw * clamp(v / e.max))), sig = w2(smp.shown) + '|' + w2(smp.chip) + '|' + w2(smp.gain) + '|' + rd(smp.shown) + '|' + (flash ? 1 : 0);
          if (sig !== e.sigV && ((e.cv && gemalt < 4) || (!e.cv && neuAn < 1))) { if (!e.cv) neuAn++; hpMalen(e, smp, flash); e.sigV = sig; gemalt++; }   // höchstens 1 neue Leinwand je Bild
        }
        if (e.cv) { const aus = alt > HP_LEBEN - HP_BLINK && (fr & 1); if (e.aus !== aus) { e.cv.style.visibility = aus ? 'hidden' : 'visible'; e.aus = aus; } }
      }
      if (t0) hpMessen('__ppFx52HpZeiten', performance.now() - t0);
    }
    if (!hpMap.size) { hpStop(); return; }
    hpRaf = (window.ppTaktRaf || window.requestAnimationFrame)(hpSchritt);
  }
  /**
   * o = { key ('h:<Sitz>-<Held>' | 'c:<Sitz>-<Held>-<Platz>'), kind: 'hero'|'creature', owner (Sitz), heroIdx, zoneSlot, hp (neu), max, myIdx }.
   * Aufrufer: Zustandsvergleich des Bretts (Schaden UND Heilung, jede Quelle). Nicht im Retro-Modus / bei ausgeschalteten Animationen (dort nur der Zustand).
   */
  window.ppFx52Hp = function (o) {
    try {
      if (!o || !(o.max > 0) || !window.ppFx52KannSalve || !window.ppFx52KannSalve() || document.hidden) return false;
      const sb = salveBis.get(o.key); if (sb && performance.now() < sb) return false;
      PF.init();
      const alt = hpMap.get(o.key);
      if (!alt && hpMap.size >= hpMax()) { let ae = null, ak = null; for (const [k, v] of hpMap) if (ae == null || v.t < ae) { ae = v.t; ak = k; } if (ak != null) { hpFrei(hpMap.get(ak)); hpMap.delete(ak); } }
      const hp = Math.max(0, o.hp | 0), max = Math.max(1, o.max | 0), jetzt = performance.now();
      if (alt) {                                                            // weitere Änderung: läuft aus dem gerade gezeigten Wert weiter, die Anzeige verlängert sich
        alt.ev.push({ t: jetzt, to: hp }); if (alt.ev.length > 6) { const v = PF.hpAnim(alt.ev, alt.hp0, alt.ev[1].t - 1).shown; alt.hp0 = v; alt.ev.shift(); }
        alt.max = max; alt.t = jetzt; alt.myIdx = o.myIdx; alt.sigV = null; alt.hp = hp;
        if (!alt.rc) alt.t = jetzt;
      } else hpMap.set(o.key, { kind: o.kind, owner: o.owner, heroIdx: o.heroIdx, zoneSlot: o.zoneSlot, hp, max, myIdx: o.myIdx, t: jetzt, hp0: (o.prev != null ? Math.max(0, o.prev | 0) : hp), ev: [{ t: jetzt, to: hp }], rc: null, sigV: null });
      if (!hpRaf) { hpLetzte = -1; hpRaf = (window.ppTaktRaf || window.requestAnimationFrame)(hpSchritt); }
      return true;
    } catch (e) { return false; }
  };

  // Aufwärmen im Leerlauf: Sprites (8 Arten × 32 Ausrichtungen) einmalig bauen, den Zeichner einmal kalt durchlaufen
  (function aufwaermen() {
    const los = () => {
      try {
        PF.init(); window.ppFx52HpWarm();
        const gw = 220, gh = 140, buf = new Uint8ClampedArray(gw * gh * 4), m = PF.maler(buf, gw, gh);
        const kinds = PF.KINDS, plan = PF.plan({ kinds, total: 200, seed: 3, A: { x: 20, y: 90, z: 58 }, B: { x: 180, y: 70, z: 50, rx: 40, ry: 10, zr: 30, zTop: 120 }, perArrow: kinds.map(() => 25) });
        const ctx = { m, plan, proj: (x, y, z) => [x * 0.25, (y - z) * 0.25], flat: 0.72, lod: 0, numSc: 1, numLift: 9 };
        const schritte = [0.1, 0.4, 0.9, 1.2, 1.6].map((t) => () => { m.d.x0 = gw; m.d.y0 = gh; m.d.x1 = 0; m.d.y1 = 0; buf.fill(0); PF.salve(t, ctx); });
        const ric = window.requestIdleCallback || ((fn) => setTimeout(fn, 60));
        const weiter = () => { const fn = schritte.shift(); if (!fn) return; try { fn(); } catch (e) { /* weg */ } ric(weiter, { timeout: 2500 }); };
        ric(weiter, { timeout: 2500 });
      } catch (e) { /* weg */ }
    };
    setTimeout(() => (window.requestIdleCallback ? window.requestIdleCallback(los, { timeout: 4000 }) : los()), 3500);
  })();
})();
