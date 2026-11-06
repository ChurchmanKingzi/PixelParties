// Pixelart-Portierungen (Canvas), Batch 20 (dritte Welle, alle übrigen Effekte): siehe app-fx-0.jsx. Jede Portierung: `ppFxUeberschreiben('typ', Komponente)`.
// Effekte: gold_sparkle (dazu puppet_swap_laki, puppet_luck, evolution_counter — dieselbe Komponente), freeze, furious_anger, fifth_circle_flames, golden_scale.
// Alle laufen auf EINER Leinwand je Effekt (`ppR1Leinwand`, 1 Rasterpixel = 3 Bildschirmpixel, 30 Bilder/s): keine weichen Schatten, Scheine oder Verläufe — Schein = Dither-Stufen,
// Deckung = Bayer-Raster, Symbole (Wutzeichen, Waage) = Pixelbilder mit hartem Umriss. Bewegung rechnet in Bildschirmpixeln und landet auf ganzen Rasterpixeln.
// Nicht portiert (laufen schon auf Canvas, `ppPunktBild`/`ppSalve`/`ppProjektil`/`ppGlasWand`): explosion_toss_blast, fan_cheer, finding_glint, flesh_swarm, front_soldier_block,
// ghostly_warning, glasowt_fireball, glass_wall_shatter, golden_gate_gold, golden_gate_sparkle, grand_feast, gunfire_volley.

// ── Bausteine (Präfix ppFx20) ───────────────────────────────────────────────────────────────────────────────────────────
/** CSS-`cubic-bezier(x1, y1, x2, y2)` als Funktion u → Wert (Bisektion). */
function ppFx20Bez(x1, y1, x2, y2) {
  const kurve = (a, b, s) => 3 * a * s * (1 - s) * (1 - s) + 3 * b * s * s * (1 - s) + s * s * s;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let lo = 0, hi = 1;
    for (let i = 0; i < 14; i++) { const m = (lo + hi) / 2; if (kurve(x1, x2, m) < x) lo = m; else hi = m; }
    return kurve(y1, y2, (lo + hi) / 2);
  };
}
const ppFx20Eo = ppFx20Bez(0, 0, 0.58, 1);      // CSS ease-out
const ppFx20Ei = ppFx20Bez(0.42, 0, 1, 1);      // CSS ease-in
const ppFx20Eio = ppFx20Bez(0.42, 0, 0.58, 1);  // CSS ease-in-out
/** Keyframes wie in CSS: `stops` = [[u, Wert], …]; `ease` wirkt je Abschnitt (Standard: ease-out). */
function ppFx20Kf(u, stops, ease) {
  const e = ease || ppFx20Eo;
  if (u <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    if (u <= stops[i][0]) {
      const [u0, v0] = stops[i - 1], [u1, v1] = stops[i];
      return v0 + (v1 - v0) * e((u - u0) / (u1 - u0 || 1));
    }
  }
  return stops[stops.length - 1][1];
}
const ppFx20R = (a, b) => a + Math.random() * (b - a);
const ppFx20Pick = (l) => l[Math.floor(Math.random() * l.length)];
/** Schneller Dither-Schein (Stufen von außen nach innen), wie `g.glow`, nur ohne Math.hypot/pow im Innenlauf. */
function ppFx20Glow(g, cx, cy, rx, ry, stufen, a = 1, p = 1) {
  cx = Math.round(cx); cy = Math.round(cy);
  const RX = Math.ceil(rx), RY = Math.ceil(ry), n = stufen.length, irx = 1 / rx, iry = 1 / ry;
  for (let j = -RY; j <= RY; j++) {
    const v = j * iry, v2 = v * v;
    if (v2 >= 1) continue;
    for (let i = -RX; i <= RX; i++) {
      const u = i * irx, d2 = u * u + v2;
      if (d2 >= 1) continue;
      const w = 1 - Math.sqrt(d2), sv = (p === 1 ? w : Math.pow(w, p)) * n, k = Math.floor(sv), neu = (sv - k) > ppBayer(cx + i, cy + j) ? k + 1 : k;
      if (neu <= 0) continue;
      g.put(cx + i, cy + j, stufen[Math.min(n, neu) - 1], a);
    }
  }
}
/** Quadrat aus Bildschirmpixeln (mind. 1 Rasterpixel), Mitte (x, y). */
function ppFx20Korn(g, x, y, px, S, c, a) {
  const n = Math.max(1, Math.round(px / S));
  g.block(x - n / 2, y - n / 2, n, n, c, a);
}
/** Kleines Offscreen-Gitter (Farbindex je Zelle) für Bilder mit hartem Umriss: erst füllen, dann `ausgeben` — der Umriss entsteht aus den Nachbarn. */
function ppFx20Gitter(w, h) {
  const d = new Uint8Array(w * h);
  const put = (x, y, k) => { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= w || y >= h) return; d[y * w + x] = k; };
  const m = {
    put,
    block(x, y, bw, bh, k) { x = Math.round(x); y = Math.round(y); for (let j = 0; j < bh; j++) for (let i = 0; i < bw; i++) put(x + i, y + j, k); },
    disc(cx, cy, r, k) {
      cx = Math.round(cx); cy = Math.round(cy);
      const R = Math.ceil(r), r2 = r * r + r * 0.6;
      for (let j = -R; j <= R; j++) for (let i = -R; i <= R; i++) if (i * i + j * j <= r2) put(cx + i, cy + j, k);
    },
    line(x0, y0, x1, y1, k, dicke = 1) {
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1), o = Math.floor((dicke - 1) / 2);
      for (let s = 0; s <= n; s++) {
        const x = Math.round(x0 + (x1 - x0) * (s / n)), y = Math.round(y0 + (y1 - y0) * (s / n));
        if (dicke <= 1) put(x, y, k); else m.block(x - o, y - o, dicke, dicke, k);
      }
    },
    /** Gefülltes Vieleck (gerade-ungerade-Regel, Zeilenlauf). */
    vieleck(pts, k) {
      const n = pts.length;
      let y0 = 1e9, y1 = -1e9;
      for (const p of pts) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
      for (let y = Math.max(0, Math.floor(y0)); y <= Math.min(h - 1, Math.ceil(y1)); y++) {
        const xs = [];
        for (let i = 0, j = n - 1; i < n; j = i++) {
          const yi = pts[i][1], yj = pts[j][1];
          if ((yi > y + 0.5) !== (yj > y + 0.5)) xs.push(((pts[j][0] - pts[i][0]) * (y + 0.5 - yi)) / (yj - yi) + pts[i][0]);
        }
        xs.sort((a, b) => a - b);
        for (let q = 0; q + 1 < xs.length; q += 2) for (let x = Math.ceil(xs[q] - 0.5); x <= Math.floor(xs[q + 1] - 0.5); x++) put(x, y, k);
      }
    },
    /** Zeichnet das Gitter mit linker oberer Ecke (ox, oy) auf `g`: Zelle k → pal[k − 1]; leere Zellen mit gefülltem 4er-Nachbarn → `rand`. */
    ausgeben(g, ox, oy, pal, rand, a) {
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const k = d[y * w + x];
        if (k) g.put(ox + x, oy + y, pal[k - 1], a);
        else if (rand && ((x > 0 && d[y * w + x - 1]) || (x < w - 1 && d[y * w + x + 1]) || (y > 0 && d[(y - 1) * w + x]) || (y < h - 1 && d[(y + 1) * w + x]))) g.put(ox + x, oy + y, rand, a);
      }
    },
  };
  return m;
}
/**
 * Flammenzunge als Pixelform: Fuß unten bei `by` (Zeile), Mitte `cx`; Breite `B`, Höhe `H` in Rasterpixeln; `form(v)` = Halbbreite als Anteil von B für v 0 (Spitze) … 1 (Fuß);
 * `schief` = Seitenversatz je Rasterpixel Höhe (skewX), `pal` = Farben Fuß → Spitze mit Grenzen `grenz` (Anteil der Höhe von unten), Übergänge im Bayer-Raster, `weich` = ab dort wird die Spitze gedithert.
 */
function ppFx20Zunge(g, cx, by, B, H, form, schief, pal, grenz, weich, a) {
  cx = Math.round(cx); by = Math.round(by);
  const hh = Math.max(1, Math.round(H));
  for (let j = 0; j < hh; j++) {
    const v = (j + 0.5) / hh, b = 1 - v, hw = B * form(v);
    if (hw < 0.3) continue;
    const y = by - (hh - 1 - j), vers = Math.round(-(hh - j) * schief), hr = Math.ceil(hw), spitze = b > weich ? 1 - (b - weich) / (1 - weich) : 1;
    for (let i = -hr; i <= hr; i++) {
      if (Math.abs(i) > hw) continue;
      const heat = b + (ppBayer(cx + i, y) - 0.5) * 0.2;
      let k = 0;
      while (k < grenz.length && heat > grenz[k]) k++;
      g.put(cx + i + vers, y, pal[k], a * (spitze < 1 ? spitze * spitze : 1));
    }
  }
}

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  Gold Sparkle (`gold_sparkle`; dieselbe Komponente für `puppet_swap_laki`, `puppet_luck`, `evolution_counter`) — PIXELART. Ein Goldblitz aus drei harten Ringen (hell, gold, orange) wächst
//  in 500 ms (.3 → 1,3 → 1,6, blendet aus), dazu zwölf Goldkörner (3–8 px, ab 0–150 ms, 400–800 ms), die in alle Richtungen stieben und schrumpfen. Wie vorher: Mitte = Zonenmitte.
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const PP_FX20_GOLD = ['#f7f7ad', '#fad54a', '#f29a3e'].map(ppHex);
const PP_FX20_GOLDKORN = ['#fad54a', '#fad54a', '#f7f7ad', '#ffffff', '#f29a3e'].map(ppHex);
const ppFx20GoldSparkle = ppR1Leinwand((g, t, sz, te) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, C = PP_FX20_GOLD;
  const u = t / 500;
  if (u <= 1) {
    const sc = ppFx20Kf(u, [[0, 0.3], [0.5, 1.3], [1, 1.6]]), a = ppFx20Kf(u, [[0, 1], [0.5, 0.6], [1, 0]]);
    if (a > 0.03) {
      g.disc(cx, cy, 19.2 * sc / S, C[2], a);
      g.disc(cx, cy, 13 * sc / S, C[1], a);
      g.disc(cx, cy, 6.2 * sc / S, C[0], a);
    }
  }
  for (const s of te.funken) {
    const k = (t - s.delay) / s.dur;
    if (k < 0 || k > 1) continue;
    const e = ppFx20Eo(k), a = k < 0.2 ? 1 : 1 - ppFx20Eo((k - 0.2) / 0.8), px = s.size * (1.2 - 1.2 * e);
    if (a < 0.04 || px < 0.8) continue;
    ppFx20Korn(g, cx + s.dx * e / S, cy + s.dy * e / S, px, S, s.farbe, a);
  }
}, 1000, { breite: 150, hoehe: 150 }, {
  z: 10100,
  vorbereiten: () => ({
    funken: Array.from({ length: ppFxN(12) }, () => {
      const w = Math.random() * Math.PI * 2, v = ppFx20R(12, 37);
      return { dx: Math.cos(w) * v, dy: Math.sin(w) * v, size: ppFx20R(3, 8), farbe: ppFx20Pick(PP_FX20_GOLDKORN), delay: Math.random() * 150, dur: ppFx20R(400, 800) };
    }),
  }),
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  Freeze (`freeze`; Status „eingefroren" und Zonen-Animation) — PIXELART. Wie vorher: ① SCHNEEBÄLLE (acht, 6–12 px) fliegen von rechts (120–160 px) in einer Reihe zur Mitte (250–400 ms, ab i·60 ms,
//  ease-in, schrumpfen, verschwinden), ② ab 400 ms ein Eisblitz (Dither-Schein in drei Blautönen, wächst .2 → 1,8 → 2,2 über 600 ms), ③ 16 Eiskristalle (Rauten in Weiß/Eisblau) stieben aus der Mitte.
//  Die Kristalle laufen etwas straffer als vorher (die alte Fassung wurde bei 1000 ms mitten im Flug abgeschnitten, hier enden sie davor).
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const PP_FX20_EIS = ['#66b6ff', '#7fdfff', '#b6eff7'].map(ppHex);
const PP_FX20_KRISTALL = ['#b3d8f9', '#7bbeea', '#bddcef', '#ffffff', '#66b6ff'].map(ppHex);
const ppFx20Freeze = ppR1Leinwand((g, t, sz, te) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy;
  const fk = (t - 400) / 600;
  if (fk >= 0 && fk <= 1) {
    const sc = ppFx20Kf(fk, [[0, 0.2], [0.5, 1.8], [1, 2.2]]), a = ppFx20Kf(fk, [[0, 1], [0.5, 0.7], [1, 0]]), r = 55 * sc / S;
    if (a > 0.03) ppFx20Glow(g, cx, cy + 10 / S, r, r, PP_FX20_EIS, a * 0.85, 1);
  }
  for (const s of te.baelle) {
    const k = (t - s.delay) / s.dur;
    if (k < 0 || k > 1) continue;
    const e = ppFx20Ei(k), a = k < 0.8 ? 1 : 1 - (k - 0.8) / 0.2, px = s.size * (1 - 0.4 * e);
    const bx = cx + (s.startX * (1 - e) + s.size / 2) / S, by = cy + (s.startY + s.size / 2) / S, r = px / 2 / S;
    if (r < 0.6) { g.put(bx, by, PP_FX20_KRISTALL[3], a); continue; }
    g.disc(bx, by, r, PP_FX20_KRISTALL[0], a);
    if (r >= 1.3) { g.disc(bx - r * 0.3, by - r * 0.3, r * 0.55, PP_FX20_KRISTALL[3], a); g.ring(bx, by, r, r + 0.9, PP_FX20_KRISTALL[1], a * 0.6); }
  }
  for (const c of te.kristalle) {
    const k = (t - c.delay) / c.dur;
    if (k < 0 || k > 1) continue;
    const e = ppFx20Eo(k), a = k < 0.2 ? 1 : 1 - ppFx20Eo((k - 0.2) / 0.8), px = c.size * (1.2 - 1.2 * e);
    if (a < 0.04 || px < 1) continue;
    const x = Math.round(cx + c.dx * e / S), y = Math.round(cy + c.dy * e / S), n = Math.round(px / S);
    if (n <= 1) { g.put(x, y, c.farbe, a); continue; }
    const r = n >= 3 ? 2 : 1;
    for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) if (Math.abs(i) + Math.abs(j) <= r) g.put(x + i, y + j, c.farbe, a);
    g.put(x, y, PP_FX20_KRISTALL[3], a);
  }
}, 1000, { breite: 330, hoehe: 280, ankerX: 190, ankerY: 140 }, {
  z: 10100,
  vorbereiten: () => ({
    baelle: Array.from({ length: ppFxN(8) }, (_, i) => ({ startX: ppFx20R(120, 160), startY: ppFx20R(-40, 0), delay: i * 60 + Math.random() * 40, dur: ppFx20R(250, 400), size: ppFx20R(6, 12) })),
    kristalle: Array.from({ length: ppFxN(16) }, () => {
      const w = Math.random() * Math.PI * 2, v = ppFx20R(15, 50);
      return { dx: Math.cos(w) * v, dy: Math.sin(w) * v, size: ppFx20R(3, 10), farbe: ppFx20Pick(PP_FX20_KRISTALL), delay: ppFx20R(360, 540), dur: ppFx20R(400, 460) };
    }),
  }),
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  Furious Anger (`furious_anger`, Wutausbruch am Wirker) — PIXELART. Wie vorher (Anker = Heldenzone, Maße w/h): ein rotes Dither-Glühen um den Helden (1100 ms), sieben Flammenzungen am Kartenfuß
//  (900 ms, ab 0–300 ms, wachsen/zucken), sechs Dampfwölkchen steigen von der Kopfhöhe auf (800 ms, ab 250 + i·110 ms) und das Manga-Wutzeichen — weißer Zackenstern mit dunklem Rand und
//  zwei roten „!" — ploppt über der Karte auf (1200 ms: .2 → 1,18 → 0,94, zittert seitlich, steigt am Ende). Das Wackeln des Zeichens (Drehung) fällt weg: Pixelart dreht nicht.
//  Klang wie vorher aus der Komponente: critical_strike (0 ms) und elem_fire (120 ms).
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const PP_FX20_WUT = { weiss: ppHex('#ffffff'), rand: ppHex('#141414'), rot: ppHex('#8b0d0d') };
const PP_FX20_WUTFLAMME = ['#c80000', '#f87420', '#f8ca21', '#f8f8bd'].map(ppHex);
const PP_FX20_WUTGLUT = ['#c0141c', '#ee6428', '#f87420'].map(ppHex);
const PP_FX20_DAMPF = ['#d2d2db', '#ffffff'].map(ppHex);
const ppFx20WutMass = (p) => {
  const w = p.w || 80, h = p.h || 110, s = Math.max(40, w * 0.62), halb = Math.ceil(Math.max(0.15 * w + s * 1.18 + 12, 0.75 * w + 8));
  const oben = Math.ceil(0.55 * h + s * 1.18 + 20), unten = Math.ceil(0.6 * h + 10);
  return { breite: halb * 2, hoehe: oben + unten, ankerX: halb, ankerY: oben };
};
const ppFx20WutFlammeForm = (v) => (v < 0.7 ? 0.5 * Math.sqrt(Math.max(0, 1 - ((0.7 - v) / 0.7) * ((0.7 - v) / 0.7))) : 0.5 * (1 - 0.5 * ((v - 0.7) / 0.3) * ((v - 0.7) / 0.3)));
const ppFx20Wut = ppR1Leinwand((g, t, sz, te) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, w = te.w, h = te.h, s = te.s;
  // Glühen um den Helden
  const gk = t / 1100;
  if (gk <= 1) {
    const a = ppFx20Kf(gk, [[0, 0], [0.25, 1], [0.7, 0.8], [1, 0]]);
    if (a > 0.03) ppFx20Glow(g, cx, cy + 0.04 * h / S, 0.68 * w / S, 0.62 * h / S, PP_FX20_WUTGLUT, a * 0.6, 1);
  }
  // Flammen am Kartenfuß
  for (const f of te.flammen) {
    const k = (t - f.verzug) / 900;
    if (k < 0 || k > 1) continue;
    const sy = ppFx20Kf(k, [[0, 0.2], [0.3, 1.1], [0.6, 0.85], [1, 0.3]]), a = ppFx20Kf(k, [[0, 0], [0.3, 0.95], [0.6, 0.8], [1, 0]]);
    if (a < 0.04) continue;
    ppFx20Zunge(g, cx + f.dx / S, cy + h * 0.5 / S, 14 / S, f.hoehe * sy / S, ppFx20WutFlammeForm, 0, PP_FX20_WUTFLAMME, [0.2, 0.5, 0.82], 0.8, a);
  }
  // Dampf
  for (const d of te.dampf) {
    const k = (t - d.verzug) / 800;
    if (k < 0 || k > 1) continue;
    const a = ppFx20Kf(k, [[0, 0], [0.3, 0.9], [1, 0]]), sc = ppFx20Kf(k, [[0, 0.5], [1, 1.4]]), hub = ppFx20Kf(k, [[0, 0], [1, -34]]);
    const r = d.groesse / 2 * sc * 0.72 / S;
    if (a > 0.04 && r >= 0.8) ppFx20Glow(g, cx + d.dx / S, cy + (-0.35 * h + d.groesse / 2 + hub) / S, r, r, PP_FX20_DAMPF, a * 0.9, 1);
  }
  // Wutzeichen
  const zk = t / 1200;
  if (zk <= 1) {
    const sc = ppFx20Kf(zk, [[0, 0.2], [0.18, 1.18], [0.28, 0.94], [0.36, 1.04], [0.44, 1], [0.52, 1.02], [0.6, 1], [0.85, 1], [1, 1.1]]);
    const tx = ppFx20Kf(zk, [[0, 0], [0.28, 0], [0.36, 2], [0.44, -2], [0.52, 2], [0.6, -2], [0.85, 0], [1, 0]]);
    const ty = ppFx20Kf(zk, [[0, 0], [0.44, 0], [0.52, -1], [0.6, 1], [0.85, 0], [1, -8]]);
    const a = ppFx20Kf(zk, [[0, 0], [0.18, 1], [0.85, 1], [1, 0]]);
    if (a > 0.03) {
      const rr = s * sc / S, m = Math.ceil(rr) + 3, W = m * 2 + 1;
      const mx = cx + (0.15 * w + tx) / S, my = cy + (-0.55 * h + ty) / S, ox = Math.round(mx) - m, oy = Math.round(my) - m;
      const gt = ppFx20Gitter(W, W);
      gt.vieleck(te.zacken.map(([r, wi]) => [m + Math.cos(wi) * r * rr, m + Math.sin(wi) * r * rr]), 1);
      // zwei rote „!": Balken (0,16 s breit, 0,55 s hoch) und Punkt darunter
      const bw = Math.max(2, Math.round(0.16 * s * sc / S)), bh = Math.max(3, Math.round(0.55 * s * sc / S)), pt = Math.max(2, Math.round(0.16 * s * sc / S));
      for (const x0 of [-0.28, 0.1]) {
        const bx = m + Math.round(x0 * rr), by = m + Math.round(-0.42 * rr);
        gt.block(bx, by, bw, bh, 2);
        gt.block(bx, m + Math.round(0.2 * rr), bw, pt, 2);
      }
      gt.ausgeben(g, ox, oy, [PP_FX20_WUT.weiss, PP_FX20_WUT.rot], PP_FX20_WUT.rand, a);
    }
  }
}, 1250, ppFx20WutMass, {
  z: 10205,
  vorbereiten: (sz) => {
    const w = sz.props.w || 80, h = sz.props.h || 110, s = Math.max(40, w * 0.62), n = 11;
    return {
      w, h, s,
      zacken: Array.from({ length: n * 2 }, (_, i) => [i % 2 === 0 ? 1 : 0.52 + Math.random() * 0.12, (i / (n * 2)) * Math.PI * 2 - Math.PI / 2]),
      dampf: Array.from({ length: ppFxN(6) }, (_, i) => ({ dx: (i % 2 === 0 ? -1 : 1) * (w * 0.25 + Math.random() * w * 0.2), verzug: 250 + i * 110, groesse: ppFx20R(12, 22) })),
      flammen: Array.from({ length: ppFxN(7) }, (_, i) => ({ dx: (i / 6 - 0.5) * w * 1.1, hoehe: h * (0.25 + Math.random() * 0.25), verzug: Math.random() * 300 })),
    };
  },
  wirkung: () => {
    const spiel = (name, opts, at) => setTimeout(() => { if (window.playSFX) window.playSFX(name, { ...opts, dedupe: 0 }); }, at);
    spiel('critical_strike', { rate: 1.2, volume: 0.9 }, 0);
    spiel('elem_fire', { rate: 0.8, volume: 0.7 }, 120);
    return undefined;
  },
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  Fifth Circle of Hell (`fifth_circle_flames`, Brett-Animation mit `targetPoints` = Fensterrechtecke aller Helden und Support Zonen der Gegnerseite; 2000 ms) — PIXELART. Je Rechteck wie vorher:
//  ein gelb-oranges Dither-Glühen (unten dicht, nach oben ausdünnend; 1900 ms), sieben Flammenzungen am Fuß (Spitzform, Rot → Orange → Bernstein → Hellgelb, wachsen/wiegen sich, 1100–1600 ms, ab
//  0–380 ms) und fünf Glutfunken, die 54 px aufsteigen. Die Leinwand deckt alle Ziele ab (Feld-Versatz bei `welt` wie bei den Salven; die alte Fassung ignorierte den Scrollstand).
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const PP_FX20_5ZUNGE = ['#c0141c', '#f87420', '#f9ac20', '#f8f8bd'].map(ppHex);
const PP_FX20_5FUNKEN = ['#f8f8bd', '#ffeb1a', '#f9ac20', '#f87420'].map(ppHex);
const PP_FX20_5GLUT = [ppHex('#ffeb1a'), ppHex('#f87420')];
const ppFx20FuenfZunge = (v) => (v < 0.38 ? 0.28 * (v / 0.38) : 0.28 + 0.22 * ((v - 0.38) / 0.62));
const ppFx20FuenfZiele = (p) => (Array.isArray(p.targetPoints) ? p.targetPoints : []).map(q => ({ ...q, w: q.w || 64, h: q.h || 90 }));
const ppFx20FuenfMass = (p) => {
  const Z = ppFx20FuenfZiele(p), off = ppR1FeldVersatz(p);
  if (!Z.length) return { breite: 3, hoehe: 3, ankerX: 0, ankerY: 0 };
  let l = 1e9, o = 1e9, r = -1e9, u = -1e9;
  for (const q of Z) {
    l = Math.min(l, q.x - q.w / 2); r = Math.max(r, q.x + q.w / 2);
    o = Math.min(o, q.y - q.h / 2 - 0.35 * q.h - 14); u = Math.max(u, q.y + q.h / 2 + 24);
  }
  l = Math.floor(l - 24 + off.dx); o = Math.floor(o + off.dy); r = Math.ceil(r + 24 + off.dx); u = Math.ceil(u + off.dy);
  return { breite: r - l, hoehe: u - o, ankerX: p.x - l, ankerY: p.y - o };
};
const ppFx20FuenfZunge_KF = {
  sx: [[0, 0.4], [0.2, 1], [0.4, 0.9], [0.6, 1.05], [0.8, 0.9], [1, 0.6]],
  sy: [[0, 0.05], [0.2, 1], [0.4, 1.15], [0.6, 0.95], [0.8, 1.1], [1, 0.4]],
  skew: [[0, 0], [0.2, 0], [0.4, 4], [0.6, -4], [0.8, 3], [1, 0]],
  a: [[0, 0], [0.2, 1], [0.4, 1], [0.6, 1], [0.8, 0.9], [1, 0]],
};
const ppFx20Fuenf = ppR1Leinwand((g, t, sz, te) => {
  const S = sz.S;
  for (const z of te.ziele) {
    // Glühen
    const gk = t / 1900;
    if (gk <= 1) {
      const op = ppFx20Kf(gk, [[0, 0], [0.25, 1], [0.75, 0.85], [1, 0]], ppFx20Eio);
      if (op > 0.03) {
        const L = z.L - 2, T = z.T - 2, W = z.W + 4, H = z.H + 4, cxg = L + W / 2, cyg = T + 0.8 * H, rx = W / 2 * 1.4142, ry = 0.8 * H * 1.4142;
        for (let y = Math.max(0, Math.floor(T)); y < Math.ceil(T + H); y++) {
          const dy = (y + 0.5 - cyg) / ry, dy2 = dy * dy;
          if (dy2 >= 0.5625) continue;
          for (let x = Math.floor(L); x < Math.ceil(L + W); x++) {
            const dx = (x + 0.5 - cxg) / rx, d = Math.sqrt(dx * dx + dy2);
            if (d >= 0.75) continue;
            const al = d < 0.45 ? 0.55 - 0.15 * (d / 0.45) : 0.4 * (1 - (d - 0.45) / 0.3);
            g.put(x, y, d < 0.3 ? PP_FX20_5GLUT[0] : PP_FX20_5GLUT[1], al * op * 1.15);
          }
        }
      }
    }
    // Zungen
    for (const f of z.zungen) {
      const k = (t - f.delay) / f.dur;
      if (k < 0 || k > 1) continue;
      const K = ppFx20FuenfZunge_KF, sx = ppFx20Kf(k, K.sx), sy = ppFx20Kf(k, K.sy), sk = ppFx20Kf(k, K.skew), a = ppFx20Kf(k, K.a);
      if (a < 0.04) continue;
      ppFx20Zunge(g, z.L + f.pos * z.W, z.T + z.H + 4 / S, z.W * 0.18 * sx, z.H * 0.85 * f.h * sy, ppFx20FuenfZunge, Math.tan(sk * Math.PI / 180), PP_FX20_5ZUNGE, [0.18, 0.5, 0.82], 0.9, a);
    }
    // Funken
    for (const e of z.funken) {
      const k = (t - e.delay) / 1000;
      if (k < 0 || k > 1) continue;
      const a = k < 0.15 ? k / 0.15 : 1 - ppFx20Eo((k - 0.15) / 0.85), q = ppFx20Eo(k);
      if (a < 0.04) continue;
      g.put(z.L + e.pos * z.W + e.dx * q / S, z.T + z.H - 0.4 * z.H - 1 - 54 * q / S, e.farbe, a);
    }
  }
}, 2000, ppFx20FuenfMass, {
  z: 10100,
  vorbereiten: (sz) => {
    const S = sz.S, off = ppR1FeldVersatz(sz.props);
    return {
      ziele: ppFx20FuenfZiele(sz.props).map(q => ({
        L: (q.x + off.dx - q.w / 2 - sz.lx) / S, T: (q.y + off.dy - q.h / 2 - sz.ly) / S, W: q.w / S, H: q.h / S,
        zungen: Array.from({ length: ppFxN(7) }, (_, k) => ({ pos: (k + 0.5) / 7, delay: Math.round(Math.random() * 380), h: 0.7 + Math.random() * 0.6, dur: Math.round(1100 + Math.random() * 500) })),
        funken: Array.from({ length: ppFxN(5) }, () => ({ pos: Math.random(), delay: Math.round(200 + Math.random() * 750), dx: Math.round((Math.random() - 0.5) * 30), farbe: ppFx20Pick(PP_FX20_5FUNKEN) })),
      })),
    };
  },
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  Golden Scale (`golden_scale`, Permanent-Animation von Divine Gift of Balance; Anker = Mitte des Permanents; 800 ms im Aufruf, 1200 ms Lebensdauer) — PIXELART. Statt des ⚖️-Emojis eine Waage als
//  Pixelbild (Gold mit dunklem Rand, Balken wippt in ganzen Pixeln) mit goldenem Dither-Schein; sie ploppt wie vorher auf (.3 → 1,3 → 1,1 → 2, blendet am Ende aus).
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const PP_FX20_WAAGE = ['#fad54a', '#f7f7ad', '#c68206'].map(ppHex);   // Gold, Glanz, Schatten
const PP_FX20_WAAGERAND = ppHex('#9d612f');
const PP_FX20_WAAGESCHEIN = ['#c68206', '#f29a3e', '#fad54a'].map(ppHex);
function ppFx20Waage(g, cx, cy, R, wipp, a) {
  const m = Math.ceil(R * 1.15) + 3, W = m * 2 + 1, gt = ppFx20Gitter(W, W);
  const dick = Math.max(1, Math.round(R * 0.1)), s = (v) => Math.round(v * R);
  // Fuß und Säule
  gt.block(m - s(0.55), m + s(0.82), s(1.1) + 1, Math.max(2, s(0.16)), 3);
  gt.block(m - s(0.45), m + s(0.74), s(0.9) + 1, Math.max(1, s(0.1)), 1);
  gt.block(m - Math.floor(dick / 2) - (dick > 1 ? 0 : 0), m - s(0.78), dick + (dick > 1 ? 1 : 0), s(1.6), 1);
  gt.disc(m, m - s(0.84), Math.max(1.2, R * 0.13), 2);
  // Balken (wippt) mit Ketten und Schalen
  const k = R >= 6 ? Math.round(wipp * R * 0.14) : 0, by = m - s(0.62);
  const yl = by + k, yr = by - k, xl = m - s(0.92), xr = m + s(0.92);
  gt.line(xl, yl, xr, yr, 1, Math.max(1, dick));
  for (const [x, y] of [[xl, yl], [xr, yr]]) {
    const py = y + s(0.62), br = s(0.3);
    gt.line(x, y, x - br, py, 3, 1); gt.line(x, y, x + br, py, 3, 1);
    // Schale: Halbrund, unten schmaler
    const hh = Math.max(2, s(0.2));
    for (let j = 0; j < hh; j++) { const b = Math.max(1, Math.round(br * (1 - 0.65 * (j / hh)))); gt.block(x - b, py + j, b * 2 + 1, 1, j === 0 ? 2 : 1); }
  }
  gt.ausgeben(g, Math.round(cx) - m, Math.round(cy) - m, PP_FX20_WAAGE, PP_FX20_WAAGERAND, a);
}
const ppFx20GoldenScale = ppR1Leinwand((g, t, sz) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, u = t / 800;
  if (u > 1) return;
  const sc = ppFx20Kf(u, [[0, 0.3], [0.3, 1.3], [0.6, 1.1], [1, 2]]), a = ppFx20Kf(u, [[0, 0], [0.3, 1], [0.6, 1], [1, 0]]);
  if (a < 0.03) return;
  const R = 27 * sc / S;
  ppFx20Glow(g, cx, cy, R * 1.55, R * 1.55, PP_FX20_WAAGESCHEIN, a * 0.5, 1.5);
  ppFx20Waage(g, cx, cy, R, Math.sin(t / 120) * Math.exp(-t / 450), a);
}, 800, { breite: 210, hoehe: 210 }, { z: 10100 });

ppFxUeberschreiben('gold_sparkle', ppFx20GoldSparkle);
ppFxUeberschreiben('puppet_swap_laki', ppFx20GoldSparkle);
ppFxUeberschreiben('puppet_luck', ppFx20GoldSparkle);
ppFxUeberschreiben('evolution_counter', ppFx20GoldSparkle);
ppFxUeberschreiben('freeze', ppFx20Freeze);
ppFxUeberschreiben('furious_anger', ppFx20Wut);
ppFxUeberschreiben('fifth_circle_flames', ppFx20Fuenf);
ppFxUeberschreiben('golden_scale', ppFx20GoldenScale);
