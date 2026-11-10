// app-fx-57: Hammer-Animationen (Magic Hammer, Heavy Hit, Hammer Skeleton) — geschwungene Waffe treibt das Ziel wie einen Nagel in die Bodenlinie (Pixelart-Leinwand)
//
// ═════════════════════════════════════════════════════════════════
//  Vorlage: Prototyp „Magic Hammer“ v5/v5b (Zeichenroutinen `PpFx57`, hier 1:1 übernommen und für das Spiel angepasst).
//  ABLAUF: Eine Waffe wird von der Seite geschwungen (Ausholen → Halt mit Zittern → Ruck → Schwung → EIN Schlag), die Schlagfläche trifft die Oberkante des Ziels (Held-Kopf bzw. Kartenoberkante) und treibt es in
//  die Bodenlinie (= untere Zonenkante); Hit-Stop, Starburst, Druckwellen, Risse, Brocken, Staub, Shake. Danach steckt sie kurz, schwingt zurück, das Ziel poppt mit Überschwingen wieder heraus.
//  HEFTIGKEIT je Karte (Tabelle `CARDS`): Magic Hammer 1,0 (Stahlblock, 53 Bilder) · Heavy Hit 0,6 (Kriegshammer mit Dorn, 44 Bilder) · Hammer Skeleton 0,35 (kleiner rostiger Hammer mit Knochenstiel, von rechts, 36 Bilder).
//  REGISTRY: `magic_hammer`, `heavy_hit_smash`, `hammer_skeleton_smash` (app-board.jsx `ANIM_REGISTRY`; `PP_SQUASH_ANIMS` reicht das Zonen-Element `zoneEl`). Schaden kommt über die Engine NACH dem Hit-Stop:
//  Magic Hammer `_delay(1450)`, Heavy Hit `animDuration: 1200`, Hammer Skeleton `_delay(1000)` (Vorlauf des Mountens ≈ 110 ms eingerechnet). `PP_ANIM_MINDAUER` (app-board.jsx) hält die Animation lange genug am Leben.
//  PIXELGRÖSSE: Rasterzelle S = max(2, round(Hero-Pixel)); Hero-Pixel = Breite des Figuren-Canvas / Frame-Breite (Reihe des Ziels), ohne Figur 2,8125 / 68 · Zonenbreite (geneigtes Brett · 0,975). Der Held wird mit
//  Zellen je Sprite-Pixel = Hero-Pixel / S in der Leinwand gemalt (Stapel gestaucht und versenkt), seine Figur im Brett ist solange unsichtbar (`platz.style.visibility`), dann kein Pixelsprung.
//  QUETSCHUNG: Karte = `.board-card` der Zone (transform-origin unten, translate/scale je Bild), die Zone beschneidet unter ihrer Unterkante (`clip-path`).
//  SHAKE: ganzzahliger `translate` (Eigenschaft `translate`) auf `.board-center` und der Leinwand (Desktop; Handy/`prefers-reduced-motion`/`window.__ppFx57KeinShake`: aus).
//  AUSHOLWINKEL: dynamisch aus der Luft über dem Ziel (Kopf nie über die Fensteroberkante), Gegner in der oberen Reihe holen flacher aus.
//  Rückfall auf den alten Hammer (`ppFx14Hammer`): Animationen aus, Retro, `__ppFxAlt`, `prefers-reduced-motion`, `window.__ppFx57Aus`. Aufwärmen aller Kopf-Winkel im Leerlauf (`window.__ppFx57KeinAufwaermen` schaltet ab).
//  Messung (nur Tests): `window.__ppFx57Messen = true` → `window.__ppFx57Zeiten` = [Art, Bild, ms].
// ═════════════════════════════════════════════════════════════════
(function (root) {
  const FX = {};
  const memo = new Map();
  const rd = Math.round, fl = Math.floor;
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOut = (t) => 1 - Math.pow(1 - clamp(t), 3);
  function H(a, b) {
    let h = Math.imul((a | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b | 0) + 0x7f4a7c15, 0xc2b2ae35);
    h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  }
  FX.H = H;
  function snap(hex) {
    if (memo.has(hex)) return memo.get(hex);
    const h = hex.replace('#', ''), p = window.ppSnapRgb(parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16));
    memo.set(hex, p); return p;
  }
  FX.snap = snap;
  const C = {};
  const CN = {
    tinte: '#12101f', nacht: '#08060c', creme: '#fffbd2', weiss: '#ffffff', grau: '#9aa3b6', asche: '#59606e', rauch: '#3e3e51',
    gelb: '#ffe23d', org: '#ff9a1a', funke: '#f0f075',
    st0: '#ffffff', st1: '#e6e6e6', st2: '#b9b9b9', st3: '#a8a8a8', st4: '#7f7f7f', st5: '#686868', st6: '#535353', st7: '#323232',
    holzD: '#270d0c', rost0: '#5a341a', rost1: '#8e503a', rost2: '#b06746', rost3: '#ca874e', bone0: '#a89370', bone1: '#c5b7a0', bone2: '#ebdcc1', bone3: '#fffbd2', holzM: '#9d612f', holzL: '#e0c085', holz: '#7d3911', holzH: '#be680e', holzHH: '#ca874e',
    leder: '#5a341a', lederH: '#8e503a', lederD: '#3a2412',
    sand: '#c5b7a0', sandD: '#a89370', sandDD: '#886c44', stein: '#7f7f7f', steinH: '#b9b9b9', steinD: '#535353', erde: '#9d612f', erdeD: '#5a341a',
  };
  FX.ensure = () => { if (FX.C) return; memo.clear(); for (const k in CN) C[k] = snap(CN[k]); FX.C = C; };

  // ── Rastermaler (RGBA-Puffer in Zellen, Schmutzrechteck) ──
  const BAY = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
  FX.BAY = BAY;
  function maler(buf, gw, gh) {
    const d = { x0: gw, y0: gh, x1: 0, y1: 0 };
    let mask = null;   // Maske (1 = gesperrt): Schatten und Bodenwirkung liegen UNTER Figur und Karte und sparen deren Zellen aus
    const px = (x, y, c) => {
      x = rd(x); y = rd(y);
      if (x < 0 || y < 0 || x >= gw || y >= gh) return;
      if (mask && mask[y * gw + x]) return;
      if (x < d.x0) d.x0 = x; if (y < d.y0) d.y0 = y; if (x + 1 > d.x1) d.x1 = x + 1; if (y + 1 > d.y1) d.y1 = y + 1;
      const i = (y * gw + x) * 4; buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2]; buf[i + 3] = 255;
    };
    /** Zelle mit Dither-Stufe lv (0..16; 16 = voll) */
    const pd = (x, y, c, lv) => { if (lv >= 16 || BAY[y & 3][x & 3] < lv) px(x, y, c); };
    const rect = (x, y, w, h, c) => {
      x = rd(x); y = rd(y); w = rd(w); h = rd(h);
      let x0 = x, y0 = y, x1 = x + w, y1 = y + h;
      if (x0 < 0) x0 = 0; if (y0 < 0) y0 = 0; if (x1 > gw) x1 = gw; if (y1 > gh) y1 = gh;
      if (x0 >= x1 || y0 >= y1) return;
      if (x0 < d.x0) d.x0 = x0; if (y0 < d.y0) d.y0 = y0; if (x1 > d.x1) d.x1 = x1; if (y1 > d.y1) d.y1 = y1;
      const r = c[0], g = c[1], b = c[2];
      if (mask) { for (let j = y0; j < y1; j++) { let i = (j * gw + x0) * 4, k = j * gw + x0; for (let q = x0; q < x1; q++, i += 4, k++) { if (mask[k]) continue; buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = 255; } } return; }
      for (let j = y0; j < y1; j++) { let i = (j * gw + x0) * 4; for (let q = x0; q < x1; q++, i += 4) { buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = 255; } }
    };
    const disc = (X, Y, r, c, lv) => { X = rd(X); Y = rd(Y); for (let yy = -r; yy <= r; yy++) { const xr = rd(Math.sqrt(Math.max(0, r * r + r * 0.6 - yy * yy))); if (lv == null || lv >= 16) rect(X - xr, Y + yy, 2 * xr + 1, 1, c); else for (let xx = -xr; xx <= xr; xx++) pd(X + xx, Y + yy, c, lv); } };
    const linie = (x0, y0, x1, y1, th, c) => {
      x0 = rd(x0); y0 = rd(y0); x1 = rd(x1); y1 = rd(y1);
      const o = fl(th / 2); x0 -= o; y0 -= o; x1 -= o; y1 -= o;
      const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let err = dx + dy;
      for (let n = 0; n < 900; n++) { rect(x0, y0, th, th, c); if (x0 === x1 && y0 === y1) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; } }
    };
    /** Ellipsenring, dither = jede zweite Zelle */
    const ell = (cx, cy, rx, ry, th, c, dither) => {
      const n = Math.max(16, rd(Math.max(rx, ry) * 6)); let lx = 1e9, ly = 1e9;
      for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2, x = rd(cx + Math.cos(a) * rx), y = rd(cy + Math.sin(a) * ry); if (x === lx && y === ly) continue; lx = x; ly = y; if (dither && ((x + y) & 1)) continue; rect(x, y, th, th, c); }
    };
    /** gefüllte Ellipse als Bayer-Dither (Stufe lv 0..16); hole = Innenradius-Anteil ausgespart */
    const dith = (cx, cy, rx, ry, lv, c, hole) => {
      if (lv <= 0 || rx < 0.5 || ry < 0.5) return;
      const x0 = fl(cx - rx), x1 = Math.ceil(cx + rx), y0 = fl(cy - ry), y1 = Math.ceil(cy + ry);
      for (let y = y0; y <= y1; y++) { const b = (y - cy) / ry, b2 = b * b; if (b2 > 1) continue; for (let x = x0; x <= x1; x++) { const a = (x - cx) / rx, q = a * a + b2; if (q > 1 || (hole && q < hole * hole)) continue; pd(x, y, c, lv); } }
    };
    return { px, pd, rect, disc, linie, ell, dith, d, gw, gh, setMask: (a) => { mask = a; } };
  }
  FX.maler = maler;


  // ═══ MAGIC HAMMER / HEAVY HIT / HAMMER SKELETON — eine gemeinsame Bibliothek (v5) ═══
  // Eine Waffe wird geschwungen (Drehpunkt seitlich vom Ziel) und treibt das Ziel mit EINEM Schlag wie einen Nagel in die Bodenlinie (untere Zonenkante).
  // Waffe = Geometrie (Kopf + Stiel), je Bild mit dem Winkel auf das Zellenraster gerastert (kein Bitmap-Drehen), Kopf je (Stil, Größe, Winkel, Richtung) einmal gebacken.
  // Heftigkeit je Karte (Parameter `I`): Magic Hammer 1,0 · Heavy Hit 0,6 · Hammer Skeleton 0,35. Die Zahlen stehen in CARDS.
  const rad = (d) => d * Math.PI / 180;
  const CARDS = {
    MH: { name: 'MAGIC HAMMER', I: 1.0, style: 'steel', handle: 'wood', dir: 1, long: 1.75, thick: 1.05, hw: 0.28, R: 2.6, burstK: 2.3, burstTips: 12, flashK: 1.6, rings: 3, ringK: 1.0, cracks: 14, puffs: 26, debris: 22, sparks: 30, splint: 14, shakeK: 18, shakeLen: 14, vEnd: 0.10, stop: 7, stuck: 5, tint: 'stone', streak: 3,
      seq: { enter: [-100, -66, 6], creep: [-66, -78, 14], hold: [-78, 9], kick: [-84, 2], swing: [-42, -12], retreat: [-12, -32, -62, -90, -100] },
      sfx: [[0, 'booster_card_whoosh', 0.5, 0.5], [-4, 'booster_card_whoosh', 0.65, 0.55], [-2, 'booster_card_whoosh', 0.85, 0.5], [0, 'heavy_impact', 1.0, 0.6], [0, 'heavy_impact', 0.6, 0.85], [0, 'attack_ram', 0.75, 0.6], [1, 'pull_crack', 0.9, 0.7], [3, 'heavy_impact', 0.5, 0.45], [10, 'booster_card_land', 0.5, 0.5], [13, 'booster_card_land', 0.35, 0.45], [12, 'booster_card_whoosh', 0.5, 0.6]] },
    HH: { name: 'HEAVY HIT', I: 0.6, style: 'war', handle: 'wood2', dir: 1, long: 1.55, thick: 0.75, hw: 0.26, R: 2.8, burstK: 1.35, burstTips: 9, flashK: 0.9, rings: 2, ringK: 0.7, cracks: 9, puffs: 14, debris: 12, sparks: 14, splint: 8, shakeK: 8, shakeLen: 6, vEnd: 0.36, stop: 4, stuck: 4, tint: 'wood', streak: 3,
      seq: { enter: [-95, -58, 5], creep: [-58, -66, 12], hold: [-66, 8], kick: [-70, 1], swing: [-34, -10], retreat: [-12, -36, -70, -100] },
      sfx: [[-4, 'booster_card_whoosh', 0.55, 0.65], [-2, 'booster_card_whoosh', 0.7, 0.6], [0, 'heavy_impact', 0.75, 0.95], [0, 'attack_ram', 0.45, 1.0], [1, 'pull_crack', 0.5, 1.0], [6, 'booster_card_land', 0.35, 0.6], [8, 'booster_card_whoosh', 0.4, 0.7]] },
    HS: { name: 'HAMMER SKELETON', I: 0.35, style: 'rust', handle: 'bone', dir: -1, long: 0.95, thick: 0.62, hw: 0.2, R: 2.4, burstK: 0.85, burstTips: 7, flashK: 0.5, rings: 1, ringK: 0.5, cracks: 5, puffs: 8, debris: 6, sparks: 0, splint: 9, shakeK: 3, shakeLen: 3, vEnd: 0.66, stop: 2, stuck: 3, tint: 'bone', streak: 2,
      seq: { enter: [-90, -48, 4], creep: [-48, -54, 9], hold: [-54, 8], kick: [-58, 1], swing: [-26, -8], retreat: [-12, -40, -80, -100] },
      sfx: [[-3, 'booster_card_whoosh', 0.35, 0.85], [-1, 'booster_card_whoosh', 0.4, 0.8], [0, 'heavy_impact', 0.45, 1.25], [1, 'pull_crack', 0.4, 1.3], [4, 'booster_card_land', 0.3, 0.9], [6, 'booster_card_whoosh', 0.25, 0.9]] },
  };
  FX.CARDS = CARDS;
  const PHI_IMP = -5;
  const lin = (a, b, n) => Array.from({ length: n }, (_, i) => lerp(a, b, (i + 1) / n));
  function buildSeq(c) {
    const q = c.seq, seq = [];
    for (let i = 0; i < q.enter[2]; i++) seq.push(lerp(q.enter[0], q.enter[1], 1 - Math.pow(1 - (i + 1) / q.enter[2], 2)));          // schneller Auftritt, bremst
    seq.push(...lin(q.creep[0], q.creep[1], q.creep[2]));                                                                          // langes, zähes Zurückziehen
    for (let i = 0; i < q.hold[1]; i++) seq.push(q.hold[0]);                                                                       // Halt (Zittern in draw)
    for (let i = 0; i < q.kick[1]; i++) seq.push(q.kick[0]);                                                                       // kurzer Ruck zurück
    seq.push(...q.swing);                                                                                                           // sehr schneller Schwung (2 Bilder)
    const hitF = seq.length;
    for (let i = 0; i < c.stop + c.stuck; i++) seq.push(PHI_IMP);
    const popF = seq.length; seq.push(...q.retreat);
    return { seq: seq.map((d) => qDeg(d)), hitF, popF, len: popF + Math.max(q.retreat.length, 6) + 2 };
  }
  const qDeg = (d) => Math.round(d / 5) * 5;
  FX.phase = (P, f) => { const h = P.hit; if (f >= h.f && f < h.f + h.stop) return 'EINSCHLAG (HIT-STOP)'; if (f < P.hit.f - 12) return 'AUFTRITT / AUSHOLEN'; if (f < P.hit.f - 3) return 'HALT / ZITTERN'; if (f < P.hit.f) return 'SCHWUNG'; if (f < P.popF) return 'EINGETRIEBEN'; return 'ZURUECK / POP'; };
  const feOf = (f, P) => f - clamp(f - P.hit.f, 0, P.hit.stop - 1);

  FX.plan = (o, kind) => {
    const c = CARDS[kind || 'MH'], P = Object.assign({ flat: 0.85, seed: 7, n: 1, stackH: 0 }, o), S = buildSeq(c);
    P.kind = kind || 'MH'; P.c = c; P.seq = S.seq; P.popF = S.popF; P.LEN = S.len; P.hit = { f: S.hitF, stop: c.stop, m: c.I };
    P.fDamage = S.hitF + c.stop; P.dir = c.dir;
    P.stackTop = Math.max(P.stackH, P.th * 0.5); P.H0 = P.stackTop + P.th * 0.5; P.L = P.gy + P.th * 0.5; P.gcy = P.L - 1;
    P.vEnd = Math.max(clamp(5 / P.H0, 0.1, 0.3), c.vEnd);
    P.hHW = Math.max(5, rd(P.tw * c.thick)); P.hHL = Math.max(8, rd(P.tw * c.long)); P.hS = Math.max(3, rd(P.tw * c.hw)); P.R = rd(P.tw * c.R); P.grip = rd(P.tw * 0.5);
    P.W0 = Math.max(P.hHL * 0.8, P.tw * 1.3);
    const u = [Math.cos(rad(PHI_IMP)), Math.sin(rad(PHI_IMP))], vv = [-u[1], u[0]];
    { const sy = P.L - P.H0, cx = P.gx - vv[0] * P.hHL / 2, cy = sy - vv[1] * P.hHL / 2; P.pivot = [cx - u[0] * P.R, cy - u[1] * P.R]; }          // Drehpunkt (unmirrored): Schlagfläche Mitte auf der Oberkante des Stapels
    // Luft über dem Ziel: der Kopf (gedrehtes Rechteck) darf beim Ausholen nie über die Fensteroberkante laufen -> flacher ausholen
    { let phiMin = -100; const lim = (P.topY || 0) + 1;
      for (; phiMin < -25; phiMin += 5) { const co = Math.cos(rad(phiMin)), si = Math.sin(rad(phiMin)), cy = P.pivot[1] + si * P.R, top = cy - (P.hHL / 2) * Math.abs(co) - (P.hHW / 2) * Math.abs(si); if (top >= lim) break; }
      P.phiMin = phiMin; P.seq = P.seq.map((d) => (d < PHI_IMP ? Math.max(d, phiMin) : d)); }
    const s = P.seed, I = c.I, n = (k) => Math.max(c.sparks === 0 && k === c.sparks ? 0 : 3, rd(k * P.n));
    P.cracks = Array.from({ length: c.cracks }, (_, i) => ({ a: (i + 0.5 + (H(s, i + 40) - 0.5) * 0.7) / c.cracks * Math.PI * 2, L: (0.8 + H(s, i + 50) * 0.9) * P.tw * (0.8 + 0.6 * I), id: i }));
    const rn = (key, k) => (k <= 0 ? 0 : Math.max(2, rd(k * P.n)));
    P.debris = Array.from({ length: rn('d', c.debris) }, (_, i) => { const side = i % 2 ? 1 : -1; return { a: (side > 0 ? 0 : Math.PI) + (H(s, i + 100) - 0.5) * 1.7, vh: (0.5 + H(s, i + 110)) * P.tw * 1.4 * (0.5 + 0.6 * I), vv: (0.8 + H(s, i + 120)) * P.tw * 1.5 * (0.5 + 0.6 * I), sz: H(s, i + 130) < 0.3 ? 3 : 2, c: (c.tint === 'bone' ? [C.rost1, C.sandD, C.bone1, C.rost0] : [C.stein, C.steinH, C.steinD, C.erde, C.sandD, C.erdeD])[fl(H(s, i + 140) * (c.tint === 'bone' ? 4 : 6))] }; });
    P.puffs = Array.from({ length: rn('p', c.puffs) }, (_, i) => ({ a: (i + H(s, i + 150) * 0.8) / c.puffs * Math.PI * 2, r0: 2 + H(s, i + 170) * 2, r1: 4 + H(s, i + 180) * 5, rise: 6 + H(s, i + 190) * 10, id: i }));
    P.sparks = Array.from({ length: rn('s', c.sparks) }, (_, i) => { const a = -Math.PI * (0.05 + H(s, i + 200) * 0.9); return { vx: Math.cos(a) * (1 + H(s, i + 210) * 2.4) * P.tw * 2.0 * I, vy: Math.sin(a) * (1 + H(s, i + 220) * 2.0) * P.tw * 1.6 * I, life: 6 + H(s, i + 230) * 8, kreuz: H(s, i + 240) < 0.3, c: (kind === 'HH' ? [C.creme, C.gelb, C.org, C.weiss] : [C.creme, C.gelb, C.weiss, C.funke])[fl(H(s, i + 250) * 4)] }; });
    const SP = { stone: [C.st4, C.st3, C.st6, C.steinH, C.erde], wood: [C.holzHH, C.holzH, C.holzL, C.st3, C.erde], bone: [C.bone2, C.bone1, C.bone3, C.rost2, C.bone0] }[c.tint];
    P.splinters = Array.from({ length: rn('x', c.splint) }, (_, i) => { const a = -Math.PI * (0.02 + H(s, i + 500) * 0.96); return { vx: Math.cos(a) * (0.7 + H(s, i + 510) * 1.4) * P.tw * 1.5 * (0.5 + 0.6 * I), vy: Math.sin(a) * (0.9 + H(s, i + 520) * 1.3) * P.tw * 1.4 * (0.5 + 0.6 * I), sz: 3 + fl(H(s, i + 530) * 3), v: fl(H(s, i + 540) * 4), c: SP[fl(H(s, i + 550) * 5)], life: 12 + H(s, i + 560) * 8 }; });
    P.burst = Array.from({ length: c.burstTips }, (_, i) => ({ a: (i + (H(s, i + 600) - 0.5) * 0.5) / c.burstTips * Math.PI * 2, r: 0.75 + H(s, i + 610) * 0.5 }));
    P.motes = Array.from({ length: rn('m', 8 + 14 * I) }, (_, i) => ({ a: H(s, i + 400) * Math.PI * 2, r: (1.2 + H(s, i + 410) * 1.6) * P.tw, life: 10 + H(s, i + 420) * 14, c: H(s, i + 430) < 0.5 ? C.creme : C.grau }));
    return P;
  };

  FX.pose = (f, P) => {
    const out = { sx: 1, sy: 1, d: 0, v: 1, dx: 0, white: false, shake: [0, 0], hit: -1, hideSprite: false, f, L: P.L, H0: P.H0 }, c = P.c, h = P.hit;
    let v = 1;
    if (f >= 2 && f < h.f - 3) out.dx = (f >= h.f - 14 ? [0, 1, -1, 1, -1, 1, 0, -1] : [0, 0, 1, 0, -1, 0])[f % (f >= h.f - 14 ? 8 : 6)];                          // Zittern des Ziels in der Anspannung
    if (f >= h.f) {
      v = P.vEnd; const j = f - h.f; out.hideSprite = true;
      if (j < h.stop) { out.hit = j; out.white = j < Math.min(2, h.stop); const w = [0.45, 0.8, 0.95, 1, 1, 1, 1, 1][Math.min(j, 7)]; v = lerp(1, P.vEnd, w); }
      else if (f === P.popF - 1 || f === h.f + h.stop + 2) v = Math.max(0.06, P.vEnd * 0.8);                                                                          // Nachbeben im Stand
      const A0 = c.shakeK * (c.I >= 1 ? 1 : 0.85), tot = h.stop + c.shakeLen, amp = A0 * Math.pow(Math.max(0, 1 - j / tot), 1.3);
      if (j < tot && amp >= 1) { const sg = j % 2 ? -1 : 1; out.shake = [rd(sg * amp * 0.4), rd(amp * (j % 2 ? -0.7 : 1))]; }
      if (f >= P.popF) { const q = f - P.popF, T = [0.35, 0.62, 1.14, 0.96, 1.03, 1]; v = q < 6 ? T[q] : 1; if (q >= 5) out.hideSprite = false; }
    }
    out.v = v;
    if (v <= 1) { out.sy = 0.5 + 0.5 * v; out.d = P.H0 * (out.sy - v); out.sx = 1 + 0.22 * (1 - v); } else { out.sy = v; out.d = 0; out.sx = 1 - 0.5 * (v - 1); }
    return out;
  };

  // ── Köpfe (Stile): steel = dunkler Stahlblock wie im Kartenbild des Magic Hammer; war = Kriegshammer mit Dorn (Heavy Hit); rust = kleiner rostiger Hammer (Hammer Skeleton) ──
  const headCache = new Map();
  const LIGHT = [0.55, -0.83];
  const RAMP = () => ({ steel: [C.st7, C.st6, C.st5, C.st4, C.st3, C.st2, C.st1, C.st0], war: [C.st6, C.st5, C.st4, C.st3, C.st2, C.st1, C.st0, C.st0], rust: [C.rost0, C.rost1, C.rost2, C.rost3, C.bone1, C.bone2, C.bone2, C.bone3] });
  function headSprite(P, deg) {
    const st = P.c.style, dir = P.dir, key = st + '|' + P.hHW + 'x' + P.hHL + '|' + dir + '@' + deg; let r = headCache.get(key); if (r) return r;
    const hu = P.hHW / 2, hv = P.hHL / 2, D = Math.ceil(Math.hypot(hu, hv)) + 3, W = 2 * D + 1, co = Math.cos(rad(deg)), si = Math.sin(rad(deg)), RP = RAMP()[st];
    const mask = new Uint8Array(W * W), tone = new Int8Array(W * W).fill(-1), col = new Array(W * W).fill(null), loc = new Float32Array(W * W * 2), lx = LIGHT[0] * dir, ly = LIGHT[1];
    const half = (v) => {                                                                                // Halbbreite (u) bei v
      if (st === 'war') { if (v >= -0.02 * hv) return hu; const t = (v + hv) / (0.98 * hv); return Math.max(1.2, hu * 0.9 * Math.pow(t, 1.15)); }        // Block + Dorn (spitz nach hinten)
      return hu;
    };
    const cham = st === 'steel' ? 3 : (st === 'war' ? 2 : 2);
    for (let j = 0; j < W; j++) for (let i = 0; i < W; i++) {
      const dx = i - D + 0.5, dy = j - D + 0.5, u = dx * co + dy * si, v = -dx * si + dy * co;
      if (Math.abs(v) > hv) continue; const hw = half(v); if (Math.abs(u) > hw) continue;
      if (Math.abs(u) + Math.abs(v - (st === 'war' ? 0 : 0)) > hw + hv - cham && (st !== 'war' || v > 0)) continue;       // Ecken abgefast
      mask[j * W + i] = 1; loc[(j * W + i) * 2] = u; loc[(j * W + i) * 2 + 1] = v;
    }
    const inM = (i, j) => i >= 0 && j >= 0 && i < W && j < W && mask[j * W + i];
    for (let j = 0; j < W; j++) for (let i = 0; i < W; i++) {
      if (!mask[j * W + i]) continue;
      const dx = i - D + 0.5, dy = j - D + 0.5, u = loc[(j * W + i) * 2], v = loc[(j * W + i) * 2 + 1], vr = v / hv, ur = u / hu;
      const s = (dx * lx + dy * ly) / (hv + hu * 0.5), bi = BAY[j & 3][i & 3] / 16;
      let t;
      if (st === 'steel') {                                                                               // dunkler Stahl: Grundton 2 (st5), zum Licht hin heller; Fasen und Bänder
        t = 2 + s * 1.5; t = fl(t + (bi - 0.5) * 0.9); t = clamp(t, 1, 4);
        const e = hv - Math.abs(v);                                                                      // Abstand zum Kopfende
        if (e < 3) t = vr > 0 ? 5 : 4;                                                                    // Fase an den Enden: hell (Schlagkante hell abgenutzt, oberes Ende etwas dunkler)
        else if (e < 5) t = Math.max(1, t - 1);
        if (Math.abs(vr) > 0.42 && Math.abs(vr) < 0.55) { t = 0; if (Math.abs(vr) < 0.44) t = 3; }       // Eisenband: dunkel mit heller Kante
        if (Math.abs(vr) > 0.42 && Math.abs(vr) < 0.55 && (Math.abs(ur) < 0.06 || Math.abs(Math.abs(ur) - 0.55) < 0.05) && Math.abs(vr) > 0.47 && Math.abs(vr) < 0.5) t = 6;   // Nieten
        if (Math.abs((u - 0.35 * hu) + 0.28 * v) < 1.3 && Math.abs(vr) < 0.85) t = Math.min(6, t + 2);   // Glanzstreifen (diagonal)
        if (H(fl(u) * 3 + 1, fl(v) * 7 + 5) < 0.035) t += (H(fl(v), fl(u)) < 0.5 ? -1 : 1);                // Kratzer
      } else if (st === 'war') {
        t = 3 + s * 1.5; t = fl(t + (bi - 0.5) * 0.9); t = clamp(t, 1, 5);
        if (v > 0 && Math.abs(vr) > 0.62 && Math.abs(vr) < 0.72) t = 0;                                    // Ring am Block
        if (hv - v < 3 && v > 0) t = 6;                                                                    // Schlagkante hell
        if (v < 0) { t = Math.min(6, t + 1); if (Math.abs(u) < 1.2) t = 5; }                               // Dorn heller, Grat in der Mitte
        if (H(fl(u) * 3 + 1, fl(v) * 7 + 5) < 0.04) t += (H(fl(v), fl(u)) < 0.5 ? -1 : 1);
      } else {                                                                                             // rust: Rostfleckig, kleine helle Metallkanten
        t = 1.8 + s * 1.3; t = fl(t + (bi - 0.5) * 1.1); t = clamp(t, 0, 3);
        if (H(fl(u / 2) * 7 + 2, fl(v / 2) * 5 + 9) < 0.2) t = Math.max(0, t - 1);                          // dunkle Rostflecken
        if (H(fl(u / 2) * 3 + 8, fl(v / 2) * 11 + 1) < 0.08) t = 3;                                          // helle Roststellen
        if (hv - v < 2.5) t = Math.min(4, t + 1);                                                           // abgewetzte Schlagfläche
      }
      tone[j * W + i] = clamp(t, 0, 7); col[j * W + i] = RP[clamp(t, 0, 7)];
    }
    const cells = [];
    for (let j = -1; j <= W; j++) for (let i = -1; i <= W; i++) {
      if (!inM(i, j)) { if (inM(i - 1, j) || inM(i + 1, j) || inM(i, j - 1) || inM(i, j + 1)) cells.push([i - D, j - D, C.tinte]); continue; }
      let t = tone[j * W + i]; const lit = !inM(i, j - 1) || !inM(i + 1, j), dark = !inM(i, j + 1) || !inM(i - 1, j);
      if (lit && !dark) t = Math.min(7, t + 2); else if (dark && !lit) t = Math.max(0, t - 1);
      cells.push([i - D, j - D, RP[t]]);
    }
    r = { cells, D }; headCache.set(key, r); return r;
  }
  function drawHead(m, P, cx, cy, deg, lv) { const sp = headSprite(P, qDeg(deg)), X = rd(cx), Y = rd(cy); for (const [i, j, c] of sp.cells) m.pd(X + i, Y + j, c, lv); }

  function drawHandle(m, P, piv, deg, lv) {
    const co = Math.cos(rad(deg)), si = Math.sin(rad(deg)), R = P.R, g = P.grip, hw = P.hS / 2, len = R + g, hs = P.c.handle, lx = LIGHT[0] * P.dir, ly = LIGHT[1];
    const ax = piv[0] - co * g, ay = piv[1] - si * g;
    const y0 = Math.max(0, Math.floor(Math.min(ay, piv[1] + si * R) - hw - 2)), y1 = Math.min(m.gh - 1, Math.ceil(Math.max(ay, piv[1] + si * R) + hw + 2));
    const sp = new Map();
    for (let y = y0; y <= y1; y++) {
      const py = y + 0.5 - ay; let xa = -1e9, xb = 1e9;
      if (Math.abs(co) > 1e-6) { const a0 = (0 - py * si) / co, a1 = (len - py * si) / co; xa = Math.max(xa, Math.min(a0, a1) + ax - 0.5); xb = Math.min(xb, Math.max(a0, a1) + ax - 0.5); } else if (py * si < 0 || py * si > len) continue;
      if (Math.abs(si) > 1e-6) { const b0 = (py * co - hw) / si, b1 = (py * co + hw) / si; xa = Math.max(xa, Math.min(b0, b1) + ax - 0.5); xb = Math.min(xb, Math.max(b0, b1) + ax - 0.5); } else if (Math.abs(py * co) > hw) continue;
      const X0 = Math.ceil(xa), X1 = Math.floor(xb); if (X0 > X1) continue; sp.set(y, [X0, X1]);
    }
    for (const [y, [X0, X1]] of sp) {
      const n1 = sp.get(y - 1), n2 = sp.get(y + 1); let lo = X0 - 1, hi = X1 + 1; if (n1) { lo = Math.min(lo, n1[0]); hi = Math.max(hi, n1[1]); } if (n2) { lo = Math.min(lo, n2[0]); hi = Math.max(hi, n2[1]); }
      for (let x = lo; x <= hi; x++) m.pd(x, y, C.tinte, lv);
      if (!n1) for (let x = X0 - 1; x <= X1 + 1; x++) m.pd(x, y - 1, C.tinte, lv);
      if (!n2) for (let x = X0 - 1; x <= X1 + 1; x++) m.pd(x, y + 1, C.tinte, lv);
    }
    const wood = hs === 'wood2' ? [C.holzD, C.holzD, C.holz, C.holzM, C.holzH] : [C.holzD, C.holz, C.holzM, C.holzH, C.holzHH], bone = [C.bone0, C.bone1, C.bone2, C.bone3, C.bone3];
    const gripL = P.tw * (hs === 'wood2' ? 1.3 : 0.9);
    for (const [y, [X0, X1]] of sp) for (let x = X0; x <= X1; x++) {
      const dx = x + 0.5 - ax, dy = y + 0.5 - ay, a = dx * co + dy * si, b = -dx * si + dy * co;
      const s = ((dx - a * co) * lx + (dy - a * si) * ly) / hw;
      let t = 2 + s * 1.6 + (BAY[y & 3][x & 3] / 16 - 0.5) * 0.9; t = clamp(fl(t), 0, 4);
      let c;
      if (hs === 'bone') {                                                                                // Knochen: helle Röhre, quer gekerbt
        c = bone[t]; if (fl(a / 7) % 2 === 0 && Math.abs(a % 7 - 3) < 0.7) c = bone[Math.max(0, t - 2)];
      } else {
        c = wood[t]; if (fl(a / 6) % 2 === 0 && H(fl(a / 6) * 5 + 2, fl(b * 0.5) + 9) < 0.3) c = wood[Math.max(0, t - 1)];
        if (a < g + gripL) { const q = (fl(a) + fl(b)) & 3; c = q < 2 ? (s > 0.2 ? C.lederH : C.leder) : C.lederD; for (const wb of [0.3, 0.6, 0.9]) if (Math.abs(a - (g + gripL * wb)) < 0.6) c = C.lederD; }
        else if (a > len - P.hHW * 0.5 - 4 && a < len - P.hHW * 0.5 - 1) c = (s > 0.2) ? C.st2 : C.st5;
      }
      m.pd(x, y, c, lv);
    }
    if (hs === 'bone') { const r0 = Math.max(2, rd(hw * 1.1)); m.disc(rd(ax), rd(ay), r0 + 1, C.tinte, lv); m.disc(rd(ax), rd(ay), r0, C.bone2, lv); m.disc(rd(ax - r0 * 0.3), rd(ay - r0 * 0.3), Math.max(1, r0 >> 1), C.bone3, lv); }    // Gelenkknopf am Griffende
  }

  function burst(m, P, cx, cy, Ro, lv, pal, rot) {
    const tips = P.burst, N = tips.length, NL = 128, lut = new Float32Array(NL), V = [];
    for (let i = 0; i < N; i++) { V.push([(tips[i].a + rot) % (Math.PI * 2), Ro * tips[i].r]); V.push([(tips[i].a + rot + Math.PI / N) % (Math.PI * 2), Ro * 0.46]); }
    V.sort((p, q) => p[0] - q[0]);
    const TP = Math.PI * 2; let seg = 0;
    for (let q = 0; q < NL; q++) { const th = q / NL * TP; while (seg < V.length - 1 && V[seg + 1][0] <= th) seg++; const a = V[seg], b = V[(seg + 1) % V.length]; let a1 = b[0]; if (a1 <= a[0]) a1 += TP; lut[q] = lerp(a[1], b[1], clamp((th - a[0]) / Math.max(1e-6, a1 - a[0]))); }
    const R = Math.ceil(Ro * 1.3), SQ = 0.8;
    for (let j = -R; j <= R; j++) for (let i = -R; i <= R; i++) {
      const dx = i + 0.5, dy = (j + 0.5) / SQ, d2 = dx * dx + dy * dy; if (d2 > Ro * Ro * 1.7) continue;
      let th = Math.atan2(dy, dx); if (th < 0) th += TP;
      const r = lut[(th / TP * NL) | 0], d = Math.sqrt(d2); if (d > r) continue;
      m.pd(rd(cx + i), rd(cy + j), d > r - 1.4 ? pal[0] : (d < r * 0.38 ? pal[3] : (d < r * 0.7 ? pal[2] : pal[1])), lv);
    }
  }
  function tri(m, x, y, sz, v, c) { for (let pass = 0; pass < 2; pass++) for (let r = 0; r < sz; r++) { const w = pass ? Math.max(1, sz - r) : sz - r + 2, x0 = v & 1 ? -(w - 1) : 0, yy = v & 2 ? y - r : y + r; if (pass === 0) m.rect(x + x0 - 1, yy, w + 2, 1, C.tinte); else m.rect(x + x0, yy, w, 1, c); } }

  FX.sfxPlan = (kind, P) => CARDS[kind].sfx.map(([fr, name, vol, rate]) => [(fr <= 0 && name === 'booster_card_whoosh' && fr === 0 ? 0 : (fr < 0 ? P.hit.f + fr : (fr === 0 && name !== 'booster_card_whoosh' ? P.hit.f : (name === 'booster_card_whoosh' && fr >= 6 ? P.popF + (fr - 12 > -1 ? 0 : 0) : P.hit.f + fr)))) / 30, name, vol, rate]);
  FX.warmList = (kind, tw, th) => { const P = FX.plan({ gx: 100, gy: 100, tw, th, stackH: 0, flat: 0.85, topY: 0, seed: 1 }, kind); const out = []; for (let d = -100; d <= 0; d += 5) out.push(() => headSprite(P, d)); return out; };
  FX.hitFrame = (kind) => buildSeq(CARDS[kind]).hitF;

  const gp = (P, ox, oz, hgt) => [P.gx + ox, P.gcy + oz * P.flat - (hgt || 0)];
  const ease = easeOut;

  FX.draw = (m, f, P, hook) => {
    const { gx, tw, th, flat, L, H0, gcy, W0, c } = P, I = c.I, fe = feOf(f, P), pose = FX.pose(f, P), phi = P.seq[Math.min(f, P.seq.length - 1)], h = P.hit, dir = P.dir;
    const gh = m.gh;
    const endFade = f >= P.popF ? clamp((f - P.popF - 1) / 7) : 0;
    // Spiegelung (Hammer Skeleton schwingt von rechts): alles an der Hammer-Geometrie läuft durch `mm`
    const mm = dir > 0 ? m : { gh, gw: m.gw, px: (x, y, col) => m.px(2 * gx - x - 1, y, col), pd: (x, y, col, lv) => m.pd(2 * gx - x - 1, y, col, lv), rect: (x, y, w, hh, col) => m.rect(2 * gx - x - w, y, w, hh, col), disc: (x, y, r, col, lv) => m.disc(2 * gx - x - 1, y, r, col, lv), linie: (x0, y0, x1, y1, t, col) => m.linie(2 * gx - x0 - 1, y0, 2 * gx - x1 - 1, y1, t, col) };
    const piv = P.pivot.slice(); const inStop = f >= h.f && f < h.f + h.stop;
    if (f >= h.f) piv[1] += (1 - pose.v) * H0 * (inStop ? 1 : (pose.v > 1 ? 0 : 1)) - (f >= P.popF && pose.v >= 1 ? 0 : 0);
    if (f >= h.f + h.stop && f < P.popF && (f - h.f - h.stop) < 6) piv[0] += dir * ([0, 1, -1, 1, -1, 0][f - h.f - h.stop] || 0);                // Nachbeben
    if (f >= 2 && f < h.f - 3) piv[0] += dir * (f >= h.f - 14 ? ([0, 1, -1, 1, -1, 1, 0, -1][f % 8]) : 0);                                           // Zittern im Halt
    // UNTERE EBENE (Schatten, Lichtkreis, Delle, Risse, Ringe, Strahlen): liegt unter Figur und Karte des Ziels — deren Zellen bleiben frei (hook.maske)
    m.setMask(hook && hook.maske ? hook.maske(pose) : null);
    // Schatten am Boden (wächst mit der Nähe), Staub-/Lichtaufbau am Ziel in der langen Anspannung
    if (f < P.popF + 2) { const near = clamp(1 - Math.abs(phi - PHI_IMP) / 70); m.dith(gx, gcy + 3, W0 * (0.4 + 0.2 * near), W0 * (0.4 + 0.2 * near) * flat * 0.4, rd(2 + 5 * near), C.nacht); }
    if (I >= 0.6 && f >= h.f - 14 && f < h.f) { const q = clamp((f - (h.f - 14)) / 14); const lv = rd(1 + q * 5 * I); m.ell(gx, gcy, rd(W0 * (1.6 - 1.0 * q)), rd(W0 * (1.6 - 1.0 * q) * flat), 1, C.creme, true); m.dith(gx, gcy, W0 * 0.8, W0 * 0.8 * flat * 0.5, lv, C.creme); }
    if (f < h.f) for (const o of P.motes) { const p = f / (o.life + h.f * 0.5); if (p >= 1) continue; const r = o.r * (1 - p * p), r2 = o.r * (1 - (p + 0.1) * (p + 0.1)); if (r < tw * 0.5) continue; const [x1, y1] = gp(P, Math.cos(o.a) * r, Math.sin(o.a) * r, 0), [x2, y2] = gp(P, Math.cos(o.a) * r2, Math.sin(o.a) * r2, 0); m.linie(x1, y1, x2, y2, 1, o.c); }
    // ── Bodenwirkung ──
    if (f >= h.f) {
      const ti = fe - h.f, mm0 = I;
      m.dith(gx, gcy + 2, W0 * (0.55 + 0.45 * I), W0 * (0.55 + 0.45 * I) * flat * 0.5, 7 + rd(3 * I), C.nacht);                                          // Delle
      for (const cr of P.cracks) {
        const p = clamp((ti + 1) / (3 + 3 * I)), Lk = cr.L * ease(p), segs = 7, r0 = tw * 0.62; let px0 = Math.cos(cr.a) * r0, pz0 = Math.sin(cr.a) * r0, a = cr.a;
        for (let sI = 1; sI <= segs; sI++) { const q = sI / segs; if (q * cr.L > Lk) break; a += (H(P.seed + cr.id, sI) - 0.5) * 0.75; const px1 = Math.cos(a) * (r0 + cr.L * q), pz1 = Math.sin(a) * (r0 + cr.L * q), [xa, ya] = gp(P, px0, pz0, 0), [xb, yb] = gp(P, px1, pz1, 0);
          if (endFade > 0 && BAY[(sI + cr.id) & 3][(sI * 3) & 3] / 16 < endFade) { px0 = px1; pz0 = pz1; continue; }
          m.linie(xa, ya + 1, xb, yb + 1, 1, C.sandD); m.linie(xa, ya, xb, yb, sI < 3 ? 2 : 1, C.nacht); px0 = px1; pz0 = pz1; }
      }
      const rings = [[0, 0, 9, 0.8 + 0.7 * c.ringK, C.creme, false], [1, 1, 11, 1.0 + 1.0 * c.ringK, C.gelb, true], [2, 3, 13, 2.2 * c.ringK + 0.3, C.sandD, true]];
      for (let q = 0; q < c.rings; q++) { const [, t0, life, K, col, dit] = rings[q], t = ti - t0; if (t < 0 || t > life) continue; const r1 = rd(ease(t / life) * W0 * K); if (r1 > 0) m.ell(gx, gcy, r1, rd(r1 * flat), q === 0 && t < 3 ? 2 : 1, col, dit && t > life * 0.5); }
      if (I >= 1 && ti >= 4 && ti <= 18) { const t = ti - 4, r1 = rd(ease(t / 14) * W0 * 3.4); m.ell(gx, gcy, r1, rd(r1 * flat), 1, C.creme, true); }                       // zweite, große Druckwelle
      if (I >= 1 && f - h.f < h.stop) { const hh = f - h.f, Lr = W0 * 2.2 * [0.6, 1, 0.9, 0.75, 0.6, 0.45, 0.3][Math.min(6, hh)]; for (let r = 0; r < 20; r++) { const an = r * Math.PI / 10 + 0.1, len = Lr * (r % 2 ? 0.55 : 1), [ex, ey] = gp(P, Math.cos(an) * len, Math.sin(an) * len, 0); m.linie(gx, gcy, ex, ey, 3, C.tinte); m.linie(gx, gcy, ex, ey, 1, r % 3 === 0 ? C.weiss : (r % 2 ? C.creme : C.gelb)); } }
    }
    m.setMask(null);
    if (hook && hook.pile) hook.pile(m, pose);
    // ── Starburst + Blitz im Hit-Stop (hinter dem Hammer) ──
    if (inStop) {
      const hh = f - h.f, sy = L - H0 + (1 - pose.v) * H0 * 0.4, szs = [0.85, 1.15, 1.0, 0.85, 0.7, 0.5, 0.3];
      const Ro = tw * c.burstK * szs[Math.min(hh, 6)] * (h.stop <= 2 ? [0.9, 0.6][hh] / 0.85 : 1);
      const pal = c.tint === 'bone' ? [C.rauch, C.bone1, C.bone2, C.bone3] : (c.tint === 'wood' ? [C.tinte, C.org, C.gelb, C.creme] : [C.tinte, C.org, C.gelb, C.creme]);
      burst(m, P, gx, sy - Ro * 0.1, Ro, 16, pal, 0);
      if (I >= 1) burst(m, P, gx, sy - Ro * 0.1, Ro * 0.62, 16, [C.tinte, C.gelb, C.creme, C.weiss], Math.PI / 10);
      const lvA = rd(12 * Math.pow(0.66, hh) * (0.3 + 0.7 * Math.sqrt(I))), rr = W0 * c.flashK * (0.9 + 0.15 * hh);
      m.dith(gx, gcy, rr, rr * flat * 0.8, lvA, C.creme);
      if (hh < Math.min(3, h.stop)) m.dith(gx, gcy, W0 * 0.45 * (0.5 + 0.5 * I), W0 * 0.45 * flat * 0.8 * (0.5 + 0.5 * I), 16, C.weiss);
      if (I >= 1) m.dith(gx, gcy - th * 0.2, tw * 5.0, tw * 3.6, [10, 8, 6, 4, 3, 2, 1][Math.min(hh, 6)], C.weiss);                                    // weißer Blitz über die ganze Zone
    }
    // ── Hammer ──
    if (f < P.popF + 5) {
      const lv = f >= P.popF + 1 ? [14, 11, 8, 5][Math.min(3, f - P.popF - 1)] || 3 : 16;
      const rot = (d, pv) => { const co = Math.cos(rad(d)), si = Math.sin(rad(d)); return [pv[0] + co * P.R, pv[1] + si * P.R]; };
      const pd = f > 0 ? P.seq[f - 1] : phi, dphi = Math.abs(phi - pd);
      if (dphi >= 12 && f < P.popF + 4) {
        let pxl = null;
        for (let q = 0; q <= 6; q++) { const dd = lerp(pd, phi, q / 6), cc = rot(dd, piv), vv = [-Math.sin(rad(dd)), Math.cos(rad(dd))], ex = cc[0] + vv[0] * P.hHL / 2, ey = cc[1] + vv[1] * P.hHL / 2; if (pxl) { mm.linie(pxl[0], pxl[1], ex, ey, c.streak + 1, C.creme); mm.linie(pxl[0], pxl[1], ex, ey, c.streak - 1 || 1, C.weiss); } pxl = [ex, ey]; }
        for (let q = 1; q <= (I >= 1 ? 3 : 2); q++) { const dd = lerp(pd, phi, 1 - q * 0.28), cc = rot(dd, piv); drawHeadM(mm, P, cc[0], cc[1], dd, [8, 5, 3][q - 1]); }
      }
      drawHandle(mm, P, piv, phi, lv);
      const cc = rot(phi, piv); drawHeadM(mm, P, cc[0], cc[1], phi, lv);
    }
    // ── Splitter, Staub, Brocken, Funken (vor dem Hammer) ──
    if (f >= h.f) {
      const ti = fe - h.f, sy = L - H0;
      for (const p of P.puffs) {
        const age = ti - (p.id % 3), life = 12 + 8 * I; if (age < 0 || age >= life) continue;
        const e = ease(age / life), kk = Math.max(0.6, tw / 40), r = lerp(p.r0 * 0.8, p.r1, e) * kk * (0.6 + 0.5 * I), dist = P.hHW * 0.5 + W0 * (0.5 + 0.9 * I) * e;
        const [x, y] = gp(P, Math.cos(p.a) * dist, Math.sin(p.a) * dist, (3 + p.rise * e) * kk), lv = rd(11 * (1 - age / life)); if (lv <= 0) continue;
        m.disc(x + r * 0.2, y + r * 0.25, Math.max(1, rd(r)), C.rauch, lv); m.disc(x, y, Math.max(1, rd(r * 0.9)), C.sandDD, lv); m.disc(x - r * 0.25, y - r * 0.3, Math.max(1, rd(r * 0.55)), C.sand, rd(lv * 0.75));
      }
      const g = 0.9 * (tw / 40);
      for (const b of P.debris) {
        const t = ti, life = 18 + 10 * I; if (t >= life) continue;
        let hgt = b.vv * (t / 30) * 3.2 - g * 0.5 * t * t * 1.05; const fly = t / 30 * 3.2;
        if (hgt < 0) { const tb = b.vv * 3.2 / 30 / (g * 1.05 / 2), tt = t - tb; hgt = tt < 0 ? 0 : Math.max(0, b.vv * 0.22 * (tt / 30) * 3.2 - g * 0.5 * tt * tt * 1.05); }
        const off = Math.cos(b.a) * P.hHW * 0.6, [x, y] = gp(P, off + Math.cos(b.a) * b.vh * Math.min(1, fly) * 0.45, Math.sin(b.a) * b.vh * Math.min(1, fly) * 0.3, hgt * 0.45);
        if (t > life - 7 && (t & 1)) continue; const sz = b.sz * Math.max(1, rd(tw / 30)); m.rect(x, y, sz, sz, b.c); m.rect(x, y, Math.max(1, sz - 1), 1, C.creme); m.rect(x + sz - 1, y + 1, 1, sz - 1, C.nacht);
      }
      for (const s of P.sparks) { const t = ti; if (t >= s.life) continue; if (t > s.life * 0.65 && (t & 1)) continue; const x = gx + (s.vx * t / 30) * 0.42, y = sy + (-s.vy * t / 30) * 0.42 - 0.5 * (tw * 7) * (t / 30) * (t / 30) * 0.42 * 1.4 - 2;
        if (s.kreuz) { m.rect(x - 1, y, 3, 1, s.c); m.rect(x, y - 1, 1, 3, s.c); } else { const vx = s.vx * 0.42 / 30, vy = -s.vy * 0.42 / 30; m.linie(x, y, x - vx * 1.8, y - vy * 1.8, 1, s.c); m.rect(x, y, 2, 2, s.c); } }
      for (const s of P.splinters) { const t = ti; if (t >= s.life) continue; if (t > s.life * 0.7 && (t & 1)) continue; const x = gx + (s.vx * t / 30) * 0.5, y = sy + (-s.vy * t / 30) * 0.5 + 0.5 * (tw * 9) * (t / 30) * (t / 30) * 0.5; tri(m, rd(x), rd(y), Math.max(3, rd(s.sz * Math.max(1, tw / 30) * (0.6 + 0.5 * I))), s.v, s.c); }
    }
  };
  function drawHeadM(mm, P, cx, cy, deg, lv) { const sp = headSprite(P, qDeg(deg)), X = rd(cx), Y = rd(cy); for (const [i, j, c] of sp.cells) mm.pd(X + i, Y + j, c, lv); }
  root.PpFx57 = FX;
})(window);

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  SPIEL-HÜLLE: Leinwand in der Weltschicht, Takt, Quetschung von Karte und Held, Kamera-Shake, Aufräumen, Rückfall
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const PP_FX57_TAKT = 1000 / 30;

/** Rückfall auf den alten Hammer (Animationen aus, Retro, Test-Schalter, reduzierte Bewegung, keine Palette). */
function ppFx57Rueckfall() {
  try {
    if (window.__ppFx57Aus || window.__ppFxAlt || window._playAnimations === false || window.PP_RETRO || typeof window.ppSnapRgb !== 'function') return true;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return true;
  } catch (e) { /* weiter */ }
  return false;
}
const ppFx57Phone = () => { try { return !!(window.ppIsPhone && window.ppIsPhone()); } catch (e) { return false; } };
const ppFx57Ruhig = () => { try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; } };

/** Pixel des Sprite-Sheets (einmal je Sheet gelesen, am Eintrag der Figur gemerkt). */
function ppFx57SheetPixel(eintrag) {
  if (!eintrag) return null;
  if (eintrag._pp57) return eintrag._pp57;
  try {
    const { img, meta } = eintrag, w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, w, h).data, fw = meta.frameWidth, fh = meta.frameHeight, vert = meta.layout === 'vertical';
    // oberste deckende Zeile über alle Bilder (Aufsetzpunkt an der Sprite-Oberkante, auch bei großen Sprites wie Andras)
    let y0 = fh;
    const frames = Math.max(1, meta.frames | 0);
    for (let f = 0; f < frames; f++) {
      const sx = vert ? 0 : f * fw, sy = vert ? f * fh : 0;
      for (let y = 0; y < fh && y < y0; y++) { for (let x = 0; x < fw; x++) if (d[((sy + y) * w + sx + x) * 4 + 3] >= 128) { y0 = y; break; } }
    }
    eintrag._pp57 = { d, w, fw, fh, vert, y0: y0 >= fh ? 0 : y0 };
    return eintrag._pp57;
  } catch (e) { return null; }
}

/** Hero-Pixel des Ziels: zentrale Fassung `ppFxHeldPixel` (app-board.jsx, mit Zwischenspeicher und Plausibilitätsprüfung); der Name bleibt für app-fx-58 und diese Datei. */
function ppFx57HeldPixel(zoneEl, w) { return ppFxHeldPixel(zoneEl, w); }

const PP_FX57_MINDAUER = { MH: 2000, HH: 1700, HS: 1450 };   // Länge + Vorlauf (≈ 110 ms) + Reserve; spiegelt `PP_ANIM_MINDAUER` in app-board.jsx

function PpFx57Leinwand({ x, y, w, h, zoneEl, welt, kind }) {
  const cvs = useRef(null);
  const wurzelRef = useRef(null);
  const geo = useMemo(() => {
    const FX = window.PpFx57; FX.ensure();
    const hp = ppFx57HeldPixel(zoneEl, w), S = Math.max(2, Math.round(hp.px)), cellsPerPx = hp.px / S;
    const fo = (welt && window.ppFxScrollOffset) ? window.ppFxScrollOffset() : { dx: 0, dy: 0 };
    const zr = zoneEl && zoneEl.isConnected ? zoneEl.getBoundingClientRect() : null;
    const zcx = zr ? zr.left + zr.width / 2 : x - fo.dx, zcy = zr ? zr.top + zr.height / 2 : y - fo.dy;   // Fenstermitte der Zone
    const ox = x - zcx, oy = y - zcy;                                                                       // Versatz Fenster → Welt (Scrollstand)
    const tw = w / S, th = h / S, flat = Math.max(0.6, Math.min(1.05, (h / w) / (95 / 68)));
    // Figur: Lage des Canvas relativ zur Zonenmitte (in Weltkoordinaten) und oberste deckende Zeile
    let figur = null, stackH = 0;
    if (hp.cv && hp.eintrag) {
      const px = ppFx57SheetPixel(hp.eintrag), r = hp.cv.getBoundingClientRect();
      if (px) {
        const oyTop = r.top + px.y0 * hp.px;                                                               // Fenster-y der Sprite-Oberkante
        stackH = Math.max(0, (zcy - oyTop) / S);
        figur = { px, ix: r.left - zcx, iy: r.top - zcy, cps: cellsPerPx };                                 // Canvas-Ursprung relativ zur Zonenmitte (px)
      }
    }
    // Fläche: Luft oben = bis zur Fensteroberkante (Welt: + Scrollstand)
    const luftOben = Math.max(0, y - fo.dy);                                                               // px zwischen Zielmitte und Fensteroberkante
    const lenR = (kind === 'MH' ? 2.3 : (kind === 'HH' ? 2.8 : 2.4));
    const links = Math.ceil(tw * (lenR + 0.55 + 1.0) + 8), rechts = Math.ceil(tw * 4.0 + 8);
    const hoch = Math.min(Math.ceil(luftOben / S) + 2, Math.ceil(tw * 9 + th));
    const runter = Math.ceil(th * 0.5 + tw * 2.9 * flat + 14);
    const dirS = kind === 'HS' ? -1 : 1;
    const gw = Math.min(1100, links + rechts + 4), gh = Math.min(900, hoch + runter);
    const xl = dirS > 0 ? links : rechts;                                                                   // Zellen links vom Ziel
    const lx = Math.round(x - xl * S), ly = Math.round(y - hoch * S);
    const gx = (x - lx) / S, gy = (y - ly) / S;
    const topY = Math.max(0, -ly + fo.dy) / S;                                                              // oberste sichtbare Zeile (Fensteroberkante) in Zellen
    const P = FX.plan({ gx, gy, tw, th, stackH, flat, topY, seed: Math.floor(Math.random() * 1e6), n: (window.ppFxN ? window.ppFxN(100) / 100 : 1) }, kind);
    return { S, P, lx, ly, gw, gh, hp, figur, zr, ox, oy, zcx, zcy, cellsPerPx };
  }, []);

  useEffect(() => {
    const el = cvs.current, FX = window.PpFx57;
    if (!el) return undefined;
    const { S, P, gw, gh, hp, figur, zr, ox, oy } = geo;
    const ctx = el.getContext('2d'), img = ctx.createImageData(gw, gh), m = FX.maler(img.data, gw, gh);
    const takt = window.ppTaktRaf || window.requestAnimationFrame;
    const zone = zoneEl && zoneEl.isConnected ? zoneEl : null;
    const karte = zone ? zone.querySelector('.board-card') : null;
    const platz = hp.platz || null;
    const phone = ppFx57Phone(), shakeAn = !phone && !ppFx57Ruhig() && !window.__ppFx57KeinShake;
    const board = shakeAn ? document.querySelector('.board-center') : null;
    const wurzel = wurzelRef.current;
    // Merker zum Zurücksetzen
    const alt = { clip: zone ? zone.style.clipPath : '', kTrans: karte ? karte.style.transform : '', kOrig: karte ? karte.style.transformOrigin : '', vis: platz ? platz.style.visibility : '', tr: board ? board.style.translate : '' };
    // Umrechnung Zellen → lokale Pixel der Karte (die Karte steht in der geneigten Brettebene)
    let kx = 1, ky = 1;
    if (karte) { const kr = karte.getBoundingClientRect(); if (kr.width > 0 && kr.height > 0) { kx = karte.offsetWidth / kr.width; ky = karte.offsetHeight / kr.height; } }
    if (zone) zone.style.clipPath = 'inset(-400px -400px 0px -400px)';   // unter der Zonenunterkante ist der Boden: was dort hinsinkt, wird abgeschnitten
    if (karte) karte.style.transformOrigin = '50% 100%';
    const t0 = performance.now();
    let raf = 0, letzte = -1, ende = false, vor = null, key = '', figurWeg = false;
    const zuruecksetzen = () => {
      try { if (zone) zone.style.clipPath = alt.clip; if (karte) { karte.style.transform = alt.kTrans; karte.style.transformOrigin = alt.kOrig; } if (platz) platz.style.visibility = alt.vis; if (board) board.style.translate = alt.tr; } catch (e) { /* weg */ }
    };
    const aufraeumen = () => { if (ende) return; ende = true; try { cancelAnimationFrame(raf); } catch (e) { /* weg */ } zuruecksetzen(); try { ctx.clearRect(0, 0, gw, gh); } catch (e) { /* weg */ } };
    // Held im Raster: eine Zelle je Sprite-Pixel-Anteil (Pixelgröße / Zelle), Stapel um die Bodenlinie gestaucht und versenkt (Nächster-Nachbar, nichts gemischt)
    const figurZellen = (p, fn) => {
      const s = figur.px, fr = platz._ppFrame | 0, f0 = Math.max(0, Math.min(fr, Math.max(1, (hp.eintrag.meta.frames | 0)) - 1));
      const sx0 = s.vert ? 0 : f0 * s.fw, sy0 = s.vert ? f0 * s.fh : 0, cps = figur.cps;
      const left = geo.zcx + figur.ix + ox - geo.lx, top = geo.zcy + figur.iy + oy - geo.ly;                // Canvas-Ursprung der Figur in Leinwand-Pixeln
      const oX = left / S, oY = top / S, Lc = p.L, d = p.d, sy = p.sy, sx = p.sx, gxc = P.gx;
      const wCells = s.fw * cps, hCells = s.fh * cps;
      const c0 = Math.max(0, Math.floor(gxc + (oX - gxc) * sx + p.dx)), c1 = Math.min(gw - 1, Math.ceil(gxc + (oX + wCells - gxc) * sx + p.dx));
      const r0 = Math.max(0, Math.floor(Lc - (Lc - oY) * sy + d)), r1 = Math.min(gh - 1, Math.ceil(Lc) - 1, Math.ceil(Lc - (Lc - (oY + hCells)) * sy + d));
      for (let Y = r0; Y <= r1; Y++) {
        if (Y + 0.5 > Lc) continue;
        const yo = Lc - (Lc - (Y + 0.5) + d) / sy, srow = Math.floor((yo - oY) / cps); if (srow < 0 || srow >= s.fh) continue;
        for (let X = c0; X <= c1; X++) {
          const xo = gxc + (X + 0.5 - gxc - p.dx) / sx, scol = Math.floor((xo - oX) / cps); if (scol < 0 || scol >= s.fw) continue;
          const i = ((sy0 + srow) * s.w + sx0 + scol) * 4, a = s.d[i + 3]; if (a < 8) continue;
          fn(X, Y, s.d[i], s.d[i + 1], s.d[i + 2], a);
        }
      }
    };
    // Held im Raster: eine Zelle je Sprite-Pixel-Anteil (Pixelgröße / Zelle), Stapel um die Bodenlinie gestaucht und versenkt (Nächster-Nachbar, nichts gemischt)
    const pile = (mm, p) => {
      if (!figur || !p.hideSprite || !platz) return;
      const W = FX.C.weiss;
      figurZellen(p, (X, Y, r, g, b, a) => mm.pd(X, Y, p.white ? W : [r, g, b], a >= 250 ? 16 : Math.max(1, Math.round(a / 255 * 16))));
    };
    // Maske für die untere Ebene: Karte (Rechteck, mit der Quetschung mitgerechnet) und Figur (Silhouette; solange die Figur im Brett steht in Normalgröße, sonst gequetscht wie `pile`)
    const maskBuf = new Uint8Array(gw * gh), kr0 = karte ? karte.getBoundingClientRect() : null;
    const kL = kr0 ? (kr0.left + ox - geo.lx) / S : 0, kR = kr0 ? (kr0.right + ox - geo.lx) / S : 0, kT = kr0 ? (kr0.top + oy - geo.ly) / S : 0, kB = kr0 ? (kr0.bottom + oy - geo.ly) / S : 0;
    const maske = (p) => {
      maskBuf.fill(0);
      if (kr0 && kR > kL) {
        const Lc = p.L, gxc = P.gx, x0 = Math.max(0, Math.floor(gxc + (kL - gxc) * p.sx + p.dx)), x1 = Math.min(gw - 1, Math.ceil(gxc + (kR - gxc) * p.sx + p.dx) - 1);
        const y0 = Math.max(0, Math.floor(Lc - (Lc - kT) * p.sy + p.d)), y1 = Math.min(gh - 1, Math.ceil(Lc - (Lc - kB) * p.sy + p.d) - 1, Math.ceil(Lc) - 1);
        for (let Y = y0; Y <= y1; Y++) for (let X = x0; X <= x1; X++) maskBuf[Y * gw + X] = 1;
      }
      if (figur && platz) { const q = p.hideSprite ? p : { sx: 1, sy: 1, d: 0, dx: p.dx, L: p.L }; figurZellen(q, (X, Y) => { maskBuf[Y * gw + X] = 1; }); }
      return maskBuf;
    };
    const schritt = (jetzt) => {
      if (ende) return;
      if (typeof jetzt !== 'number') jetzt = performance.now();
      const ms = Math.max(0, jetzt - t0);
      if (ms >= (P.LEN + 1) * PP_FX57_TAKT) { aufraeumen(); return; }
      const fr = Math.floor(jetzt / PP_FX57_TAKT);
      if (fr !== letzte) {
        letzte = fr;
        const mess = window.__ppFx57Messen ? performance.now() : 0;
        const f = Math.min(P.LEN - 1, Math.floor(ms / PP_FX57_TAKT + 1e-4)), d = m.d, buf = img.data;
        if (vor) { for (let j = vor.y0; j < vor.y1; j++) buf.fill(0, (j * gw + vor.x0) * 4, (j * gw + vor.x1) * 4); }
        d.x0 = gw; d.y0 = gh; d.x1 = 0; d.y1 = 0;
        const pose = FX.pose(f, P);
        FX.draw(m, f, P, { pile, maske });
        const ux0 = Math.min(vor ? vor.x0 : gw, d.x0), uy0 = Math.min(vor ? vor.y0 : gh, d.y0), ux1 = Math.max(vor ? vor.x1 : 0, d.x1), uy1 = Math.max(vor ? vor.y1 : 0, d.y1);
        if (ux1 > ux0 && uy1 > uy0) ctx.putImageData(img, 0, 0, ux0, uy0, ux1 - ux0, uy1 - uy0);
        vor = d.x1 > d.x0 ? { x0: d.x0, y0: d.y0, x1: d.x1, y1: d.y1 } : null;
        // DOM-Seite (nur bei Änderung): Karte quetschen/versenken, Figur ausblenden solange sie im Raster gemalt wird, Brett schütteln
        const k2 = pose.sx + '|' + pose.sy + '|' + pose.d + '|' + pose.dx + '|' + pose.white + '|' + pose.hideSprite + '|' + pose.shake[0] + '|' + pose.shake[1];
        if (k2 !== key) {
          key = k2;
          if (karte) {
            const ruhe = pose.sx === 1 && pose.sy === 1 && pose.d === 0 && pose.dx === 0;
            karte.style.transform = ruhe ? alt.kTrans : `translate(${(pose.dx * S * kx).toFixed(2)}px, ${(pose.d * S * ky).toFixed(2)}px) scale(${pose.sx.toFixed(3)}, ${pose.sy.toFixed(3)})`;
            karte.style.filter = pose.white ? 'brightness(2.2) saturate(.5)' : '';
          }
          if (platz && pose.hideSprite !== figurWeg) { figurWeg = pose.hideSprite; platz.style.visibility = figurWeg ? 'hidden' : alt.vis; }
          const sxp = Math.round(pose.shake[0] * S), syp = Math.round(pose.shake[1] * S);
          if (board) board.style.translate = (sxp || syp) ? `${sxp}px ${syp}px` : alt.tr;
          if (wurzel) wurzel.style.translate = (sxp || syp) && board ? `${sxp}px ${syp}px` : '';
        }
        if (mess) (window.__ppFx57Zeiten || (window.__ppFx57Zeiten = [])).push([kind, f, +(performance.now() - mess).toFixed(3)]);
      }
      raf = takt(schritt);
    };
    raf = takt(schritt);
    const netz = setTimeout(aufraeumen, (P.LEN + 1) * PP_FX57_TAKT + 2500);                             // Notnagel (Tab im Hintergrund: rAF ruht)
    return () => { clearTimeout(netz); aufraeumen(); if (karte) karte.style.filter = ''; };
  }, []);

  return (
    <div ref={wurzelRef} aria-hidden="true" data-pp-px="aus" style={{ position: 'fixed', left: geo.lx, top: geo.ly, pointerEvents: 'none', zIndex: 10100 }}>
      <canvas ref={cvs} width={geo.gw} height={geo.gh} style={{ width: geo.gw * geo.S, height: geo.gh * geo.S, imageRendering: 'pixelated', display: 'block' }} />
    </div>
  );
}

/** Registry-Komponente: neuer Hammer oder der alte als Rückfall. Ohne Ziel-Element (Vorwärmen) wird nichts gezeichnet. */
function ppFx57Komponente(kind, Alt) {
  return function PpFx57Effekt(props) {
    const modus = useMemo(() => (ppFx57Rueckfall() ? 'alt' : (props.zoneEl && props.zoneEl.isConnected ? 'neu' : 'leer')), []);
    if (modus === 'alt') return Alt ? <Alt {...props} /> : null;
    if (modus === 'leer') return null;
    return <PpFx57Leinwand {...props} kind={kind} />;
  };
}
(function ppFx57Registrieren() {
  const alt = ANIM_REGISTRY.magic_hammer;                 // ppFx14Hammer (Leinwand) bzw. die DOM-Fassung aus app-board.jsx
  ANIM_REGISTRY.heavy_hit_smash = window.__ppFxAlt ? alt : ppFx57Komponente('HH', alt);
  ANIM_REGISTRY.hammer_skeleton_smash = window.__ppFxAlt ? alt : ppFx57Komponente('HS', alt);
  if (!window.__ppFxAlt) ANIM_REGISTRY.magic_hammer = ppFx57Komponente('MH', alt);
})();

// Aufwärmen im Leerlauf: die Köpfe aller Waffen für jeden Winkel (5°-Schritte), je Leerlauf-Slot einer, damit der erste Schlag nicht im kalten Code startet.
(function ppFx57Aufwaermen() {
  const los = () => {
    try {
      if (ppFx57Rueckfall() || window.__ppFx57KeinAufwaermen) return;
      const FX = window.PpFx57; FX.ensure();
      const groessen = [];
      try {   // Größe aus dem Brett, sonst typische Werte (Desktop S=3: Zone 66 px → 22 Zellen; 1280: S=2 → 25; Handy S=2 → 20)
        const z = document.querySelector('[data-hero-zone]');
        if (z) { const r = z.getBoundingClientRect(), hp = ppFx57HeldPixel(z, r.width), S = Math.max(2, Math.round(hp.px)); groessen.push([r.width / S, r.height / S]); }
      } catch (e) { /* Standard */ }
      if (!groessen.length) groessen.push([22, 26], [25, 29], [20, 28]);
      const schritte = [];
      for (const [tw, th] of groessen) for (const k of ['MH', 'HH', 'HS']) schritte.push(...FX.warmList(k, tw, th));
      const ric = window.requestIdleCallback || ((f) => setTimeout(f, 60));
      const weiter = () => { const f = schritte.shift(); if (!f) return; try { f(); } catch (e) { /* weg */ } ric(weiter, { timeout: 2500 }); };
      ric(weiter, { timeout: 2500 });
    } catch (e) { /* weg */ }
  };
  setTimeout(() => (window.requestIdleCallback ? window.requestIdleCallback(los, { timeout: 6000 }) : los()), 4500);
})();
