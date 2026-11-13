// app-fx-43: Symbol-Animationen als Pixelart-Leinwand (statt Emoji/Glyphen mit CSS-Drehung, Schein und Weichzeichner)
//
// ═════════════════════════════════════════════════════════════════
//  Betrifft Brett-Animationen, die bisher Emoji als Symbole benutzten (Blumen/Blätter, Pilz, Wüste, Denkblase, Spinnen, 🆒 …), jeweils mit gedrehten/stufenlos skalierten Glyphen,
//  weichen Verläufen und `blur`/`drop-shadow`. Jetzt: EINE Leinwand je Effekt (`ppSzene`, app-board.jsx: Rasterpixel = 3 Bildschirmpixel, 30 Bilder/s, feste Paletten-Farben,
//  Bayer-Dithering statt Alpha, `data-pp-px="aus"`), die Symbole sind Pixelsprites (`PP_FX43_SPR`: Zeichenraster, harte Kanten, nearest-neighbour), Drehungen nur in
//  Viertelschritten (vorgedrehte Raster-Fassungen; „Wirbeln“ = Sprite-Wechsel), Bewegung ganzzahlig.
//    Effekte (Registry-Name → `window.PpFx43[name]`, in app-board.jsx über `ppFx43Reg` eingehängt):
//      coolness_summon · biomancy_bloom · thicket_cover · biomancy_vines · druid_leaf_storm · deepsea_spores_growth · thought_bubbles · mushroom_spore · sand_reset ·
//      poison_pollen_rain · spider_avalanche · cactus_burst · fan_blow · sand_twister · dark_swarm · mummy_wrap
//    Imperative Ereignisse (socket-Handler in app-board.jsx; mounten eine Szene kurz an `document.body`): `PpFx43.willy({ rect })`, `PpFx43.alleria({ sx, sy, tx, ty })`,
//      `PpFx43.evolution({ cx, cy, up, ms })` (nur die Glyphen-Partikel; Lichtsäule/Ringe bleiben beim Aufrufer).
//  Zeitkurven wie die alten Keyframes (ease-out je Abschnitt; Positionen und Deckung getrennt gerechnet, wie CSS es tut).
// ═════════════════════════════════════════════════════════════════
const PP_FX43_BLUME = ['.aa.aa.', 'ahaaaab', 'aaccaab', '.acccb.', 'aaccaab', 'aaaabbb', '.ab.bb.'];
const PP_FX43_SPR = {
  blume_rosa: { z: PP_FX43_BLUME, p: { a: '#f8b4df', b: '#f174ab', c: '#ffe23d', h: '#ffffff' } },
  blume_rot: { z: PP_FX43_BLUME, p: { a: '#fe5154', b: '#a60f39', c: '#ffe23d', h: '#f9b3b3' } },
  blume_gelb: { z: PP_FX43_BLUME, p: { a: '#ffe23d', b: '#c79e05', c: '#ff8b1a', h: '#fff196' } },
  klee4: { z: ['.GG.GG.', 'GLGdGLG', 'GGGdGGG', '.ddddd.', 'GGGdGGG', 'GLGdGLG', '.GG.GGd'], p: { G: '#20ac37', D: '#167927', L: '#80bf59', d: '#167927' } },
  klee3: { z: ['..GLG..', '.GGGGD.', 'GLGdGLG', 'GGGdGGG', '.GGdGD.', '..DdD..', '...d...'], p: { G: '#20ac37', D: '#167927', L: '#80bf59', d: '#167927' } },
  kraut: { z: ['...GL.G', '..GGGGD', '.GG.dGG', 'GGGdGD.', '.GGdG..', '..GdD..', '..d....'], p: { G: '#20ac37', D: '#167927', L: '#80bf59', d: '#167927' } },
  setzling: { z: ['LGG.GGL', '.GGDGG.', '..GdG..', '...d...', '...d...', '..DdD..', '.BBBBB.'], p: { G: '#20ac37', D: '#167927', L: '#80bf59', d: '#167927', B: '#6e4421' } },
  aehre: { z: ['...Y...', '..yYy..', '..yYy..', '...Y...', '..yYy..', '..yYy..', '...s...'], p: { y: '#ffe23d', Y: '#c79e05', s: '#b29466' } },
  baum: { z: ['..GGG..', '.GLGGG.', 'GGGGGGD', 'GGLGGGD', '.GGGGD.', '..DbD..', '...b...', '...b...'], p: { G: '#20ac37', D: '#167927', L: '#80bf59', b: '#6e4421' } },
  koralle: { z: ['c..c..c', 'c.cCc.c', 'cccCccc', '.ccCcc.', '..cCc..', '..cCc..', '.ccCcc.'], p: { c: '#fe7476', C: '#e94e53' } },
  gedanke: { z: ['..WWWW..', '.WWWWWW.', 'WWWWWWWS', 'WWWWWWWS', '.SSSSSS.', '.WS.....', 'W.......'], p: { W: '#ffffff', S: '#d2d2db' } },
  birne: { z: ['..yYy..', '.yYYYy.', 'yYwYYYy', 'yYYYYYy', '.yYYYy.', '..GgG..', '..ggg..', '...g...'], p: { Y: '#ffe23d', y: '#fad54a', w: '#fffbd2', G: '#9aa3b6', g: '#59606e' } },
  funke: { z: ['...Y...', '...Y...', '..YwY..', 'YYwwwYY', '..YwY..', '...Y...', '...Y...'], p: { Y: '#ffe23d', w: '#fffbd2' },
    klein: { z: ['.Y.', 'YwY', '.Y.'], p: { Y: '#ffe23d', w: '#fffbd2' } } },
  pilz: { z: ['.RRRRR.', 'RRWRRRR', 'RRRRWRR', 'RWRRRRD', '.DDDDD.', '..CCC..', '..CcC..'], p: { R: '#e73b41', D: '#a60f39', W: '#ffffff', C: '#fff8e8', c: '#c5b7a0' },
    klein: { z: ['.RR.', 'RWRR', '.CC.', '.Cc.'], p: { R: '#e73b41', W: '#ffffff', C: '#fff8e8', c: '#c5b7a0' } } },
  wuest: { z: ['....yy.', '....yy.', '.......', '.ssSsss', 'sssSSss', 'SSSSSSS'], p: { y: '#ffe23d', s: '#e0c085', S: '#b29466' },
    klein: { z: ['...y', '.s..', 'ssS.', 'SSSS'], p: { y: '#ffe23d', s: '#e0c085', S: '#b29466' } } },
  topf: { z: ['.yYyYy.', 'yyYyyYy', 'KKKKKKK', 'KkKKKKK', '.KKKKK.', '..K.K..'], p: { y: '#ffe23d', Y: '#c79e05', K: '#282834', k: '#59606e' } },
  muenze: { z: ['.yyy.', 'yYYYo', 'yYyYo', 'yYYYo', '.ooo.'], p: { y: '#fff196', Y: '#ffe23d', o: '#c79e05' } },
  geldsack: { z: ['..BbB..', '...b...', '.BBBBb.', 'BBBYBBb', 'BBYYYBb', 'BBBYBBb', '.bbbbbb'], p: { B: '#9d612f', b: '#6e4421', Y: '#ffe23d' } },
  spinne: { z: ['.K.K.K.', 'K.KKK.K', '.KKRKK.', 'K.KKK.K', '.K...K.'], p: { K: '#702db3', R: '#fe5154' },
    klein: { z: ['K.K', '.K.', 'K.K'], p: { K: '#a040ff' } } },
  dna: { z: ['a.....b', '.a...b.', '..a.b..', '...x...', '..b.a..', '.b...a.', 'b.....a'], p: { a: '#1ca9fd', b: '#fc69c6', x: '#ffffff' } },
  wirbel: { z: ['.BBBBB.', 'BB...BB', 'B.BBB.B', 'B.B.B.B', 'B.B.BBB', 'BB.....', '.BBBBB.'], p: { B: '#1ca9fd' } },
  raute: { z: ['...B...', '..BLB..', '.BLwLB.', 'BLwwwLB', '.BLwLB.', '..BLB..', '...B...'], p: { B: '#1ca9fd', L: '#68c6fd', w: '#e5f5fa' } },
  blatt: { ext: 'blatt' }, blitz: { ext: 'blitz' }, tropfen: { ext: 'tropfen' },
  geist: { ext: 'geist' },
  kaktus: { z: ['..GGD..', '.G.GD.D', '.G.GD.D', '.GGGDDD', '...GD..', '...GD..', '...GD..', '..GGDD.'], p: { G: '#20ac37', D: '#167927' } },
  faecher: { z: ['..rrr..', '.rRrRr.', 'rrRrRrr', 'rRrRrRr', '.R.R.R.', '..tRt..', '...t...'], p: { r: '#fe5154', R: '#a60f39', t: '#b29466' } },
  tornado: { z: ['GGGGGGG', '.gGGGGg', '..GGGg.', '..gGGg.', '...GGg.', '...gG..', '....G..', '....g..'], p: { G: '#b9b9b9', g: '#7f7f7f' } },
  regenbogen: { gen: () => {                                   // 9×5: konzentrische Halbringe (rot, orange, gelb, grün, blau)
    const cols = ['R', 'O', 'Y', 'G', 'B'], z = [];
    for (let y = 0; y < 5; y++) { let r = ''; for (let x = 0; x < 9; x++) { const d = Math.hypot(x - 4, y - 4.2), i = Math.floor((4.8 - d) / 0.8); r += (d <= 4.8 && i >= 0 && i < 5) ? cols[i] : '.'; } z.push(r); }
    return { z, p: { R: '#fe5154', O: '#ff9b3a', Y: '#ffe23d', G: '#4ceb70', B: '#1ca9fd' } };
  } },
};
const _ppFx43Cache = {};
const ppFx43Hell = (hex) => ppSzeneFarbe(ppHex(hex));
/** Sprite übersetzen (einmal): Zeichenraster + auf die Palette gerastete Farben; `rot[q]` = um q Viertelschritte (im Uhrzeigersinn) gedrehte Fassung, träge angelegt. */
function ppFx43Spr(name) {
  let s = _ppFx43Cache[name];
  if (s) return s;
  const d = PP_FX43_SPR[name];
  if (!d) return null;
  const bau = (def) => {
    let z = def.z, p = def.p;
    if (def.ext) { const e = window.PP_PX_SPRITES ? PP_PX_SPRITES[def.ext] : (typeof PP_PX_SPRITES !== 'undefined' ? PP_PX_SPRITES[def.ext] : null); if (!e) return null; z = e.z; p = e.pal; }
    else if (def.gen) { const e = def.gen(); z = e.z; p = e.p; }
    const pal = {}; for (const k in p) pal[k] = ppFx43Hell(p[k]);
    const w = Math.max(...z.map(r => r.length));
    return { rot: [z.map(r => r.padEnd(w, '.'))], pal, w, h: z.length };
  };
  s = bau(d);
  if (s && d.klein) s.klein = bau(d.klein);
  _ppFx43Cache[name] = s;
  return s;
}
function ppFx43Dreh(s, q) {
  q = ((q % 4) + 4) % 4;
  while (s.rot.length <= q) {
    const z = s.rot[s.rot.length - 1], h = z.length, w = z[0].length, n = [];
    for (let y = 0; y < w; y++) { let r = ''; for (let x = 0; x < h; x++) r += z[h - 1 - x][y]; n.push(r); }   // 90° im Uhrzeigersinn
    s.rot.push(n);
  }
  return s.rot[q];
}
/** Sprite zeichnen. (X, Y) Mitte in Rasterpixeln, `px` = gewünschte Kantenlänge in Bildschirmpixeln (nearest-neighbour), a = Deckung (Bayer), q = Viertelschritte, flip = spiegeln. */
function ppFx43Zeichne(g, name, X, Y, px, a, q, flip) {
  if (a <= 0.02 || px <= 0) return;
  let s = ppFx43Spr(name);
  if (!s) return;
  const W = Math.max(1, Math.round(px / (g.S || 3) * 1.15));
  if (s.klein && W <= 4) s = s.klein;
  const k = W / s.w, z = ppFx43Dreh(s, q | 0), h = z.length, w = z[0].length;
  const W2 = Math.max(1, Math.round(w * k)), H2 = Math.max(1, Math.round(h * k));
  const x0 = Math.round(X - W2 / 2), y0 = Math.round(Y - H2 / 2);
  for (let j = 0; j < H2; j++) {
    const row = z[Math.min(h - 1, Math.floor((j + 0.5) / k))];
    for (let i = 0; i < W2; i++) {
      const c = s.pal[row[Math.min(w - 1, Math.floor(((flip ? W2 - 1 - i : i) + 0.5) / k))]];
      if (c) g.put(x0 + i, y0 + j, c, a);
    }
  }
}
const ppFx43Kl = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const ppFx43Seg = (u, a, b) => ppFx43Kl((u - a) / (b - a), 0, 1);
const ppFx43Aus = (x) => 1 - (1 - x) * (1 - x);                      // ease-out
const ppFx43Aus3 = (x) => 1 - Math.pow(1 - x, 3);
const ppFx43AnAus = (x) => x * x * (3 - 2 * x);                      // ease-in-out
const ppFx43Viertel = (grad) => ((Math.round(grad / 90) % 4) + 4) % 4;
const ppFx43Zufall = (a, b) => a + Math.random() * (b - a);
/** Ein-Pixel-Linie mit Deckungsverlauf entlang der Länge (f 0..1 → Deckung). */
function ppFx43Linie(g, x0, y0, x1, y1, farbe, deckungFn) {
  const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 1.5));
  for (let k = 0; k <= n; k++) { const f = k / n; g.put(x0 + (x1 - x0) * f, y0 + (y1 - y0) * f, typeof farbe === 'function' ? farbe(f) : farbe, deckungFn ? deckungFn(f) : 1); }
}

const PpFx43 = {};
window.PpFx43 = PpFx43;
window.PpFx43Spr = ppFx43Spr;

// ── 🆒-Plakette (19×10 Rasterpixel): weißer Rahmen, hellblauer Streifen, blauer Grund, „COOL“ in einem 3×5-Pixelschriftsatz ──
const PP_FX43_COOL = (() => {
  const B = ppFx43Hell('#ffffff'), ST = ppFx43Hell('#4580f6'), G = ppFx43Hell('#0351c9');
  const GL = { C: ['.##', '#..', '#..', '#..', '.##'], O: ['.#.', '#.#', '#.#', '#.#', '.#.'], L: ['#..', '#..', '#..', '#..', '###'] };
  const W = 19, H = 10, m = Array.from({ length: H }, () => Array.from({ length: W }, () => null));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (y === 0 || y === H - 1 || x === 0 || x === W - 1) m[y][x] = B; else m[y][x] = y === 1 ? ST : G;
  }
  'COOL'.split('').forEach((ch, n) => { const x0 = 2 + n * 4; GL[ch].forEach((r, j) => [...r].forEach((c, i) => { if (c === '#') m[3 + j][x0 + i] = B; })); });
  return { m, W, H };
})();
function ppFx43Plakette(g, X, Y, breite, a) {                        // breite in Rasterpixeln
  const k = breite / PP_FX43_COOL.W, W2 = Math.round(PP_FX43_COOL.W * k), H2 = Math.round(PP_FX43_COOL.H * k);
  if (W2 < 2 || H2 < 2) return;
  const x0 = Math.round(X - W2 / 2), y0 = Math.round(Y - H2 / 2);
  for (let j = 0; j < H2; j++) for (let i = 0; i < W2; i++) {
    const c = PP_FX43_COOL.m[Math.min(PP_FX43_COOL.H - 1, Math.floor((j + 0.5) / k))][Math.min(PP_FX43_COOL.W - 1, Math.floor((i + 0.5) / k))];
    g.put(x0 + i, y0 + j, c, a);
  }
}

// ═══════ Coolness Stack ═══════
PpFx43.coolness_summon = ppSzene((g, t, sz, tl) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy;
  // Halo (1200 ms): hellblaue Scheibe, geditherter Schein darum
  { const u = t / 1200;
    if (u >= 0 && u <= 1) {
      const [o, sc] = ppKf(u, [[0, [0, .5]], [.3, [1, 1.15]], [.7, [.85, 1.45]], [1, [0, 1.65]]]);
      const r = 65 * sc / S;
      g.radial(cx, cy, r * 1.5, r * 1.5, [[0, [119, 200, 238], .4], [.66, [119, 200, 238], .26], [1, [119, 200, 238], 0]], o * 0.8);
      g.radial(cx, cy, r, r, [[0, [179, 232, 249], .85], [.64, [104, 198, 253], .55], [1, [104, 198, 253], .12]], o);
    } }
  // Ringe (1100 ms): messing außen, cyan innen (die Drehung eines Rings sieht man nicht — Wachsen und Verblassen bleiben)
  [[60, 'fbe181', 'fbc86a', 3], [42, '7fdfff', '7fdfff', 2]].forEach(([rad, hell, glueh, dick], n) => {
    const u = t / 1100; if (u < 0 || u > 1) return;
    const [o, sc] = ppKf(u, [[0, [0, n ? .4 : .35]], [.3, [1, n ? 1 : 1.05]], [1, [0, n ? 1.4 : 1.55]]], ppFx43Aus3);
    const a = o > 0.6 ? 1 : o / 0.6, r = rad * sc / S;
    g.band(cx, cy, r + 1, r + 1, 1, ppFx43Hell('#' + glueh), a * 0.45);
    g.band(cx, cy, r, r, Math.max(1, Math.round(dick / S)), ppFx43Hell('#' + hell), a);
  });
  // Strahlen
  const WEISS = ppFx43Hell('#ffffff'), HELLB = ppFx43Hell('#b3e8f9');
  tl.beams.forEach((b) => {
    const u = (t - b.delay) / 1000; if (u < 0 || u > 1) return;
    const [o, sy] = ppKf(u, [[0, [0, 0]], [.3, [1, 1]], [1, [0, .6]]]);
    const ar = b.angle * Math.PI / 180, dx = Math.sin(ar), dy = -Math.cos(ar), r0 = (32 - 40 * sy) / S, r1 = (32 + 40 * sy) / S;
    ppFx43Linie(g, cx + dx * r0, cy + dy * r0, cx + dx * r1, cy + dy * r1, (f) => f > 0.6 ? WEISS : HELLB, (f) => o * (0.25 + 0.75 * f));
  });
  // Funken
  tl.sparkles.forEach((s) => {
    const u = (t - s.delay) / 1300; if (u < 0 || u > 1) return;
    const [p, sc, o] = ppKf(u, [[0, [0, .3, 0]], [.25, [.35, 1.1, 1]], [1, [1, .25, 0]]]);
    const n = Math.max(1, Math.round(s.size * sc / S)), x = cx + Math.cos(s.angle) * s.dist * p / S, y = cy + Math.sin(s.angle) * s.dist * p / S;
    const kern = s.cyan ? ppFx43Hell('#b6eff7') : ppFx43Hell('#f9ecb3'), glut = s.cyan ? ppFx43Hell('#66d9ff') : ppFx43Hell('#ffd966');
    if (n >= 2) { g.rect(x - n / 2 - 1, y - n / 2 - 1, n + 2, n + 2, glut, o * 0.4); }
    g.rect(x - n / 2, y - n / 2, n, n, kern, o);
  });
  // 🆒-Plakette (1100 ms ab 80 ms): schnappt auf, fällt zurück, steigt und verblasst
  { const u = (t - 80) / 1100;
    if (u >= 0 && u <= 1) {
      const seg = u < .25 ? ppFx43Aus3(u / .25) : u < .6 ? ppFx43Aus3((u - .25) / .35) : ppFx43Aus3((u - .6) / .4);
      const sc = u < .25 ? .2 + 1.2 * seg : u < .6 ? 1.4 - .25 * seg : 1.15 + .45 * seg;
      const o = u < .25 ? seg : u < .6 ? 1 - .05 * seg : .95 * (1 - seg);
      const up = u < .6 ? 0 : -20 * seg;
      ppFx43Plakette(g, cx, cy + up / S, 42 * sc / S, o);
    } }
}, 1260, (sz) => ({
  beams: Array.from({ length: ppFxN(14) }, (_, i) => ({ angle: (i / 14) * 360, delay: Math.random() * 100 })),
  sparkles: Array.from({ length: ppFxN(22) }, (_, i) => ({ angle: (i / 22) * Math.PI * 2 + Math.random() * 0.3, dist: 50 + Math.random() * 45, size: 3 + Math.random() * 5, delay: Math.random() * 250, cyan: Math.random() < 0.5 })),
}), { radius: 130, z: 10110 });

// ═══════ Pflanzen ═══════
const PP_FX43_BLUMEN = ['blume_rosa', 'blume_rot', 'blume_gelb', 'klee4', 'kraut', 'klee3'];
PpFx43.biomancy_bloom = ppSzene((g, t, sz, fl) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy;
  fl.forEach((f) => {
    const u = (t - f.delay) / f.dur; if (u < 0 || u > 1) return;
    let p, sc, o;
    if (u < 0.6) { const k = ppFx43Aus(u / 0.6); p = k; sc = 0.2 + 0.9 * k; o = u < 0.2 ? ppFx43Aus(u / 0.2) : 1; }
    else { const k = ppFx43Aus((u - 0.6) / 0.4); p = 1 + 0.2 * k; sc = 1.1 - 0.3 * k; o = 1 - k; }
    ppFx43Zeichne(g, f.spr, cx + f.dx * p / S, cy + f.dy * p / S, f.size * sc * 1.15, o, 0);
  });
}, 1700, () => Array.from({ length: ppFxN(16) }, (_, i) => {
  const w = (i / 16) * Math.PI * 2;
  return { dx: Math.cos(w) * (15 + Math.random() * 25), dy: Math.sin(w) * (10 + Math.random() * 20), size: 10 + Math.random() * 14, delay: i * 40 + Math.random() * 60, dur: 600 + Math.random() * 400,
    spr: PP_FX43_BLUMEN[Math.floor(Math.random() * 6)] };
}), { radius: 100, z: 10100 });

PpFx43.thicket_cover = ppSzene((g, t, sz, fl) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy;
  fl.forEach((f) => {
    const u = (t - f.delay) / f.dur; if (u < 0 || u > 1) return;
    let x, y, sc, o, rot;
    if (u < 0.45) { const k = ppFx43Aus3(u / 0.45); x = f.sx + (f.dx - f.sx) * k; y = f.sy + (f.dy - f.sy) * k; sc = 0.35 + 0.8 * k; rot = f.rot + f.spin * k; o = u < 0.18 ? u / 0.18 : 1; }
    else if (u < 0.78) { const k = ppFx43Aus3((u - 0.45) / 0.33); x = f.dx; y = f.dy + 3 * k; sc = 1.15 - 0.1 * k; rot = f.rot + f.spin; o = 1; }
    else { const k = ppFx43Aus3((u - 0.78) / 0.22); x = f.dx; y = f.dy + 3 + 7 * k; sc = 1.05 - 0.1 * k; rot = f.rot + f.spin; o = 1 - k; }
    ppFx43Zeichne(g, f.spr, cx + x / S, cy + y / S, f.size * sc * 1.15, o, ppFx43Viertel(rot));
  });
}, 2500, () => Array.from({ length: ppFxN(34) }, (_, i) => {
  const w = (i / 34) * Math.PI * 2 + Math.random() * 0.35, weite = 46 + Math.random() * 26;
  return { sx: Math.cos(w) * weite, sy: Math.sin(w) * weite * 0.72, dx: Math.cos(w) * (6 + Math.random() * 12), dy: Math.sin(w) * (4 + Math.random() * 9) + 6,
    rot: Math.random() * 360, spin: (Math.random() < 0.5 ? -1 : 1) * (25 + Math.random() * 55), delay: i * 14 + Math.random() * 60, dur: 900 + Math.random() * 500,
    spr: ['kraut', 'setzling', 'klee3', 'blatt', 'aehre', 'baum', 'klee4'][Math.floor(Math.random() * 7)], size: 15 + Math.random() * 16 };
}), { radius: [120, 100], z: 10100 });

PpFx43.biomancy_vines = ppSzene((g, t, sz, fl) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy;
  fl.forEach((f) => {
    const u = (t - f.delay) / f.dur; if (u < 0 || u > 1) return;
    let k, sc, o, rot;
    if (u < 0.7) { k = ppFx43AnAus(u / 0.7); sc = 0.3 + 0.8 * k; rot = f.rot * k; o = u < 0.3 ? ppFx43AnAus(u / 0.3) : 1; }
    else { const m = ppFx43AnAus((u - 0.7) / 0.3); k = 1; sc = 1.1 - 0.2 * m; rot = f.rot; o = 1 - m; }
    ppFx43Zeichne(g, f.spr, cx + f.dx * (1 - k) / S, cy + f.dy * (1 - k) / S, f.size * sc * 1.15, o, ppFx43Viertel(rot));
  });
}, 1000, () => Array.from({ length: ppFxN(12) }, (_, i) => {
  const w = (i / 12) * Math.PI * 2;
  return { dx: Math.cos(w) * 30, dy: Math.sin(w) * 20, rot: (w * 180 / Math.PI) + 90, delay: i * 30 + Math.random() * 50, dur: 500 + Math.random() * 300,
    spr: ['kraut', 'setzling', 'klee3', 'blatt', 'aehre'][Math.floor(Math.random() * 5)], size: 12 + Math.random() * 10 };
}), { radius: 70, z: 10100 });

PpFx43.druid_leaf_storm = ppSzene((g, t, sz, fl) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy;
  fl.forEach((f) => {
    const u = (t - f.delay) / f.dur; if (u < 0 || u > 1) return;
    let p, sc, o, rot;
    if (u < 0.7) { const k = ppFx43Aus(u / 0.7); p = k; sc = 0.35 + 0.7 * k; rot = f.spin * k; o = u < 0.15 ? ppFx43Aus(u / 0.15) : 1; }
    else { const k = ppFx43Aus((u - 0.7) / 0.3); p = 1 + 0.35 * k; sc = 1.05 - 0.25 * k; rot = f.spin; o = 1 - k; }
    ppFx43Zeichne(g, f.spr, cx + f.dx * p / S, cy + f.dy * p / S, f.size * sc * 1.15, o, ppFx43Viertel(rot));
  });
}, 2100, () => Array.from({ length: ppFxN(36) }, () => {
  const w = Math.random() * Math.PI * 2, dist = 70 + Math.random() * 90;
  return { dx: Math.cos(w) * dist, dy: Math.sin(w) * dist * 0.75, spin: (Math.random() < 0.5 ? -1 : 1) * (180 + Math.random() * 540), delay: Math.random() * 220, dur: 750 + Math.random() * 500,
    spr: ['kraut', 'setzling', 'klee3', 'blatt', 'aehre', 'klee4'][Math.floor(Math.random() * 6)], size: 14 + Math.random() * 14 };
}), { radius: [240, 190], z: 10100 });

PpFx43.deepsea_spores_growth = ppSzene((g, t, sz, tl) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy;
  // dunkelroter Puls über der Kreaturkarte (1600 ms): geditherter Verlauf, ein dünner Rahmen für den Schein
  { const u = t / 1600;
    if (u >= 0 && u <= 1) {
      const [o, sc] = ppKf(u, [[0, [0, .6]], [.3, [1, 1.05]], [.7, [.8, 1]], [1, [0, 1.08]]]);
      const rx = 35 * sc / S, ry = 48 * sc / S;
      g.radial(cx, cy, rx, ry, [[0, [192, 20, 28], .55], [.78, [120, 0, 20], .3], [1, [120, 0, 20], .12]], o);
      g.frame(Math.round(cx - rx), Math.round(cy - ry), Math.round(rx * 2), Math.round(ry * 2), 1, ppFx43Hell('#b21a29'), o * 0.5);
    } }
  // Ranken wachsen vom Fuß der Karte nach oben/außen (die Drehung ist feste Vorgabe je Ranke)
  tl.tendrils.forEach((r) => {
    const u = (t - r.delay) / r.dur; if (u < 0) return;
    const sy = ppKf(Math.min(1, u), [[0, [0]], [.6, [1.08]], [1, [1]]])[0], ar = r.angle * Math.PI / 180, L = r.len * sy / S;
    const x0 = cx, y0 = cy + 24 / S, x1 = x0 + Math.sin(ar) * L, y1 = y0 - Math.cos(ar) * L;
    g.line(x0, y0, x1, y1, ppFx43Hell(r.shade), 1, Math.max(1, Math.round(r.width / S)));
  });
  // Wedel (Alge/Koralle) schießen an den Rankenspitzen auf
  tl.fronds.forEach((f) => {
    const u = (t - f.delay) / f.dur; if (u < 0 || u > 1) return;
    const k = ppFx43Aus(ppFx43Seg(u, 0, 0.3)), k2 = ppFx43Aus(ppFx43Seg(u, 0.3, 1)), y = -8 - 6 * k - 12 * k2, sc = u < 0.3 ? 0.2 + 0.9 * k : 1.1 - 0.1 * k2, o = u < 0.3 ? k : 1 - 0.1 * k2;
    ppFx43Zeichne(g, f.spr, cx + (f.xOff + f.size / 2) / S, cy + (y + f.size / 2) / S, f.size * sc * 1.15, o, 0);
  });
}, 1500, () => ({
  tendrils: Array.from({ length: ppFxN(8) }, (_, i) => ({ angle: -70 + (i * 20) + (Math.random() * 10 - 5), len: 28 + Math.random() * 18, delay: Math.random() * 200, dur: 800 + Math.random() * 300,
    width: 2.5 + Math.random() * 2, shade: (i % 3 === 0) ? '#780014' : (i % 3 === 1 ? '#3b9159' : '#2b457e') })),
  fronds: Array.from({ length: 5 }, () => ({ xOff: -18 + Math.random() * 36, delay: 150 + Math.random() * 250, dur: 700 + Math.random() * 200, size: 10 + Math.random() * 8, spr: Math.random() < 0.5 ? 'kraut' : 'koralle' })),
}), { radius: [90, 90], z: 10110 });

// ═══════ Gedanken, Pilze, Wüste, Pollen, Spinnen ═══════
PpFx43.thought_bubbles = ppSzene((g, t, sz, bl) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy;
  bl.forEach((b) => {
    const u = (t - b.delay * 1000) / 900; if (u < 0 || u > 1) return;
    const k = ppFx43Aus(ppFx43Seg(u, 0, 0.25)), k2 = ppFx43Aus(ppFx43Seg(u, 0.25, 0.7)), k3 = ppFx43Aus(ppFx43Seg(u, 0.7, 1));
    const rise = u < 0.25 ? 0.3 * k : u < 0.7 ? 0.3 + 0.5 * k2 : 0.8 + 0.2 * k3;
    const sc = u < 0.25 ? 0.4 + 0.7 * k : u < 0.7 ? 1.1 - 0.1 * k2 : 1 - 0.4 * k3, o = u < 0.25 ? k : u < 0.7 ? 1 - 0.1 * k2 : 0.9 * (1 - k3);
    ppFx43Zeichne(g, b.spr, cx + (b.x + b.size / 2) / S, cy + (-10 + b.size / 2 + b.rise * rise) / S, b.size * sc * 1.15, o, 0);
  });
}, 1500, () => [
  { spr: 'gedanke', x: -15, delay: 0, size: 20, rise: -40 },
  { spr: 'birne', x: 10, delay: 0.2, size: 24, rise: -55 },
  { spr: 'gedanke', x: -5, delay: 0.4, size: 16, rise: -35 },
  { spr: 'funke', x: 15, delay: 0.15, size: 14, rise: -50 },
  { spr: 'gedanke', x: -20, delay: 0.35, size: 18, rise: -45 },
], { radius: 80, z: 9999 });

/** Weiche Wolke → Pixelwolke: gefüllte Scheibe mit geditherter Randzone (statt `blur`). */
function ppFx43Wolke(g, X, Y, durchm, farbe, a) {
  const r = durchm / 2 / (g.S || 3);
  if (r < 0.9) { g.put(X, Y, farbe, a); return; }
  g.disc(X, Y, r + 0.9, farbe, a * 0.4);
  g.disc(X, Y, Math.max(0.6, r - 0.2), farbe, a);
}
PpFx43.mushroom_spore = ppSzene((g, t, sz, tl) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy;
  tl.forEach((p) => {
    const u = (t - p.delay) / p.dur; if (u < 0 || u > 1) return;
    const [fx, fy, sc, o] = ppKf(u, [[0, [0, 0, .5, 0]], [.25, [.3, .2, 1.1, .9]], [.7, [1, .7, .9, .7]], [1, [1.2, 1, .3, 0]]]);
    const x = cx + p.tx * fx / S, y = cy + p.ty * fy / S;
    if (p.pilz) ppFx43Zeichne(g, 'pilz', x, y, (p.size + 2) * sc * 1.15, o, 0);
    else ppFx43Wolke(g, x, y, p.size * sc, p.farbe, o * p.alpha);
  });
}, 900, () => Array.from({ length: ppFxN(20) }, () => {
  const w = Math.random() * Math.PI * 2, dist = 8 + Math.random() * 28, drift = -15 - Math.random() * 25;
  return { tx: Math.cos(w) * dist, ty: Math.sin(w) * dist + drift, size: 5 + Math.random() * 8, delay: Math.random() * 150, dur: 400 + Math.random() * 300, pilz: Math.random() < 0.35,
    farbe: ppSzeneFarbe([80 + Math.random() * 60, 120 + Math.random() * 60, 40 + Math.random() * 40]), alpha: 0.6 + Math.random() * 0.3 };
}), { radius: 80, z: 9999 });

PpFx43.sand_reset = ppSzene((g, t, sz, tl) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy;
  tl.forEach((p) => {
    const u = (t - p.delay) / p.dur; if (u < 0 || u > 1) return;
    const k = ppFx43Aus(u), sc = 1 - 0.7 * k, o = u < 0.6 ? 0.9 - 0.2 * (u / 0.6) : 0.7 * (1 - (u - 0.6) / 0.4);
    ppFx43Zeichne(g, p.spr, cx + p.tx * k / S, cy + p.ty * k / S, (p.size + 4) * sc * 1.15, o, 0);
  });
}, 1300, () => Array.from({ length: ppFxN(18) }, (_, i) => {
  const w = ((i / 18) * 360 + Math.random() * 20) * Math.PI / 180, dist = 10 + Math.random() * 30, drift = -20 - Math.random() * 30;
  return { tx: Math.cos(w) * dist, ty: Math.sin(w) * dist + drift, size: 3 + Math.random() * 5, delay: Math.random() * 300, dur: 500 + Math.random() * 400, spr: Math.random() < 0.8 ? 'wuest' : 'funke' };
}), { radius: 90, z: 9999 });

PpFx43.poison_pollen_rain = ppSzene((g, t, sz, tl) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy;
  { const u = t / 400;                                                   // Blitz: violett-gelber Verlauf (400 ms)
    if (u >= 0 && u <= 1) {
      const [o, sc] = ppKf(u, [[0, [0, .5]], [.3, [.8, 1.2]], [1, [0, 1.5]]]), r = 30 * sc / S;
      g.radial(cx, cy, r, r, [[0, [149, 68, 213], .5], [.57, [227, 206, 54], .3], [1, [227, 206, 54], 0]], o);
    } }
  tl.forEach((s) => {
    const u = (t - s.delay) / s.dur; if (u < 0 || u > 1) return;
    const [fx, fy, sc, o] = ppKf(u, [[0, [0, 0, .5, 0]], [.15, [.3, 8, 1, .9]], [.7, [1, 35, .9, .7]], [1, [1.3, 55, .4, 0]]]);
    const x = cx + (s.xOff + s.wobble * fx) / S, y = cy + (-40 + fy) / S;
    if (s.spr) ppFx43Zeichne(g, s.spr, x, y, (s.size + 4) * sc * 1.15, o, 0);
    else { const n = Math.max(1, Math.round(s.size * sc / S)); g.rect(x - n / 2 - 1, y - n / 2 - 1, n + 2, n + 2, s.farbe, o * 0.35); g.rect(x - n / 2, y - n / 2, n, n, s.farbe, o); }
  });
}, 1300, () => Array.from({ length: ppFxN(24) }, () => ({
  xOff: -35 + Math.random() * 70, size: 4 + Math.random() * 7, delay: Math.random() * 300, dur: 500 + Math.random() * 400,
  farbe: ppSzeneFarbe(ppHex(Math.random() < 0.5 ? ['#9544d5', '#702db3', '#b866ff', '#9544d5'][Math.floor(Math.random() * 4)] : ['#e3ce36', '#e3ce36', '#ffe469', '#c79e05'][Math.floor(Math.random() * 4)])),
  wobble: -6 + Math.random() * 12, spr: Math.random() < 0.2 ? (Math.random() < 0.5 ? 'pilz' : 'funke') : null,
})), { radius: [70, 80], z: 10100 });

PpFx43.spider_avalanche = ppSzene((g, t, sz, tl) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, VON = ppFx43Hell('#d6bbf1');
  { const u = t / 300;                                                   // violetter Blitz (300 ms)
    if (u >= 0 && u <= 1) {
      const [o, sc] = ppKf(u, [[0, [0, .3]], [.5, [1, 1.2]], [1, [0, 1.5]]]), r = 40 * sc / S;
      g.radial(cx, cy - 40 / S, r, r, [[0, [71, 17, 126], .5], [.7, [71, 17, 126], 0], [1, [71, 17, 126], 0]], o);
    } }
  tl.forEach((s) => {
    const u = (t - s.delay) / s.dur; if (u < 0 || u > 1) return;
    // ease-in je Teilstrecke (-80 → -40 → 80), Deckung wie die Keyframes
    const [px, py, sc, o] = u < 0.15 ? ppKf(u / 0.15, [[0, [0, -80, .5, 0]], [1, [0, -40, 1, 1]]], true) : ppKf((u - 0.15) / 0.85, [[0, [0, -40, 1, 1]], [1, [1, 80, .7, 0]]], (f) => f * f);
    const x = cx + (s.startX + s.drift * px) / S, y = cy + (-60 + py) / S;
    if (s.punkt) g.put(x, y, VON, o);
    else ppFx43Zeichne(g, 'spinne', x, y, s.size * sc * 1.15, o, 0);
  });
}, 1350, () => Array.from({ length: ppFxN(80) }, () => ({
  startX: -60 + Math.random() * 120, delay: Math.random() * 600, dur: 300 + Math.random() * 400, size: 6 + Math.random() * 8, drift: -15 + Math.random() * 30, punkt: Math.random() < 1 / 3,
})), { radius: [90, 150], z: 10100 });

PpFx43.cactus_burst = ppSzene((g, t, sz, tl) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy;
  tl.forEach((p) => {
    const u = (t - p.delay) / p.dur; if (u < 0 || u > 1) return;
    const [fx, fy, sc, o] = ppKf(u, [[0, [0, 0, .4, 0]], [.2, [.3, .3, 1.2, 1]], [.6, [1, 1, 1, .8]], [1, [1.3, 1.2, .2, 0]]]);
    const x = cx + p.tx * fx / S, y = cy + p.ty * fy / S;
    if (p.kaktus) ppFx43Zeichne(g, 'kaktus', x, y, (p.size + 4) * sc * 1.15, o, 0);
    else { const n = Math.max(1, Math.round(p.size * sc / S)); if (n >= 2) g.rect(x - n / 2 - 1, y - n / 2 - 1, n + 2, n + 2, p.farbe, o * 0.35); g.rect(x - n / 2, y - n / 2, n, n, p.farbe, o * 0.9); }
  });
}, 900, () => Array.from({ length: ppFxN(16) }, (_, i) => {
  const w = ((i / 16) * 360 + Math.random() * 22) * Math.PI / 180, dist = 12 + Math.random() * 22, drift = -8 - Math.random() * 15;
  return { tx: Math.cos(w) * dist, ty: Math.sin(w) * dist + drift, size: 6 + Math.random() * 8, delay: Math.random() * 100, dur: 400 + Math.random() * 300, kaktus: Math.random() < 0.4,
    farbe: ppSzeneFarbe([60 + Math.random() * 40, 140 + Math.random() * 60, 50 + Math.random() * 30]) };
}), { radius: 80, z: 9999 });

PpFx43.fan_blow = ppSzene((g, t, sz, tl) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy;
  tl.forEach((p) => {
    const u = (t - p.delay) / p.dur; if (u < 0 || u > 1) return;
    if (p.fan) {
      const [sc, o, dx] = ppKf(u, [[0, [.5, 0, 0]], [.3, [1.3, 1, 0]], [.6, [1.1, .8, 0]], [1, [.8, 0, 20]]]);
      ppFx43Zeichne(g, 'faecher', cx + (p.x + p.size / 2 + dx) / S, cy + (p.y + p.size / 2) / S, p.size * sc * 1.15, o, 0);
    } else {                                                             // Windlinie: Strich in Wurfrichtung, wächst und fliegt davon
      const [dx, sx, o] = ppKf(u, [[0, [0, .5, 0]], [.3, [10, 1.5, .8]], [1, [p.dist, .3, 0]]]), ar = p.angle * Math.PI / 180, L = p.size * sx / S;
      const x0 = cx + (p.x + dx) / S, y0 = cy + (p.y + 1) / S;
      ppFx43Linie(g, x0, y0, x0 + Math.cos(ar) * L, y0 + Math.sin(ar) * L, p.farbe, () => o);
    }
  });
}, 1000, () => [
  ...Array.from({ length: ppFxN(6) }, (_, i) => ({ fan: true, x: -12 + Math.random() * 24, y: -5 + Math.random() * 10, delay: i * 40, dur: 500 + Math.random() * 200, size: 14 + Math.random() * 6 })),
  ...Array.from({ length: ppFxN(14) }, () => ({ fan: false, x: -8 + Math.random() * 16, y: -10 + Math.random() * 20, delay: 50 + Math.random() * 200, dur: 400 + Math.random() * 300, size: 8 + Math.random() * 16,
    angle: -30 + Math.random() * 60, dist: 40 + Math.random() * 30, farbe: ppSzeneFarbe([200 + Math.random() * 55, 180 + Math.random() * 50, 120 + Math.random() * 80]) })),
], { radius: 90, z: 9999 });

PpFx43.sand_twister = ppSzene((g, t, sz, tl) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy;
  tl.forEach((p) => {
    const u = (t - p.delay) / p.dur; if (u < 0 || u > 1) return;
    const [th, x, y, o] = ppKf(u, [[0, [0, 2, 0, 0]], [.3, [180, p.radius, -.3 * p.rise, .9]], [.7, [360, p.radius, -.7 * p.rise, .7]], [1, [540, .5 * p.radius, -p.rise, 0]]]);
    const a = (p.angle + th) * Math.PI / 180, c = Math.cos(a), si = Math.sin(a), n = Math.max(1, Math.round(p.size / S));
    g.rect(cx + (x * c - y * si) / S - n / 2, cy + (x * si + y * c) / S - n / 2, n, n, p.farbe, o);
  });
  { const u = (t - 100) / 700;                                           // Windhose in der Mitte: das „Wirbeln“ ist ein Spiegel-Wechsel des Sprites im 4-Bilder-Takt
    if (u >= 0 && u <= 1) {
      const [sc, o, up] = ppKf(u, [[0, [.3, 0, 0]], [.4, [1.3, 1, 0]], [1, [.5, 0, -20]]]);
      ppFx43Zeichne(g, 'tornado', cx, cy + up / S, 18 * sc * 1.15, o, 0, Math.floor(t / 100) % 2 === 1);
    } }
}, 900, () => Array.from({ length: ppFxN(24) }, (_, i) => ({
  angle: (i / 24) * 360 * 2 + Math.random() * 30, radius: 4 + (i / 24) * 18, size: 3 + Math.random() * 4, delay: i * 20, dur: 600 + Math.random() * 200, rise: 10 + (i / 24) * 30,
  farbe: ppSzeneFarbe([190 + Math.random() * 40, 160 + Math.random() * 40, 100 + Math.random() * 40]),
})), { radius: 80, z: 9999 });

PpFx43.dark_swarm = ppSzene((g, t, sz, tl) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy;
  tl.forEach((p) => {
    const u = (t - p.delay) / p.dur; if (u < 0 || u > 1) return;
    const [fx, fy, sc, o] = ppKf(u, [[0, [0, 0, .3, 0]], [.2, [.3, .3, 1.2, .95]], [.5, [1, 1, 1, 1]], [.8, [.6, 1.3, .8, .8]], [1, [1, 1, .2, 0]]], ppFx43AnAus);
    const x = cx + p.tx * fx / S, y = cy + (p.ty * fy + (u > .8 ? 10 * ppFx43Seg(u, .8, 1) : 0)) / S, n = Math.max(1, Math.round(p.size * sc / S));
    g.rect(x - n / 2 - 1, y - n / 2 - 1, n + 2, n + 2, p.glut, o * 0.4);
    if (n >= 3) g.disc(x, y, n / 2, p.farbe, o); else g.rect(x - n / 2, y - n / 2, n, n, p.farbe, o);
    if (n >= 2) g.put(x - 0.5, y - 0.5, p.kern, o);
  });
}, 700, () => Array.from({ length: ppFxN(22) }, () => {
  const w = Math.random() * Math.PI * 2, dist = 5 + Math.random() * 25;
  return { tx: Math.cos(w) * dist, ty: Math.sin(w) * dist, size: 4 + Math.random() * 6, delay: Math.random() * 200, dur: 300 + Math.random() * 300,
    farbe: ppSzeneFarbe([120 + Math.random() * 40, 20 + Math.random() * 30, 160 + Math.random() * 60]), kern: ppFx43Hell('#a040ff'), glut: ppFx43Hell('#702db3') };
}), { radius: 70, z: 9999 });

PpFx43.mummy_wrap = ppSzene((g, t, sz, tl) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy;
  tl.forEach((p) => {
    const u = (t - p.delay) / p.dur; if (u < 0 || u > 1) return;
    const [x, y, th, sx, o] = ppKf(u, [[0, [p.sx, p.sy, 0, .3, 0]], [.4, [0, 0, 180, 1.2, .9]], [.7, [p.ex, p.ey, 300, 1, .8]], [1, [p.ex, p.ey, 360, .5, 0]]], (f) => f * f);
    const a = th * Math.PI / 180, L = p.width * sx / 2 / S, X = cx + x / S, Y = cy + y / S, d = Math.max(1, Math.round(p.height / S));
    g.line(X - Math.cos(a) * L, Y - Math.sin(a) * L, X + Math.cos(a) * L, Y + Math.sin(a) * L, p.farbe, o, d);
  });
  { const u = (t - 100) / 600;
    if (u >= 0 && u <= 1) { const [sc, o, up] = ppKf(u, [[0, [.3, 0, 0]], [.4, [1.4, 1, -6]], [1, [.6, 0, -15]]]); ppFx43Zeichne(g, 'geist', cx, cy + up / S, 22 * sc * 1.15, o, 0); }
  }
}, 900, () => Array.from({ length: ppFxN(12) }, (_, i) => {
  const w = ((i / 12) * 360 + Math.random() * 30) * Math.PI / 180, dist = 6 + Math.random() * 20;
  return { sx: Math.cos(w) * 35, sy: Math.sin(w) * 35, ex: Math.cos(w) * dist, ey: Math.sin(w) * dist, width: 12 + Math.random() * 16, height: 3 + Math.random() * 2, delay: i * 30 + Math.random() * 60, dur: 400 + Math.random() * 300,
    farbe: ppSzeneFarbe(Math.random() < 0.5 ? [204, 183, 153] : [168, 147, 112]) };
}), { radius: 70, z: 9999 });

// ═══════ Imperative Ereignisse (socket-Handler) ═══════
/** Eine Szene kurz an `document.body` hängen: `Comp` ist eine `ppSzene`-Komponente; nach `ms` wird sie wieder abgebaut. */
function ppFx43Mount(Comp, props, ms) {
  try {
    if (window._playAnimations === false || !window.ReactDOM || !ReactDOM.createRoot) return;
    const host = document.createElement('div');
    host.setAttribute('data-pp-fx43', '1');
    document.body.appendChild(host);
    const root = ReactDOM.createRoot(host);
    root.render(React.createElement(Comp, props));
    setTimeout(() => { try { root.unmount(); } catch (e) { /* weg */ } host.remove(); }, ms);
  } catch (e) { /* ohne Effekt */ }
}
const PP_FX43_WILLY = ['klee4', 'regenbogen', 'muenze', 'topf', 'klee3', 'geldsack', 'regenbogen', 'klee4', 'muenze', 'geldsack', 'klee3', 'topf'];
const PpFx43WillySzene = ppSzene((g, t, sz, tl) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, w = sz.props.w, h = sz.props.h;
  { const u = t / 1800;                                                  // goldgrüner Glanz über der Heldenkarte (1800 ms, wie `ascensionBurstAnim`)
    if (u >= 0 && u <= 1) {
      const [o, sc] = ppKf(u, [[0, [0, .5]], [.15, [1, 1.3]], [.4, [.8, 1]], [1, [0, 2.5]]]);
      g.radial(cx, cy, w / 2 * sc / S, h / 2 * sc / S, [[0, [250, 213, 74], .8], [.4, [61, 220, 87], .4], [.7, [61, 220, 87], 0], [1, [61, 220, 87], 0]], o);
    } }
  tl.forEach((p) => {
    const u = (t - p.delay) / 1600; if (u < 0 || u > 1) return;
    const [fx, fy, sc, o, rot] = ppKf(u, [[0, [0, 0, .3, 0, 0]], [.25, [.3, .2, 1.2, 1, 30]], [1, [1, 1, .5, 0, 120]]]);
    ppFx43Zeichne(g, p.spr, cx + p.dx * fx / S, cy + p.dy * fy / S, p.size * sc * 1.15, o, ppFx43Viertel(rot));
  });
}, 2200, () => Array.from({ length: 24 }, (_, i) => {
  const w = ((i / 24) * 360 + Math.random() * 30) * Math.PI / 180;
  return { dx: Math.cos(w) * (25 + Math.random() * 60), dy: -(20 + Math.random() * 80), delay: Math.random() * 500, size: 12 + Math.random() * 10, spr: PP_FX43_WILLY[i % PP_FX43_WILLY.length] };
}), { radius: (p) => [Math.max(130, p.w * 1.3), Math.max(170, p.h * 1.3)], z: 10000 });
PpFx43.willy = ({ rect }) => ppFx43Mount(PpFx43WillySzene, { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, w: rect.width, h: rect.height }, 2400);

const PpFx43AlleriaSzene = ppSzene((g, t, sz, tl) => {
  const S = sz.S, p = sz.props, ox = sz.cx + (p.sx - p.x) / S, oy = sz.cy + (p.sy - p.y) / S, dx = (p.tx - p.sx) / S, dy = (p.ty - p.sy) / S;
  const FADE = ppKf(ppFx43Seg(t, 1200, 1500), [[0, [1]], [1, [0]]], true)[0];
  { const k = ppFx43Aus(ppFx43Seg(t, 0, 400));                         // Faden wächst in 0,4 s, hält bis 1,2 s, blendet in 0,3 s aus
    if (k > 0 && FADE > 0) ppFx43Linie(g, ox, oy, ox + dx * k, oy + dy * k, (f) => ppFx43Hell(f < 0.5 ? '#b9b9b9' : '#e6e6e6'), () => FADE * (k < 0.3 ? k / 0.3 : 1)); }
  tl.forEach((s) => {
    const u = (t - s.delay) / 700; if (u < 0 || u > 1) return;
    const k = ppFx43AnAus(u), o = u < 0.1 ? u / 0.1 : u > 0.9 ? (1 - u) / 0.1 : 1;
    ppFx43Zeichne(g, 'spinne', ox + dx * k, oy - 8 / S + dy * k, 14 * 1.3, o, 0, u > 0.5);
  });
}, 1700, () => Array.from({ length: 6 }, (_, s) => ({ delay: 300 + s * 120 })),
{ radius: (p) => [Math.abs(p.tx - p.sx) / 2 + 40, Math.abs(p.ty - p.sy) / 2 + 40], z: 10001 });
PpFx43.alleria = ({ sx, sy, tx, ty }) => ppFx43Mount(PpFx43AlleriaSzene, { x: (sx + tx) / 2, y: (sy + ty) / 2, sx, sy, tx, ty }, 1900);

const PP_FX43_EVO_UP = ['dna', 'funke', 'blitz', 'wirbel', 'raute'], PP_FX43_EVO_DOWN = ['dna', 'tropfen', 'wirbel'];
const PpFx43EvoSzene = ppSzene((g, t, sz, tl) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, ms = sz.props.ms;
  tl.forEach((p) => {
    const u = (t - p.delay) / ms; if (u < 0 || u > 1) return;
    const k = ppFx43Aus(u), o = u < 0.2 ? u / 0.2 : 1 - (u - 0.2) / 0.8, sc = 0.4 + 0.9 * k;
    ppFx43Zeichne(g, p.spr, cx + p.dx * k / S, cy + p.dy * k / S, p.size * sc * 1.15, o, ppFx43Viertel(320 * k));
  });
}, 2100, (sz) => {
  const up = sz.props.up, syms = up ? PP_FX43_EVO_UP : PP_FX43_EVO_DOWN, n = up ? 22 : 12;
  return Array.from({ length: n }, (_, i) => {
    const w = ((i / n) * 360 + Math.random() * 24) * Math.PI / 180, dist = 30 + Math.random() * 70;
    return { dx: Math.cos(w) * dist, dy: Math.sin(w) * dist - (up ? 60 : -40), size: 12 + Math.random() * 12, delay: Math.random() * 400, spr: syms[i % syms.length] };
  });
}, { radius: [140, 160], z: 10000 });
PpFx43.evolution = ({ cx, cy, up, ms }) => ppFx43Mount(PpFx43EvoSzene, { x: cx, y: cy, up, ms }, ms + 500);
