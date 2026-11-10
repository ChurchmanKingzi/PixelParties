// app-fx-33: Ascension (Aufstieg zum Ascended Hero) im Look des Trailers — Pixelart
//
// ═════════════════════════════════════════════════════════════════
//  Aufstieg (`hero_ascension`, Morph in `onHeroAscension` / `HeroIdleSprite`) — Vorlage: Trailer shot01.js (`MBOT`, `ASC_POP`, `A_L`/`A_C0`/`A_X`).
//
//  Zeitplan (ms ab Ereignis; ASC_DAUER_MS = 2000 und der Server-Sync nach 900 ms bleiben unverändert — der Kartenwechsel fällt in den Blitz):
//     0 –  330   „Landung" der Aufstiegskarte: harte Ringe um die Heldenkarte (Rahmen in Cyan/Creme), Funken springen nach außen, ein Druckring
//   120 –  880   Energie sammeln: die alte Figur blinkt im 2-Bilder-Takt (Creme/Cyan/Orange/Gelb, volle Silhouette — kein Alpha), drei Ringe ziehen sich
//                zusammen, die Lichtsäule wächst (gedithert), acht Strahlen kreisen, Funken werden in die Mitte gesogen, Rahmenringe um die Karte
//   880        Blitz: die alte Figur ist hart weg; Scheibe, 24 rotierende Strahlen, sieben Ringe, Lichtsäule bis zum Bildrand (1 s, wird duenner),
//                Funkenschauer (Splitter, die zurückgesogen werden) und bis 1,6 s aufsteigender Funkenregen; Vollbild-Blitz in 9 Bildern (Dither-Stufen)
//   947        die NEUE Figur erscheint hart und federt auf (ASC_POP aus dem Trailer: Streckung x/y + Hub, 11 Bilder; die ersten 4 als Creme-Silhouette)
//  Der Sprite macht das selbst: `HeroIdleSprite` fragt `ppFx33Pose(rolle, ms)` (Sichtbarkeit, Streckung, Hub, Blinkfarbe) und setzt sie auf `.hero-idle-holo`
//  (statt der CSS-Überblendung `heroAufstiegAlt/Neu`, die nur noch als Rückfall läuft, wenn diese Datei fehlt).
//
//  Technik: eine Leinwand (Rasterpixel = Hero-Pixel der Figur, `ppFxZelle`; vorher 3 Bildschirmpixel, 30 Bilder/s auf dem globalen Takt, harte Kanten, kein Alpha) in der Welt-Hülle (`ppFxWeltSchicht`),
//  deshalb bleibt sie beim Scrollen auf ihrer Zone; Aufruf `ppFx33Aufstieg({ key, x, y, w, h, t0 })` mit der Heldenzone in Fensterkoordinaten.
//  Der Vollbild-Blitz ist ein fester Block aus 4x4-Bayer-Kacheln (CSS-Hintergrund, `image-rendering: pixelated`), neun Stufen.
//  Mehrere Aufstiege: derselbe Held (`key`) löst den laufenden ab. Ton: wie bisher (macht der Aufrufer).
// ═════════════════════════════════════════════════════════════════
const PP_FX33_C = {
  creme: ppHex('#fffbd2'), gelb: ppHex('#ffe23d'), hell: ppHex('#b3d8f9'), cyan: ppHex('#1ac6ff'), orange: ppHex('#ff9a1a'), rosa: ppHex('#f8b4c8'), tinte: ppHex('#12101f'),
};
const PP_FX33_FARBEN = ['', '#fffbd2', '#1ac6ff', '#ff9a1a', '#ffe23d'];              // Blinkfarben der Figur (Index = Wert von `pose.flash`)
const PP_FX33_BILD = 1000 / 30;
const PP_FX33_SAMMELN = 120;                                                          // ms: Beginn des Energiesammelns (und des Blinkens)
const PP_FX33_X = 880;                                                                // ms: Blitz = alte Figur weg (der Server tauscht die Karte bei ~900 ms + Netz)
const PP_FX33_FLASH = [0.9, 0.9, 0.8, 0.7, 0.55, 0.4, 0.28, 0.18, 0.1];              // Vollbild-Blitz je Bild ab dem Blitz (Anteil gesetzter Dither-Pixel)
const PP_FX33_POP = [[0.2, 0.1, 0, 1], [0.35, 0.6, 20, 1], [0.5, 2.0, 140, 1], [0.7, 1.9, 210, 1], [0.9, 1.5, 170, 0], [1.25, 0.7, 90, 0], [1.0, 1.2, 40, 0], [1.12, 0.88, 10, 0],
  [0.96, 1.08, 0, 0], [1.04, 0.98, 0, 0], [1, 1, 0, 0]];                              // [sx, sy, Hub, Creme] je Bild — ASC_POP des Trailers; Hub dort in Weltpixeln (Figur 254 hoch)
const PP_FX33_HUB = 0.85 / 254;                                                        // Hub als Anteil der Figurenhöhe (etwas weniger als im Trailer: das Brett ist enger)

/**
 * Pose einer Figur im Aufstiegs-Morph zur Zeit `ms` (seit dem Ereignis). rolle 'alt' | 'neu'.
 * → { sicht, sx, sy, lift (Anteil der Figurenhöhe), flash (0 = keine, 1.. = Index in PP_FX33_FARBEN), key }
 */
function ppFx33Pose(rolle, ms) {
  const fr = Math.floor(ms / PP_FX33_BILD + 1e-6);
  if (rolle === 'alt') {
    if (ms >= PP_FX33_X) return { sicht: false, sx: 1, sy: 1, lift: 0, flash: 0, key: 'h' };
    const fl = ms >= PP_FX33_SAMMELN && fr % 2 === 0 ? 1 + ((fr >> 1) % 4) : 0;
    return { sicht: true, sx: 1, sy: 1, lift: 0, flash: fl, key: 'a' + fl };
  }
  const st = Math.floor((ms - PP_FX33_X) / PP_FX33_BILD + 1e-6) - 2;                   // der Blitz startet; die Figur kommt 2 Bilder später (wie im Trailer)
  if (st < 0) return { sicht: false, sx: 1, sy: 1, lift: 0, flash: 0, key: 'h' };
  const p = st < PP_FX33_POP.length ? PP_FX33_POP[st] : null;
  if (!p) return { sicht: true, sx: 1, sy: 1, lift: 0, flash: 0, key: 'n' };
  return { sicht: true, sx: p[0], sy: p[1], lift: p[2] * PP_FX33_HUB, flash: p[3] ? 1 : 0, key: 'p' + st };
}
const ppFx33Farbe = (i) => PP_FX33_FARBEN[i] || PP_FX33_FARBEN[1];

// ── Vollbild-Blitz: neun Dither-Kacheln (4x4, Bayer), einmal gebaut ──
const PP_FX33_KACHEL = [];
function ppFx33Kachel(stufe) {
  if (PP_FX33_KACHEL[stufe]) return PP_FX33_KACHEL[stufe];
  const lv = PP_FX33_FLASH[stufe], c = document.createElement('canvas');
  c.width = 4; c.height = 4;
  const g = c.getContext('2d'), cr = PP_FX33_C.creme;
  g.fillStyle = 'rgb(' + cr[0] + ',' + cr[1] + ',' + cr[2] + ')';
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if (ppBayer(x, y) < lv) g.fillRect(x, y, 1, 1);
  return (PP_FX33_KACHEL[stufe] = 'url(' + c.toDataURL() + ')');
}
let PP_FX33_BLITZ = null;
function ppFx33BlitzEl() {
  if (PP_FX33_BLITZ && PP_FX33_BLITZ.isConnected) return PP_FX33_BLITZ;
  const d = document.createElement('div');
  d.setAttribute('aria-hidden', 'true');
  d.setAttribute('data-pp-px', 'aus');
  d.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100vh;pointer-events:none;z-index:10140;display:none;image-rendering:pixelated;background-size:12px 12px;';
  document.body.appendChild(d);
  return (PP_FX33_BLITZ = d);
}

/** Kleiner Rastermaler (RGBA-Puffer), ganzzahlig, harte Kanten. */
function ppFx33Maler(buf, gw, gh) {
  const d = { x0: gw, y0: gh, x1: 0, y1: 0 };
  const rect = (x, y, w, h, c) => {
    let x0 = x, y0 = y, x1 = x + w, y1 = y + h;
    if (x0 < 0) x0 = 0; if (y0 < 0) y0 = 0; if (x1 > gw) x1 = gw; if (y1 > gh) y1 = gh;
    if (x0 >= x1 || y0 >= y1) return;
    if (x0 < d.x0) d.x0 = x0; if (y0 < d.y0) d.y0 = y0; if (x1 > d.x1) d.x1 = x1; if (y1 > d.y1) d.y1 = y1;      // Schmutzrechteck: je Bild nur das Berührte löschen/hochladen (Zelle = Hero-Pixel → mehr Zellen)
    for (let j = y0; j < y1; j++) {
      let i = (j * gw + x0) * 4;
      for (let q = x0; q < x1; q++, i += 4) { buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2]; buf[i + 3] = 255; }
    }
  };
  const linie = (x0, y0, x1, y1, th, c) => {
    const o = Math.floor(th / 2);
    x0 -= o; y0 -= o; x1 -= o; y1 -= o;
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (let n = 0; n < 900; n++) {
      rect(x0, y0, th, th, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  };
  /** Mittelpunktkreis, `th` = Strichstärke, `dither` = nur jedes zweite Pixel (Schachbrett). */
  const ring = (cx, cy, r, th, c, dither) => {
    let x = r, y = 0, err = 1 - r;
    const pt = (a, b) => { if (!dither || ((cx + a + cy + b) & 1) === 0) rect(cx + a, cy + b, th, th, c); };   // (keine Feld-Allokationen je Schritt: weniger GC-Ruckler)
    while (x >= y) {
      pt(x, y); pt(y, x); pt(-y, x); pt(-x, y); pt(-x, -y); pt(-y, -x); pt(y, -x); pt(x, -y);
      y++;
      if (err < 0) err += 2 * y + 1; else { x--; err += 2 * (y - x) + 1; }
    }
  };
  const scheibe = (cx, cy, r, c) => {
    for (let yy = -r; yy <= r; yy++) { const xr = Math.round(Math.sqrt(Math.max(0, r * r + r * 0.6 - yy * yy))); rect(cx - xr, cy + yy, 2 * xr + 1, 1, c); }
  };
  /** Rechteckrahmen (Außenmaß), Strichstärke 1. */
  const rahmen = (x0, y0, x1, y1, c) => { rect(x0, y0, x1 - x0 + 1, 1, c); rect(x0, y1, x1 - x0 + 1, 1, c); rect(x0, y0, 1, y1 - y0 + 1, c); rect(x1, y0, 1, y1 - y0 + 1, c); };
  return { rect, linie, ring, scheibe, rahmen, d };
}

/** Ganzzahl-Hash → 0..1 (deterministisch). */
function ppFx33H(a, b) {
  let h = Math.imul((a | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b | 0) + 0x7f4a7c15, 0xc2b2ae35);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}
const ppFx33Ease = (t) => 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);
const ppFx33Lerp = (a, b, t) => a + (b - a) * t;
const PP_FX33_LAUF = {};

function ppFx33Aufstieg(o) {
  try {
    if (!o || window._playAnimations === false || !isFinite(o.x) || !isFinite(o.y)) return null;
    const S = (typeof ppFxZelle === 'function' ? ppFxZelle({ x: o.x, y: o.y }, o.w) : 3), TAKT = PP_FX33_BILD, C = PP_FX33_C, X0 = PP_FX33_X / 1000, CH0 = PP_FX33_SAMMELN / 1000;   // Rasterzelle = Hero-Pixel der aufsteigenden Figur (Phase 2; vorher fest 3)
    if (o.key && PP_FX33_LAUF[o.key]) { try { PP_FX33_LAUF[o.key](); } catch {} }
    const fo = window.ppFxScrollOffset ? window.ppFxScrollOffset() : { dx: 0, dy: 0 };
    const welt = !!window.ppFxWeltSchicht;
    const zw = o.w > 0 ? o.w : 64, zh = o.h > 0 ? o.h : 90;
    // Maßstab: im Trailer ist die Heldenkarte ~52 Rasterpixel breit (Overlay-Raster), hier die Zonenbreite in Rasterpixeln; E = Faktor für alle Radien/Längen
    const cwR = zw / S, Q = Math.max(0.45, Math.min(1.7, cwR / 52)), E = Q * 1.26;
    const cx = o.x + fo.dx, cyZ = o.y + fo.dy, cy = cyZ - 0.34 * zh;                  // cy: Brust der Figur (sie steht mit den Füßen auf der Kartenmitte)
    const R = Math.min(330, Math.ceil(236 * E));                                          // Rasterradius der größten Ringe
    const topY = Math.max(Math.min(cy - R * S, fo.dy), cy - 650 * S);
    const lx = Math.floor((cx - R * S) / S) * S, ly = Math.floor(topY / S) * S;
    const gw = 2 * R + 2, gh = Math.min(900, Math.ceil((cy + R * S - ly) / S));
    const CX = Math.round((cx - lx) / S), CY = Math.round((cy - ly) / S), ZY = Math.round((cyZ - ly) / S);
    const hwK = Math.round(cwR / 2), hhK = Math.round(zh / S / 2);                         // halbe Kartenbreite/-höhe (Raster)

    // ── Funken (einmal gewürfelt): Landung, Sog, Schauer, Regen ──
    const salt = Math.floor(Math.random() * 1e6), cols = [C.cyan, C.creme, C.orange, C.gelb, C.rosa, C.hell], teile = [];
    const farbe = (i) => cols[Math.floor(ppFx33H(salt, i) * cols.length)];
    const sz = (i) => { const v = ppFx33H(salt, i); return v < 0.7 ? 1 : (v < 0.95 ? 2 : 3); };
    let id = 0;
    const P = (p) => { p.id = id++; teile.push(p); };
    for (let k = 0, n = ppFxN(40); k < n; k++) {                                          // Landung: Splitter nach außen, werden abgebremst
      const an = ppFx33H(salt, 10 + k) * Math.PI * 2, sp = (40 + ppFx33H(salt, 60 + k) * 150) * E;
      P({ t0: 0, life: 0.3 + ppFx33H(salt, 110 + k) * 0.5, x: CX, y: ZY, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp * 0.7, ax: -Math.cos(an) * sp * 1.4, ay: -Math.sin(an) * sp * 0.7 * 1.4, plus: ppFx33H(salt, 160 + k) < 0.3, sz: sz(210 + k), c: farbe(260 + k) });
    }
    for (let k = 0, n = ppFxN(80); k < n; k++) {                                          // Sog: Funken fliegen aus dem Umkreis zur Mitte
      const an = ppFx33H(salt, 300 + k) * Math.PI * 2, r = (45 + ppFx33H(salt, 400 + k) * 150) * E, life = 0.45;
      P({ t0: CH0 + ppFx33H(salt, 500 + k) * (X0 - CH0 - 0.1), life, x: CX + Math.cos(an) * r, y: CY + Math.sin(an) * r * 0.6, vx: -Math.cos(an) * r / life, vy: -Math.sin(an) * r * 0.6 / life, ax: 0, ay: 0,
        plus: ppFx33H(salt, 600 + k) < 0.3, sz: sz(700 + k), c: farbe(800 + k) });
    }
    for (let k = 0, n = ppFxN(190); k < n; k++) {                                         // Schauer: schnell nach außen, kehren um (Sog)
      const an = ppFx33H(salt, 900 + k) * Math.PI * 2, sp = (60 + ppFx33H(salt, 1100 + k) * 300) * E;
      P({ t0: X0, life: 0.5 + ppFx33H(salt, 1300 + k) * 0.9, x: CX, y: CY, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp * 0.8, ax: -Math.cos(an) * sp * 1.1, ay: -Math.sin(an) * sp * 0.88,
        plus: ppFx33H(salt, 1500 + k) < 0.3, sz: sz(1700 + k), c: farbe(1900 + k) });
    }
    for (let k = 0, n = ppFxN(90); k < n; k++) {                                          // Regen: steigt aus der Umgebung auf
      P({ t0: X0 + 0.2 + ppFx33H(salt, 2100 + k) * 0.8, life: 0.8 + ppFx33H(salt, 2300 + k) * 1.0, x: CX + (ppFx33H(salt, 2500 + k) - 0.5) * 50 * E, y: CY + (ppFx33H(salt, 2700 + k) - 0.5) * 50 * E,
        vx: (ppFx33H(salt, 2900 + k) - 0.5) * 22 * E, vy: -(36 + ppFx33H(salt, 3100 + k) * 130) * E, ax: 0, ay: 0, star: ppFx33H(salt, 3300 + k) < 0.2, sz: 1, c: farbe(3500 + k) });
    }
    for (let k = 0, n = ppFxN(36); k < n; k++) {                                          // Funken, die vom Boden aufsteigen (Ausklang)
      P({ t0: X0 + 0.3 + k * 0.045, life: 0.7 + ppFx33H(salt, 3700 + k) * 0.6, x: CX + (ppFx33H(salt, 3900 + k) - 0.5) * 40 * E, y: CY + 22 * E - ppFx33H(salt, 4100 + k) * 8 * E,
        vx: (ppFx33H(salt, 4300 + k) - 0.5) * 10 * E, vy: -(15 + ppFx33H(salt, 4500 + k) * 45) * E, ax: 0, ay: 0, star: ppFx33H(salt, 4700 + k) < 0.3, sz: 1, c: farbe(4900 + k) });
    }
    const ENDE = X0 + 2.3;

    // ── Leinwand in der Welt-Hülle ──
    const wurzel = document.createElement('div');
    wurzel.setAttribute('aria-hidden', 'true');
    wurzel.setAttribute('data-pp-px', 'aus');
    wurzel.style.cssText = `position:fixed;left:${lx}px;top:${ly}px;pointer-events:none;z-index:10130;`;
    const cv = document.createElement('canvas');
    cv.width = gw; cv.height = gh;
    cv.style.cssText = `width:${gw * S}px;height:${gh * S}px;image-rendering:pixelated;display:block;`;
    wurzel.appendChild(cv);
    (welt ? window.ppFxWeltSchicht() : document.body).appendChild(wurzel);
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(gw, gh);
    const m = ppFx33Maler(img.data, gw, gh);
    const rd = Math.round, fl = (x) => Math.floor(x * 30 + 1e-4);
    const dick = (v) => Math.max(1, rd(v * E));

    const malen = (t) => {
      const q = fl(t);
      // 1) „Landung": harte Rahmenringe um die Karte (10 Bilder), ein Druckring
      if (q < 10) {
        const cs = [q % 2 ? C.creme : C.cyan, C.hell, q % 2 ? C.cyan : C.creme];
        for (let r = 0; r < 3; r++) m.rahmen(CX - hwK - 1 - r * 2, ZY - hhK - 1 - r * 2, CX + hwK + 1 + r * 2, ZY + hhK + 1 + r * 2, cs[r]), m.rahmen(CX - hwK - 2 - r * 2, ZY - hhK - 2 - r * 2, CX + hwK + 2 + r * 2, ZY + hhK + 2 + r * 2, cs[r]);
      }
      if (t < 0.5) m.ring(CX, ZY, rd(ppFx33Ease(t / 0.4) * 55 * E), t < 0.1 ? dick(3) : 1, C.creme, false);
      if (t >= 0.05 && t < 0.5) m.ring(CX, ZY, rd(ppFx33Ease((t - 0.05) / 0.45) * 40 * E), dick(2), C.cyan, true);

      // 2) Energie sammeln
      if (t >= CH0 && t < X0) {
        const u = (t - CH0) / (X0 - CH0);
        for (let k = 0; k < 3; k++) { const ph = ((t - CH0) * 2.2 + k / 3) % 1; m.ring(CX, CY, rd(ppFx33Lerp(70 * E, 6, ph)), 2, [C.cyan, C.creme, C.orange][k], true); }
        const hh = rd(ppFx33Lerp(8, 150, u * u) * E), ww = 1 + rd(u * 3 * Q);
        const ab = rd(13 * E);                                                              // die Säule beginnt über dem Kopf der Figur, die Strahlen außerhalb von ihr (die Figur soll lesbar blinken)
        for (let yy = 0; yy < hh; yy++) {
          const dd = 1 - yy / hh;
          for (let xx = -ww; xx <= ww; xx++) if (ppBayer(CX + xx, CY - ab - yy) < dd) m.rect(CX + xx, CY - ab - yy, 1, 1, C.creme);
        }
        m.rect(CX - ww - 1, CY - ab - hh, 1, hh, C.cyan); m.rect(CX + ww + 1, CY - ab - hh, 1, hh, C.cyan);
        for (let k = 0; k < 8; k++) {
          const a = k * Math.PI / 4 + (t - CH0) * 3, ri = 12 * E, len = ri + (10 + 30 * u) * E, ca = Math.cos(a), sa = Math.sin(a);
          m.linie(rd(CX + ca * ri), rd(CY + sa * ri * 0.7), rd(CX + ca * len), rd(CY + sa * len * 0.7), 2, k % 2 ? C.cyan : C.creme);
        }
        // Rahmenringe um die Karte, werden mehr (1..4)
        const n = 1 + Math.floor(u * 3.99), f = fl(t) >> 1;
        for (let r = 0; r < n; r++) m.rahmen(CX - hwK - 1 - r * 2, ZY - hhK - 1 - r * 2, CX + hwK + 1 + r * 2, ZY + hhK + 1 + r * 2, cols[(f + r) % 4]);
      }

      // 3) Blitz
      if (t >= X0) {
        const dt = t - X0, qd = fl(dt);
        // Lichtsäule bis zum Bildrand
        if (dt < 1.0) {
          const hw = Math.max(0, rd(ppFx33Lerp(14, 0, Math.pow(Math.min(1, dt / 1.0), 0.7)) * E));
          for (let xx = -hw; xx <= hw; xx++) {
            const kante = Math.abs(xx) > hw * 0.55, kern = Math.abs(xx) < hw * 0.35, c = kern ? C.creme : ((qd >> 1) % 2 ? C.hell : C.gelb);
            for (let yy = CY; yy >= 0; yy--) { if (kante && ppBayer(CX + xx, yy) > 0.55) continue; m.rect(CX + xx, yy, 1, 1, c); }
          }
        }
        // rotierender Strahlenkranz
        if (dt < 0.75) {
          const n = 24, rot = qd * 0.05, len = Math.min(320, dt * 700) * E * 0.75, duenn = dt > 0.15;
          for (let k = 0; k < n; k++) {
            if (duenn && k % 2) continue;
            const a = k * Math.PI * 2 / n + rot, ex = rd(CX + Math.cos(a) * len), ey = rd(CY + Math.sin(a) * len * 0.8);
            m.linie(CX, CY, ex, ey, duenn ? dick(3) : dick(8), C.tinte);
            m.linie(CX, CY, ex, ey, duenn ? 1 : dick(4), k % 3 === 0 ? C.creme : (k % 3 === 1 ? C.hell : C.gelb));
          }
        }
        // Ringe
        for (let k = 0; k < 7; k++) {
          const rt = dt - k * 0.07;
          if (rt < 0 || rt > 1.0) continue;
          m.ring(CX, CY, rd(ppFx33Ease(rt / 1.0) * (150 + k * 12) * E * 0.75), k < 2 ? dick(4) : 2, [C.creme, C.cyan, C.gelb, C.orange, C.rosa, C.creme, C.hell][k], k % 2 === 1);
        }
        for (let k = 0; k < 4; k++) {
          const rt = dt - 1.1 - k * 0.5;
          if (rt < 0 || rt > 0.9) continue;
          m.ring(CX, CY, rd(ppFx33Ease(rt / 0.9) * (110 + k * 14) * E * 0.75), 2, [C.cyan, C.creme, C.orange, C.gelb][k], true);
        }
        if (dt < 0.2) { const r = rd(ppFx33Lerp(40, 0, dt / 0.2) * E); m.scheibe(CX, CY, r + 2, C.tinte); m.scheibe(CX, CY, r, C.creme); }
      }

      // 4) Funken (Blinken im Ausklang: ab 70 % der Lebensdauer jedes zweite Bild aus)
      for (const p of teile) {
        const d = t - p.t0;
        if (d < 0 || d >= p.life || (d > p.life * 0.7 && fl(d) % 2)) continue;
        const x = rd(p.x + p.vx * d + 0.5 * p.ax * d * d), y = rd(p.y + p.vy * d + 0.5 * p.ay * d * d);
        if (p.plus || p.star) { m.rect(x - 1, y, 3, 1, p.c); m.rect(x, y - 1, 1, 3, p.c); if (p.star) m.rect(x, y, 1, 1, C.creme); }
        else m.rect(x, y, p.sz, p.sz, p.c);
      }
    };

    // ── Takt: 30 Bilder/s auf dem globalen Raster; Zeit in ganzen Bildern ──
    const takt = window.ppTaktRaf || window.requestAnimationFrame;
    const t0 = typeof o.t0 === 'number' ? o.t0 : performance.now();
    let raf = 0, letzte = -1, fertig = false, blitzStufe = -1, vor = null;
    let ruhig = false; try { ruhig = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch {}   // kein Vollbild-Blitz bei „weniger Bewegung“
    const blitz = ppFx33BlitzEl();
    const ende = () => {
      if (fertig) return; fertig = true;
      try { cancelAnimationFrame(raf); } catch {}
      wurzel.remove();
      if (blitzStufe >= 0) blitz.style.display = 'none';
      if (o.key && PP_FX33_LAUF[o.key] === ende) delete PP_FX33_LAUF[o.key];
    };
    if (o.key) PP_FX33_LAUF[o.key] = ende;
    const schritt = (jetzt) => {
      if (fertig) return;
      if (typeof jetzt !== 'number') jetzt = performance.now();
      const ms = jetzt - t0;
      if (ms / 1000 >= ENDE) { ende(); return; }
      const fr = Math.floor(jetzt / TAKT);
      if (fr !== letzte) {
        letzte = fr;
        const t = Math.floor(Math.max(0, ms) / TAKT + 1e-6) / 30;
        const dd = m.d, buf0 = img.data;
        if (vor) for (let j = vor.y0; j < vor.y1; j++) buf0.fill(0, (j * gw + vor.x0) * 4, (j * gw + vor.x1) * 4);
        dd.x0 = gw; dd.y0 = gh; dd.x1 = 0; dd.y1 = 0;
        malen(t);
        const ux0 = Math.min(vor ? vor.x0 : gw, dd.x0), uy0 = Math.min(vor ? vor.y0 : gh, dd.y0), ux1 = Math.max(vor ? vor.x1 : 0, dd.x1), uy1 = Math.max(vor ? vor.y1 : 0, dd.y1);
        if (ux1 > ux0 && uy1 > uy0) ctx.putImageData(img, 0, 0, ux0, uy0, ux1 - ux0, uy1 - uy0);
        vor = dd.x1 > dd.x0 ? { x0: dd.x0, y0: dd.y0, x1: dd.x1, y1: dd.y1 } : null;
        // Vollbild-Blitz
        const bs = t >= X0 ? fl(t - X0) : -1, st = bs >= 0 && bs < PP_FX33_FLASH.length && !ruhig ? bs : -1;
        if (st !== blitzStufe) {
          blitzStufe = st;
          if (st < 0) blitz.style.display = 'none';
          else { blitz.style.backgroundImage = ppFx33Kachel(st); blitz.style.backgroundSize = (4 * S) + 'px ' + (4 * S) + 'px'; blitz.style.display = 'block'; }   // Kachel 4x4 Zellen = Hero-Pixel-Zelle
        }
      }
      raf = takt(schritt);
    };
    raf = takt(schritt);
    setTimeout(ende, ENDE * 1000 + 1500);                                                 // Notnagel (Tab im Hintergrund: rAF ruht)
    return ende;
  } catch (e) { try { console.warn('ppFx33Aufstieg', e); } catch {} return null; }
}
// Aufwaermen im Leerlauf: Dither-Kacheln und Blitz-Huelle liegen bereit, bevor der erste Aufstieg kommt (sonst kostete das erste Mal einige ms mitten im Blitz)
(function ppFx33Aufwaermen() {
  const los = () => { try { for (let i = 0; i < PP_FX33_FLASH.length; i++) ppFx33Kachel(i); ppFx33BlitzEl(); } catch {} };
  if (typeof window === 'undefined') return;
  if (window.requestIdleCallback) window.requestIdleCallback(los, { timeout: 6000 }); else setTimeout(los, 3000);
})();
window.ppFx33Pose = ppFx33Pose;
window.ppFx33Farbe = ppFx33Farbe;
window.ppFx33Aufstieg = ppFx33Aufstieg;
