// app-fx-60: Flame Avalanche — eine Lawine aus Feuer rollt von der Rückkante der Gegnerhälfte auf den Wirker zu (Pixelart-Leinwand in der Weltschicht, Zelle = Hero-Pixel)
//
// ═════════════════════════════════════════════════════════════════
//  Vorlage: abgesegneter Prototyp „Flame Avalanche“ (Zeichenroutinen `PpFx60`, auf den Rasterpinseln von `PpFx57` aufgebaut: Hash / Bayer / Palette).
//  Alles ist eine reine Funktion des Bildes f (30 Hz, 60 Bilder = 2,0 s), gezeichnet in Rasterzellen auf EINER Leinwand (nur das Rechteck der Gegnerhälfte plus Flammenhöhe, nicht das Vollfenster),
//  feste Palettenfarben (`ppSnapRgb`), Bayer-Dither statt Alpha, nichts wird gedreht oder weich skaliert (Brocken: je 8 neu gerasterte Roll-Orientierungen).
//  ABLAUF:
//    0–4    Wand zündet an der RÜCKKANTE der Gegnerhälfte (ausgehend von der Spalte des Wirkers), wächst in 8 Bildern auf 2,1 Heldenhöhen; Feuerring + Funkensäule an den Füßen des Wirkers (Bild 0–9)
//    3–37   Front rollt mit 26–30 Brett-Einheiten je Bild zur MITTELLINIE, also AUF den Wirker zu, und läuft dort aus (Höhe sinkt auf 40 %). 6 gestaffelte Flammenvorhänge (Alter 0/2/4/7/11/16),
//           anisotropes Rauschen, Rampe aus 13 Palettenfarben, heller Fußsaum, Staubkante, Rauchsaum (Handy aus); Felsbrocken (4 Größen), Flammenzungen als Schweif, Funken, Glut-Boden
//    Treffer je Ziel (Bild h): Weiß-Blitz mit Quetschung (Held: Sprite zellenweise 0,80/1,14 auf der Leinwand, Karte: Weißfüllung), h+1 Creme-Blitz, h+2..h+3 Gelb-Dither, Stern + Druckring, Aufprallbrocken
//           zerfällt in Splitter; danach verkohlt (Ruß-Dither) mit züngelnden Flammen an der Silhouette; Karten ruckeln nur in ganzen Zellen, Helden zittern vor dem Treffer ±1 Zelle
//    Ausklingen ab Bild 39 per Bayer-Schwelle in 12 Bildern, Bild 59 leer, kein Rest.
//  TREFFERBILDER kommen aus der Engine (`waveAnimation` in cards/effects/flame-avalanche.js, `kreaturenZuerst`): Kreaturen alle gleichzeitig bei `delay` (470 ms = Bild 14), Helden von links nach rechts bei
//  `heroAt + i * hitDelay` (870 / 990 / 1110 ms = Bild 26 / 31 / 35). Die Engine fällt den Schaden zu denselben Zeitpunkten (`dealDamageToTargets`, `vorlauf` gleicht den Mount-Vorlauf der Animation aus).
//  BRETTABBILDUNG: Homografie Brettebene → Fenster aus den Mitten aller Zonen (Held/Fähigkeit/Support, beide Seiten; `.board-plane`-Layoutkette, ppFx60Homografie) — exakt für die geneigte Perspektive
//  und das flache Handy-Brett. Einheit u des Prototyps: ein Sprite-Pixel = 4,84 u (aus dem Hero-Pixel geeicht). Silhouettenmaske: alle Karten (Viereck) und Heldenfiguren (Sprite-Pixel) mit Tiefe q; Wand und
//  Boden liegen HINTER näheren Zielen (Zellen bleiben frei, das DOM-Ziel scheint durch) und VOR ferneren.
//  PIXELGRÖSSE: Rasterzelle S = Hero-Pixel der Zielreihe (`ppFxZelleGedeckelt`, höchstens 140 000 Zellen, Handy 60 000; kein `ohneDeckel`). Handy: Zelle 2, Teilchen 50 %, 4 statt 6 Vorhänge, kein Rauch, kein Shake.
//  SHAKE: ganzzahliger `translate` auf `.board-center` und der Leinwand (nur Desktop; Handy/`prefers-reduced-motion`/`window.__ppFx60KeinShake`: aus), kein Hit-Stop.
//  REGISTRY: `flame_avalanche` (überschreibt den Eintrag aus app-board.jsx; `ppR1FlameAvalanche` bleibt Rückfall bei Animationen aus, Retro, `__ppFxAlt`, reduzierter Bewegung, `window.__ppFx60Aus`, fehlenden Zielen/Zonen).
//  Klang: `ZONE_ANIM_SFX.flame_avalanche` (app-shared.jsx). Aufwärmen der Rauschtabellen und Brocken-Sprites im Leerlauf (`window.__ppFx60KeinAufwaermen` schaltet ab).
//  Messung (nur Tests): `window.__ppFx60Messen = true` → `window.__ppFx60Zeiten` = [Bild, ms] (Bild −1 = Geometrie beim Start).
// ═════════════════════════════════════════════════════════════════
(function (root) {
  let H = null, BAY = null, snapA = null;      // aus PpFx57 (app-fx-57: Hash, Bayer-Matrix, Palette), in `FX.init` gesetzt
  const FX = {};
  const rd = Math.round, fl = Math.floor, ab = Math.abs, mn = Math.min, mx = Math.max;
  const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const LEN = 60; FX.LEN = LEN;
  let C = null, RAMP = null, SMK = null, ROCK = null, NA = null, NB = null, NG = null;

  // ── Rastermaler mit Tiefenmaske: Zellen unter einer NÄHEREN Zielsilhouette bleiben frei (Wand/Boden liegen hinter dem Ziel, vor dem Ziel liegt das Ziel) ──
  function maler(buf, gw, gh, tq, ox, oy) {   // Aufrufer malen in Bühnenzellen; ox/oy = Ursprung der Leinwand
    let Z = 0;
    const px = (x, y, c) => {
      x -= ox; y -= oy;
      if (x < 0 || y < 0 || x >= gw || y >= gh) return;
      const k = y * gw + x, t = tq[k]; if (t !== 0 && t < Z) return;
      const i = k * 4; buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2]; buf[i + 3] = 255;
    };
    const pd = (x, y, c, lv) => { if (lv >= 16 || BAY[y & 3][x & 3] < lv) px(x, y, c); };
    const rect = (x, y, w, h, c) => { x = rd(x); y = rd(y); for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) px(x + i, y + j, c); };
    const disc = (X, Y, r, c, lv) => { X = rd(X); Y = rd(Y); for (let yy = -r; yy <= r; yy++) { const xr = rd(Math.sqrt(Math.max(0, r * r + r * 0.6 - yy * yy))); for (let xx = -xr; xx <= xr; xx++) pd(X + xx, Y + yy, c, lv == null ? 16 : lv); } };
    const linie = (x0, y0, x1, y1, th, c) => {
      x0 = rd(x0); y0 = rd(y0); x1 = rd(x1); y1 = rd(y1); const o = fl(th / 2); x0 -= o; y0 -= o; x1 -= o; y1 -= o;
      const dx = ab(x1 - x0), dy = -ab(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let err = dx + dy;
      for (let n = 0; n < 600; n++) { rect(x0, y0, th, th, c); if (x0 === x1 && y0 === y1) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; } }
    };
    const ring = (cx, cy, rx, ry, th, c, dith) => {
      const n = mx(16, rd(mx(rx, ry) * 6)); let lx = 1e9, ly = 1e9;
      for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2, x = rd(cx + Math.cos(a) * rx), y = rd(cy + Math.sin(a) * ry); if (x === lx && y === ly) continue; lx = x; ly = y; if (dith && ((x + y) & 1)) continue; rect(x, y, th, th, c); }
    };
    return { px, pd, rect, disc, linie, ring, buf, tq, gw, gh, ox, oy, setZ: (z) => { Z = z; }, getZ: () => Z };
  }
  FX.maler = maler;

  // ── Rauschen: zwei gekachelte Wertrauschen (Merkmal 8 / 16 Zellen), nur Nachschlagen im Takt ──
  function mkNoise(sx, sy, seed) {
    const Lx = 256 / sx, Ly = 256 / sy, lat = new Float32Array(Lx * Ly); for (let i = 0; i < Lx * Ly; i++) lat[i] = H(seed, i);
    const out = new Uint8Array(65536), sm = (t) => t * t * (3 - 2 * t);
    for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
      const gx = x / sx, gy = y / sy, x0 = fl(gx), y0 = fl(gy), fx = sm(gx - x0), fy = sm(gy - y0);
      const a = lat[(y0 % Ly) * Lx + (x0 % Lx)], b = lat[(y0 % Ly) * Lx + ((x0 + 1) % Lx)], c = lat[(((y0 + 1) % Ly)) * Lx + (x0 % Lx)], d = lat[(((y0 + 1) % Ly)) * Lx + ((x0 + 1) % Lx)];
      out[y * 256 + x] = rd(lerp(lerp(a, b, fx), lerp(c, d, fx), fy) * 255);
    }
    return out;
  }
  FX.init = () => {
    if (C) return;
    const B = root.PpFx57; B.ensure(); H = B.H; BAY = B.BAY; snapA = B.snap; C = {}; const s = snapA;
    RAMP = ['#1f0f04', '#520a0c', '#7a1900', '#b62600', '#cc2b00', '#ff491a', '#ff7d00', '#ff9a1a', '#ffc61c', '#ffe23d', '#fff196', '#fffbd2', '#ffffff'].map(s);
    SMK = ['#12101f', '#12101f', '#282834', '#3e3e51', '#59606e'].map(s);
    ROCK = ['#12101f', '#27180c', '#4a2a10', '#6e4421', '#9d612f'].map(s);
    C.soot = s('#1f0f04'); C.soot2 = s('#270d0c'); C.ember = s('#cc2b00'); C.emberD = s('#7a1900'); C.org = s('#ff7d00'); C.yel = s('#ffe23d'); C.cream = s('#fffbd2'); C.white = s('#ffffff');
    NA = mkNoise(4, 16, 11); NB = mkNoise(8, 32, 23); NG = mkNoise(8, 8, 5);
    FX.C = C; FX.RAMP = RAMP;
  };

  // ── monotone kubische Interpolation (Fritsch–Carlson) für die mittlere Ankunftszeit τ(q) ──
  function pchip(xs, ys) {
    const n = xs.length, d = [], m = new Array(n);
    for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
    m[0] = d[0]; m[n - 1] = d[n - 2];
    for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
    for (let i = 0; i < n - 1; i++) { if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; } const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b; if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; } }
    return (x) => {
      if (x <= xs[0]) return ys[0] + m[0] * (x - xs[0]); if (x >= xs[n - 1]) return ys[n - 1] + m[n - 1] * (x - xs[n - 1]);
      let i = 0; while (x > xs[i + 1]) i++;
      const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t;
      return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
    };
  }

  const DIAM = [4, 7, 11, 17];                 // Felsbrocken: Durchmesser in Zellen (4 Größenstufen)
  const CA = [0, 2, 4, 7, 11, 16], CH = [1, 0.88, 0.72, 0.55, 0.38, 0.24], CP = [0, 0.07, 0.14, 0.22, 0.32, 0.44];   // Vorhänge: Alter (Bilder), Höhe, Hitzeabzug

  // ═════════ Plan ═════════
  FX.plan = (o) => {
    const P = { o, dir: o.dir || 1, G: o.G, n: o.n == null ? 1 : o.n, phone: !!o.phone, seed: o.seed || 1, T: o.targets, Wd: o.Wd, qS: o.qS, qB: o.qB, Hb: o.heroHb * 2.1, heroHb: o.heroHb };
    const QLO = -500, QHI = 1100, QSTEP = 8, NQ = (QHI - QLO) / QSTEP + 1;
    P.QLO = QLO; P.QSTEP = QSTEP; P.NQ = NQ; P.cx0 = new Float32Array(NQ); P.cy = new Float32Array(NQ); P.ck = new Float32Array(NQ);
    for (let i = 0; i < NQ; i++) { const g = o.gp(0, QLO + i * QSTEP); P.cx0[i] = g[0]; P.cy[i] = g[1]; P.ck[i] = g[2]; }
    const tmp = [0, 0, 0];
    P.tab = (q, out) => { out = out || tmp; const u = clamp((q - QLO) / QSTEP, 0, NQ - 1.001), i = fl(u), t = u - i; out[0] = P.cx0[i] + (P.cx0[i + 1] - P.cx0[i]) * t; out[1] = P.cy[i] + (P.cy[i + 1] - P.cy[i]) * t; out[2] = P.ck[i] + (P.ck[i + 1] - P.ck[i]) * t; return out; };
    // Ankunftsfeld T(bx, q) = τ(q) + σ(q) · bx; Anker: Helden- und Kreaturenreihe (Trefferbilder der Engine)
    const heroes = P.T.filter((t) => t.kind === 'hero'), cards = P.T.filter((t) => t.kind !== 'hero');
    const reg = (L) => { if (L.length < 2) return { s: 0, t0: L.length ? L[0].hitF : 0 }; let mb = 0, mf = 0; L.forEach((t) => { mb += t.bx; mf += t.hitF; }); mb /= L.length; mf /= L.length; let cv = 0, vr = 0; L.forEach((t) => { cv += (t.bx - mb) * (t.hitF - mf); vr += (t.bx - mb) ** 2; }); const s = vr > 1 ? cv / vr : 0; return { s, t0: mf - s * mb }; };
    const mq = (L, d) => (L.length ? L.reduce((a, t) => a + t.q, 0) / L.length : d);
    const rh = reg(heroes), rc = reg(cards);
    const qh = mq(heroes, o.qhDef != null ? o.qhDef : 105), qc = mq(cards, o.qcDef != null ? o.qcDef : 527);
    let th = heroes.length ? rh.t0 : (cards.length ? rc.t0 + 12 : 26), tc = cards.length ? rc.t0 : th - 12;   // Die Front läuft zum Wirker: erst die Kreaturenreihe (hinten), 12 Bilder später die Helden
    const sh = heroes.length ? rh.s : 0, sc = cards.length ? rc.s : 0;
    // Die Front läuft von der Rückkante (großes q) auf den Wirker zu und endet an der Mittellinie (q = qE); T fällt mit q
    const qB = P.qB, qS = P.qS, qE = P.qE = o.qE == null ? -25 : o.qE;
    const tauF = pchip([qE, qh, qc, qB, qB + 250], [th + (qh - qE) / 19, th, tc, tc - (qB - qc) / 29, tc - (qB + 250 - qc) / 31]);
    const sigF = (q) => (q >= qc ? sc : q >= qh ? lerp(sh, sc, (qc - q) / (qc - qh)) : lerp(0.55 * sh, sh, clamp((q - qE) / (qh - qE))));
    P.qh = qh; P.qc = qc; P.tauF = tauF; P.sigF = sigF; const ripF = (bx) => { let w = 1; for (const t of P.T) w = mn(w, ab(bx - t.bx) / 120); return 1.5 * Math.sin(bx / 85 + 0.6) * clamp(w); };   // Front mit Wellen (an den Zielspalten gleich 0: dort gilt der Engine-Takt)
    P.Tf = (bx, q) => tauF(q) + sigF(q) * bx + ripF(bx);
    P.solve = (bx, f) => { let a = -600, b = 1300; for (let i = 0; i < 16; i++) { const m = (a + b) / 2; if (P.Tf(bx, m) > f) a = m; else b = m; } return (a + b) / 2; };
    // Spalten der Wand
    const NC = P.phone ? 41 : 61, NF = LEN + 10; P.NC = NC; P.NF = NF; P.bxj = new Float32Array(NC); P.ign = new Float32Array(NC); P.tend = new Float32Array(NC); P.bell = new Float32Array(NC); P.Qtab = new Float32Array(NC * NF);
    const bxc = o.caster ? o.caster.bx : 0; P.bxc = bxc; let fExit = 0;
    for (let j = 0; j < NC; j++) {
      const bx = -P.Wd / 2 + j * P.Wd / (NC - 1); P.bxj[j] = bx; P.ign[j] = 0.5 + 3.5 * ab(bx - bxc) / (P.Wd / 2); P.tend[j] = P.Tf(bx, qE + 40); { const u = clamp(bx / (P.Wd / 2), -1, 1); P.bell[j] = (0.4 + 0.6 * Math.cos(u * 1.35)) * (0.28 + 0.72 * clamp((1 - ab(u)) / 0.07)); }
      fExit = mx(fExit, P.tend[j]);
      for (let ff = -6; ff < NF - 6; ff++) P.Qtab[j * NF + ff + 6] = clamp(P.solve(bx, ff), qE - 5, qB + 330);
    }
    P.fExit = fExit + 2;
    // Zeilentabelle des Bodens: Zellzeile → Tiefe q
    { const ya = P.cy[clamp(fl((qB + 60 - QLO) / QSTEP), 0, NQ - 1)], yb = P.cy[clamp(fl((qE - 40 - QLO) / QSTEP), 0, NQ - 1)]; P.rowTop = fl(mn(ya, yb)) - 2; P.rowBot = Math.ceil(mx(ya, yb)) + 1; }   // Zielseite oben (Wand läuft nach unten) oder unten (nach oben)
    const NR = P.rowBot - P.rowTop + 1, inc = P.cy[NQ - 1] > P.cy[0];
    P.rq = new Float32Array(NR); P.rcx = new Float32Array(NR); P.rk = new Float32Array(NR); P.rtau = new Float32Array(NR); P.rsig = new Float32Array(NR);
    for (let r = 0; r < NR; r++) {
      const Y = P.rowTop + r; let i = 0; while (i < NQ - 2 && (inc ? P.cy[i + 1] <= Y : P.cy[i + 1] > Y)) i++;
      const dd = P.cy[i] - P.cy[i + 1], t = clamp(dd !== 0 ? (P.cy[i] - Y) / dd : 0, 0, 1), q = QLO + (i + t) * QSTEP; P.rq[r] = q; P.tab(q, tmp); P.rcx[r] = tmp[0]; P.rk[r] = tmp[2]; P.rtau[r] = tauF(q); P.rsig[r] = sigF(q);
    }
    // Ziele: Fußpunkt und Aufprallpunkt in Zellen
    P.T.forEach((t, i) => { const g = o.gp(t.bx, t.q); t.cx = g[0]; t.cy = g[1]; t.k = g[2]; t.i = i; });
    // Brocken
    const rocks = [], rnd = (i, j) => H(P.seed * 101 + i, j);
    const nF = [fl(2 * (P.phone ? 0.5 : 1)), fl(4 * (P.phone ? 0.6 : 1)), fl(9 * P.n), fl(15 * P.n)];   // frei rollende: je Größenstufe 3 … 0
    const lane = (bx, rr) => P.T.every((t) => ab(bx - t.bx) > t.wb * 0.55 + rr);
    let id = 0;
    for (let cls = 3; cls >= 0; cls--) for (let r = 0; r < nF[cls]; r++) {
      let bx = 0, ok = false; for (let tries = 0; tries < 14 && !ok; tries++) { bx = (rnd(id, 1 + tries) - 0.5) * P.Wd * 0.94; ok = lane(bx, DIAM[cls] * 3.5); }
      const f0r = 1 + rnd(id, 20) * 24, qf = new Float32Array(NF); for (let ff = 0; ff < NF; ff++) qf[ff] = clamp(P.solve(bx, ff - 6), qE - 5, qB + 330);
      rocks.push({ id: id++, cls, bx, f0: f0r | 0, qf, L0: lerp(-210, -30, rnd(id, 3)), A: lerp(60, 120, rnd(id, 4)) * (cls >= 2 ? 0.45 : 1), hop: lerp(110, 200, rnd(id, 5)), aim: -1, imp: 0 });
    }
    P.T.forEach((t, i) => {
      const defs = t.kind === 'hero' ? [[3, 0, 0], [1, -42, -1], [1, 38, -2]] : [[2, 0, 0]];
      defs.forEach(([cls, off, dl]) => {
        const bx = t.bx + off, h = t.hitF + dl, qf = new Float32Array(NF); for (let ff = 0; ff < NF; ff++) qf[ff] = clamp(P.solve(bx, ff - 6), qE - 5, qB + 330);
        rocks.push({ id: id++, cls, bx, f0: mx(1, h - (cls === 3 ? 13 : 11)), qf, L0: 0, A: 70, hop: 150, aim: i, imp: h, qt: t.q + (off ? 0 : 0), vT: t.kind === 'hero' ? t.hb * 0.52 : 6 });
      });
    });
    P.rocks = rocks;
    // Funken
    const NE = rd(120 * P.n); P.emb = [];
    for (let i = 0; i < NE; i++) { const bx = (rnd(900 + i, 1) - 0.5) * P.Wd * 0.96, s = 2 + rnd(900 + i, 2) * 44 | 0; const q = clamp(P.solve(bx, s - 6) + (rnd(900 + i, 7) - 0.5) * 140, qE, qB + 330); P.tab(q, tmp); P.emb.push({ x: tmp[0] + bx * tmp[2], y: tmp[1], k: tmp[2], s, L: 11 + (rnd(900 + i, 3) * 15 | 0), v0: rnd(900 + i, 4) * 0.7, vr: 1.2 + rnd(900 + i, 5) * 2.6, vx: (rnd(900 + i, 6) - 0.5) * 0.7, big: rnd(900 + i, 8) > 0.86, ph: rnd(900 + i, 9) * 6 }); }
    return P;
  };

  // ── Ziel: Pose je Bild ──
  FX.stageOf = (a) => (a < 0 ? -1 : a <= 1 ? 99 : a <= 4 ? 1 : a <= 7 ? 3 : 99);
  FX.pose = (f, P, i) => {
    const t = P.T[i], a = f - t.hitF, p = { active: a >= 0, flash: 0, char: 0, sx: 1, sy: 1, dx: 0, dy: 0 };
    if (a < 0) { if (a >= -5 && !P.phone) p.dx = ((f & 1) ? 1 : -1); return p; }
    if (a <= 0) { p.flash = 1; p.sx = 1.14; p.sy = 0.80; p.dx = 1; }
    else if (a <= 1) { p.flash = 2; p.sx = 1.12; p.sy = 0.84; p.dx = 1; }
    else if (a <= 3) { p.flash = 3; p.sx = 1.07; p.sy = 0.9; p.dx = -1; }
    else if (a <= 6) { p.sy = 1.05; p.sx = 0.98; }
    else if (a <= 18 && ((a % 3) === 0)) { p.dx = (a & 1) ? 1 : -1; }
    p.char = clamp((a - 3) * 0.13, 0, 0.6) * clamp((LEN - 1 - f) / 11);
    return p;
  };
  FX.shake = (f, P) => {
    if (P.phone) return [0, 0];
    let amp = 0; if (f >= 2 && f <= 42) amp += 1;
    const hits = {}; P.T.forEach((t) => { hits[t.hitF] = (hits[t.hitF] || 0) + (t.kind === 'hero' ? 4.2 : 2.4); });
    for (const k in hits) { const d = f - (+k); if (d >= 0 && d < 5) amp += mn(8, hits[k]) * (1 - d / 5); }
    return [rd(amp * (H(f, 2) - 0.5) * 2), rd(amp * (H(f, 3) - 0.5) * 1.5)];
  };

  // ═════════ Zeichnen ═════════
  const pdIdx = (m, x, y, c, lv) => m.pd(x, y, c, lv);
  // eine Flammensäule (Spalte X, Fuß yF, Höhe Hc Zellen); so = Phasenversatz je Vorhang; pen = Hitzeabzug; smk = Rauchsaum; dl = Bayer-Auflösung (16 = voll)
  function flameCol(m, X, yF, Hc, f, so, pen, smk, dl, foot, dust) {
    const buf = m.buf, gw = m.gw, gh = m.gh, tq = m.tq, Z = m.getZ(), cx = X - m.ox, oy = m.oy; if (cx < 0 || cx >= gw) return;
    const top = yF - ((smk ? 1.9 : 1.12) * Hc) - 1, sv = f * 2 + so * 31, xb = (X + so * 7) & 255, xb2 = ((X >> 1) + so * 5) & 255, bx3 = X & 3;
    for (let Y = yF; Y >= top; Y--) {
      const cy = Y - oy; if (cy < 0) break; if (cy >= gh) continue;
      const bay = BAY[Y & 3][bx3];
      if (dl < 16 && bay >= dl) continue;
      const k = cy * gw + cx, t = tq[k]; if (t !== 0 && t < Z) continue;
      const a = (yF - Y) / Hc, row = ((Y + sv) & 255) << 8;
      const n = (NA[row | xb] * 0.55 + NB[row | xb2] * 0.45) / 255;
      const h = (1 - a * 0.9) * 1.12 + (n - 0.5) * 1.7 - pen + (bay - 7.5) * 0.011;
      let c = null;
      if (h > 0.16) c = RAMP[mn(12, fl(h * 10.5))];
      else if (smk && h > -0.8 && a > 0.4) { if (bay < (h > -0.2 ? 9 : (h > -0.5 ? 6 : 3))) c = h > -0.2 ? C.soot2 : SMK[2 + (n > 0.58 ? 1 : 0)]; }
      if (c) { const i = k * 4; buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2]; buf[i + 3] = 255; }
    }
    if (foot) {
      m.px(X, yF, C.cream); if (BAY[yF & 3][X & 3] < 10) m.px(X, yF - 1, C.yel);
      if (dust) for (let j = 1; j <= 7; j++) { const n = NB[((((yF + j) + f * 2) & 255) << 8) | ((X >> 1) & 255)] / 255; if (n > 0.42 + j * 0.05) m.pd(X, yF + j, j < 3 ? SMK[2] : (n > 0.7 ? SMK[3] : C.soot2), 9 - j); }
    }
  }

  function ground(m, f, P) {
    m.setZ(1e9);
    const fade = clamp((LEN - 1 - f) / 10), nR = P.rq.length, Wd2 = P.Wd / 2;
    for (let r = 0; r < nR; r++) {
      const Y = P.rowTop + r; if (Y < (m.oy || 0) || Y >= (m.oy || 0) + m.gh) continue; const q = P.rq[r], cx0 = P.rcx[r], k = P.rk[r], tau = P.rtau[r], sg = P.rsig[r], base = (f - tau);
      if (base - sg * (-Wd2) < -8 && base - sg * Wd2 < -8) continue;    // noch weit vor der Front
      const ox = m.ox || 0, xl = mx(ox, fl(cx0 - Wd2 * k)), xr = mn(ox + m.gw - 1, Math.ceil(cx0 + Wd2 * k)), yr = (Y & 255) << 8;
      for (let X = xl; X <= xr; X++) {
        const bx = (X - cx0) / k, age = base - sg * bx;
        if (age < -8) continue;
        const v = NG[yr | (X & 255)], ridge = ab(v - 128) < 6, bay = BAY[Y & 3][X & 3];
        if (age < 0) { const lv = (age + 8) * 1.1; if (bay < lv) m.px(X, Y, ridge ? C.emberD : C.soot2); continue; }
        if (age < 6) { const lv = 16 - age; if (ridge) m.px(X, Y, age < 3 ? C.yel : C.org); else if (bay < lv * 0.85) m.px(X, Y, age < 3 ? RAMP[6] : RAMP[4]); else m.px(X, Y, RAMP[2]); continue; }
        // Glut-Boden: Risse glimmen (Flackern je Zelle), Ruß-Dither dazwischen
        const lvS = fade * 10;
        if (ridge) { const bl = H(X * 7 + Y, f >> 1); const hot = clamp(1 - (age - 6) / 26); if (bl < 0.35 + 0.5 * hot && fade > 0.05 && bay < 16 * fade + 2) m.px(X, Y, hot > 0.55 ? C.org : (hot > 0.25 ? C.ember : C.emberD)); else if (bay < lvS) m.px(X, Y, C.soot2); }
        else if (bay < lvS) m.px(X, Y, age < 14 ? RAMP[1] : C.soot);
      }
    }
  }

  function targetBurn(m, f, P, i, sil) {
    const t = P.T[i], a = f - t.hitF; if (a < 2 || !sil) return;
    const life = clamp((a - 1) / 4) * (1 - 0.35 * clamp((a - 6) / 14)) * clamp((LEN - 5 - f) / 10); if (life <= 0.02) return;
    m.setZ(0);
    const hs = t.kind === 'hero' ? 1 : 0.75;
    for (let X = sil.x0; X <= sil.x1; X++) {
      const y = sil.top[X]; if (y > 30000) continue;
      const Hc = (3 + 9 * (NA[(((X * 3) & 255) << 8) | ((f * 3 + i * 17) & 255)] / 255)) * life * hs;
      if (Hc >= 1.5) flameCol(m, X, y + 2, Hc, f, i + 3, 0.04, false, 16, false);
    }
    const E = sil.edge, lim = 0.34 * life;
    for (let e = 0; e < E.length; e += 2) { const x = E[e], y = E[e + 1]; const hh = H(x * 13 + y, (f >> 1) + i * 5); if (hh < lim) m.pd(x, y, hh < lim * 0.35 ? C.yel : (hh < lim * 0.7 ? C.org : C.ember), 11); }
  }

  // ── Felsbrocken: Kugelkörper mit Kruste und glühenden Rissen, Orientierung 0..7 (Rollwinkel in 45°-Stufen), einmal je (Größe, Orientierung) gebacken ──
  const rockCache = new Map();
  function rockSprite(cls, o) {
    const key = cls * 8 + o; let r = rockCache.get(key); if (r) return r;
    const d = DIAM[cls], rr0 = d / 2, xs = [], ys = [], cs = [], phi = o * Math.PI / 4, cp = Math.cos(phi), sp = Math.sin(phi);
    for (let j = 0; j < d; j++) for (let i = 0; i < d; i++) {
      const nx = (i + 0.5 - rr0) / rr0, ny = (j + 0.5 - rr0) / rr0, q2 = nx * nx + ny * ny, ang = Math.atan2(ny, nx), bk = fl((ang + Math.PI) / (2 * Math.PI) * 9), lump = 1 - 0.14 * H(77 + cls, bk);
      if (q2 > lump * lump) continue;
      const nz = Math.sqrt(Math.max(0, 1 - q2 / (lump * lump))), lam = nx * -0.45 + ny * -0.6 + nz * 0.66;
      const py = ny * cp - nz * sp, pz = ny * sp + nz * cp;
      const u = fl(nx * 17 + pz * 11 + 128 + cls * 40), v = fl(py * 17 + pz * 7 + 64 + cls * 23), nv = NG[((v & 255) << 8) | (u & 255)];
      let col;
      if (q2 > 0.78 * lump * lump) col = ROCK[0];
      else if (ab(nv - 128) < (cls <= 0 ? 0 : 7)) col = (ab(nv - 128) < 3) ? C.yel : C.org;
      else { const idx = lam < -0.1 ? 1 : lam < 0.22 ? 2 : lam < 0.52 ? 3 : 4; col = ROCK[idx]; if (ny > 0.25 && BAY[j & 3][i & 3] < ny * 9) col = ny > 0.6 ? RAMP[5] : RAMP[4]; }
      xs.push(i - fl(rr0)); ys.push(j - fl(rr0)); cs.push(col);
    }
    r = { xs, ys, cs }; rockCache.set(key, r); return r;
  }
  function drawRock(m, cx, cy, cls, o) { const s = rockSprite(cls, o & 7); for (let i = 0; i < s.xs.length; i++) m.px(cx + s.xs[i], cy + s.ys[i], s.cs[i]); }
  const TRAIL = [C => C.cream, null];
  function rockState(P, R, ff) {
    // Position des Brockens im Bild ff: { q, v (Brett-px Höhe), vis }
    const t = ff - R.f0; if (t < 0) return null;
    if (R.aim < 0 && R.end == null) { R.end = 999; for (let g = R.f0; g < LEN; g++) { const q = R.qf[mn(P.NF - 1, g + 6)] + R.L0 * clamp((g - R.f0) / 12); if (q <= 34) { R.end = g; R.endQ = q; break; } } }
    const qf = R.qf[mn(P.NF - 1, mx(0, ff + 6))];
    if (R.aim >= 0) {
      const u = clamp((ff - R.f0) / (R.imp - R.f0)); if (ff > R.imp) return null;
      const lead = -70 * (1 - u) * (1 - u), q = qf + lead, vT = R.vT;
      return { q, v: vT * u + R.A * 4 * u * (1 - u) * (R.cls >= 2 ? 1.0 : 0.8), u, bx: R.bx, d: q - (R.q0 || 0) };
    }
    const lead = R.L0 * clamp(t / 12), q = qf + lead; if (q > P.qB + 260 || (R.end != null && ff > R.end)) return null;
    const dist = q - qf0(P, R), ph = (dist / R.hop) % 1, v = R.A * 4 * ph * (1 - ph);
    return { q, v, bx: R.bx, d: dist };
  }
  function qf0(P, R) { return R.qf[mn(P.NF - 1, R.f0 + 6)] + R.L0 * 0; }
  function drawRocks(m, f, P, ph2) {
    const tmp = [0, 0, 0];
    for (const R of P.rocks) {
      if (R.aim >= 0 && !R.q0) R.q0 = R.qf[mn(P.NF - 1, R.f0 + 6)];
      const dr = DIAM[R.cls], rrad = dr / 2;
      // Splitter / Einschlag eines Zielbrockens bzw. Zerplatzen eines freien Brockens an der Mittellinie
      if (R.aim >= 0 && f >= R.imp) { rockBurst(m, f, P, R); continue; }
      if (R.aim < 0 && R.f0 <= f && R.end < 999 && f > R.end) { rockBurst(m, f, P, R); continue; }
      m.setZ(R.aim >= 0 ? 0 : 1e8);
      const st = rockState(P, R, f); if (!st) continue;
      // Schweif: eine Flammenzunge hinter dem Brocken (gleicher Flammenmaler wie die Wand: Rampe, Dither, Rauschen), Spitze zeigt gegen die Laufrichtung (nach oben)
      P.tab(st.q, tmp); const k0 = tmp[2], x0 = rd(tmp[0] + R.bx * k0), y0 = rd(tmp[1] - st.v * k0 - rrad);
      m.setZ(R.aim >= 0 ? 0 : P.dir * st.q + 5000);
      const cw = R.cls === 0 ? 2 : rd(rrad * 0.95);
      for (let X = x0 - cw; X <= x0 + cw; X++) { const edge = 1 - ab(X - x0) / (cw + 1); flameCol(m, X, y0 - rd(rrad * 0.5), mx(3, DIAM[R.cls] * 1.9 * (0.55 + 0.45 * edge)), f, R.id & 7, 0.1 + (1 - edge) * 0.25, false, 16, false, false); }
      const k = k0, x = x0, y = y0;
      const ori = rd((st.q - (R.q0 != null ? R.q0 : qf0(P, R))) * k / (rrad * Math.PI / 4)) & 7;
      drawRock(m, x, y, R.cls, ori);
      // Landestaub großer Brocken
      if (R.cls >= 2 && R.aim < 0) { const ph = ((st.q - qf0(P, R)) / R.hop) % 1; if (ph < 0.1) m.disc(x, y + rd(rrad), 2 + R.cls, RAMP[1], 8); }
    }
  }
  function rockBurst(m, f, P, R) {
    const free = R.aim < 0, a = f - (free ? R.end + 1 : R.imp); if (a > 22 || a < 0) return;
    const tmp = [0, 0, 0]; P.tab(free ? R.endQ : P.T[R.aim].q, tmp); const k = tmp[2];
    const X0 = rd(tmp[0] + R.bx * k), Y0 = rd(tmp[1] - (free ? 0 : R.vT) * k - (free ? DIAM[R.cls] / 2 : 0)), gY = rd(tmp[1] + 1);
    m.setZ(0);
    const big = R.cls === 3, nfr = big ? 15 : R.cls === 2 ? 10 : 6, sd = P.seed * 31 + R.id * 7;
    for (let j = 0; j < nfr; j++) {
      const hh = (n) => H(sd + j, n), ang = hh(1) * Math.PI * 2, sp = 1.0 + hh(2) * (big ? 3.4 : 2.6), vx = Math.cos(ang) * sp * 1.15, vy = -Math.abs(Math.sin(ang)) * sp * 1.25 - 0.7;
      const aa = a - (hh(3) < 0.4 ? 0 : 1); if (aa < 0) continue;
      let x = X0 + vx * aa, y = Y0 + vy * aa + 0.5 * 0.34 * aa * aa; const gl = gY + (hh(4) - 0.5) * 6;
      let rest = false; if (y > gl) { y = gl; rest = true; }
      const life = 18 + hh(5) * 6; if (aa > life) continue;
      const sz = 1 + (hh(6) > 0.55 ? 1 : 0) + (big && hh(7) > 0.8 ? 1 : 0), glow = aa < 6;
      const col = glow ? (aa < 2 ? RAMP[10] : aa < 4 ? RAMP[8] : RAMP[6]) : (hh(8) > 0.5 ? ROCK[2] : ROCK[3]);
      const lvl = aa > life - 6 ? 16 - (aa - (life - 6)) * 2.6 : 16;
      for (let yy = 0; yy < sz; yy++) for (let xx = 0; xx < sz; xx++) m.pd(rd(x) + xx, rd(y) + yy, col, lvl);
      if (!rest && aa < 14) m.pd(rd(x - vx * 0.8), rd(y - vy * 0.8 - 0.3), aa < 5 ? RAMP[7] : RAMP[4], 9);   // Funkenschweif der Splitter
    }
    // Stern (Kreuz → Stern → Reste), Weiß-Dither-Blitz
    if (R.cls >= 2 || a === 0) {
      const sc = big ? 1 : 0.65;
      if (a === 0) { const r = rd(11 * sc); m.disc(X0, Y0, rd(r * 0.55), C.white, 16); m.linie(X0 - r, Y0, X0 + r, Y0, 2, C.white); m.linie(X0, Y0 - r, X0, Y0 + r, 2, C.white); m.linie(X0 - rd(r * 0.7), Y0 - rd(r * 0.7), X0 + rd(r * 0.7), Y0 + rd(r * 0.7), 1, C.cream); m.linie(X0 - rd(r * 0.7), Y0 + rd(r * 0.7), X0 + rd(r * 0.7), Y0 - rd(r * 0.7), 1, C.cream); }
      else if (a === 1) { const r = rd(15 * sc); for (let q = 0; q < 8; q++) { const an = q * Math.PI / 4 + 0.2; m.linie(X0 + Math.cos(an) * r * 0.35, Y0 + Math.sin(an) * r * 0.35, X0 + Math.cos(an) * r, Y0 + Math.sin(an) * r, 1, q & 1 ? C.yel : RAMP[8]); } m.disc(X0, Y0, rd(r * 0.4), RAMP[8], 12); }
      else if (a === 2) { const r = rd(19 * sc); for (let q = 0; q < 8; q++) { const an = q * Math.PI / 4 + 0.2, rr = q & 1 ? r * 0.7 : r; m.pd(rd(X0 + Math.cos(an) * rr), rd(Y0 + Math.sin(an) * rr), RAMP[5], 16); m.pd(rd(X0 + Math.cos(an) * rr * 0.75), rd(Y0 + Math.sin(an) * rr * 0.75), RAMP[6], 16); } }
      else if (a === 3) { for (let q = 0; q < 8; q++) { const an = q * Math.PI / 4 + 0.5, rr = 21 * sc; m.pd(rd(X0 + Math.cos(an) * rr), rd(Y0 + Math.sin(an) * rr), RAMP[3], 16); } }
    }
    // Staub: dunkle Dither-Scheibe wächst
    if (a < 9) { m.setZ(1e9); const r = rd(2 + a * (big ? 1.4 : 0.9)); m.disc(X0, gY - 2, r, RAMP[1], mx(3, 11 - a)); }
  }

  function casterCue(m, f, P) {
    if (f > 9 || !P.o.casterFoot) return; const c = P.o.casterFoot, a = f; m.setZ(0);
    const r = 4 + a * 2.6, col = a < 3 ? C.yel : a < 6 ? C.org : C.ember;
    m.ring(rd(c[0]), rd(c[1]), rd(r * 1.3), mx(2, rd(r * 0.55)), 1 + (a < 4 ? 1 : 0), col, a > 5);
    for (let i = 0; i < 9; i++) { const x = rd(c[0] + (H(i, 3) - 0.5) * r * 1.6), y0 = rd(c[1] - 1 - H(i, 4) * r * 0.3), hh = rd((3 + H(i, 5) * 9) * clamp(1 - a / 10) * 1.2); for (let y = 0; y < hh; y++) m.pd(x, y0 - y, y < hh * 0.4 ? RAMP[9] : y < hh * 0.75 ? RAMP[7] : RAMP[5], 16 - y); }
  }

  function embers(m, f, P) {
    m.setZ(0); const cols = [RAMP[11], RAMP[9], RAMP[7], RAMP[5], RAMP[3], RAMP[2]];
    for (const e of P.emb) {
      const a = f - e.s; if (a < 0 || a >= e.L) continue;
      const u = a / e.L, rise = e.vr * (1 - Math.pow(0.9, a)) / 0.1, x = rd(e.x + e.vx * a + Math.sin(a * 0.7 + e.ph) * 1.3), y = rd(e.y - e.v0 * P.Hb * e.k - rise);
      if (H(e.s * 7 + a, e.ph * 100) < 0.12 + u * 0.35) continue;    // Flackern
      const c = cols[mn(5, fl(u * 6))], sz = e.big && u < 0.6 ? 2 : 1;
      for (let j = 0; j < sz; j++) for (let i = 0; i < sz; i++) m.px(x + i, y + j, c);
    }
  }

  // ── Wand: 6 Vorhänge von vorn (alt = weit hinten, rot, niedrig) nach vorn; Ziele werden zwischen den Vorhängen gemalt, an deren Tiefe sie stehen ──
  function curtain(m, f, ci, P, dl) {
    const ff = f - CA[ci]; if (ff < -4) return;
    const NC = P.NC, sX = P._sX || (P._sX = new Float32Array(NC)), sY = P._sY || (P._sY = new Float32Array(NC)), sH = P._sH || (P._sH = new Float32Array(NC)), sQ = P._sQ || (P._sQ = new Float32Array(NC)), tmp = [0, 0, 0];
    let any = false;
    for (let j = 0; j < NC; j++) {
      const bx = P.bxj[j], rise = clamp((ff - P.ign[j]) / 8);
      if (rise <= 0) { sH[j] = 0; continue; }
      const q = P.Qtab[j * P.NF + mn(P.NF - 1, mx(0, ff + 6))]; P.tab(q, tmp);
      const fall = clamp(1 - (ff - P.tend[j]) / 6), er = 0.4 + 0.6 * clamp((q - P.qE) / (P.qh * 1.1 - P.qE));   // Höhe sinkt zur Mittellinie hin: die Lawine läuft aus
      sX[j] = tmp[0] + bx * tmp[2]; sY[j] = tmp[1]; sQ[j] = q; sH[j] = P.Hb * tmp[2] * CH[ci] * P.bell[j] * (0.6 + 0.8 * NB[((((ff + 8) * 2) & 255) << 8) | ((j + ci * 50) & 255)] / 255) * (rise * (2 - rise)) * fall * er; if (sH[j] > 1.5) any = true;
    }
    if (!any) return;
    for (let j = 0; j < NC - 1; j++) {
      if (sH[j] <= 1.5 && sH[j + 1] <= 1.5) continue;
      const x0 = sX[j], x1 = sX[j + 1], X0 = fl(x0), X1 = fl(x1);
      for (let X = X0; X < X1; X++) {
        const t = clamp((X + 0.5 - x0) / (x1 - x0)), Hc = lerp(sH[j], sH[j + 1], t); if (Hc < 1.5) continue;
        const y = rd(lerp(sY[j], sY[j + 1], t)); m.setZ(P.dir * lerp(sQ[j], sQ[j + 1], t) + 5000);
        flameCol(m, X, y, Hc, f, ci, CP[ci], ci < 3 && !P.phone, dl, ci === 0, !P.phone);
      }
    }
  }

  FX.draw = (m, f, P, hook) => {
    const dl = f > P.fExit ? 16 * clamp(1 - (f - P.fExit) / 12) : 16;
    ground(m, f, P);
    // Druckringe am Boden (Einschlag)
    P.T.forEach((t, i) => { const a = f - t.hitF; if (a < 1 || a > 8) return; m.setZ(1e9); const r = (4 + a * 6) * (t.kind === 'hero' ? 1 : 1.1), k = t.k; m.ring(rd(t.cx), rd(t.cy), rd(r * 1.25), mx(2, rd(r * 0.55)), a < 4 ? 2 : 1, a < 3 ? C.yel : a < 5 ? C.org : C.ember, a > 5); });
    const sils = new Array(P.T.length).fill(null);
    // Zielalter a = f − hitF. a < 0: nicht gemalt (das DOM-Ziel steht VOR der Wand, Tiefenmaske). 0–1: Blitz oben auf. 2–6: „umzüngelt“ — das Ziel steht zwischen den Vorhängen
    // (jüngere = nähere Vorhänge überdecken es). Ab 7: wieder oben auf (brennt vor der Glut).
    const paint = (i) => { const pose = FX.pose(f, P, i); m.setZ(0); sils[i] = hook.pile(m, i, pose); targetBurn(m, f, P, i, sils[i]); };
    const done = new Array(P.T.length).fill(false);
    for (let ci = CA.length - 1; ci >= 0; ci--) {
      if (P.phone && ci === 5) continue;
      P.T.forEach((t, i) => { const a = f - t.hitF; if (!done[i] && a >= 2 && a <= 4 && CA[ci] <= a) { done[i] = true; paint(i); } });
      if (dl > 0) curtain(m, f, ci, P, dl);
    }
    P.T.forEach((t, i) => { const a = f - t.hitF; if (!done[i] && a >= 0) paint(i); });
    casterCue(m, f, P);
    drawRocks(m, f, P);
    embers(m, f, P);
  };
  FX.warmList = () => { const out = []; for (let c = 0; c < 4; c++) for (let o = 0; o < 8; o++) out.push(() => rockSprite(c, o)); return out; };
  root.PpFx60 = FX;
})(window);

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  SPIEL-HÜLLE: Brettabbildung (Homografie aus den Zonen), Leinwand in der Weltschicht, Takt, Held-Sprites per Leinwand, Karten-Ruckeln, Shake, Aufräumen, Rückfall
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const PP_FX60_TAKT = 1000 / 30;

/** Rückfall auf die alte Salve (`ppR1FlameAvalanche`): Animationen aus, Retro, Test-Schalter, reduzierte Bewegung, keine Palette. */
function ppFx60Rueckfall() {
  try {
    if (window.__ppFx60Aus || window.__ppFxAlt || window._playAnimations === false || window.PP_RETRO || typeof window.ppSnapRgb !== 'function' || !window.PpFx57 || !window.PpFx60) return true;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return true;
  } catch (e) { /* weiter */ }
  return false;
}

/** Homografie Brettebene (Layout-Pixel) → Fenster aus Referenzpunkten [X, Y, sx, sy]: { f(X, Y) → [sx, sy], inv(sx, sy) → [X, Y], rms }. Kleinste Quadrate (8 Unbekannte), Umkehrung per Newton. */
function ppFx60Homografie(paare) {
  const n = paare.length; if (n < 4) return null;
  let mX = 0, mY = 0, ms = 0, mt = 0; for (const p of paare) { mX += p[0]; mY += p[1]; ms += p[2]; mt += p[3]; } mX /= n; mY /= n; ms /= n; mt /= n;
  let dX = 0, dS = 0; for (const p of paare) { dX += Math.hypot(p[0] - mX, p[1] - mY); dS += Math.hypot(p[2] - ms, p[3] - mt); } dX = dX / n / Math.SQRT2 || 1; dS = dS / n / Math.SQRT2 || 1;
  const A = Array.from({ length: 8 }, () => new Float64Array(9));
  for (const p of paare) {
    const x = (p[0] - mX) / dX, y = (p[1] - mY) / dX, u = (p[2] - ms) / dS, v = (p[3] - mt) / dS;
    for (const r of [[x, y, 1, 0, 0, 0, -u * x, -u * y, u], [0, 0, 0, x, y, 1, -v * x, -v * y, v]]) for (let i = 0; i < 8; i++) { for (let j = 0; j < 8; j++) A[i][j] += r[i] * r[j]; A[i][8] += r[i] * r[8]; }
  }
  for (let c = 0; c < 8; c++) {
    let pv = c; for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[pv][c])) pv = r;
    if (Math.abs(A[pv][c]) < 1e-12) return null; const t = A[c]; A[c] = A[pv]; A[pv] = t;
    for (let r = 0; r < 8; r++) if (r !== c) { const f = A[r][c] / A[c][c]; for (let j = c; j < 9; j++) A[r][j] -= f * A[c][j]; }
  }
  const h = []; for (let i = 0; i < 8; i++) h.push(A[i][8] / A[i][i]); h.push(1);
  const f = (X, Y) => { const x = (X - mX) / dX, y = (Y - mY) / dX, w = h[6] * x + h[7] * y + 1; return [(h[0] * x + h[1] * y + h[2]) / w * dS + ms, (h[3] * x + h[4] * y + h[5]) / w * dS + mt]; };
  const inv = (sx, sy) => {
    let X = mX, Y = mY;
    for (let it = 0; it < 14; it++) {
      const p = f(X, Y), ex = p[0] - sx, ey = p[1] - sy; if (Math.abs(ex) + Math.abs(ey) < 1e-4) break;
      const a = f(X + 1, Y), b = f(X, Y + 1), j11 = a[0] - p[0], j21 = a[1] - p[1], j12 = b[0] - p[0], j22 = b[1] - p[1], d = j11 * j22 - j12 * j21 || 1e-9;
      X -= (ex * j22 - ey * j12) / d; Y -= (ey * j11 - ex * j21) / d;
    }
    return [X, Y];
  };
  let s2 = 0; for (const p of paare) { const q = f(p[0], p[1]); s2 += (q[0] - p[2]) ** 2 + (q[1] - p[3]) ** 2; }
  return { f, inv, rms: Math.sqrt(s2 / n) };
}

/** Mitte und Maß eines Elements in Layout-Pixeln der Brettebene (offsetLeft/Top-Kette, Verschiebungen der Vorfahren eingerechnet); null, wenn es nicht in der Ebene liegt. */
function ppFx60Layout(e, plane) {
  let x = 0, y = 0, el = e, n = 0;
  while (el && el !== plane && n++ < 24) {
    x += el.offsetLeft; y += el.offsetTop;
    if (el !== e) { const tf = getComputedStyle(el).transform; if (tf && tf !== 'none') { const m = tf.match(/^matrix\(([^)]+)\)/); if (m) { const a = m[1].split(',').map(Number); x += a[4] || 0; y += a[5] || 0; } } }
    el = el.offsetParent;
  }
  if (el !== plane || !(e.offsetWidth > 0)) return null;
  return { x: x + e.offsetWidth / 2, y: y + e.offsetHeight / 2, w: e.offsetWidth, h: e.offsetHeight };
}

/** Held-Sprite-Figur einer Zone: { hp, px, y0, y1 } oder null (`ppFx59Figur`, app-fx-59). */
function ppFx60Figur(el) { return (typeof ppFx59Figur === 'function') ? ppFx59Figur(el) : null; }

/**
 * Brettabbildung und Ziele einmal beim Start (kein Layout im Takt): Homografie aus allen Zonen, Maßstab (u = Brett-Einheit des Prototyps: ein Sprite-Pixel = 4,84 u),
 * Wandbreite, Rückkante, Leinwandrechteck (Gegnerhälfte + Flammenhöhe, KEIN Vollfenster), Zelle = Hero-Pixel (Deckel `ppFxZelleGedeckelt`), Ziele samt Trefferbildern, Silhouettenmaske.
 * Gibt null zurück, wenn etwas fehlt (Effekt fällt dann auf die alte Salve zurück).
 */
/** Geometrie nicht möglich: Grund merken (Tests: `window.__ppFx60Grund`), Rückfall auf die alte Salve. */
function ppFx60Fehl(g) { window.__ppFx60Grund = g; return null; }

function ppFx60Geometrie(props) {
  try {
    const FX = window.PpFx60; FX.init();
    const plane = document.querySelector('.board-plane');
    const tps0 = (props.targetPoints || []).filter((t) => t && t.el && t.el.isConnected);
    if (!plane || !tps0.length || typeof props.ox !== 'number') return ppFx60Fehl(1);
    const off = (props.welt && window.ppFxScrollOffset) ? window.ppFxScrollOffset() : { dx: 0, dy: 0 };
    const phone = !!(window.ppIsPhone && window.ppIsPhone());
    // Referenzpunkte: alle Zonen (Held, Fähigkeit, Support, beide Seiten)
    const refs = [];
    document.querySelectorAll('[data-hero-zone],[data-support-zone],[data-ability-zone]').forEach((e) => {
      const l = ppFx60Layout(e, plane), r = e.getBoundingClientRect();
      if (l && r.width > 0) refs.push([l.x, l.y, r.left + r.width / 2, r.top + r.height / 2, e]);
    });
    if (refs.length < 8) return ppFx60Fehl(2);
    const Hm = ppFx60Homografie(refs); if (!Hm || !(Hm.rms < 6)) return ppFx60Fehl(3);
    let Xc = 0, Ym = 0; for (const r of refs) { Xc += r[0]; Ym += r[1]; } Xc /= refs.length; Ym /= refs.length;
    const lblOf = (e) => e.getAttribute('data-hero-owner') || e.getAttribute('data-support-owner') || e.getAttribute('data-ability-owner');
    const t0e = tps0[0].el, side = lblOf(t0e) || ((tps0[0].y < innerHeight / 2) ? 'opp' : 'me');
    const l0 = ppFx60Layout(t0e, plane); if (!l0) return ppFx60Fehl(4);
    const dir = l0.y < Ym ? 1 : -1;                                                             // Zielseite oben (Gegner) → q wächst mit sinkendem Layout-y
    // Heldenfiguren (Ziele und andere), Maß der Brett-Einheit u
    const hf0 = tps0.map((t) => ((t.zoneSlot == null || t.zoneSlot < 0) ? ppFx60Figur(t.el) : null)).find(Boolean) || ppFx60Figur(document.querySelector('[data-hero-zone]'));
    let R = 1.72;
    if (hf0) {
      const zl = ppFx60Layout(hf0.hp.platz && hf0.hp.platz.closest('[data-hero-zone]') || t0e, plane) || l0, a = Hm.f(zl.x, zl.y), b = Hm.f(zl.x + 1, zl.y), pxPerL = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      R = Math.max(1.2, Math.min(2.4, 4.84 / (hf0.hp.px / pxPerL)));
    }
    const toL = (bx, q) => [Xc + bx / R, Ym - dir * q / R];
    const fromL = (X, Y) => [(X - Xc) * R, dir * (Ym - Y) * R];
    const gpPx = (bx, q) => { const L = toL(bx, q), a = Hm.f(L[0], L[1]), b = Hm.f(L[0] + 1, L[1]); return [a[0], a[1], Math.hypot(b[0] - a[0], b[1] - a[1]) / R]; };   // Fenster-x, -y, px je u
    const fromPx = (sx, sy) => { const L = Hm.inv(sx, sy); return fromL(L[0], L[1]); };
    // Zeilen der Zielseite
    const rowQ = (attr) => { let s = 0, n = 0; for (const r of refs) { const e = r[4]; if (e.hasAttribute(attr) && lblOf(e) === side) { s += r[1]; n++; } } return n ? fromL(Xc, s / n)[1] : null; };
    const qHeroRow = rowQ('data-hero-zone'), qSupRow = rowQ('data-support-zone');
    if (qHeroRow == null) return ppFx60Fehl(5);
    const qB = (qSupRow != null ? qSupRow : qHeroRow + 420) + 123;
    let xmin = 1e9, xmax = -1e9; for (const r of refs) { xmin = Math.min(xmin, r[0]); xmax = Math.max(xmax, r[0]); }
    const Wd = Math.max(1000, (xmax - xmin) * R + 270);
    // Wirker: Zone des Ursprungs (nächste Heldenzone), Fußpunkt
    let oz = null, dBest = 1e9;
    document.querySelectorAll('[data-hero-zone]').forEach((e) => { const r = e.getBoundingClientRect(), d = Math.hypot(r.left + r.width / 2 - props.ox, r.top + r.height / 2 - props.oy); if (d < dBest) { dBest = d; oz = e; } });
    if (!oz || dBest > 40) return ppFx60Fehl(6);
    const ofg = ppFx60Figur(oz), orr = oz.getBoundingClientRect();
    const cFoot = ofg ? [orr.left + orr.width / 2, ofg.hp.cv.getBoundingClientRect().top + ofg.y1 * ofg.hp.px] : [orr.left + orr.width / 2, orr.top + orr.height * 0.5];
    const cq = fromPx(cFoot[0], cFoot[1]);
    // Leinwandrechteck in Fensterpixeln (Wand von der Rückkante bis zum Wirker, Breite Wd, Höhe der Flammen darüber)
    let heroHbs = [];
    for (const t of tps0) { const fg = (t.zoneSlot == null || t.zoneSlot < 0) ? ppFx60Figur(t.el) : null; if (fg) heroHbs.push((fg.y1 - fg.y0) * 4.84); }
    const heroHb = heroHbs.length ? heroHbs.reduce((a, b) => a + b, 0) / heroHbs.length : (hf0 ? (hf0.y1 - hf0.y0) * 4.84 : 130);
    const Hb = heroHb * 2.1;
    let bx0 = 1e9, bx1 = -1e9, by0 = 1e9, by1 = -1e9;
    for (const q of [cq[1] - 30, qHeroRow, (qSupRow != null ? qSupRow : qHeroRow + 300), qB + 40]) { const g = gpPx(0, q); bx0 = Math.min(bx0, g[0] - Wd / 2 * g[2]); bx1 = Math.max(bx1, g[0] + Wd / 2 * g[2]); by1 = Math.max(by1, g[1] + 30); by0 = Math.min(by0, g[1] - Hb * g[2] * 1.55); }
    bx0 = Math.max(0, bx0); bx1 = Math.min(innerWidth, bx1); by0 = Math.max(0, by0); by1 = Math.min(innerHeight, by1);   // die Flammen ragen über die Brettkante hinaus (Kopfzeile), aber nicht über das Fenster
    if (!(bx1 - bx0 > 100 && by1 - by0 > 60)) return ppFx60Fehl(7);
    const S = ppFxZelleGedeckelt({ zoneEl: t0e, w: tps0[0].w }, { breite: bx1 - bx0, hoehe: by1 - by0 });
    const lx = Math.round(bx0 + off.dx), ly = Math.round(by0 + off.dy);
    const gw = Math.min(900, Math.ceil((bx1 - bx0) / S)), gh = Math.min(700, Math.ceil((by1 - by0) / S));
    const cell = (sx, sy) => [(sx + off.dx - lx) / S, (sy + off.dy - ly) / S];
    const gp = (bx, q) => { const g = gpPx(bx, q), c = cell(g[0], g[1]); return [c[0], c[1], g[2] / S]; };
    // Ziele (Engine-Reihenfolge), Trefferbilder aus delay / heroAt / hitDelay
    const tps = tps0.slice().sort((a, b) => (a.idx != null && b.idx != null ? a.idx - b.idx : 0));
    const raw = Array.isArray(props.targets) ? props.targets : [], isHero = (t) => t.zoneSlot == null || t.zoneSlot < 0;
    const dMs = props.delay != null ? props.delay : 470, hA = props.heroAt != null ? props.heroAt : 870, hD = props.hitDelay != null ? props.hitDelay : 120;
    let heroN = 0;
    const targets = [], recs = [];
    for (const tp of tps) {
      const el = tp.el, hero = tp.zoneSlot == null || tp.zoneSlot < 0;
      const slot = (tp.idx != null && raw.length) ? raw.slice(0, tp.idx).filter(isHero).length : heroN;
      if (hero) heroN++;
      const fg = hero ? ppFx60Figur(el) : null, kind = fg ? 'hero' : 'card';
      const hitF = Math.max(2, Math.min(52, Math.round((hero ? hA + slot * hD : dMs) * 30 / 1000)));
      let bq, hb, wb = (el.offsetWidth || 68) * R;
      const karte = el.querySelector('.board-card');
      if (kind === 'hero') { const r = fg.hp.cv.getBoundingClientRect(), z = el.getBoundingClientRect(); bq = fromPx(z.left + z.width / 2, r.top + fg.y1 * fg.hp.px); hb = (fg.y1 - fg.y0) * 4.84; }
      else { const l = ppFx60Layout(karte || el, plane) || ppFx60Layout(el, plane); if (!l) continue; bq = fromL(l.x, l.y); hb = 20; }
      targets.push({ kind, bx: bq[0], q: bq[1], wb, hb, hitF });
      recs.push({ kind, el, fig: fg, karte: kind === 'card' ? karte : null, platz: fg ? fg.hp.platz : null });
    }
    if (!targets.length) return ppFx60Fehl(8);
    const nF = (window.ppFxN ? window.ppFxN(100) / 100 : 1) * (phone ? 0.5 : 1);
    const cc = cell(cFoot[0], cFoot[1]);
    const P = FX.plan({ gp, G: S, n: nF, phone, seed: Math.floor(Math.random() * 1e6), Wd, qS: -60, qB, qE: -25, heroHb, caster: { bx: cq[0] }, casterFoot: cc, targets, dir, qhDef: qHeroRow, qcDef: qSupRow != null ? qSupRow : qHeroRow + 422 });
    // Beschreibung einer Figur in Leinwandzellen (Lage des Sprite-Canvas, Fußlinie, Mitte)
    const beschreibe = (fg, el) => {
      const r = fg.hp.cv.getBoundingClientRect(), z = el.getBoundingClientRect(), c0 = cell(r.left, r.top), ft = cell(z.left + z.width / 2, r.top + fg.y1 * fg.hp.px);
      return { px: fg.px, eintrag: fg.hp.eintrag, fr: fg.hp.platz._ppFrame | 0, cps: fg.hp.px / S, oX: c0[0], oY: c0[1], L: ft[1], gx: ft[0] };
    };
    recs.forEach((rc, i) => { if (rc.fig) rc.desc = beschreibe(rc.fig, rc.el); else { const l = ppFx60Layout(rc.karte || rc.el, plane); if (l) { const pt = (dx, dy) => { const p = Hm.f(l.x + dx, l.y + dy); return cell(p[0], p[1]); }; rc.quad = { tl: pt(-l.w / 2, -l.h / 2), tr: pt(l.w / 2, -l.h / 2), bl: pt(-l.w / 2, l.h / 2), br: pt(l.w / 2, l.h / 2) }; } } });
    // Silhouettenmaske: alle Karten (Viereck) und Heldenfiguren (Sprite-Pixel) der Brettebene mit dem Tiefenschlüssel dir * q + 5000 (der Kamera nähere gewinnen; Kamera = unten im Bild)
    const tq = new Float32Array(gw * gh);
    const setze = (k, qd) => { const t = tq[k]; if (t === 0 || qd < t) tq[k] = qd; };
    const masken = [];
    document.querySelectorAll('.board-card').forEach((ce) => {
      const l = ppFx60Layout(ce, plane); if (!l) return;
      const c = Hm.f(l.x, l.y); if (!(c[0] > -200 && c[0] < innerWidth + 200)) return;
      const q = dir * fromL(l.x, l.y)[1] + 5000, pt = (dx, dy) => { const p = Hm.f(l.x + dx, l.y + dy); return cell(p[0], p[1]); };
      const tl = pt(-l.w / 2, -l.h / 2), tr = pt(l.w / 2, -l.h / 2), bl = pt(-l.w / 2, l.h / 2), br = pt(l.w / 2, l.h / 2);
      const y0 = Math.max(0, Math.floor(Math.min(tl[1], tr[1]))), y1 = Math.min(gh, Math.ceil(Math.max(bl[1], br[1])));
      for (let Y = y0; Y < y1; Y++) {
        const t = Math.max(0, Math.min(1, (Y + 0.5 - tl[1]) / (bl[1] - tl[1]))), a = tl[0] + (bl[0] - tl[0]) * t, b = tr[0] + (br[0] - tr[0]) * t;
        for (let X = Math.max(0, Math.round(a)); X < Math.min(gw, Math.round(b)); X++) setze(Y * gw + X, q);
      }
    });
    return { S, P, FX, lx, ly, gw, gh, off, recs, tq, phone, Hm, cell, setze, beschreibe, fromPx, ppx: (fg) => fg.hp.px };
  } catch (e) { try { console.warn('[FlameAvalanche]', e); } catch (e2) { /* weg */ } return ppFx60Fehl('Fehler ' + e.message); }
}

function PpFx60Leinwand({ geo }) {
  const cvs = useRef(null);
  const wurzelRef = useRef(null);
  useEffect(() => {
    const el = cvs.current, FX = geo.FX;
    if (!el) return undefined;
    const { S, P, gw, gh, recs, tq, phone } = geo;
    const ctx = el.getContext('2d'), img = ctx.createImageData(gw, gh), buf = img.data, m = FX.maler(buf, gw, gh, tq, 0, 0);
    const takt = window.ppTaktRaf || window.requestAnimationFrame;
    const BAY = window.PpFx57.BAY, snapA = window.PpFx57.snap, C = FX.C;
    const ruhig = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const shakeAn = !phone && !ruhig && !window.__ppFx60KeinShake;
    const board = shakeAn ? document.querySelector('.board-center') : null;
    const wurzel = wurzelRef.current;
    // Silhouetten der Silhouettenmaske für die Helden (Figuren im Brett; die Ziele selbst stehen mit ihrer Tiefe darin) — einmal, mit dem Ausgangsbild
    try {
      document.querySelectorAll('[data-hero-zone]').forEach((z) => {
        const fg = ppFx60Figur(z); if (!fg) return;
        const d = geo.beschreibe(fg, z), q = geo.fromPx(z.getBoundingClientRect().left + z.getBoundingClientRect().width / 2, fg.hp.cv.getBoundingClientRect().top + fg.y1 * fg.hp.px)[1] * geo.P.dir + 5000;
        figurZellen(d, { sx: 1, sy: 1, dx: 0 }, (X, Y) => geo.setze(Y * gw + X, q));
      });
    } catch (e) { /* ohne Heldensilhouetten: Wand liegt dann über den Helden (nur Optik) */ }
    // ── Figur im Raster (Nächster-Nachbar, eine Zelle je Sprite-Pixel-Anteil), um die Fußlinie gestaucht ──
    function figurZellen(fg, p, fn) {
      const s = fg.px, f0 = Math.max(0, Math.min(fg.fr, Math.max(1, (fg.eintrag.meta.frames | 0)) - 1));
      const sx0 = s.vert ? 0 : f0 * s.fw, sy0 = s.vert ? f0 * s.fh : 0, cps = fg.cps, oX = fg.oX, oY = fg.oY, Lc = fg.L, sy = p.sy, sx = p.sx, gxc = fg.gx;
      const wCells = s.fw * cps, hCells = s.fh * cps;
      const c0 = Math.max(0, Math.floor(gxc + (oX - gxc) * sx + p.dx)), c1 = Math.min(gw - 1, Math.ceil(gxc + (oX + wCells - gxc) * sx + p.dx));
      const r0 = Math.max(0, Math.floor(Lc - (Lc - oY) * sy)), r1 = Math.min(gh - 1, Math.ceil(Lc) - 1, Math.ceil(Lc - (Lc - (oY + hCells)) * sy));
      for (let Y = r0; Y <= r1; Y++) {
        if (Y + 0.5 > Lc) continue;
        const yo = Lc - (Lc - (Y + 0.5)) / sy, srow = Math.floor((yo - oY) / cps); if (srow < 0 || srow >= s.fh) continue;
        for (let X = c0; X <= c1; X++) {
          const xo = gxc + (X + 0.5 - gxc - p.dx) / sx, scol = Math.floor((xo - oX) / cps); if (scol < 0 || scol >= s.fw) continue;
          const i = ((sy0 + srow) * s.w + sx0 + scol) * 4; if (s.d[i + 3] < 128) continue;
          fn(X, Y, s.d[i], s.d[i + 1], s.d[i + 2]);
        }
      }
    }
    const darkMemo = new Map();
    const dark = (c) => { const k = c[0] << 16 | c[1] << 8 | c[2]; let r = darkMemo.get(k); if (!r) { r = snapA('#' + [c[0] * 0.22 + 26, c[1] * 0.16 + 12, c[2] * 0.14 + 8].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')); darkMemo.set(k, r); } return r; };
    const mk = new Uint8Array(gw * gh);
    const tops = recs.map(() => new Int16Array(gw + 2));
    // Held: Sprite mit Blitz/Quetschung/Ruß auf die Leinwand; Silhouette (oberste Zeile je Spalte, Randzellen) für die Flammen
    const pileHero = (mm, i, pose) => {
      const rc = recs[i], fg = rc.desc; if (!fg || !rc.platz || rc.tot) return null;
      fg.fr = rc.platz._ppFrame | 0;
      const top = tops[i]; top.fill(32767); mk.fill(0);
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      figurZellen(fg, pose, (X, Y, r, g, b) => {
        let col = [r, g, b];
        if (pose.flash === 1) col = C.white; else if (pose.flash === 2) col = C.cream; else if (pose.flash === 3 && BAY[Y & 3][X & 3] < 8) col = C.yel; else if (pose.char > 0 && BAY[Y & 3][X & 3] / 16 < pose.char * 0.9) col = dark(col);
        mm.px(X, Y, col); mk[Y * gw + X] = 1; if (Y < top[X]) top[X] = Y; if (X < x0) x0 = X; if (X > x1) x1 = X; if (Y < y0) y0 = Y; if (Y > y1) y1 = Y;
      });
      if (x1 < x0) return null;
      const edge = [];
      for (let Y = Math.max(1, y0 - 1); Y <= Math.min(gh - 2, y1); Y++) for (let X = Math.max(1, x0 - 1); X <= Math.min(gw - 2, x1 + 1); X++) {
        if (mk[Y * gw + X]) continue; if (mk[Y * gw + X - 1] || mk[Y * gw + X + 1] || mk[(Y + 1) * gw + X]) edge.push(X, Y);
      }
      return { x0, x1, top, edge };
    };
    // Karte (flach auf dem Brett): Viereck in Zellen; Blitz = Weiß/Creme-Füllung, Ruß = Dither; Ruckeln nur in ganzen Zellen
    const pileCard = (mm, i, pose) => {
      const rc = recs[i], q = rc.quad; if (!q || (rc.karte && !rc.karte.isConnected)) return null;
      const top = tops[i]; top.fill(32767); const edge = [], dx = pose.dx; let x0 = 1e9, x1 = -1e9;
      const yA = Math.floor(Math.min(q.tl[1], q.tr[1])), yB = Math.ceil(Math.max(q.bl[1], q.br[1])), y0 = Math.max(0, yA);
      for (let Y = y0; Y < Math.min(gh, yB); Y++) {
        const t = Math.max(0, Math.min(1, (Y + 0.5 - q.tl[1]) / (q.bl[1] - q.tl[1]))), a = q.tl[0] + (q.bl[0] - q.tl[0]) * t + dx, b = q.tr[0] + (q.br[0] - q.tr[0]) * t + dx, xa = Math.round(a), xb = Math.round(b) - 1;
        x0 = Math.min(x0, xa); x1 = Math.max(x1, xb);
        for (let X = Math.max(0, xa); X <= Math.min(gw - 1, xb); X++) {
          if (pose.flash === 1) mm.px(X, Y, C.white); else if (pose.flash === 2) { if (BAY[Y & 3][X & 3] / 16 < 0.7) mm.px(X, Y, C.cream); } else if (pose.flash === 3) { if (BAY[Y & 3][X & 3] / 16 < 0.3) mm.px(X, Y, C.yel); }
          else if (pose.char > 0 && BAY[Y & 3][X & 3] / 16 < pose.char * 0.8) mm.px(X, Y, ((X * 7 + Y * 3) % 5 === 0) ? C.soot2 : C.soot);
          if (X === xa || X === xb) { edge.push(X - 1, Y, X + 1, Y); }
          if (Y === y0) edge.push(X, Y - 1);
        }
      }
      for (let X = Math.max(0, x0); X <= Math.min(gw - 1, x1); X++) top[X] = y0;
      return { x0: Math.max(0, x0), x1: Math.min(gw - 1, x1), top, edge };
    };
    const hook = { pile: (mm, i, pose) => (recs[i].kind === 'hero' ? pileHero(mm, i, pose) : pileCard(mm, i, pose)) };
    // DOM-Seite: Merker zum Zurücksetzen
    for (const rc of recs) {
      rc.alt = { vis: rc.platz ? rc.platz.style.visibility : '', tr: rc.platz ? rc.platz.style.translate : '', kTr: rc.karte ? rc.karte.style.transform : '' };
      rc.kx = 1; if (rc.karte) { const kr = rc.karte.getBoundingClientRect(); if (kr.width > 0) rc.kx = rc.karte.offsetWidth / kr.width; }
      rc.key = ''; rc.tot = false;
    }
    const altBoard = board ? board.style.translate : '';
    const t0 = performance.now();
    let raf = 0, letzte = -1, ende = false, skey = '';
    const zuruecksetzen = () => {
      try { for (const rc of recs) { if (rc.platz) { rc.platz.style.visibility = rc.alt.vis; rc.platz.style.translate = rc.alt.tr; } if (rc.karte) rc.karte.style.transform = rc.alt.kTr; } if (board) board.style.translate = altBoard; } catch (e) { /* weg */ }
    };
    const aufraeumen = () => { if (ende) return; ende = true; try { cancelAnimationFrame(raf); } catch (e) { /* weg */ } zuruecksetzen(); try { ctx.clearRect(0, 0, gw, gh); } catch (e) { /* weg */ } };
    const schritt = (jetzt) => {
      if (ende) return;
      if (typeof jetzt !== 'number') jetzt = performance.now();
      const ms = Math.max(0, jetzt - t0);
      if (ms >= (FX.LEN + 1) * PP_FX60_TAKT) { aufraeumen(); return; }
      const fr = Math.floor(jetzt / PP_FX60_TAKT);
      if (fr !== letzte) {
        letzte = fr;
        const mess = window.__ppFx60Messen ? performance.now() : 0;
        const f = Math.min(FX.LEN - 1, Math.floor(ms / PP_FX60_TAKT + 1e-4));
        buf.fill(0);
        // Heldenfiguren: neue Figur im Zonenplatz (Wiederbelebung/Neuaufbau) bzw. Tod (Zerfall der Figur läuft dann selbst) — ab da nicht mehr in die Leinwand malen
        for (const rc of recs) if (rc.kind === 'hero') { const cur = rc.el._ppFigurPlatz; if (cur && cur !== rc.platz && cur.isConnected) { rc.platz = cur; rc.key = ''; } if (rc.platz && (rc.platz._ppFx32Tot || !rc.platz.isConnected)) rc.tot = true; }
        FX.draw(m, f, P, hook);
        ctx.putImageData(img, 0, 0);
        // DOM-Seite (nur bei Änderung): Held ausblenden, solange er im Raster gemalt wird (Zittern davor), Karte ruckeln, Brett schütteln
        recs.forEach((rc, i) => {
          const pose = FX.pose(f, P, i), k2 = (pose.active && !rc.tot ? 'a' : 'p') + pose.dx;
          if (k2 === rc.key) return; rc.key = k2;
          if (rc.platz) { rc.platz.style.visibility = pose.active && !rc.tot ? 'hidden' : rc.alt.vis; rc.platz.style.translate = (!pose.active && pose.dx) ? `${pose.dx * S}px 0px` : rc.alt.tr; }
          if (rc.karte) rc.karte.style.transform = pose.dx ? `translate(${(pose.dx * S * rc.kx).toFixed(2)}px, 0px)` : rc.alt.kTr;
        });
        if (board) {
          const sh = FX.shake(f, P), sxp = Math.round(sh[0] * S / 3), syp = Math.round(sh[1] * S / 3), k3 = sxp + '|' + syp;
          if (k3 !== skey) { skey = k3; board.style.translate = (sxp || syp) ? `${sxp}px ${syp}px` : altBoard; if (wurzel) wurzel.style.translate = (sxp || syp) ? `${sxp}px ${syp}px` : ''; }
        }
        if (mess) (window.__ppFx60Zeiten || (window.__ppFx60Zeiten = [])).push([f, +(performance.now() - mess).toFixed(3)]);
      }
      raf = takt(schritt);
    };
    raf = takt(schritt);
    const netz = setTimeout(aufraeumen, (FX.LEN + 1) * PP_FX60_TAKT + 2500);                              // Notnagel (Tab im Hintergrund: rAF ruht)
    return () => { clearTimeout(netz); aufraeumen(); };
  }, []);
  return (
    <div ref={wurzelRef} aria-hidden="true" data-pp-px="aus" style={{ position: 'fixed', left: geo.lx, top: geo.ly, pointerEvents: 'none', zIndex: 10100 }}>
      <canvas ref={cvs} width={geo.gw} height={geo.gh} style={{ width: geo.gw * geo.S, height: geo.gh * geo.S, imageRendering: 'pixelated', display: 'block' }} />
    </div>
  );
}

/** Registry-Komponente: neue Lawine oder die alte Salve (`Alt`) als Rückfall (Animationen aus, Retro, Test-Schalter, reduzierte Bewegung, fehlende Ziele/Zonen). Ohne Ziele (Vorwärmen) wird nichts gezeichnet. */
function ppFx60Komponente(Alt) {
  return function PpFx60Effekt(props) {
    const geo = useMemo(() => {
      if (props.prewarm || ppFx60Rueckfall()) { window.__ppFx60Grund = 'Rückfall (Animationen aus / Retro / reduzierte Bewegung / Schalter)'; return null; }
      const mess = window.__ppFx60Messen ? performance.now() : 0;
      const g = ppFx60Geometrie(props);
      if (mess) (window.__ppFx60Zeiten || (window.__ppFx60Zeiten = [])).push([-1, +(performance.now() - mess).toFixed(3)]);
      return g;
    }, []);
    if (!geo) return Alt ? <Alt {...props} /> : null;
    return <PpFx60Leinwand geo={geo} />;
  };
}
(function ppFx60Registrieren() {
  if (typeof ANIM_REGISTRY === 'undefined') return;
  const alt = ANIM_REGISTRY.flame_avalanche;                 // ppR1FlameAvalanche (app-board.jsx): bleibt als Rückfall
  if (!window.__ppFxAlt) ANIM_REGISTRY.flame_avalanche = ppFx60Komponente(alt);
})();

// Aufwärmen im Leerlauf: Rauschtabellen, Palette und die 32 Felsbrocken-Sprites (4 Größen x 8 Orientierungen), je Leerlauf-Slot ein Schritt, damit die erste Lawine nicht im kalten Code startet.
(function ppFx60Aufwaermen() {
  const los = () => {
    try {
      if (ppFx60Rueckfall() || window.__ppFx60KeinAufwaermen) return;
      const FX = window.PpFx60, schritte = [() => FX.init(), ...FX.warmList()];
      const ric = window.requestIdleCallback || ((f) => setTimeout(f, 60));
      const weiter = () => { const f = schritte.shift(); if (!f) return; try { f(); } catch (e) { /* weg */ } ric(weiter, { timeout: 2500 }); };
      ric(weiter, { timeout: 2500 });
    } catch (e) { /* weg */ }
  };
  setTimeout(() => (window.requestIdleCallback ? window.requestIdleCallback(los, { timeout: 6000 }) : los()), 5500);
})();
