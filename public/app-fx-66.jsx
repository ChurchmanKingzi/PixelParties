// app-fx-66: Einäscherung — eine Karte, die sich selbst zerstört, verbrennt auf ihrem Platz; die Essenz (Glutfunke) fliegt zum Ablage- bzw. Gelöscht-Stapel (Pixelart-Leinwand, Zelle = Hero-Pixel)
//
// ═════════════════════════════════════════════════════════════════
//  Vorlage: Trailer (shot01.js: Mr. Jiggles `burnCard`/`JIG`, Cute Cat `crBurn`/`CAT`, Essenz `Y_EM0`, Landung `DISC_EV`). Alles ist eine reine Funktion des Bildes f (30 Hz): feste Palettenfarben (`ppSnapRgb`),
//  Bayer-Dither statt Alpha, nichts gedreht / weich skaliert, Bewegung in ganzen Pixeln im Bildtakt (`ppTaktRaf`).
//  AUSLÖSER (Engine): `play_pile_transfer { flightStyle: 'einaescherung', from: 'support', to: 'discard' | 'deleted' }` — gesendet von `actionDestroyCard` (cards/effects/_engine.js, `_actionDestroyCardKern`),
//  wenn eine Karte sich SELBST zerstört (Quelle == Ziel, z. B. Cute Cat über `ctx.destroyCard(inst)`) oder das Kartenskript `{ einaescherung: true }` mitgibt (Doomed Town Guard, Tamed Hell Fox, Tamed Primordium).
//  Karten mit eigener Zerstörungs-Animation (Explosion, Zerspringen, Katapult …) bekommen das Flag NICHT. Handler: `onPileTransfer` in app-board.jsx ruft `ppFx66Starten`.
//  ABLAUF (Bild nach Ereignis, 30/s):
//    0–7    ABHEBEN   die Karte steht auf: das Brett-Viereck wird in 6 Stufen zum aufrechten Rechteck (1,14 × Kartenbreite) und hebt sich um ~1/3 Kartenhöhe; Bodenschatten (Schach-Dither) schrumpft
//    8–41   VERBRENNEN von unten nach oben (Brandkante mit Rauschen): vor der Flamme gedithert abgedunkelt, Flammenband (4 Gelb-Rot-Töne, Blöcke je Rasterzelle), verkohlter Streifen mit Glutpunkten, dahinter weg;
//           Funken/Flammenblöcke steigen auf, Plus-Funken, Asche fällt, Rauch steigt über der Kante; die Karte steigt währenddessen in 6 Stufen um weitere ~10 % der Kartenhöhe
//    40–60  ESSENZ    glühender Funke (Kern 3×3 Zellen, gelber Punkt, 7 Schweifglieder) fliegt im Bogen (Höhe 22 % der Strecke, 26–140 px) vom Kartenmittelpunkt zum Zielstapel (easeInOutCubic)
//    61     LANDUNG   Creme-Ring (Dicke 2→1) + zweiter Dither-Ring, Funkenstoß, 3 Bilder Creme-Dither-Blitz über dem Stapel; Ende ≈ Bild 75
//  PIXELGRÖSSE: Rasterzelle S = Hero-Pixel der Reihe der Karte (`ppFxZelleGedeckelt`, Regel in app-fx-57/60); Brandkanten-Blöcke, Flammen, Asche, Funken, Ringe liegen auf diesem Raster. Die unversehrte Kartenfläche wird wie auf dem Brett
//  gezeichnet (Nächster-Nachbar aus dem Kartenbild, ein Bildschirmpixel je Abtastwert, auf das Brett-Viereck perspektivisch abgebildet — Kartenmotive bleiben unangetastet).
//  ENGINE-VERTRAG: Die Engine wartet nach der Zerstörung `EINAESCHERUNG_MS` (= `PP_FX66_LANDUNG_MS` = Bild 61 ≈ 2033 ms, Zeit bis zur Landung) abzüglich der schon vergangenen Zeit; der Zielstapel wächst erst bei der Landung
//  (Handler: `setHidden`-Frist, Aufdecken `PILE_AUFDECKEN_VORLAUF_MS` vor der Landung). Der Quellplatz bleibt bis zum Ende verborgen (`bounceOutgoingHidden`) und die echte Karte wird sofort unsichtbar (`ppFxHalte`).
//  Rückfall (Animationen aus, Retro, `__ppFxAlt`, reduzierte Bewegung, `window.__ppFx66Aus`, fehlende Palette/Quelle/Geometrie): `ppFx66Starten` gibt null zurück → der Handler spielt den alten Karten-Flug.
//  Handy (`ppIsPhone`): Teilchen 40 %, kein Rauch. Foil-Ebenen werden nicht berührt (die echte Karte samt Foil wird nur ausgeblendet, gezeichnet wird das Kartenbild).
//  Messung (nur Tests): `window.__ppFx66Messen = true` → `window.__ppFx66Zeiten` = [Bild, ms] (Bild −1 = Geometrie/Start), `window.__ppFx66T0`; Grund eines Rückfalls: `window.__ppFx66Grund`.
// ═════════════════════════════════════════════════════════════════
(function (root) {
  const FX = {};
  const rd = Math.round, fl = Math.floor, ab = Math.abs, mn = Math.min, mx = Math.max, PI = Math.PI;
  const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeIO = (t) => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  const easeOut = (t) => 1 - Math.pow(1 - clamp(t), 3);

  // ── Zeitplan (Bilder bei 30 Hz) ──
  const F_LIFT = 8, F_BURN0 = 8, F_BURN = 33, F_EMB0 = 40, F_EMB = 21, F_LAND = 61, F_END = 76;
  FX.F_LAND = F_LAND; FX.F_END = F_END; FX.TAKT = 1000 / 30;
  FX.LANDUNG_MS = Math.round(F_LAND * 1000 / 30);

  // ── Hash, Zufall, Bayer ──
  function H(a, b) {
    let h = Math.imul((a | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b | 0) + 0x7f4a7c15, 0xc2b2ae35);
    h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  }
  function rng32(a) { return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const BAY = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];

  // ── Palette (Trailer-Farben, auf die 256 Farben gerastet) ──
  const memo = new Map();
  function snap(hex) {
    if (memo.has(hex)) return memo.get(hex);
    const h = hex.replace('#', ''), r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    const p = typeof root.ppSnapRgb === 'function' ? root.ppSnapRgb(r, g, b) : [r, g, b];
    memo.set(hex, p); return p;
  }
  let C = null;
  FX.ensure = () => {
    if (C) return C;
    C = { yel: snap('#ffe23d'), org: snap('#ff9a1a'), red: snap('#fe5154'), dred: snap('#780014'), cream: snap('#fffbd2'), white: snap('#ffffff'), ink: snap('#12101f'), dark: snap('#08060c'),
      grey: snap('#9aa3b6'), ash2: snap('#59606e'), smk: snap('#3e3e51'), pink: snap('#f8b4c8') };
    C.fire = [C.yel, C.org, C.red, C.dred];
    return C;
  };

  // ── Rastermaler für die Zellenleinwand ──
  function maler(buf, gw, gh) {
    const px = (x, y, c) => { if (x < 0 || y < 0 || x >= gw || y >= gh) return; const i = (y * gw + x) * 4; buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2]; buf[i + 3] = 255; };
    const pd = (x, y, c, lv) => { if (lv >= 16 || BAY[y & 3][x & 3] < lv) px(x, y, c); };
    const rect = (x, y, w, h, c) => { x = rd(x); y = rd(y); for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) px(x + i, y + j, c); };
    const ring = (cx, cy, r, th, c, dith) => {   // Kreisring in Zellen (Dicke th; dith: jede zweite Zelle)
      cx = rd(cx); cy = rd(cy); r = rd(r); if (r < 1) return;
      const n = mx(16, rd(r * 7)); let lx = 1e9, ly = 1e9;
      for (let k = 0; k < n; k++) {
        const a = k / n * PI * 2, x = rd(cx + Math.cos(a) * r), y = rd(cy + Math.sin(a) * r * 0.82); if (x === lx && y === ly) continue; lx = x; ly = y;
        if (dith && ((x + y) & 1)) continue; rect(x, y, th, th, c);
      }
    };
    return { px, pd, rect, ring };
  }
  FX.maler = maler;

  // ── Projektive Abbildung Einheitsquadrat → Viereck (TL, TR, BR, BL) und ihre Umkehrung ──
  function quadMap(q) {
    const [x0, y0] = q[0], [x1, y1] = q[1], [x2, y2] = q[2], [x3, y3] = q[3];
    const sx = x0 - x1 + x2 - x3, sy = y0 - y1 + y2 - y3;
    let a, b, c, d, e, f, g, h;
    if (ab(sx) < 1e-9 && ab(sy) < 1e-9) { a = x1 - x0; b = x3 - x0; c = x0; d = y1 - y0; e = y3 - y0; f = y0; g = 0; h = 0; }
    else {
      const dx1 = x1 - x2, dx2 = x3 - x2, dy1 = y1 - y2, dy2 = y3 - y2, den = dx1 * dy2 - dx2 * dy1;
      g = (sx * dy2 - dx2 * sy) / den; h = (dx1 * sy - sx * dy1) / den;
      a = x1 - x0 + g * x1; b = x3 - x0 + h * x3; c = x0; d = y1 - y0 + g * y1; e = y3 - y0 + h * y3; f = y0;
    }
    // Umkehrung (Adjunkte): (x, y) → (u, v)
    const A = e - f * h, B = c * h - b, Cc = b * f - c * e, D = f * g - d, E = a - c * g, F = c * d - a * f, G = d * h - e * g, Hh = b * g - a * h, I = a * e - b * d;
    return {
      fwd: (u, v) => { const w = g * u + h * v + 1; return [(a * u + b * v + c) / w, (d * u + e * v + f) / w]; },
      inv: { A, B, C: Cc, D, E, F, G, H: Hh, I },
    };
  }
  FX.quadMap = quadMap;
  const lerpQ = (p, q, t) => p.map((pt, i) => [lerp(pt[0], q[i][0], t), lerp(pt[1], q[i][1], t)]);
  const roundQ = (q) => q.map((p) => [rd(p[0]), rd(p[1])]);
  const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);

  /**
   * Plan einmal beim Start (reine Zahlen, kein DOM): Vierecke je Bild, Zellenleinwand, Teilchen, Essenz-Bahn, Landung.
   * o: { Q0 (Fensterpunkte TL,TR,BR,BL des Kartenvierecks), ratio (Kartenhöhe / -breite im Layout), S, tgt: { x, y, w, h } (Zielstapel, Fensterpunkte), phone, n (Teilchenfaktor), seed }
   */
  FX.plan = (o) => {
    const Q0 = o.Q0, S = o.S;
    const cx = (Q0[0][0] + Q0[1][0] + Q0[2][0] + Q0[3][0]) / 4, cy = (Q0[0][1] + Q0[1][1] + Q0[2][1] + Q0[3][1]) / 4;
    const meanW = (dist(Q0[0], Q0[1]) + dist(Q0[3], Q0[2])) / 2;
    const Wt = meanW * 1.14, Ht = Wt * o.ratio, lift = Ht * 0.34, extra = Ht * 0.10;
    const Q1 = [[cx - Wt / 2, cy - Ht / 2 - lift], [cx + Wt / 2, cy - Ht / 2 - lift], [cx + Wt / 2, cy + Ht / 2 - lift], [cx - Wt / 2, cy + Ht / 2 - lift]];
    const stufen = 6;
    // Pose je Bild: Viereck (ganze Pixel), Brandfortschritt rb (0..1), Hebestufe q
    const pose = (f) => {
      const q = rd(easeIO(f / F_LIFT) * stufen) / stufen, rb = clamp((f - F_BURN0) / F_BURN), r2 = rd(rb * stufen) / stufen;
      const quad = roundQ(lerpQ(Q0, Q1, q).map((p) => [p[0], p[1] - r2 * extra]));
      return { q, rb, quad, ex: r2 * extra };
    };
    const poses = []; for (let f = 0; f <= F_END; f++) poses.push(pose(f));
    // Leinwand der Karte (Bildschirmpixel) = Hülle aller Vierecke
    let kx0 = 1e9, ky0 = 1e9, kx1 = -1e9, ky1 = -1e9;
    for (const p of poses) for (const pt of p.quad) { kx0 = mn(kx0, pt[0]); ky0 = mn(ky0, pt[1]); kx1 = mx(kx1, pt[0]); ky1 = mx(ky1, pt[1]); }
    for (const pt of Q0) { kx0 = mn(kx0, pt[0]); ky0 = mn(ky0, pt[1]); kx1 = mx(kx1, pt[0]); ky1 = mx(ky1, pt[1]); }
    const card = { x: fl(kx0) - 1, y: fl(ky0) - 1, w: Math.ceil(kx1) - fl(kx0) + 2, h: Math.ceil(ky1) - fl(ky0) + 2 };
    // Essenz-Bahn (Fensterpunkte)
    const eStart = [cx, cy - lift - extra], eEnd = [o.tgt.x, o.tgt.y], dd = dist(eStart, eEnd), arc = clamp(dd * 0.22, 26, 140);
    const embPos = (u) => { const e = easeIO(u); return [lerp(eStart[0], eEnd[0], e), lerp(eStart[1], eEnd[1], e) - Math.sin(PI * clamp(u)) * arc]; };
    // Zellenleinwand (um Karte, Bahn und Stapel)
    let fx0 = mn(card.x, o.tgt.x - o.tgt.w * 0.9), fy0 = mn(card.y, o.tgt.y - o.tgt.h * 0.9), fx1 = mx(card.x + card.w, o.tgt.x + o.tgt.w * 0.9), fy1 = mx(card.y + card.h, o.tgt.y + o.tgt.h * 0.9);
    for (let k = 0; k <= 12; k++) { const p = embPos(k / 12); fx0 = mn(fx0, p[0]); fy0 = mn(fy0, p[1]); fx1 = mx(fx1, p[0]); fy1 = mx(fy1, p[1]); }
    const padPx = 14 * S + 40;
    const lx = rd(fx0 - padPx), ly = rd(fy0 - padPx), gw = Math.min(900, Math.ceil((fx1 + padPx - lx) / S)), gh = Math.min(700, Math.ceil((fy1 + padPx - ly) / S));
    const cell = (x, y) => [(x - lx) / S, (y - ly) / S];
    // Kartenskala: Zellen je Kartenhöhe
    const hc = Ht / S, ks = 3 / S;                                    // Geschwindigkeiten gelten für Zelle 3: bei feinerer Zelle mehr Zellen je Sekunde
    const nF = (o.n == null ? 1 : o.n);
    const rg = rng32(o.seed | 0 || 1), parts = [];
    const P = (p) => parts.push(p);
    const ramp = (arr) => arr;
    // Brandteilchen je Bild: an der Brandkante, im Kartenraum (150 × 210) auf das Viereck des Bildes abgebildet
    const bw = mx(2.2, hc / 11);                                     // Teilchenmenge wächst mit der Kartengröße
    for (let f = F_BURN0; f < F_BURN0 + F_BURN + 9; f++) {
      const ps = poses[mn(F_END, f)], rb = clamp((f - F_BURN0) / F_BURN), yf = lerp(236, -60, rb), qm = quadMap(ps.quad);
      const at = (xt, yt) => { const p = qm.fwd(xt / 150, yt / 210); return cell(p[0], p[1]); };
      const nFl = rd((rb < 0.05 ? 0.5 : 1) * bw * 1.8 * nF), nPl = rd(bw * 0.28 * nF + rg() * 0.6), nAs = rd(bw * 0.34 * nF + rg() * 0.5), nSm = o.phone ? 0 : rd(bw * 0.22 * nF + rg() * 0.5);
      for (let k = 0; k < nFl; k++) {
        const xt = rg() * 150, yt = yf + (rg() - 0.3) * 12; if (yt < 0 || yt > 210) continue; const [sx, sy] = at(xt, yt);
        P({ f0: f + rg() * 0.9, life: (0.3 + rg() * 0.4) * 30, x0: sx, y0: sy, vx: (rg() - 0.5) * 6 * ks, vy: -(8 + rg() * 16) * ks, ay: -5 * ks, kind: 'sq', sz: rg() < 0.5 ? 3 : 2, sz2: 1, ramp: C.fire });
      }
      for (let k = 0; k < nPl; k++) {
        const xt = rg() * 150, yt = yf + (rg() - 0.5) * 14; if (yt < 0 || yt > 210) continue; const [sx, sy] = at(xt, yt);
        P({ f0: f, life: (0.4 + rg() * 0.5) * 30, x0: sx, y0: sy, vx: (rg() - 0.5) * 14 * ks, vy: -(14 + rg() * 26) * ks, ay: 18 * ks, kind: 'plus', sz: 1, ramp: [C.yel, C.org, C.org] });
      }
      for (let k = 0; k < nAs; k++) {
        const xt = rg() * 150, yt = yf + 6 + rg() * 16; if (yt < 0 || yt > 210) continue; const [sx, sy] = at(xt, yt);
        P({ f0: f, life: (0.8 + rg() * 0.8) * 30, x0: sx, y0: sy, vx: (rg() - 0.5) * 9 * ks, vy: -(3 + rg() * 10) * ks, ay: 2 * ks, kind: 'sq', sz: rg() < 0.5 ? 2 : 1, sz2: 1, ramp: [C.grey, C.ash2, C.ash2, C.dark] });
      }
      for (let k = 0; k < nSm; k++) {
        const xt = rg() * 150, yt = yf - 8 - rg() * 10; if (yt < 0 || yt > 210) continue; const [sx, sy] = at(xt, yt);
        P({ f0: f, life: (0.7 + rg() * 0.6) * 30, x0: sx, y0: sy - 1, vx: (rg() - 0.5) * 3 * ks, vy: -(5 + rg() * 8) * ks, ay: 0, kind: 'sq', sz: 3, sz2: 2, ramp: [C.smk, C.smk, C.ink] });
      }
    }
    // Landung: Funkenstoß am Zielstapel
    const tc = cell(o.tgt.x, o.tgt.y), nL = rd(30 * nF);
    for (let k = 0; k < nL; k++) { const an = rg() * PI * 2, sp = (10 + rg() * 42) * ks; P({ f0: F_LAND + rg() * 0.5, life: (0.25 + rg() * 0.3) * 30, x0: tc[0], y0: tc[1], vx: Math.cos(an) * sp, vy: Math.sin(an) * sp * 0.85, ay: 0, kind: rg() < 0.3 ? 'plus' : 'sq', sz: 1, ramp: [k % 2 ? C.org : C.yel] }); }
    for (let k = 0; k < rd(8 * nF); k++) P({ f0: F_LAND + 2 + rg() * 8, life: (0.7 + rg() * 0.5) * 30, x0: tc[0] + (rg() - 0.5) * o.tgt.w / S * 0.8, y0: tc[1] + (rg() - 0.5) * o.tgt.h / S * 0.8, vx: (rg() - 0.5) * 4 * ks, vy: -(8 + rg() * 12) * ks, ay: 0, kind: 'star', sz: 1, ramp: [k % 2 ? C.cream : C.pink] });
    // Funken auf der Essenz-Bahn
    for (let f = F_EMB0 + 1; f < F_LAND; f += 2) { const u = (f - F_EMB0) / F_EMB, p = embPos(u), c = cell(p[0], p[1]); P({ f0: f, life: 8, x0: c[0] + (rg() - 0.5) * 2, y0: c[1] + (rg() - 0.5) * 2, vx: (rg() - 0.5) * 8 * ks, vy: (rg() - 0.5) * 8 * ks, ay: 0, kind: rg() < 0.5 ? 'plus' : 'sq', sz: 1, ramp: [C.cream, C.yel, C.org] }); }
    return { S, Q0, Q1, poses, card, lx, ly, gw, gh, cell, embPos, tc, tw: o.tgt.w / S, th: o.tgt.h / S, parts, hc, ks, wRest: meanW, hRest: Ht };
  };

  // ── Zeichnen der Zellenleinwand zum Bild f ──
  FX.drawFx = (m, f, pl, ms) => {
    const S = pl.S, ps = pl.poses[mn(f, F_END)];
    // Bodenschatten unter der Karte (Schach-Dither im Brett-Viereck, schrumpft beim Aufstehen), weg ab 70 % Brand
    if (f < F_BURN0 + F_BURN * 0.7 && f >= 0) {
      const k = 1 - 0.4 * ps.q, Q = pl.Q0.map((p, i) => { const c = [(pl.Q0[0][0] + pl.Q0[2][0]) / 2, (pl.Q0[0][1] + pl.Q0[2][1]) / 2]; return [c[0] + (p[0] - c[0]) * k, c[1] + (p[1] - c[1]) * k]; });
      const qc = Q.map((p) => pl.cell(p[0], p[1])), x0 = fl(mn(qc[0][0], qc[3][0])), x1 = Math.ceil(mx(qc[1][0], qc[2][0])), y0 = fl(mn(qc[0][1], qc[1][1])), y1 = Math.ceil(mx(qc[2][1], qc[3][1]));
      const inside = (x, y) => { let s = 0; for (let i = 0; i < 4; i++) { const a = qc[i], b = qc[(i + 1) % 4], cr = (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]); if (cr < 0) s |= 1; else if (cr > 0) s |= 2; } return s !== 3; };
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (((x + y) & 1) === 0 && inside(x + 0.5, y + 0.5)) ms.px(x, y, C.dark);   // eigene Ebene UNTER der Karte
    }
    // Teilchen
    for (const p of pl.parts) {
      const dt = (f - p.f0) / 30, dfr = f - p.f0; if (dfr < 0 || dfr >= p.life) continue;
      if (dfr > p.life * 0.72 && (f & 1)) continue;                                  // Ausblinken statt Alpha
      const x = rd(p.x0 + p.vx * dt), y = rd(p.y0 + p.vy * dt + 0.5 * p.ay * dt * dt);
      const col = p.ramp[mn(p.ramp.length - 1, fl(dfr / p.life * p.ramp.length))];
      if (p.kind === 'plus') { m.rect(x - 1, y, 3, 1, col); m.rect(x, y - 1, 1, 3, col); }
      else if (p.kind === 'star') { m.rect(x - 2, y, 5, 1, col); m.rect(x, y - 2, 1, 5, col); m.rect(x - 1, y - 1, 3, 3, col); }
      else { const z = p.sz2 != null && dfr > p.life * 0.5 ? p.sz2 : p.sz; m.rect(x, y, z, z, col); }
    }
    // Essenz
    if (f >= F_EMB0 && f < F_LAND) {
      const u = (f - F_EMB0) / F_EMB;
      for (let k = 7; k >= 1; k--) { const uu = mx(0, u - k * 0.03), p = pl.embPos(uu), c = pl.cell(p[0], p[1]), z = k < 3 ? 3 : 2; m.rect(rd(c[0]), rd(c[1]), z, z, k % 2 ? C.org : C.yel); }
      const p = pl.embPos(u), c = pl.cell(p[0], p[1]), X = rd(c[0]), Y = rd(c[1]);
      m.rect(X - 2, Y - 2, 4, 4, C.org); m.rect(X - 1, Y - 1, 2, 2, C.yel);
      if (f & 1) { m.px(X - 3, Y, C.yel); m.px(X + 2, Y, C.yel); m.px(X, Y - 3, C.yel); m.px(X, Y + 2, C.yel); }
    }
    // Landung: Ringe + Blitz
    const dl = (f - F_LAND) / 30;
    if (dl >= 0 && dl < 0.45) {
      const tc = pl.tc, R = mx(8, pl.tw * 0.62), e1 = easeOut(dl / 0.4), e2 = easeOut((dl - 0.05) / 0.4);
      m.ring(tc[0], tc[1], rd(e1 * R), dl < 0.1 ? 2 : 1, C.cream, false);
      if (dl > 0.05) m.ring(tc[0], tc[1], rd(e2 * R * 0.66), 1, C.org, true);
    }
    const fb = f - F_LAND;
    if (fb >= 0 && fb < 3) {
      const lv = [10, 6, 3][fb], tc = pl.tc, hw = rd(pl.tw / 2), hh = rd(pl.th / 2);
      for (let y = -hh; y < hh; y++) for (let x = -hw; x < hw; x++) m.pd(rd(tc[0]) + x, rd(tc[1]) + y, C.cream, lv);
    }
  };

  /**
   * Kartenebene zum Bild f: Nächster-Nachbar-Abtastung der Karte auf dem (stufenweise gehobenen) Viereck, Brandkante mit Rauschen in Rasterblöcken.
   * tex: { d (RGBA), w, h }, cv: { x, y, w, h } (Leinwand in Bildschirmpixeln), B: Blockgröße im Kartenraum (150 × 210), bk: Bandfaktor
   */
  FX.drawCard = (buf, f, pl, tex, B, bk) => {
    buf.fill(0);
    if (f >= F_BURN0 + F_BURN) return false;
    const ps = pl.poses[mn(f, F_END)], qm = quadMap(ps.quad), I = qm.inv, cv = pl.card, rb = ps.rb, yf = lerp(236, -60, rb), fr = f;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const p of ps.quad) { x0 = mn(x0, p[0]); y0 = mn(y0, p[1]); x1 = mx(x1, p[0]); y1 = mx(y1, p[1]); }
    x0 = mx(cv.x, fl(x0)); y0 = mx(cv.y, fl(y0)); x1 = mn(cv.x + cv.w, Math.ceil(x1)); y1 = mn(cv.y + cv.h, Math.ceil(y1));
    const td = tex.d, tw = tex.w, th = tex.h, ink = C.ink, dk = C.dark, fire = C.fire;
    const sinT = 3 * rb, burning = rb > 0;
    for (let y = y0; y < y1; y++) {
      const yy = y + 0.5;
      for (let x = x0; x < x1; x++) {
        const xx = x + 0.5, w = I.G * xx + I.H * yy + I.I, u = (I.A * xx + I.B * yy + I.C) / w, v = (I.D * xx + I.E * yy + I.F) / w;
        if (u < 0 || v < 0 || u >= 1 || v >= 1) continue;
        const ti = ((v * th | 0) * tw + (u * tw | 0)) * 4; if (td[ti + 3] < 128) continue;
        let r, g, b;
        if (!burning) { r = td[ti]; g = td[ti + 1]; b = td[ti + 2]; }
        else {
          const tx = u * 150, ty = v * 210, bx = (tx / B) | 0, by = (ty / B) | 0, cxb = bx * B, cyb = by * B;
          const dd = (cyb + (H(bx + 1, by + 7) - 0.5) * 30 + Math.sin(cxb * 0.21 + sinT) * 5 - yf) / bk;
          if (dd >= 22) continue;
          if (dd < -12) { r = td[ti]; g = td[ti + 1]; b = td[ti + 2]; }
          else if (dd < 0) { if ((bx + by) & 1) { r = td[ti]; g = td[ti + 1]; b = td[ti + 2]; } else { r = ink[0]; g = ink[1]; b = ink[2]; } }
          else if (dd < 10) { const c = fire[mn(3, ((bx + by + fr) % 3) + (dd > 6 ? 1 : 0))]; r = c[0]; g = c[1]; b = c[2]; }
          else { const c = ((bx * 7 + by * 13 + fr) % 23 === 0) ? fire[1] : (((bx + by) & 1) ? ink : dk); r = c[0]; g = c[1]; b = c[2]; }
        }
        const i = ((y - cv.y) * cv.w + (x - cv.x)) * 4; buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = 255;
      }
    }
    return true;
  };
  root.PpFx66 = FX;
})(window);

// ═════════════════════════════════════════════════════════════════════════════════════
//  SPIEL-HÜLLE: Quelle (Brett-Viereck der Karte) und Ziel (Stapel) messen, Leinwände in der Weltschicht, Takt, Aufräumen, Rückfall
// ═════════════════════════════════════════════════════════════════════════════════════
const PP_FX66_TAKT = 1000 / 30;
const PP_FX66_LANDUNG_MS = Math.round(61 * 1000 / 30);   // = PpFx66.LANDUNG_MS (Bild 61): Zeit vom Ereignis bis die Essenz den Stapel trifft; die Engine wartet genauso lange (`EINAESCHERUNG_MS` in _engine.js)
window.PP_FX66_LANDUNG_MS = PP_FX66_LANDUNG_MS;

/** Rückfall auf den alten Karten-Flug: Animationen aus, Retro, Test-Schalter, reduzierte Bewegung, keine Palette. */
function ppFx66Rueckfall() {
  try {
    if (window.__ppFx66Aus || window.__ppFxAlt || window._playAnimations === false || window.PP_RETRO || typeof window.ppSnapRgb !== 'function' || !window.PpFx66) return true;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return true;
  } catch (e) { /* weiter */ }
  return false;
}
window.ppFx66Moeglich = () => !ppFx66Rueckfall();

function ppFx66Fehl(g) { window.__ppFx66Grund = g; return null; }

/** Die vier Bildschirmpunkte (TL, TR, BR, BL) der Layoutbox eines Elements samt Brett-Perspektive: vier Nullgrößen-Marken, ein Layout-Lesen. */
function ppFx66Viereck(el) {
  const w = el.offsetWidth, h = el.offsetHeight; if (!(w > 0 && h > 0)) return null;
  const pos = getComputedStyle(el).position;
  if (pos === 'static') return null;
  const ms = [[0, 0], [w, 0], [w, h], [0, h]].map(([x, y]) => { const m = document.createElement('i'); m.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:0;height:0;margin:0;padding:0;border:0;visibility:hidden;pointer-events:none`; el.appendChild(m); return m; });
  const q = ms.map((m) => { const r = m.getBoundingClientRect(); return [r.left, r.top]; });
  for (const m of ms) m.remove();
  return q.every((p) => isFinite(p[0]) && isFinite(p[1])) ? { Q: q, ratio: h / w } : null;
}

/**
 * Startet die Einäscherung. o: { srcEl (Zone), tgtEl (Stapel), cardName, delayMs (Startversatz: Bild 0 steht still), prewarm }
 * Gibt { landungMs } zurück, wenn gestartet; null → der Aufrufer spielt den alten Flug. Alles Messen (Layout) passiert hier einmal, nie im Takt.
 */
function ppFx66Starten(o) {
  try {
    if (ppFx66Rueckfall()) { window.__ppFx66Grund = 'Rückfall (Animationen aus / Retro / reduzierte Bewegung / Schalter)'; return null; }
    const FX = window.PpFx66, { srcEl, tgtEl, cardName } = o;
    if (!srcEl || !srcEl.isConnected || !tgtEl || !tgtEl.isConnected) return ppFx66Fehl('kein Quell-/Zielelement');
    const mess0 = window.__ppFx66Messen ? performance.now() : 0;
    FX.ensure();
    // Karte im Platz: die mit dem Namen im Bild, sonst die erste
    const karten = Array.from(srcEl.querySelectorAll('.board-card'));
    const enc = cardName ? encodeURIComponent(cardName) : '';
    const dateiname = (u) => { try { return decodeURIComponent(String(u || '').split('?')[0].split('/').pop() || ''); } catch (e) { return ''; } };   // Namen mit Komma/Sonderzeichen: `cardImageUrl` bildet sie auf andere Dateinamen ab
    const soll = cardName && window.cardImageUrl ? dateiname(window.cardImageUrl(cardName)) : '';
    const gleich = (k) => { const im = k.querySelector('img'); return !!im && ((!!soll && dateiname(im.src) === soll) || (!!enc && (im.src.indexOf(enc) >= 0 || im.src.indexOf(cardName) >= 0))); };
    const karte = karten.find(gleich) || (cardName ? null : karten[0]);   // nie eine fremde Karte verbrennen: ohne Namenstreffer Rückfall auf den alten Flug
    if (!karte) return ppFx66Fehl('keine Karte mit diesem Namen im Platz');
    const img = karte.querySelector('img');
    if (!img || !img.complete || !(img.naturalWidth > 0)) return ppFx66Fehl('Kartenbild nicht geladen');
    const vq = ppFx66Viereck(karte); if (!vq) return ppFx66Fehl('kein Kartenviereck');
    const tr = tgtEl.getBoundingClientRect(); if (!(tr.width > 0)) return ppFx66Fehl('Stapel ohne Größe');
    const anker = window.ppFxWeltAnker ? (window.ppFxWeltAnker(tgtEl).welt ? window.ppFxWeltAnker(tgtEl) : window.ppFxWeltAnker(srcEl)) : { welt: false, dx: 0, dy: 0 };
    const phone = !!(window.ppIsPhone && window.ppIsPhone());
    const w0 = srcEl.getBoundingClientRect().width || 66;
    const S = ppFxZelleGedeckelt({ zoneEl: srcEl, w: w0 }, { breite: Math.hypot(tr.left - vq.Q[0][0], tr.top - vq.Q[0][1]) + 260, hoehe: Math.abs(tr.top - vq.Q[0][1]) + 260 });
    const seed = Math.floor(Math.random() * 1e6) + 1;
    const pl = FX.plan({ Q0: vq.Q, ratio: vq.ratio, S, tgt: { x: tr.left + tr.width / 2, y: tr.top + tr.height / 2, w: tr.width, h: tr.height }, phone, n: (window.ppFxN ? window.ppFxN(100) / 100 : 1), seed });
    // Textur: Kartenbild Nächster-Nachbar auf Bildschirmgröße (wie das Brett es zeigt)
    const tw = ppFx66Klemme(Math.ceil(pl.hRest / vq.ratio), 24, 420), th = ppFx66Klemme(Math.round(tw * vq.ratio), 34, 600);
    const tcv = document.createElement('canvas'); tcv.width = tw; tcv.height = th;
    const tg = tcv.getContext('2d', { willReadFrequently: true }); tg.imageSmoothingEnabled = false; tg.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, 0, 0, tw, th);
    const tex = { d: tg.getImageData(0, 0, tw, th).data, w: tw, h: th };
    const B = ppFx66Klemme(Math.round(150 * S / Math.max(20, pl.wRest)), 2, 12), bk = 1.5;
    // Ebenen
    const parent = anker.welt && window.ppFxWeltSchicht ? window.ppFxWeltSchicht() : document.body;
    const wurzel = document.createElement('div');
    wurzel.setAttribute('aria-hidden', 'true'); wurzel.setAttribute('data-pp-px', 'aus'); wurzel.className = 'card-flight';
    wurzel.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;pointer-events:none;z-index:10100';
    const mk = (x, y, w, h, scale) => { const c = document.createElement('canvas'); c.width = w; c.height = h; c.style.cssText = `position:absolute;left:${x + anker.dx}px;top:${y + anker.dy}px;width:${w * scale}px;height:${h * scale}px;image-rendering:pixelated;display:block`; wurzel.appendChild(c); return c; };
    const cs = mk(pl.lx, pl.ly, pl.gw, pl.gh, S), ck = mk(pl.card.x, pl.card.y, pl.card.w, pl.card.h, 1), cf = mk(pl.lx, pl.ly, pl.gw, pl.gh, S);
    cs.setAttribute('data-pp-px', 'aus');
    ck.setAttribute('data-pp-px', 'aus'); cf.setAttribute('data-pp-px', 'aus'); cf.style.zIndex = '2';
    const gk = ck.getContext('2d'), gf = cf.getContext('2d'), ik = gk.createImageData(pl.card.w, pl.card.h), ifx = gf.createImageData(pl.gw, pl.gh), mal = FX.maler(ifx.data, pl.gw, pl.gh), gs = cs.getContext('2d'), isd = gs.createImageData(pl.gw, pl.gh), mals = FX.maler(isd.data, pl.gw, pl.gh);
    // echte Karte sofort unsichtbar (gleicher Takt wie der Start der Kartenebene, kein Doppelbild)
    const stil = karte.style; ppFxHalte(stil, 'visibility'); let freigegeben = false;
    const freigeben = () => { if (freigegeben) return; freigegeben = true; try { if (ppFxLoese(stil, 'visibility')) stil.visibility = ''; } catch (e) { /* weg */ } };
    stil.visibility = 'hidden';
    parent.appendChild(wurzel);
    // erstes Bild sofort (Frame 0 = Karte unverändert auf dem Brett)
    const draw = (f) => {
      const k = FX.drawCard(ik.data, f, pl, tex, B, bk); gk.putImageData(ik, 0, 0); ck.style.visibility = k ? 'visible' : 'hidden';
      ifx.data.fill(0); isd.data.fill(0); FX.drawFx(mal, f, pl, mals); gf.putImageData(ifx, 0, 0); gs.putImageData(isd, 0, 0);
    };
    draw(0);
    if (mess0) (window.__ppFx66Zeiten || (window.__ppFx66Zeiten = [])).push([-1, +(performance.now() - mess0).toFixed(3)]);
    const takt = window.ppTaktRaf || window.requestAnimationFrame;
    if (window.__ppFx66Manuell) {   // nur Tests: Bild für Bild von außen (`window.__ppFx66Lauf.zeichne(f)`), kein Takt, kein Ende
      window.__ppFx66Lauf = { zeichne: draw, ende: () => { try { wurzel.remove(); } catch (e) { /* weg */ } freigeben(); }, plan: pl };
      return { landungMs: PP_FX66_LANDUNG_MS, stop: () => {} };
    }
    const t0 = performance.now() + (o.delayMs > 0 ? o.delayMs : 0);
    if (window.__ppFx66Messen) window.__ppFx66T0 = t0;
    let raf = 0, letzte = -1, ende = false;
    const aufraeumen = () => { if (ende) return; ende = true; try { cancelAnimationFrame(raf); } catch (e) { /* weg */ } try { wurzel.remove(); } catch (e) { /* weg */ } freigeben(); };
    const schritt = (jetzt) => {
      if (ende) return;
      if (typeof jetzt !== 'number') jetzt = performance.now();
      const f = Math.max(0, Math.floor((jetzt - t0) / PP_FX66_TAKT + 1e-4));
      if (f > FX.F_END) { aufraeumen(); return; }
      if (f !== letzte) {
        letzte = f;
        const mess = window.__ppFx66Messen ? performance.now() : 0;
        draw(f);
        if (f >= 1 && !freigegeben && !karte.isConnected) freigegeben = true;
        if (mess) (window.__ppFx66Zeiten || (window.__ppFx66Zeiten = [])).push([f, +(performance.now() - mess).toFixed(3)]);
      }
      raf = takt(schritt);
    };
    raf = takt(schritt);
    const netz = setTimeout(aufraeumen, (o.delayMs || 0) + (FX.F_END + 1) * PP_FX66_TAKT + 2500);   // Notnagel (Tab im Hintergrund: rAF ruht)
    // Klang: Brand beim Brandbeginn, Landung beim Treffer
    try {
      if (window.playSFX) {
        setTimeout(() => window.playSFX('burn', { dedupe: 80, volume: 0.7 }), (o.delayMs || 0) + 8 * PP_FX66_TAKT);
        setTimeout(() => window.playSFX('discard', { dedupe: 80 }), (o.delayMs || 0) + PP_FX66_LANDUNG_MS);
      }
    } catch (e) { /* ohne Klang */ }
    window.__ppFx66Grund = 'neu';
    return { landungMs: PP_FX66_LANDUNG_MS, stop: () => { clearTimeout(netz); aufraeumen(); } };
  } catch (e) { try { console.warn('[Einaescherung]', e); } catch (e2) { /* weg */ } return ppFx66Fehl('Fehler ' + (e && e.message)); }
}
const ppFx66Klemme = (v, a, b) => (v < a ? a : v > b ? b : v);
window.ppFx66Starten = ppFx66Starten;
