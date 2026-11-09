// app-fx-59: Hammer Throw — ein Hammer wird im Bogen geworfen (Ausholen, Flug mit Drehungen, Aufprall mit Hit-Stop, steckt, prallt ab und zerfällt) — Pixelart-Leinwand
//
// ═════════════════════════════════════════════════════════════════
//  Vorlage: abgesegneter Prototyp „Hammer Throw“ (Zeichenroutinen `PpFx59`, auf den Rasterpinseln von `PpFx57` aufgebaut: maler / Bayer / Palette).
//  ABLAUF (30 Hz, 32 Bilder ≈ 1,07 s):
//    0–2   AUSHOLEN   Hammer erscheint (Dither-Einblendung) an der Hand des Werfers, −50° gekippt, Werfer rückt 1–2 Zellen weg, weißes Glanzkreuz am Edelstein
//    3–14  FLUG       Bogen (Höhe 20 % der Distanz, 6–18 Zellen), 1–2 Umdrehungen end-over-end in 15°-Stufen (gerasterte Sprites, nie gedrehte Bitmap), Nachbilder, Schwungbahn,
//                     Funkenschweif, Bodenschatten unter allen Sprites/Karten (Silhouettenmaske)
//    15–17 AUFPRALL   Hit-Stop 3 Bilder (Teilchenzeit steht, Blitz/Quetschung/Shake laufen), Starburst, Weiß-Dither-Blitz, 12 Strahlen, Druckring; Ziel weiß geblitzt und gestaucht
//                     (Hero: Sprite zellenweise auf der Leinwand, Karte: skaliert mit Ursprung unten). SCHADEN und HP-Zahl kommen bei Bild 15 (Engine: `_delay`, s. hammer-throw.js)
//    18–21 STECKT     Hammer wackelt und sinkt ein, Ziel federt (0,86 → 1,10 → 1,05 → 1,0), Funken, Brocken, Staub, Risse, Delle, zweiter Ring
//    22–30 ABPRALLEN  Hammer springt nach oben weg und zerfällt per Bayer-Schwelle; Zellen lösen sich als Funken (Handy: aus); Risse blenden per Dither aus
//  Größe: k = 1,25 (Hammer ≈ 32 Zellen hoch). Kamera-Shake nur am Desktop (Stärke 5; Handy/`prefers-reduced-motion`/`window.__ppFx59KeinShake`: aus).
//  PIXELGRÖSSE: Rasterzelle S = Hero-Pixel des Ziels (`ppFxZelleFuer` / `ppFxZelleGedeckelt`, Regel in app-fx-57). Werfer und Ziel brauchen Quelle + Ziel: die Engine schickt `von: { owner, heroIdx }`
//  (app-board.jsx `onZoneAnim` löst es auf: `vonDx/vonDy/vonW/vonH` + `vonEl`); ohne Quelle läuft die alte Fassung.
//  REGISTRY: `hammer_throw` (Zonen-Animation, `PP_SQUASH_ANIMS` reicht das Zonen-Element `zoneEl`; `PP_ANIM_MINDAUER` in app-board.jsx). Klang: `ZONE_ANIM_SFX.hammer_throw` (app-shared.jsx).
//  Rückfall (Animationen aus, Retro, `__ppFxAlt`, reduzierte Bewegung, `window.__ppFx59Aus`, keine Quelle): 🔨 fliegt, am Ende `quick_slash` am Ziel (wie vor dem Umbau).
//  Aufwärmen aller 24 Hammer-Winkel im Leerlauf (`window.__ppFx59KeinAufwaermen` schaltet ab). Messung (nur Tests): `window.__ppFx59Messen = true` → `window.__ppFx59Zeiten` = [Bild, ms].
// ═════════════════════════════════════════════════════════════════
(function (root) {
  const FX = {};
  const rd = Math.round, fl = Math.floor;
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOut = (t) => 1 - Math.pow(1 - clamp(t), 3);
  const rad = (d) => d * Math.PI / 180;
  let H = null, BAY = null, C = null;
  FX.init = () => {
    if (C) return;
    const B = root.PpFx57; B.ensure();
    H = B.H; BAY = B.BAY;
    C = Object.assign({}, B.C);
    const sn = B.snap;
    C.teal = sn('#3adfcb'); C.tealD = sn('#66a1a1'); C.tealH = sn('#b2eeee'); C.tealM = sn('#7ce9dc');   // Edelstein wie im Kartenbild (türkis)
    FX.C = C;
  };
  FX.maler = (buf, gw, gh) => root.PpFx57.maler(buf, gw, gh);

  // ── Zeitplan ──
  const WIND = 3, HITF = 15, STOP = 3, STUCK = 4, POP0 = HITF + STOP + STUCK, DISS = 9, LEN = POP0 + DISS + 1;   // 3 / 15 / 3 / 4 / 22 / 9 / 32
  FX.WIND = WIND; FX.HITF = HITF; FX.STOP = STOP; FX.POP0 = POP0; FX.LEN = LEN; FX.DAMAGE_F = HITF;
  FX.K = 1.25;

  // ── Hammer-Sprite: Kopf + Stiel, Geometrie auf Raster gerastert (einmal je Winkel/Größe gebacken) ──
  // Lokale Achsen: a = quer (Kopf-Längsachse), b = längs des Stiels, +b zeigt „nach unten“ (Stielende); Kopf sitzt bei b = −8k, Drehpunkt (b = 0) liegt nahe dem Schwerpunkt.
  const LIGHT = [-0.55, -0.83];
  const spriteCache = new Map();
  const qDeg = (d) => { d = Math.round(d / 15) * 15; d %= 360; if (d < 0) d += 360; return d; };
  function sprite(deg, k) {
    deg = qDeg(deg); const key = deg + '|' + k; let r = spriteCache.get(key); if (r) return r;
    const hu = 6.5 * k, hv = 4 * k, bC = -8 * k, hw = Math.max(1.5, 1.5 * k), bEnd = 13 * k;
    const D = Math.ceil(20 * k) + 2, W = 2 * D + 1, co = Math.cos(rad(deg)), si = Math.sin(rad(deg));
    const mat = new Uint8Array(W * W), loc = new Float32Array(W * W * 2);
    for (let j = 0; j < W; j++) for (let i = 0; i < W; i++) {
      const dx = i - D + 0.5, dy = j - D + 0.5, a = dx * co + dy * si, b = -dx * si + dy * co, bb = b - bC;
      let m = 0;
      if (Math.abs(a) <= hu && Math.abs(bb) <= hv && Math.abs(a) + Math.abs(bb) <= hu + hv - 1.5) m = 1;                  // Kopf (Ecken abgefast)
      else if (Math.abs(a) <= hw && b > bC + hv - 1.2 && b <= bEnd) m = 2;                                                // Stiel
      if (m) { mat[j * W + i] = m; loc[(j * W + i) * 2] = a; loc[(j * W + i) * 2 + 1] = b; }
    }
    const inM = (i, j) => i >= 0 && j >= 0 && i < W && j < W && mat[j * W + i];
    const ST = [C.st7, C.st6, C.st5, C.st4, C.st3, C.st2, C.st1, C.st0];                                                  // Stahl: dunkel → hell
    const WD = [C.holzD, C.holz, C.holzM, C.holzH, C.holzHH];
    const lx = LIGHT[0], ly = LIGHT[1], cells = [];
    for (let j = -1; j <= W; j++) for (let i = -1; i <= W; i++) {
      if (!inM(i, j)) { if (inM(i - 1, j) || inM(i + 1, j) || inM(i, j - 1) || inM(i, j + 1)) cells.push([i - D, j - D, C.tinte]); continue; }
      const dx = i - D + 0.5, dy = j - D + 0.5, a = loc[(j * W + i) * 2], b = loc[(j * W + i) * 2 + 1], bb = b - bC, m = mat[j * W + i], bi = BAY[j & 3][i & 3] / 16;
      const s = (dx * lx + dy * ly) / (11 * k);
      let col;
      if (m === 1) {
        let t = 1.5 + s * 1.5; t = clamp(fl(t + (bi - 0.5) * 0.9), 0, 4);
        const e = hu - Math.abs(a);
        if (e < 2.2) t = Math.max(t, 4);                                                                                  // Schlagflächen (Enden) hell abgenutzt
        if (e > 2.2 && e < 4.2) { t = 0; if (e < 2.8) t = 3; }                                                           // Eisenband mit heller Kante
        if (Math.abs(bb) < 0.9 * k && e > 4.4) t = Math.min(7, t + 1);                                                   // Mittelgrat
        if (Math.abs((a * 0.7 + bb * 0.7) - 2.6 * k) < 0.95 && e > 4.4) t = Math.min(7, t + 3);                          // Glanzstreifen
        if (H(fl(a) * 3 + 1, fl(b) * 7 + 5) < 0.04) t += H(fl(b), fl(a)) < 0.5 ? -1 : 1;                                  // Kratzer
        col = ST[clamp(t, 0, 7)];
        const rr = Math.hypot(a, bb);
        if (rr <= 1.9 * k) { const q = clamp(fl(2 + (s * -1.2) + (bi - 0.5) * 0.8), 0, 3); col = [C.tealD, C.teal, C.tealM, C.tealH][q]; if (rr > 1.4 * k) col = C.tealD; }   // Edelstein
        else if (rr <= 2.9 * k) col = ST[clamp(fl(5 + s), 4, 7)];                                                           // helle Fassung
      } else {
        let t = 2 + s * 1.6 + (bi - 0.5) * 0.9; t = clamp(fl(t), 0, 4); col = WD[t];
        if (b > 5.2 * k && b < 11 * k) { const q = (fl(a) + fl(b)) & 3; col = q < 2 ? (s > 0.2 ? C.lederH : C.leder) : C.lederD; }   // Griffwicklung
        else if (b >= 11 * k) col = s > 0.1 ? ST[5] : ST[3];                                                                 // Knauf
        else if (b < bC + hv + 1.2 * k) col = s > 0.1 ? ST[4] : ST[2];                                                       // Zwinge unter dem Kopf
      }
      const lit = !inM(i, j - 1) || !inM(i + 1, j), dark = !inM(i, j + 1) || !inM(i - 1, j);
      if (m === 1 && !(Math.hypot(a, bb) <= 2.9 * k)) { let t = ST.indexOf(col); if (t >= 0) { if (lit && !dark) t = Math.min(7, t + 2); else if (dark && !lit) t = Math.max(0, t - 1); col = ST[t]; } }
      cells.push([i - D, j - D, col]);
    }
    r = { cells, D }; spriteCache.set(key, r); return r;
  }
  FX.sprite = sprite;
  FX.warmList = (k) => { const out = []; for (let d = 0; d < 360; d += 15) out.push(() => sprite(d, k)); return out; };
  function drawHammer(m, cx, cy, deg, lv, k) { const sp = sprite(deg, k), X = rd(cx), Y = rd(cy); for (const [i, j, c] of sp.cells) m.pd(X + i, Y + j, c, lv); }
  /** Kopfmitte zum Drehpunkt (Hammer-Mitte) */
  const headOf = (cx, cy, deg, k) => [cx + 8 * k * Math.sin(rad(deg)), cy - 8 * k * Math.cos(rad(deg))];
  const centerFor = (hx, hy, deg, k) => [hx - 8 * k * Math.sin(rad(deg)), hy + 8 * k * Math.cos(rad(deg))];

  // ── Plan ──
  FX.plan = (o) => {
    const P = Object.assign({ seed: 5, k: FX.K, n: 1, th: 0, kind: 'hero', tw: 25, shake: 1, lite: false }, o), k = P.k;
    P.dx = P.tgt[0] - P.hand[0]; P.dy = P.tgt[1] - P.hand[1]; P.dist = Math.hypot(P.dx, P.dy); P.sgn = P.dx >= 0 ? 1 : -1;
    P.A = clamp(0.2 * P.dist, 5 * k, 14 * k);                                                                              // Bogenhöhe (Zellen)
    P.deg0 = -P.sgn * 50;                                                                                                  // Hammer gespannt (nach hinten gekippt)
    // Mitte des Hammers beim Abwurf: die Hand hält den Stiel bei b = +5k
    P.Hc = [P.hand[0] + 5 * k * Math.sin(rad(P.deg0)), P.hand[1] - 5 * k * Math.cos(rad(P.deg0))];
    const pe = (te) => 0.6 * te + 0.4 * te * te;
    // Endwinkel: Kopf voraus in Flugrichtung (Richtung am Ende des Bogens, mit Abstieg)
    let Ic = P.tgt.slice(), degE = 0;
    for (let it = 0; it < 4; it++) {
      const a = [lerp(P.Hc[0], Ic[0], pe(12 / 13)), lerp(P.Hc[1], Ic[1], pe(12 / 13)) - P.A * 4 * (12 / 13) * (1 / 13)], b = Ic;
      const dxv = b[0] - a[0], dyv = b[1] - a[1], L = Math.hypot(dxv, dyv) || 1;
      degE = Math.atan2(dxv / L, -dyv / L) * 180 / Math.PI;
      degE = qDeg(degE);
      Ic = centerFor(P.tgt[0], P.tgt[1], degE, k);
    }
    P.degE = degE; P.Ic = Ic; P.dEnd = [Math.sin(rad(degE)), -Math.cos(rad(degE))];
    let d = ((degE - P.deg0) % 360 + 360) % 360; if (P.sgn < 0) d = d - 360; P.spin = d + P.sgn * 360;
    const s = P.seed, sc = Math.max(0.7, P.tw / 25);
    P.sparks = Array.from({ length: Math.max(8, rd(22 * P.n)) }, (_, i) => { const a = Math.atan2(-P.dEnd[1], -P.dEnd[0]) + (H(s, i + 200) - 0.5) * 2.2; return { vx: Math.cos(a) * (1.2 + H(s, i + 210) * 2.8) * sc, vy: Math.sin(a) * (1.2 + H(s, i + 220) * 2.8) * sc - 0.6, life: 7 + H(s, i + 230) * 7, kreuz: H(s, i + 240) < 0.3, c: [C.creme, C.gelb, C.weiss, C.funke, C.org, C.tealM][fl(H(s, i + 250) * 6)] }; });
    P.debris = Array.from({ length: Math.max(5, rd(11 * P.n)) }, (_, i) => { const side = i % 2 ? 1 : -1; return { a: (side > 0 ? 0 : Math.PI) + (H(s, i + 100) - 0.5) * 1.5, vh: (0.5 + H(s, i + 110)) * P.tw * 0.5, vv: (0.8 + H(s, i + 120)) * P.tw * 0.55, sz: H(s, i + 130) < 0.3 ? 2 : 1, c: [C.stein, C.steinH, C.steinD, C.erde, C.sandD, C.erdeD][fl(H(s, i + 140) * 6)] }; });
    P.puffs = Array.from({ length: Math.max(5, rd(10 * P.n)) }, (_, i) => ({ a: (i + H(s, i + 150) * 0.8) / 10 * Math.PI * 2, r0: 1 + H(s, i + 170) * 1.5, r1: 2 + H(s, i + 180) * 3, rise: 2 + H(s, i + 190) * 5, id: i }));
    P.cracks = Array.from({ length: 7 }, (_, i) => ({ a: (i + 0.5 + (H(s, i + 40) - 0.5) * 0.7) / 7 * Math.PI * 2, L: (0.55 + H(s, i + 50) * 0.7) * P.tw * 0.55, id: i }));
    P.burst = Array.from({ length: 8 }, (_, i) => ({ a: (i + (H(s, i + 600) - 0.5) * 0.5) / 8 * Math.PI * 2, r: 0.75 + H(s, i + 610) * 0.5 }));
    return P;
  };

  // ── Hammer je Bild: Mitte, Winkel, Dither-Stufe ──
  const lift = (P, te) => P.A * 4 * te * (1 - te);
  const pe = (te) => 0.6 * te + 0.4 * te * te;
  FX.state = (f, P) => {
    const k = P.k;
    if (f < WIND) { const w = [0, 1, 2][f]; return { cx: P.Hc[0] - P.sgn * w * 1.0, cy: P.Hc[1] + w * 1.0, deg: P.deg0 + P.sgn * (-[0, 8, 16][f]), lv: [5, 11, 16][f], k }; }
    if (f < HITF) {
      const te = (f - 2) / 13, q = 1 - Math.pow(1 - te, 1.5), deg = P.deg0 + P.spin * q;
      const x = lerp(P.Hc[0], P.Ic[0], pe(te)), y = lerp(P.Hc[1], P.Ic[1], pe(te)) - lift(P, te);
      return { cx: x, cy: y, deg, lv: 16, k, te };
    }
    if (f < HITF + STOP) { const j = f - HITF; return { cx: P.Ic[0] + P.dEnd[0] * (j * 0.5), cy: P.Ic[1] + P.dEnd[1] * (j * 0.5), deg: P.degE, lv: 16, k }; }
    if (f < POP0) { const j = f - HITF - STOP; const sink = [1, 2, 2, 2][j]; const wob = [15, -15, 15, 0][j] * P.sgn; return { cx: P.Ic[0] + P.dEnd[0] * (1.5 + sink), cy: P.Ic[1] + P.dEnd[1] * (1.5 + sink), deg: P.degE + wob * 0.6, lv: 16, k }; }
    if (f < POP0 + DISS) {
      const q = f - POP0, lvT = [16, 14, 12, 10, 8, 6, 4, 2, 1];
      const base = [P.Ic[0] + P.dEnd[0] * 3, P.Ic[1] + P.dEnd[1] * 3];
      return { cx: base[0] - P.dEnd[0] * q * 1.7 - P.sgn * q * 0.6, cy: base[1] - P.dEnd[1] * q * 1.7 - (q * 2.2 - 0.12 * q * q), deg: P.degE - P.sgn * q * 22, lv: lvT[q], k, q };
    }
    return null;
  };
  const centerAt = (f, P) => { const s = FX.state(f, P); return s ? [s.cx, s.cy] : null; };

  // ── Ziel: Quetschung, Weiß, Nachbeben, Kamera-Shake ──
  FX.pose = (f, P) => {
    const out = { sx: 1, sy: 1, dx: 0, white: false, hideSprite: false, shake: [0, 0], hit: -1 };
    if (f < HITF) return out;
    const j = f - HITF, T = [0.74, 0.64, 0.64, 0.70, 0.86, 1.1, 1.05, 1.0], jj = Math.min(j, 7), sy = T[jj];
    out.hit = j; out.sy = sy; out.sx = 1 + 0.36 * (1 - sy); out.white = j < 2; out.hideSprite = j <= 7;
    if (j >= 3 && j <= 7) out.dx = [0, 1, -1, 1, -1][j - 3];
    if (P.shake > 0) { const A0 = 5 * P.shake, tot = STOP + 7, amp = A0 * Math.pow(Math.max(0, 1 - j / tot), 1.3); if (j < tot && amp >= 1) { const sg = j % 2 ? -1 : 1; out.shake = [rd(sg * amp * 0.4), rd(amp * (j % 2 ? -0.7 : 1))]; } }
    return out;
  };
  /** Werfer: Rückstoß beim Ausholen (weg vom Ziel), Vorrücken beim Abwurf (Zellen, ganzzahlig) */
  FX.thrower = (f, P) => { const a = [0, -1, -2, 2, 1, 0][f] || 0, L = P.dist || 1, ux = P.dx / L, uy = P.dy / L; return { dx: rd(ux * a), dy: rd(uy * a) }; };

  function dline(m, x0, y0, x1, y1, th, c, lv) {
    x0 = rd(x0); y0 = rd(y0); x1 = rd(x1); y1 = rd(y1); const o = fl(th / 2); x0 -= o; y0 -= o; x1 -= o; y1 -= o;
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let err = dx + dy;
    for (let n = 0; n < 400; n++) { for (let a = 0; a < th; a++) for (let b = 0; b < th; b++) m.pd(x0 + a, y0 + b, c, lv); if (x0 === x1 && y0 === y1) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; } }
  }
  function burst(m, P, cx, cy, Ro, lv, pal, rot) {
    const tips = P.burst, N = tips.length, NL = 128, lut = new Float32Array(NL), V = [];
    for (let i = 0; i < N; i++) { V.push([(tips[i].a + rot) % (Math.PI * 2), Ro * tips[i].r]); V.push([(tips[i].a + rot + Math.PI / N) % (Math.PI * 2), Ro * 0.46]); }
    V.sort((p, q) => p[0] - q[0]);
    const TP = Math.PI * 2; let seg = 0;
    for (let q = 0; q < NL; q++) { const th = q / NL * TP; while (seg < V.length - 1 && V[seg + 1][0] <= th) seg++; const a = V[seg], b = V[(seg + 1) % V.length]; let a1 = b[0]; if (a1 <= a[0]) a1 += TP; lut[q] = lerp(a[1], b[1], clamp((th - a[0]) / Math.max(1e-6, a1 - a[0]))); }
    const R = Math.ceil(Ro * 1.3);
    for (let j = -R; j <= R; j++) for (let i = -R; i <= R; i++) {
      const dx = i + 0.5, dy = (j + 0.5), d2 = dx * dx + dy * dy; if (d2 > Ro * Ro * 1.7) continue;
      let th = Math.atan2(dy, dx); if (th < 0) th += TP;
      const r = lut[(th / TP * NL) | 0], d = Math.sqrt(d2); if (d > r) continue;
      m.pd(rd(cx + i), rd(cy + j), d > r - 1.2 ? pal[0] : (d < r * 0.38 ? pal[3] : (d < r * 0.7 ? pal[2] : pal[1])), lv);
    }
  }

  FX.draw = (m, f, P, hook) => {
    const k = P.k, tw = P.tw, st = FX.state(f, P), flat = P.flat || 0.8;
    const ti = f < HITF ? -1 : f - HITF - Math.min(f - HITF, STOP - 1);                    // Teilchenzeit (Hit-Stop friert ein)
    const I = P.tgt, T0 = P.tfoot, W0 = Math.max(10, tw * 0.5);
    // ── UNTERE EBENE (maskiert): Flugschatten, Delle, Risse, Bodenring ──
    m.setMask(hook && hook.maske ? hook.maske(f) : null);
    if (f >= 2 && f < HITF + 1) {                                                          // Schatten des Hammers am Boden: wandert zum Ziel, wird mit der Nähe dunkler/kleiner
      const te = clamp((f - 2) / 13), gx = lerp(P.foot[0], T0[0], pe(te)), gy = lerp(P.foot[1], T0[1], pe(te)), near = te, r = (6 + 3 * (1 - near)) * k;
      m.dith(gx, gy, r, r * flat * 0.45, rd(3 + 5 * near), C.nacht);
    }
    if (f >= HITF) {
      m.dith(T0[0], T0[1] + 1, W0 * 0.8, W0 * 0.8 * flat * 0.5, 8, C.nacht);                                       // Delle
      for (const cr of P.cracks) {
        const p = clamp((ti + 1) / 4), Lk = cr.L * easeOut(p), segs = 6, r0 = tw * 0.3; let a = cr.a, px0 = Math.cos(a) * r0, pz0 = Math.sin(a) * r0 * flat;
        for (let s2 = 1; s2 <= segs; s2++) { const q = s2 / segs; if (q * cr.L > Lk) break; a += (H(P.seed + cr.id, s2) - 0.5) * 0.7; const px1 = Math.cos(a) * (r0 + cr.L * q), pz1 = Math.sin(a) * (r0 + cr.L * q) * flat;
          if (f >= POP0 + 3 && BAY[(s2 + cr.id) & 3][(s2 * 3) & 3] / 16 < clamp((f - POP0 - 2) / 6)) { px0 = px1; pz0 = pz1; continue; }
          m.linie(T0[0] + px0, T0[1] + pz0 + 1, T0[0] + px1, T0[1] + pz1 + 1, 1, C.sandD); m.linie(T0[0] + px0, T0[1] + pz0, T0[0] + px1, T0[1] + pz1, s2 < 3 ? 2 : 1, C.nacht); px0 = px1; pz0 = pz1; }
      }
      const rings = [[0, 9, 0.9, C.creme, false], [1, 11, 1.5, C.gelb, true]];
      for (const [t0, life, K, col, dit] of rings) { const t = ti - t0; if (t < 0 || t > life) continue; const r1 = rd(easeOut(t / life) * W0 * K * 1.4); if (r1 > 0) m.ell(T0[0], T0[1], r1, rd(r1 * flat), t < 3 ? 2 : 1, col, dit && t > life * 0.5); }
    }
    m.setMask(null);
    if (hook && hook.pile && f >= HITF) hook.pile(m, FX.pose(f, P));
    // ── Starburst + Blitz im Hit-Stop (hinter dem Hammer) ──
    if (f >= HITF && f < HITF + STOP) {
      const hh = f - HITF, szs = [0.85, 1.1, 0.8], Ro = tw * 0.62 * szs[hh];
      burst(m, P, I[0], I[1], Ro, 16, [C.tinte, C.org, C.gelb, C.creme], 0);
      if (hh < 2) burst(m, P, I[0], I[1], Ro * 0.6, 16, [C.tinte, C.gelb, C.creme, C.weiss], Math.PI / 8);
      m.dith(I[0], I[1], tw * 0.8 * (1 + 0.15 * hh), tw * 0.7 * (1 + 0.15 * hh), [10, 6, 3][hh], C.creme);
      if (hh < 2) for (let r = 0; r < 12; r++) { const an = r * Math.PI / 6 + 0.1, len = tw * 0.95 * (r % 2 ? 0.55 : 1) * [1, 0.7][hh]; const ex = I[0] + Math.cos(an) * len, ey = I[1] + Math.sin(an) * len; m.linie(I[0], I[1], ex, ey, 3, C.tinte); m.linie(I[0], I[1], ex, ey, 1, r % 3 === 0 ? C.weiss : (r % 2 ? C.creme : C.gelb)); }
    }
    // ── Flug-Schweif: Funken + Nachbilder + Schwung-Bahn (hinter dem Hammer) ──
    if (f >= 3 && f <= HITF + 1) {
      for (let f2 = 3; f2 <= Math.min(f, HITF - 1); f2++) {                                // Funkenspur an den früheren Hammerpositionen
        const age = f - f2, p = centerAt(f2, P); if (!p || age > 6) continue;
        for (let q = 0; q < 3; q++) { const hs = H(P.seed + f2, q + 7); const ox = (hs - 0.5) * 8 * k - age * (P.dEnd[0]) * 0.8, oy = (H(P.seed + f2, q + 31) - 0.5) * 8 * k - age * P.dEnd[1] * 0.8 + 0.35 * age * age; const x = p[0] + ox, y = p[1] + oy, lv = rd(16 - age * 2.6); if (lv <= 0 || (age > 3 && (q + age) & 1)) continue;
          const col = [C.creme, C.gelb, C.tealM, C.weiss, C.funke][(f2 + q) % 5]; if (H(f2, q + 3) < 0.35) { m.pd(x, y, col, 16); m.pd(x + 1, y, col, 16); m.pd(x, y + 1, col, 16); } else m.pd(x, y, col, 16); }
      }
      if (f > 3) {                                                                         // Schwung-Bahn: helle, gedithert auslaufende Streifen zwischen den Kopfpositionen
        const pts = [];
        for (let q = 0; q <= 4; q++) { const sf = FX.state(Math.max(3, f - q), P); if (!sf) continue; pts.push(headOf(sf.cx, sf.cy, sf.deg, k)); }
        for (let q = 0; q + 1 < pts.length; q++) { const th = [5, 4, 3, 2][q] || 2; dline(m, pts[q + 1][0], pts[q + 1][1], pts[q][0], pts[q][1], th, C.creme, [12, 9, 6, 4][q] || 3); dline(m, pts[q + 1][0], pts[q + 1][1], pts[q][0], pts[q][1], Math.max(1, th - 2), C.weiss, [10, 7, 4, 2][q] || 2); }
      }
      if (f > 3 && f < HITF) for (let q = 1; q <= 2; q++) { const sf = FX.state(f - q, P); if (sf && f - q >= 3) drawHammer(m, sf.cx, sf.cy, sf.deg, [7, 3][q - 1], k); }   // Nachbilder
    }
    // ── Hammer ──
    if (st) {
      if (f === 1 || f === 2) { const hp = headOf(st.cx, st.cy, st.deg, k); const rr = f === 1 ? 4 : 6; m.rect(hp[0] - rr, hp[1], rr * 2 + 1, 1, C.weiss); m.rect(hp[0], hp[1] - rr, 1, rr * 2 + 1, C.weiss); }   // Glanzkreuz am Edelstein
      drawHammer(m, st.cx, st.cy, st.deg, st.lv, k);
    }
    // ── Abwurf-Funken an der Hand ──
    if (f >= 3 && f < 8) { const q = f - 3; for (let i = 0; i < 6; i++) { const a = -Math.PI * (0.1 + H(P.seed, i + 700) * 0.8); const x = P.hand[0] + Math.cos(a) * (2 + q * 2.2) * (0.6 + H(P.seed, i + 710)), y = P.hand[1] + Math.sin(a) * (2 + q * 2.2) * (0.6 + H(P.seed, i + 710)) + q * q * 0.2; if (q > 2 && (i & 1)) continue; m.rect(x, y, 1 + (i % 2), 1, [C.creme, C.gelb, C.weiss][i % 3]); } }
    // ── Wirkung am Ziel: Druckring (Bild-Ebene), Funken, Brocken, Staub ──
    if (f >= HITF) {
      const r1 = rd(easeOut(ti / 9) * tw * 0.95);
      if (ti >= 0 && ti <= 9 && r1 > 0) m.ell(I[0], I[1], r1, r1, ti < 3 ? 2 : 1, ti < 4 ? C.creme : C.gelb, ti > 4);
      for (const p of P.puffs) {
        const age = ti - (p.id % 3), life = 14; if (age < 0 || age >= life) continue;
        const e = easeOut(age / life), r = lerp(p.r0 * 0.8, p.r1, e) * Math.max(0.8, tw / 30), dist = tw * 0.14 + W0 * (0.5 + 0.9) * e * 0.9;
        const x = T0[0] + Math.cos(p.a) * dist, y = T0[1] + Math.sin(p.a) * dist * flat - (2 + p.rise * e), lv = rd(11 * (1 - age / life)); if (lv <= 0) continue;
        m.disc(x + r * 0.2, y + r * 0.25, Math.max(1, rd(r)), C.rauch, lv); m.disc(x, y, Math.max(1, rd(r * 0.9)), C.sandDD, lv); m.disc(x - r * 0.25, y - r * 0.3, Math.max(1, rd(r * 0.55)), C.sand, rd(lv * 0.75));
      }
      const g = 0.16 * (tw / 25);
      for (const b of P.debris) {
        const t = ti, life = 20; if (t >= life) continue;
        let hgt = b.vv * (t / 30) * 1.0 * 3.2 - g * 4 * 0.5 * t * t; const fly = t / 30 * 3.2; if (hgt < 0) hgt = 0;
        const x = T0[0] + Math.cos(b.a) * (tw * 0.12 + b.vh * Math.min(1, fly) * 0.8), y = T0[1] + Math.sin(b.a) * b.vh * Math.min(1, fly) * 0.3 * flat - hgt * 0.9;
        if (t > life - 7 && (t & 1)) continue; const sz = b.sz + 1; m.rect(x, y, sz, sz, b.c); m.rect(x, y, Math.max(1, sz - 1), 1, C.creme); m.rect(x + sz - 1, y + 1, 1, sz - 1, C.nacht);
      }
      for (const s of P.sparks) {
        const t = ti; if (t >= s.life || t < 0) continue; if (t > s.life * 0.65 && (t & 1)) continue;
        const x = I[0] + s.vx * t, y = I[1] + s.vy * t + 0.5 * 0.22 * t * t;
        if (s.kreuz) { m.rect(x - 1, y, 3, 1, s.c); m.rect(x, y - 1, 1, 3, s.c); } else { m.linie(x, y, x - s.vx * 1.6, y - s.vy * 1.6, 1, s.c); m.rect(x, y, 2, 2, s.c); }
      }
    }
    // ── Zerfall des Hammers: Zellen lösen sich als Funken (Bayer-Schwelle im Hammer, Zellen als Teilchen); Handy: aus ──
    if (!P.lite && f >= POP0 && f < POP0 + DISS + 8) {
      for (let q0 = 0; q0 < DISS; q0++) {
        const fs = POP0 + q0, age = f - fs; if (age < 0 || age > 9) continue; const sf = FX.state(fs, P); if (!sf) continue;
        const sp = sprite(sf.deg, k), n = rd(8 * (0.7 + P.n * 0.3));
        for (let i = 0; i < n; i++) {
          const cell = sp.cells[fl(H(P.seed + fs, i + 900) * sp.cells.length)], vx = (H(P.seed + fs, i + 910) - 0.5) * 1.4, vy = -(0.3 + H(P.seed + fs, i + 920) * 1.1);
          const life = 5 + H(P.seed + fs, i + 930) * 5; if (age >= life) continue;
          const x = rd(sf.cx) + cell[0] + vx * age, y = rd(sf.cy) + cell[1] + vy * age + 0.07 * age * age; const flick = age > life * 0.6 && ((age + i) & 1);
          if (flick) continue; const col = age < 2 ? cell[2] : [C.creme, C.gelb, C.weiss, C.tealM, C.st2][(i + fs) % 5]; m.rect(x, y, age > life * 0.5 ? 1 : 2, age > life * 0.5 ? 1 : 2, col);
        }
      }
    }
  };
  root.PpFx59 = FX;
})(window);

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  SPIEL-HÜLLE: Leinwand in der Weltschicht, Takt, Quetschung von Karte und Held, Werfer-Rückstoß, Kamera-Shake, Aufräumen, Rückfall
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const PP_FX59_TAKT = 1000 / 30;

/** Rückfall auf die alte Fassung (Animationen aus, Retro, Test-Schalter, reduzierte Bewegung, keine Palette). */
function ppFx59Rueckfall() {
  try {
    if (window.__ppFx59Aus || window.__ppFxAlt || window._playAnimations === false || window.PP_RETRO || typeof window.ppSnapRgb !== 'function' || !window.PpFx57) return true;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return true;
  } catch (e) { /* weiter */ }
  return false;
}

/** Unterste deckende Zeile (exklusiv) über alle Bilder des Sheets (Fußlinie der Figur), einmal je Sheet gelesen. */
function ppFx59SheetFuss(eintrag, px) {
  if (!eintrag || !px) return 0;
  if (eintrag._pp59 != null) return eintrag._pp59;
  let y1 = 0;
  try {
    const frames = Math.max(1, eintrag.meta.frames | 0);
    for (let f = 0; f < frames; f++) {
      const sx = px.vert ? 0 : f * px.fw, sy = px.vert ? f * px.fh : 0;
      for (let y = px.fh - 1; y >= y1; y--) { let da = false; for (let x = 0; x < px.fw; x++) if (px.d[((sy + y) * px.w + sx + x) * 4 + 3] >= 128) { da = true; break; } if (da) { y1 = y + 1; break; } }
    }
  } catch (e) { y1 = px.fh; }
  eintrag._pp59 = y1 || px.fh;
  return eintrag._pp59;
}

/** Figur einer Zone (Held mit Sprite im Brett): { hp, px, y0, y1 } oder null. */
function ppFx59Figur(el) {
  try {
    if (!el || !el.isConnected) return null;
    const hp = ppFxHeldPixel(el, 0);
    if (!hp.cv || !hp.eintrag || !hp.platz) return null;
    const px = ppFx57SheetPixel(hp.eintrag);
    if (!px) return null;
    return { hp, px, y0: px.y0, y1: ppFx59SheetFuss(hp.eintrag, px) };
  } catch (e) { return null; }
}

function PpFx59Leinwand(props) {
  const { x, y, w, h, zoneEl, welt, vonDx, vonDy, vonW, vonH, vonEl, zelleS } = props;
  const cvs = useRef(null);
  const wurzelRef = useRef(null);
  const geo = useMemo(() => {
    const mess0 = window.__ppFx59Messen ? performance.now() : 0;
    const FX = window.PpFx59; FX.init();
    const hp = ppFxHeldPixel(zoneEl, w);
    const zr = zoneEl.getBoundingClientRect();
    const zcx = zr.left + zr.width / 2, zcy = zr.top + zr.height / 2;
    const ox = x - zcx, oy = y - zcy;                                                                       // Versatz Fenster → Welt (Scrollstand)
    const vr = vonEl && vonEl.isConnected ? vonEl.getBoundingClientRect() : null;
    const scx = vr ? vr.left + vr.width / 2 + ox : x + vonDx, scy = vr ? vr.top + vr.height / 2 + oy : y + vonDy, sw = vr ? vr.width : (vonW || w), sh = vr ? vr.height : (vonH || h);
    const tFig = ppFx59Figur(zoneEl), sFig = ppFx59Figur(vonEl);
    // Fenster (Weltpixel) um beide Beteiligte samt Figuren, dann Zelle (Hero-Pixel, bei sehr großer Leinwand gedeckelt) und Rand
    let minX = Math.min(x - w / 2, scx - sw / 2), maxX = Math.max(x + w / 2, scx + sw / 2), minY = Math.min(y - h / 2, scy - sh / 2), maxY = Math.max(y + h / 2, scy + sh / 2);
    const oben = (fg, r0) => { if (!fg) return Infinity; const r = fg.hp.cv.getBoundingClientRect(); return r.top + fg.y0 * fg.hp.px + oy; };
    minY = Math.min(minY, oben(tFig), oben(sFig));
    const S = ppFxZelleGedeckelt({ zelleS, zoneEl, w, x, y }, { breite: maxX - minX + 360, hoehe: maxY - minY + 360 });
    const cps = hp.px / S, phone = !!(window.ppIsPhone && window.ppIsPhone());
    const tw = w / S, th = h / S, flat = Math.max(0.6, Math.min(1.05, (h / w) / (95 / 68)));
    const M = Math.ceil(tw * 1.5 + 34);                                                                      // Rand in Zellen: Hammer (±27), Starburst, Ringe, Funken, Schatten
    const lx = Math.round(minX - M * S), ly = Math.round(minY - M * S);
    const gw = Math.min(1100, Math.ceil((maxX - minX) / S) + 2 * M + 2), gh = Math.min(900, Math.ceil((maxY - minY) / S) + 2 * M + 2);
    const cx = (px) => (px - lx) / S, cy = (py) => (py - ly) / S;
    // Ziel: Held mit Figur → Fußlinie der Figur, Aufprallpunkt auf 62 % ihrer Höhe; sonst Karte (Unterkante der Zone, Aufprall auf 60 % der Kartenhöhe)
    const gxT = cx(x), kind = tFig ? 'hero' : 'card';
    let tfoot, tgt, Lc;
    if (tFig) {
      const r = tFig.hp.cv.getBoundingClientRect(), footY = cy(r.top + tFig.y1 * tFig.hp.px + oy), hh = (tFig.y1 - tFig.y0) * cps;
      Lc = footY; tfoot = [gxT, footY]; tgt = [gxT, footY - hh * 0.62];
    } else {
      Lc = cy(y) + th * 0.5; tfoot = [gxT, Lc - 1]; tgt = [gxT, Lc - th * 0.6];
    }
    // Werfer: Fußlinie seiner Figur (sonst Unterkante seiner Zone), Hand auf 55 % Höhe, leicht zum Ziel hin versetzt
    let sFoot, heroH;
    if (sFig) { const r = sFig.hp.cv.getBoundingClientRect(); sFoot = [cx(scx), cy(r.top + sFig.y1 * sFig.hp.px + oy)]; heroH = (sFig.y1 - sFig.y0) * (sFig.hp.px / S); }
    else { sFoot = [cx(scx), cy(scy) + (sh / S) * 0.5]; heroH = (sh / S) * 0.9; }
    const sgn = (tgt[0] - sFoot[0]) >= 0 ? 1 : -1, hand = [sFoot[0] + sgn * heroH * 0.2, sFoot[1] - heroH * 0.55];
    const nF = (window.ppFxN ? window.ppFxN(100) / 100 : 1) * (S <= 2 && !phone ? 0.8 : 1);
    const P = FX.plan({ hand, foot: sFoot, heroH, tgt, tfoot, tw, th, kind, seed: Math.floor(Math.random() * 1e6), n: nF, lite: phone, shake: 0 });
    P.flat = flat; P.Lc = Lc;
    if (mess0) (window.__ppFx59Zeiten || (window.__ppFx59Zeiten = [])).push([-1, +(performance.now() - mess0).toFixed(3)]);
    return { S, P, lx, ly, gw, gh, hp, tFig, sFig, zr, ox, oy, zcx, zcy, cps, kind, phone };
  }, []);

  useEffect(() => {
    const el = cvs.current, FX = window.PpFx59;
    if (!el) return undefined;
    const mess1 = window.__ppFx59Messen ? performance.now() : 0;
    const { S, P, gw, gh, hp, tFig, sFig, zr, ox, oy, phone } = geo;
    const ctx = el.getContext('2d'), img = ctx.createImageData(gw, gh), m = FX.maler(img.data, gw, gh);
    const takt = window.ppTaktRaf || window.requestAnimationFrame;
    const zone = zoneEl && zoneEl.isConnected ? zoneEl : null;
    const karte = zone && !tFig ? zone.querySelector('.board-card') : null;
    const platz = tFig ? tFig.hp.platz : null;
    const wPlatz = sFig && sFig.hp.platz !== platz ? sFig.hp.platz : null;                                  // Werfer (Rückstoß)
    const shakeAn = !phone && !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) && !window.__ppFx59KeinShake;
    P.shake = shakeAn ? 1 : 0;
    const board = shakeAn ? document.querySelector('.board-center') : null;
    const wurzel = wurzelRef.current;
    const alt = { clip: zone ? zone.style.clipPath : '', kTrans: karte ? karte.style.transform : '', kOrig: karte ? karte.style.transformOrigin : '', kFilter: karte ? karte.style.filter : '', vis: platz ? platz.style.visibility : '', tr: board ? board.style.translate : '', wTr: wPlatz ? wPlatz.style.translate : '' };
    let kx = 1, ky = 1;                                                                                     // Zellen → lokale Pixel der Karte (geneigte Brettebene)
    if (karte) { const kr = karte.getBoundingClientRect(); if (kr.width > 0 && kr.height > 0) { kx = karte.offsetWidth / kr.width; ky = karte.offsetHeight / kr.height; } }
    if (zone) zone.style.clipPath = 'inset(-400px -400px 0px -400px)';                                      // unter der Zonenunterkante ist der Boden
    if (karte) karte.style.transformOrigin = '50% 100%';
    const t0 = performance.now();
    let raf = 0, letzte = -1, ende = false, vor = null, key = '', figurWeg = false;
    const zuruecksetzen = () => {
      try { if (zone) zone.style.clipPath = alt.clip; if (karte) { karte.style.transform = alt.kTrans; karte.style.transformOrigin = alt.kOrig; karte.style.filter = alt.kFilter; } if (platz) platz.style.visibility = alt.vis; if (board) board.style.translate = alt.tr; if (wPlatz) wPlatz.style.translate = alt.wTr; } catch (e) { /* weg */ }
    };
    const aufraeumen = () => { if (ende) return; ende = true; try { cancelAnimationFrame(raf); } catch (e) { /* weg */ } zuruecksetzen(); try { ctx.clearRect(0, 0, gw, gh); } catch (e) { /* weg */ } };
    // Figur im Raster: eine Zelle je Sprite-Pixel-Anteil (Pixelgröße / Zelle), Fußlinie Lc; p = { sx, sy, dx } (Nächster-Nachbar, nichts gemischt). `fg` = Figur-Beschreibung (Ziel, Werfer, andere Helden)
    const figurZellen = (fg, p, fn) => {
      const s = fg.px, f0 = Math.max(0, Math.min(fg.fr, Math.max(1, (fg.eintrag.meta.frames | 0)) - 1));
      const sx0 = s.vert ? 0 : f0 * s.fw, sy0 = s.vert ? f0 * s.fh : 0, cps = fg.cps;
      const oX = fg.oX, oY = fg.oY, Lc = fg.L, sy = p.sy, sx = p.sx, gxc = fg.gx;
      const wCells = s.fw * cps, hCells = s.fh * cps;
      const c0 = Math.max(0, Math.floor(gxc + (oX - gxc) * sx + p.dx)), c1 = Math.min(gw - 1, Math.ceil(gxc + (oX + wCells - gxc) * sx + p.dx));
      const r0 = Math.max(0, Math.floor(Lc - (Lc - oY) * sy)), r1 = Math.min(gh - 1, Math.ceil(Lc) - 1, Math.ceil(Lc - (Lc - (oY + hCells)) * sy));
      for (let Y = r0; Y <= r1; Y++) {
        if (Y + 0.5 > Lc) continue;
        const yo = Lc - (Lc - (Y + 0.5)) / sy, srow = Math.floor((yo - oY) / cps); if (srow < 0 || srow >= s.fh) continue;
        for (let X = c0; X <= c1; X++) {
          const xo = gxc + (X + 0.5 - gxc - p.dx) / sx, scol = Math.floor((xo - oX) / cps); if (scol < 0 || scol >= s.fw) continue;
          const i = ((sy0 + srow) * s.w + sx0 + scol) * 4, a = s.d[i + 3]; if (a < 8) continue;
          fn(X, Y, s.d[i], s.d[i + 1], s.d[i + 2], a);
        }
      }
    };
    // Beschreibung einer Figur in Leinwand-Zellen (Lage des Sprite-Canvas, aktuelles Bild des Idle-Zyklus); L = Fußlinie in Zellen
    const beschreibe = (fg) => {
      const r = fg.hp.cv.getBoundingClientRect();
      return { px: fg.px, eintrag: fg.hp.eintrag, fr: fg.hp.platz._ppFrame | 0, cps: fg.hp.px / S, oX: (r.left + ox - geo.lx) / S, oY: (r.top + oy - geo.ly) / S, L: (r.top + fg.y1 * fg.hp.px + oy - geo.ly) / S, gx: (zr.left + zr.width / 2 + ox - geo.lx) / S };
    };
    const ziel = tFig ? beschreibe(tFig) : null;
    if (ziel) { ziel.L = P.Lc; ziel.gx = P.tfoot[0]; }
    const pile = (mm, p) => {
      if (!ziel || !p.hideSprite || !platz) return;
      ziel.fr = platz._ppFrame | 0;
      const W = FX.C.weiss;
      figurZellen(ziel, p, (X, Y, r, g, b, a) => mm.pd(X, Y, p.white ? W : [r, g, b], a >= 250 ? 16 : Math.max(1, Math.round(a / 255 * 16))));
    };
    // Maske der unteren Ebene (Schatten, Delle, Risse, Ringe): alle anderen Karten (Rechtecke) und Figuren (Silhouetten) einmal gebaut; das Ziel je Bild nach seiner Quetschung
    const statisch = new Uint8Array(gw * gh), maskBuf = new Uint8Array(gw * gh);
    const gwx0 = geo.lx - ox, gwy0 = geo.ly - oy;                                                             // Leinwand-Ursprung in Fensterpixeln
    try {
      for (const kEl of document.querySelectorAll('.board-card')) {
        if (karte && kEl === karte) continue;
        const kr = kEl.getBoundingClientRect(); if (!(kr.width > 0)) continue;
        const x0 = Math.max(0, Math.floor((kr.left - gwx0) / S)), x1 = Math.min(gw - 1, Math.ceil((kr.right - gwx0) / S) - 1), y0 = Math.max(0, Math.floor((kr.top - gwy0) / S)), y1 = Math.min(gh - 1, Math.ceil((kr.bottom - gwy0) / S) - 1);
        for (let Y = y0; Y <= y1; Y++) for (let X = x0; X <= x1; X++) statisch[Y * gw + X] = 1;
      }
      for (const zEl of document.querySelectorAll('[data-hero-zone]')) {
        if (zEl === zoneEl) continue;
        const fg = ppFx59Figur(zEl); if (!fg) continue;
        const b = beschreibe(fg); b.fr = fg.hp.platz._ppFrame | 0;
        figurZellen(b, { sx: 1, sy: 1, dx: 0 }, (X, Y) => { statisch[Y * gw + X] = 1; });
      }
    } catch (e) { /* ohne Maske: Schatten liegt dann über Figuren (nur Optik) */ }
    if (mess1) (window.__ppFx59Zeiten || (window.__ppFx59Zeiten = [])).push([-2, +(performance.now() - mess1).toFixed(3)]);
    const kr0 = karte ? karte.getBoundingClientRect() : null;
    const kL = kr0 ? (kr0.left + ox - geo.lx) / S : 0, kR = kr0 ? (kr0.right + ox - geo.lx) / S : 0, kT = kr0 ? (kr0.top + oy - geo.ly) / S : 0, kB = kr0 ? (kr0.bottom + oy - geo.ly) / S : 0;
    const maske = (f) => {
      const p = FX.pose(f, P);
      maskBuf.set(statisch);
      if (kr0 && kR > kL) {
        const Lc = P.Lc, gxc = P.tfoot[0], x0 = Math.max(0, Math.floor(gxc + (kL - gxc) * p.sx + p.dx)), x1 = Math.min(gw - 1, Math.ceil(gxc + (kR - gxc) * p.sx + p.dx) - 1);
        const y0 = Math.max(0, Math.floor(Lc - (Lc - kT) * p.sy)), y1 = Math.min(gh - 1, Math.ceil(Lc - (Lc - kB) * p.sy) - 1, Math.ceil(Lc) - 1);
        for (let Y = y0; Y <= y1; Y++) for (let X = x0; X <= x1; X++) maskBuf[Y * gw + X] = 1;
      }
      if (ziel && platz) { ziel.fr = platz._ppFrame | 0; figurZellen(ziel, p.hideSprite ? p : { sx: 1, sy: 1, dx: p.dx }, (X, Y) => { maskBuf[Y * gw + X] = 1; }); }
      return maskBuf;
    };
    const schritt = (jetzt) => {
      if (ende) return;
      if (typeof jetzt !== 'number') jetzt = performance.now();
      const ms = Math.max(0, jetzt - t0);
      if (ms >= (FX.LEN + 1) * PP_FX59_TAKT) { aufraeumen(); return; }
      const fr = Math.floor(jetzt / PP_FX59_TAKT);
      if (fr !== letzte) {
        letzte = fr;
        const mess = window.__ppFx59Messen ? performance.now() : 0;
        const f = Math.min(FX.LEN - 1, Math.floor(ms / PP_FX59_TAKT + 1e-4)), d = m.d, buf = img.data;
        if (vor) { for (let j = vor.y0; j < vor.y1; j++) buf.fill(0, (j * gw + vor.x0) * 4, (j * gw + vor.x1) * 4); }
        d.x0 = gw; d.y0 = gh; d.x1 = 0; d.y1 = 0;
        const pose = FX.pose(f, P);
        FX.draw(m, f, P, { pile, maske });
        const ux0 = Math.min(vor ? vor.x0 : gw, d.x0), uy0 = Math.min(vor ? vor.y0 : gh, d.y0), ux1 = Math.max(vor ? vor.x1 : 0, d.x1), uy1 = Math.max(vor ? vor.y1 : 0, d.y1);
        if (ux1 > ux0 && uy1 > uy0) ctx.putImageData(img, 0, 0, ux0, uy0, ux1 - ux0, uy1 - uy0);
        vor = d.x1 > d.x0 ? { x0: d.x0, y0: d.y0, x1: d.x1, y1: d.y1 } : null;
        // DOM-Seite (nur bei Änderung): Karte quetschen, Figur ausblenden solange sie im Raster gemalt wird, Werfer zurückrücken, Brett schütteln
        const rueck = f < 6 ? FX.thrower(f, P) : { dx: 0, dy: 0 };
        const k2 = pose.sx + '|' + pose.sy + '|' + pose.dx + '|' + pose.white + '|' + pose.hideSprite + '|' + pose.shake[0] + '|' + pose.shake[1] + '|' + rueck.dx + '|' + rueck.dy;
        if (k2 !== key) {
          key = k2;
          if (karte) {
            const ruhe = pose.sx === 1 && pose.sy === 1 && pose.dx === 0;
            karte.style.transform = ruhe ? alt.kTrans : `translate(${(pose.dx * S * kx).toFixed(2)}px, 0px) scale(${pose.sx.toFixed(3)}, ${pose.sy.toFixed(3)})`;
            karte.style.filter = pose.white ? 'brightness(2.2) saturate(.5)' : alt.kFilter;
          }
          if (platz && pose.hideSprite !== figurWeg) { figurWeg = pose.hideSprite; platz.style.visibility = figurWeg ? 'hidden' : alt.vis; }
          if (wPlatz) wPlatz.style.translate = (rueck.dx || rueck.dy) ? `${rueck.dx * S}px ${rueck.dy * S}px` : alt.wTr;
          const sxp = Math.round(pose.shake[0] * S), syp = Math.round(pose.shake[1] * S);
          if (board) board.style.translate = (sxp || syp) ? `${sxp}px ${syp}px` : alt.tr;
          if (wurzel) wurzel.style.translate = (sxp || syp) && board ? `${sxp}px ${syp}px` : '';
        }
        if (mess) (window.__ppFx59Zeiten || (window.__ppFx59Zeiten = [])).push([f, +(performance.now() - mess).toFixed(3)]);
      }
      raf = takt(schritt);
    };
    raf = takt(schritt);
    const netz = setTimeout(aufraeumen, (FX.LEN + 1) * PP_FX59_TAKT + 2500);                              // Notnagel (Tab im Hintergrund: rAF ruht)
    return () => { clearTimeout(netz); aufraeumen(); };
  }, []);

  return (
    <div ref={wurzelRef} aria-hidden="true" data-pp-px="aus" style={{ position: 'fixed', left: geo.lx, top: geo.ly, pointerEvents: 'none', zIndex: 10100 }}>
      <canvas ref={cvs} width={geo.gw} height={geo.gh} style={{ width: geo.gw * geo.S, height: geo.gh * geo.S, imageRendering: 'pixelated', display: 'block' }} />
    </div>
  );
}

/** Rückfall: 🔨 fliegt von der Quelle zum Ziel (Retro/aus: schlicht, ohne Bogen), nach 450 ms `quick_slash` am Ziel — wie vor dem Umbau. */
function PpFx59Alt(props) {
  const { vonDx, vonDy } = props;
  const [schlag, setSchlag] = useState(false);
  const hammerRef = useRef(null);
  useEffect(() => {
    const t = setTimeout(() => setSchlag(true), 450);
    const el = hammerRef.current;
    try {
      const ruhig = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (el && !ruhig && typeof el.animate === 'function' && typeof vonDx === 'number') {
        el.animate([{ transform: `translate(${vonDx}px, ${vonDy}px) rotate(0deg)` }, { transform: 'translate(0px, 0px) rotate(900deg)' }], { duration: 480, easing: 'linear', fill: 'both' });
      }
    } catch (e) { /* ohne Flug */ }
    return () => clearTimeout(t);
  }, []);
  const Slash = ANIM_REGISTRY.quick_slash;
  return (
    <>
      {typeof vonDx === 'number' && !schlag ? (
        <div ref={hammerRef} aria-hidden="true" style={{ position: 'fixed', left: props.x - 14, top: props.y - 14, width: 28, height: 28, fontSize: 28, lineHeight: '28px', textAlign: 'center', pointerEvents: 'none', zIndex: 10100 }}>🔨</div>
      ) : null}
      {schlag && Slash ? <Slash {...props} /> : null}
    </>
  );
}

/** Registry-Komponente: neuer Wurf oder der alte als Rückfall. Ohne Ziel-Element (Vorwärmen) wird nichts gezeichnet. */
function PpFx59Effekt(props) {
  const modus = useMemo(() => {
    if (!(props.zoneEl && props.zoneEl.isConnected) && !ppFx59Rueckfall()) return 'leer';
    if (ppFx59Rueckfall()) return 'alt';
    if (!(typeof props.vonDx === 'number' && typeof props.vonDy === 'number')) return 'alt';        // keine Quelle gefunden (Held nicht im Bild)
    return 'neu';
  }, []);
  if (modus === 'leer') return null;
  if (modus === 'alt') return <PpFx59Alt {...props} />;
  return <PpFx59Leinwand {...props} />;
}
if (typeof ANIM_REGISTRY !== 'undefined') ANIM_REGISTRY.hammer_throw = PpFx59Effekt;

// Aufwärmen im Leerlauf: die Hammer-Sprites aller 24 Winkel (15°-Schritte), je Leerlauf-Slot einer, damit der erste Wurf nicht im kalten Code startet.
(function ppFx59Aufwaermen() {
  const los = () => {
    try {
      if (ppFx59Rueckfall() || window.__ppFx59KeinAufwaermen) return;
      const FX = window.PpFx59; FX.init();
      const schritte = FX.warmList(FX.K);
      const ric = window.requestIdleCallback || ((f) => setTimeout(f, 60));
      const weiter = () => { const f = schritte.shift(); if (!f) return; try { f(); } catch (e) { /* weg */ } ric(weiter, { timeout: 2500 }); };
      ric(weiter, { timeout: 2500 });
    } catch (e) { /* weg */ }
  };
  setTimeout(() => (window.requestIdleCallback ? window.requestIdleCallback(los, { timeout: 6000 }) : los()), 5000);
})();
